import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';

export interface TableStructure {
  [rowIndex: number]: { [colIndex: number]: string };
}
export interface AllTables {
  [tableIndex: number]: TableStructure;
}

// ===== Хелпер: группировка слов по строкам =====
function groupWordsByRows(words: any[], yTolerance = 15) {
  const rows: Record<number, any[]> = {};
  for (const word of words.sort((a, b) => a.bbox.y0 - b.bbox.y0)) {
    const y = word.bbox.y0;
    const existingRow = Object.keys(rows).find(
      (k) => Math.abs(Number(k) - y) < yTolerance
    );

    if (existingRow) rows[existingRow].push(word);
    else rows[y] = [word];
  }
  return Object.values(rows).map((r) => r.sort((a, b) => a.bbox.x0 - b.bbox.x0));
}

// ===== Основная функция =====
export async function extractStructuredTablesFromCanvas(page: Page): Promise<AllTables> {
  const result: AllTables = {};
  const canvases = await page.locator('canvas');
  const count = await canvases.count();

  if (count === 0) return result;

  // Получаем размеры viewport
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Viewport size not available');
  const { width: vw, height: vh } = viewport;

  for (let i = 0; i < count; i++) {
    const canvas = canvases.nth(i);
    await canvas.scrollIntoViewIfNeeded();

    // Получаем размеры canvas
    const box = await canvas.boundingBox();
    if (!box) continue;
    const { width, height } = box;

    // Вычисляем масштаб, если canvas больше viewport
    const zoomOut = Math.min(1, vw / width, vh / height);

    // Устанавливаем zoom через CSS
    if (zoomOut < 1) {
      await page.evaluate((scale) => {
        document.body.style.transformOrigin = '0 0';
        document.body.style.transform = `scale(${scale})`;
      }, zoomOut);
      await page.waitForTimeout(100); // ждем рендер после зума
    }

    // Скриншот canvas
    const buffer = await canvas.screenshot();

    // Возвращаем масштаб обратно
    if (zoomOut < 1) {
      await page.evaluate(() => {
        document.body.style.transform = '';
      });
    }

    // OCR
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: (info) => console.log(`[Canvas ${i}] ${info.status}`),
    });

    const words = data.words || [];
    if (!words.length) continue;

    // Группировка по строкам
    const rows = groupWordsByRows(words);

    // Преобразуем в словарь словарей
    const table: TableStructure = {};
    rows.forEach((rowWords, rowIndex) => {
      const rowData: Record<number, string> = {};
      rowWords.forEach((w, colIndex) => {
        rowData[colIndex] = w.text.trim();
      });
      table[rowIndex] = rowData;
    });

    result[i] = table;
  }

  return result;
}
