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
 * Основная функция: tiled screenshot контейнера + OCR
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

  const box = await container.boundingBox();
  if (!box) {
    console.error('❌ Не удалось получить boundingBox контейнера');
    return result;
  }

  const viewport = page.viewportSize();
  const tileWidth = viewport?.width || 800;
  const tileHeight = viewport?.height || 600;

  console.log(`📏 Размер контейнера: width=${box.width}, height=${box.height}`);
  console.log(`🔳 Размер тайла: width=${tileWidth}, height=${tileHeight}`);

  const tiles: Buffer[] = [];

  for (let y = 0; y < box.height; y += tileHeight) {
    for (let x = 0; x < box.width; x += tileWidth) {
      console.log(`📌 Скриншот тайла x=${x}, y=${y}`);

      await page.evaluate(
        (sel, scrollX, scrollY) => {
          const el = document.querySelector(sel) as HTMLElement;
          if (el) {
            el.scrollLeft = scrollX;
            el.scrollTop = scrollY;
          }
        },
        containerSelector,
        x,
        y
      );

      await page.waitForTimeout(100); // ждем, пока canvas отрисуется

      const tileBuffer = await container.screenshot();
      tiles.push(tileBuffer);
    }
  }

  console.log(`🧩 Объединяем ${tiles.length} тайлов в одно изображение`);

  // Объединяем тайлы через canvas в браузере
  const mergedBase64 = await page.evaluate(
    async (selector, tileData: string[], tileWidth: number, tileHeight: number, totalWidth: number, totalHeight: number) => {
      const merged = document.createElement('canvas');
      merged.width = totalWidth;
      merged.height = totalHeight;
      const ctx = merged.getContext('2d');
      if (!ctx) return null;

      for (let i = 0; i < tileData.length; i++) {
        const img = new Image();
        img.src = tileData[i];
        await new Promise((res) => { img.onload = res; });
        const col = i % Math.ceil(totalWidth / tileWidth);
        const row = Math.floor(i / Math.ceil(totalWidth / tileWidth));
        ctx.drawImage(img, col * tileWidth, row * tileHeight);
      }

      return merged.toDataURL('image/png');
    },
    containerSelector,
    tiles.map((b) => 'data:image/png;base64,' + b.toString('base64')),
    tileWidth,
    tileHeight,
    box.width,
    box.height
  );

  if (!mergedBase64) {
    console.error('❌ Не удалось объединить тайлы');
    return result;
  }

  const buffer = Buffer.from(mergedBase64.split(',')[1], 'base64');

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
