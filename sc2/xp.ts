import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';

export interface TableStructure {
  [rowIndex: number]: { [colIndex: number]: string };
}

export interface AllTables {
  [tableIndex: number]: TableStructure;
}

/** Группировка слов по строкам */
function groupWordsByRows(
  words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[],
  yTolerance = 15
) {
  console.log(`📊 Группировка ${words.length} слов по строкам...`);
  const rows: Record<number, typeof words> = {};

  for (const word of words.sort((a, b) => a.bbox.y0 - b.bbox.y0)) {
    const y = word.bbox.y0;
    const existingRow = Object.keys(rows).find((k) => Math.abs(Number(k) - y) < yTolerance);
    if (existingRow) rows[existingRow].push(word);
    else rows[y] = [word];
  }

  const grouped = Object.values(rows).map((r) => r.sort((a, b) => a.bbox.x0 - b.bbox.x0));
  console.log(`✅ Получено ${grouped.length} строк после группировки`);
  return grouped;
}

/** Основная функция */
export async function extractStructuredTablesFromCanvas(
  page: Page,
  canvasSelector: string
): Promise<AllTables> {
  const result: AllTables = {};
  console.log(`🔹 Поиск canvas: "${canvasSelector}"`);
  const canvas = await page.$(canvasSelector);
  if (!canvas) {
    console.error('❌ Canvas не найден');
    return result;
  }

  // Получаем bounding box всего canvas
  const box = await canvas.boundingBox();
  if (!box) {
    console.error('❌ Не удалось получить boundingBox canvas');
    return result;
  }

  console.log(`📏 Размер canvas: width=${box.width}, height=${box.height}`);

  // Находим реальный контент на canvas через evaluate
  const contentBox = await page.evaluate((sel) => {
    const c = document.querySelector(sel) as HTMLCanvasElement;
    if (!c) return null;
    const ctx = c.getContext('2d');
    if (!ctx) return null;

    const w = c.width;
    const h = c.height;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    const data = ctx.getImageData(0, 0, w, h).data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];

        // Считаем "контентом" все пиксели, которые не белые или почти белые
        if (!(r > 240 && g > 240 && b > 240 && a > 240)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (minX > maxX || minY > maxY) return null;
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }, canvasSelector);

  if (!contentBox) {
    console.warn('⚠️ Не найден контент на canvas, используем весь canvas');
    contentBox = { x: 0, y: 0, width: box.width, height: box.height };
  }

  console.log(`🔳 Контент bounding box:`, contentBox);

  // Скриншот только области с контентом
  const buffer = await canvas.screenshot({ clip: contentBox });

  console.log('🧠 Запуск OCR через Tesseract.js...');
  const { data } = await Tesseract.recognize(buffer, 'eng', {
    logger: (info) => console.log(`[OCR] ${info.status}: ${info.progress?.toFixed(2)}`),
  });

  const words = (data.words ?? []).filter((w) => w.text?.trim());
  console.log(`🔠 OCR распознал ${words.length} слов`);

  if (!words.length) return result;

  const rows = groupWordsByRows(words);

  const table: TableStructure = {};
  rows.forEach((rowWords, rowIndex) => {
    const rowData: Record<number, string> = {};
    rowWords.forEach((w, colIndex) => (rowData[colIndex] = w.text.trim()));
    table[rowIndex] = rowData;
  });

  result[0] = table;
  console.log('✅ Таблица сформирована успешно');

  return result;
}
