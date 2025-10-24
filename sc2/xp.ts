import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';
import path from 'path';

export interface TableStructure {
  [rowIndex: number]: { [colIndex: number]: string };
}

export interface AllTables {
  [tableIndex: number]: TableStructure;
}

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

export async function extractStructuredTablesFromCanvas(
  page: Page,
  zoomScale = 2,
  screenshotName = 'page_screenshot.png'
): Promise<AllTables> {
  const result: AllTables = {};

  try {
    console.log(`🔍 Применяем zoom-in через CSS transform x${zoomScale}...`);
    await page.evaluate((scale) => {
      document.body.style.transformOrigin = '0 0';
      document.body.style.transform = `scale(${scale})`;
    }, zoomScale);

    // Ждём, чтобы браузер успел отрисовать увеличенное содержимое
    await page.waitForTimeout(500); 

    console.log('📸 Делаем скриншот всей страницы...');
    const screenshotPath = path.resolve(process.cwd(), screenshotName);
    const buffer = await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Скриншот сохранён: ${screenshotPath}, размер: ${buffer.length} байт`);

    // OCR
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

    // Сброс transform после скриншота и OCR
    await page.evaluate(() => {
      document.body.style.transform = '';
    });

  } catch (err) {
    console.error('❌ Ошибка в extractStructuredTablesFromCanvas:', err);
  }

  return result;
}
