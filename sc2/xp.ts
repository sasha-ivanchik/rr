import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';
import path from 'path';
import fs from 'fs';

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

/** Основная функция с zoom-in через viewport */
export async function extractStructuredTablesFromCanvas(
  page: Page,
  zoomFactor = 2 // коэффициент увеличения
): Promise<AllTables> {
  const result: AllTables = {};

  try {
    // 1️⃣ Узнаём текущий размер viewport
    const viewport = page.viewportSize() || { width: 1280, height: 720 };
    console.log(`🔹 Текущий viewport: ${viewport.width}x${viewport.height}`);

    // 2️⃣ Устанавливаем увеличенный viewport
    const zoomWidth = Math.round(viewport.width / zoomFactor);
    const zoomHeight = Math.round(viewport.height / zoomFactor);
    console.log(`🔍 Устанавливаем zoom-in viewport: ${zoomWidth}x${zoomHeight}`);
    await page.setViewportSize({ width: zoomWidth, height: zoomHeight });
    await page.waitForTimeout(200);

    // 3️⃣ Скриншот всей страницы
    const screenshotPath = path.resolve(process.cwd(), 'page_screenshot.png');
    const buffer = await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Скриншот сохранён: ${screenshotPath}, размер: ${buffer.length} байт`);

    // 4️⃣ Восстанавливаем исходный viewport
    await page.setViewportSize(viewport);

    // 5️⃣ OCR через Tesseract.js
    console.log('🧠 Запуск OCR через Tesseract.js...');
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      langPath: path.resolve(process.cwd(), 'tessdata'),
      gzip: false,
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
  } catch (err) {
    console.error('❌ Ошибка в extractStructuredTablesFromCanvas:', err);
  }

  return result;
}
