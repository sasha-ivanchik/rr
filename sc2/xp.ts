import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';

export interface TableStructure {
  [rowIndex: number]: { [colIndex: number]: string };
}

export interface AllTables {
  [tableIndex: number]: TableStructure;
}

function timestamp() {
  return new Date().toISOString().split('T')[1].split('.')[0];
}

function groupWordsByRows(
  words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[],
  yTolerance = 15
) {
  console.log(`[${timestamp()}] 📊 Группировка ${words.length} слов по строкам`);
  const rows: Record<number, typeof words> = {};

  for (const word of words.sort((a, b) => a.bbox.y0 - b.bbox.y0)) {
    const y = word.bbox.y0;
    const existingRow = Object.keys(rows).find(
      (k) => Math.abs(Number(k) - y) < yTolerance
    );
    if (existingRow) rows[existingRow].push(word);
    else rows[y] = [word];
  }

  const grouped = Object.values(rows).map((r) =>
    r.sort((a, b) => a.bbox.x0 - b.bbox.x0)
  );
  console.log(`[${timestamp()}] ✅ Получено ${grouped.length} строк`);
  return grouped;
}

/**
 * Принудительный timeout для асинхронных задач (например, OCR)
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`⏰ Timeout: ${message}`)), ms);
  });
  const result = await Promise.race([promise, timeoutPromise]);
  clearTimeout(timeoutId);
  return result;
}

export async function extractStructuredTablesFromCanvas(
  page: Page,
  canvasClass?: string
): Promise<AllTables> {
  const result: AllTables = {};
  const selector = canvasClass ? `canvas.${canvasClass}` : 'canvas';
  console.log(`[${timestamp()}] 🔹 Используется селектор: "${selector}"`);

  const canvases = page.locator(selector);
  const count = await canvases.count();
  console.log(`[${timestamp()}] 🔹 Найдено ${count} канвасов`);

  if (count === 0) {
    console.warn(`[${timestamp()}] ⚠️ Канвасы не найдены. Сохраняем fullPage...`);
    const file = `fullpage_${Date.now()}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(`[${timestamp()}] ✅ Скриншот страницы сохранён: ${file}`);
    return result;
  }

  for (let i = 0; i < count; i++) {
    console.log(`\n[${timestamp()}] 🧩 Обработка canvas #${i}`);
    const canvas = canvases.nth(i);

    try {
      const visible = await canvas.isVisible();
      if (!visible) {
        console.warn(`[${timestamp()}] ⚠️ Canvas #${i} невидим, скроллим...`);
        await canvas.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      }

      const box = await canvas.boundingBox();
      if (!box) {
        console.warn(`[${timestamp()}] ⚠️ Canvas #${i}: bounding box отсутствует — пробуем fullPage`);
        const file = `canvas_${i}_fallback_${Date.now()}.png`;
        await page.screenshot({ path: file, fullPage: true });
        console.log(`[${timestamp()}] 📸 FullPage fallback сохранён: ${file}`);
        continue;
      }

      const { width, height } = box;
      console.log(`[${timestamp()}] 📏 Размер: ${width.toFixed(1)}x${height.toFixed(1)}`);

      // Проверяем, не превышает ли canvas вьюпорт
      const { width: vw, height: vh } = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }));

      const zoomOut = Math.min(1, vw / width, vh / height);
      console.log(`[${timestamp()}] 🔍 Zoom scale: ${zoomOut.toFixed(2)}`);

      if (zoomOut < 1) {
        await page.evaluate((scale) => {
          document.body.style.transformOrigin = '0 0';
          document.body.style.transform = `scale(${scale})`;
        }, zoomOut);
        await page.waitForTimeout(200);
      }

      console.log(`[${timestamp()}] 📸 Делаем screenshot canvas #${i}...`);
      let buffer: Buffer | undefined;
      try {
        buffer = await withTimeout(canvas.screenshot(), 15000, 'canvas.screenshot() timeout');
      } catch (err) {
        console.error(`[${timestamp()}] ❌ Ошибка screenshot: ${err}`);
        continue;
      }

      if (zoomOut < 1) {
        await page.evaluate(() => {
          document.body.style.transform = '';
        });
      }

      const fileName = path.resolve(`canvas_${i}_${Date.now()}.png`);
      fs.writeFileSync(fileName, buffer);
      console.log(`[${timestamp()}] ✅ Скриншот сохранён: ${fileName}`);

      console.log(`[${timestamp()}] 🧠 Запуск OCR через Tesseract`);
      const { data } = await withTimeout(
        Tesseract.recognize(buffer, 'eng', {
          logger: (info) =>
            console.log(`[${timestamp()}] [Canvas ${i} OCR] ${info.status}: ${(info.progress ?? 0).toFixed(2)}`),
        }),
        120000, // OCR timeout 2 минуты
        'Tesseract.recognize timeout'
      );

      const words = (data.words ?? []).filter((w) => w.text?.trim());
      console.log(`[${timestamp()}] 🔠 OCR нашёл ${words.length} слов`);

      if (!words.length) continue;
      const rows = groupWordsByRows(words);
      const table: TableStructure = {};

      rows.forEach((rowWords, rowIndex) => {
        const rowData: Record<number, string> = {};
        rowWords.forEach((w, colIndex) => {
          rowData[colIndex] = w.text.trim();
        });
        table[rowIndex] = rowData;
        console.log(`[${timestamp()}] 🧾 Row ${rowIndex}:`, rowData);
      });

      result[i] = table;
      console.log(`[${timestamp()}] ✅ Canvas #${i} завершён (строк: ${rows.length})`);
    } catch (err) {
      console.error(`[${timestamp()}] ❌ Ошибка при обработке canvas #${i}:`, err);
    }
  }

  console.log(`\n[${timestamp()}] 🏁 Все канвасы обработаны`);
  return result;
}
