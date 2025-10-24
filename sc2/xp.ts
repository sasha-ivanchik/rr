import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';

export interface TableStructure {
  [rowIndex: number]: { [colIndex: number]: string };
}

export interface AllTables {
  [tableIndex: number]: TableStructure;
}

/**
 * Группировка слов по строкам
 */
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

/**
 * Основная функция: OCR для всех canvas через скриншот родителя
 */
export async function extractStructuredTablesFromCanvas(
  page: Page,
  containerSelector: string
): Promise<AllTables> {
  const result: AllTables = {};
  console.log(`🔹 Поиск контейнера: "${containerSelector}"`);
  const container = await page.$(containerSelector);
  if (!container) {
    console.error('❌ Контейнер не найден');
    return result;
  }

  console.log('📸 Делаем скриншот контейнера без скролла...');
  const buffer = await container.screenshot(); // теперь Playwright сам снимет всё

  console.log('🧠 Запуск OCR...');
  const { data } = await Tesseract.recognize(buffer, 'eng', {
    logger: (info) => console.log(`[OCR] ${info.status}: ${info.progress?.toFixed(2)}`),
  });

  const words = (data.words ?? []).filter((w) => w.text?.trim());
  console.log(`🔠 Распознано ${words.length} слов`);

  if (!words.length) return result;

  const rows = groupWordsByRows(words);
  const table: TableStructure = {};
  rows.forEach((rowWords, rowIndex) => {
    const rowData: Record<number, string> = {};
    rowWords.forEach((w, colIndex) => (rowData[colIndex] = w.text.trim()));
    table[rowIndex] = rowData;
  });

  result[0] = table;
  console.log('✅ Таблица сформирована');
  return result;
}

