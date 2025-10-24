import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';
import path from 'path';

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

  // Получаем размеры canvas напрямую через JS
  const contentBox = await page.evaluate((sel) => {
    const c = document.querySelector(sel) as HTMLCanvasElement;
    if (!c) return null;
    return { width: c.width, height: c.height };
  }, canvasSelector);

  if (!contentBox) {
    console.error('❌ Не удалось получить размеры canvas');
    return result;
  }

  if (contentBox.width < 10 || contentBox.height < 10) {
    console.warn('⚠️ Canvas слишком мал для OCR, пропускаем');
    return result;
  }

  console.log(`📏 Canvas size: width=${contentBox.width}, height=${contentBox.height}`);

  console.log('📸 Скриншот всего canvas...');
  const buffer = await canvas.screenshot();

  console.log('🧠 Запуск OCR через Tesseract.js (локальная модель)...');
  const { data } = await Tesseract.recognize(buffer, 'eng', {
    langPath: path.resolve(process.cwd(), 'tessdata'), // папка с eng.traineddata
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
