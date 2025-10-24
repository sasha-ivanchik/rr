import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';

export interface TableStructure {
  [rowIndex: number]: { [colIndex: number]: string };
}

export interface AllTables {
  [tableIndex: number]: TableStructure;
}

/**
 * Группировка слов по строкам с доп. логами
 */
function groupWordsByRows(
  words: {
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }[],
  yTolerance = 15
) {
  console.log(`📊 Группировка ${words.length} слов по строкам...`);
  const rows: Record<number, typeof words> = {};

  for (const word of words.sort((a, b) => a.bbox.y0 - b.bbox.y0)) {
    const y = word.bbox.y0;
    const existingRow = Object.keys(rows).find(
      (k) => Math.abs(Number(k) - y) < yTolerance
    );

    if (existingRow) {
      rows[existingRow].push(word);
    } else {
      rows[y] = [word];
    }
  }

  const grouped = Object.values(rows).map((r) => r.sort((a, b) => a.bbox.x0 - b.bbox.x0));
  console.log(`✅ Получено ${grouped.length} строк после группировки`);
  return grouped;
}

/**
 * Основная функция
 */
export async function extractStructuredTablesFromCanvas(
  page: Page,
  canvasClass?: string
): Promise<AllTables> {
  const result: AllTables = {};
  const selector = canvasClass ? `canvas.${canvasClass}` : 'canvas';
  console.log(`🔹 Используется селектор: "${selector}"`);

  const canvases = page.locator(selector);
  const count = await canvases.count();
  console.log(`🔹 Найдено ${count} канвасов по селектору`);

  if (count === 0) {
    console.warn('⚠️ Канвасы не найдены, выходим.');
    return result;
  }

  for (let i = 0; i < count; i++) {
    console.log(`\n🧩 Обработка canvas #${i}`);
    const canvas = canvases.nth(i);

    try {
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      if (!box) {
        console.warn(`⚠️ Canvas #${i}: bounding box не найден`);
        continue;
      }

      const { width, height } = box;
      console.log(`📏 Размер: ${width}x${height}`);

      // Получаем размеры окна для авто-зум
      const { width: vw, height: vh } = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }));

      const zoomOut = Math.min(1, vw / width, vh / height);
      console.log(`🔍 Рассчитанный zoom scale: ${zoomOut.toFixed(2)}`);

      if (zoomOut < 1) {
        console.log(`📉 Применяем zoom: ${zoomOut}`);
        await page.evaluate((scale) => {
          document.body.style.transformOrigin = '0 0';
          document.body.style.transform = `scale(${scale})`;
        }, zoomOut);
        await page.waitForTimeout(150);
      }

      console.log(`📸 Скриншот canvas #${i}...`);
      const buffer = await canvas.screenshot();

      if (zoomOut < 1) {
        await page.evaluate(() => {
          document.body.style.transform = '';
        });
      }

      console.log(`🧠 OCR через Tesseract для canvas #${i}...`);
      const { data } = await Tesseract.recognize(buffer, 'eng', {
        logger: (info) =>
          console.log(`[Canvas ${i} OCR] ${info.status}: ${info.progress?.toFixed(2)}`),
      });

      const words = (data.words ?? []).filter((w) => w.text?.trim());
      console.log(`🔠 Распознано ${words.length} слов`);

      if (words.length === 0) {
        console.warn(`⚠️ Canvas #${i}: OCR не нашёл текста`);
        continue;
      }

      const rows = groupWordsByRows(words);
      console.log(`📋 Canvas #${i}: ${rows.length} строк после группировки`);

      const table: TableStructure = {};
      rows.forEach((rowWords, rowIndex) => {
        const rowData: Record<number, string> = {};
        rowWords.forEach((w, colIndex) => {
          rowData[colIndex] = w.text.trim();
        });
        console.log(`🧾 Row ${rowIndex}:`, rowData);
        table[rowIndex] = rowData;
      });

      result[i] = table;
      console.log(`✅ Canvas #${i} готов (строк: ${Object.keys(table).length})`);
    } catch (err) {
      console.error(`❌ Ошибка при обработке canvas #${i}:`, err);
    }
  }

  console.log(`\n🏁 Все канвасы обработаны`);
  return result;
}
