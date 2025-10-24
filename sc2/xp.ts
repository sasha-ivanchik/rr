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
    console.error(`❌ Контейнер "${containerSelector}" не найден`);
    return result;
  }

  console.log(`🔹 Скроллим контейнер в видимую область...`);
  await container.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Получаем размеры контейнера
  const box = await container.boundingBox();
  if (!box) {
    console.error('❌ Не удалось получить boundingBox контейнера');
    return result;
  }

  console.log(`📏 Размер контейнера: width=${box.width.toFixed(1)}, height=${box.height.toFixed(1)}`);

  // Проверяем размер вьюпорта
  const viewport = page.viewportSize();
  if (!viewport) {
    console.warn('⚠️ Viewport недоступен, может быть слишком большой контейнер');
  }

  // Применяем зум-аут, если контейнер больше экрана
  let zoomOut = 1;
  if (viewport) {
    zoomOut = Math.min(1, viewport.width / box.width, viewport.height / box.height);
    if (zoomOut < 1) {
      console.log(`🔍 Применяем zoom-аут: ${zoomOut.toFixed(2)}`);
      await page.evaluate((scale) => {
        document.body.style.transformOrigin = '0 0';
        document.body.style.transform = `scale(${scale})`;
      }, zoomOut);
      await page.waitForTimeout(500);
    }
  }

  console.log('📸 Делаем скриншот контейнера...');
  const buffer = await container.screenshot();

  // Возвращаем масштаб к нормальному
  if (zoomOut < 1) {
    await page.evaluate(() => {
      document.body.style.transform = '';
    });
  }

  console.log('🧠 Запуск OCR через Tesseract.js...');
  const { data } = await Tesseract.recognize(buffer, 'eng', {
    logger: (info) => console.log(`[OCR] ${info.status}: ${info.progress?.toFixed(2)}`),
  });

  const words = (data.words ?? []).filter((w) => w.text?.trim());
  console.log(`🔠 OCR распознал ${words.length} слов`);

  if (!words.length) {
    console.warn('⚠️ OCR не нашёл текста в контейнере');
    return result;
  }

  const rows = groupWordsByRows(words);
  console.log(`📋 Получено ${rows.length} строк после группировки`);

  const table: TableStructure = {};
  rows.forEach((rowWords, rowIndex) => {
    const rowData: Record<number, string> = {};
    rowWords.forEach((w, colIndex) => {
      rowData[colIndex] = w.text.trim();
    });
    table[rowIndex] = rowData;
  });

  result[0] = table;
  console.log('✅ Таблица сформирована успешно');

  return result;
}
