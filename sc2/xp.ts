import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';

export interface TableStructure {
  [rowIndex: number]: { [colIndex: number]: string };
}

export interface AllTables {
  [tableIndex: number]: TableStructure;
}

// ===== Группировка слов по строкам =====
function groupWordsByRows(words: {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}[], yTolerance = 15) {
  const rows: Record<number, typeof words> = {};

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
export async function extractStructuredTablesFromCanvas(
  page: Page,
  canvasClass?: string // опциональный класс для фильтрации
): Promise<AllTables> {
  const result: AllTables = {};

  const selector = canvasClass ? `canvas.${canvasClass}` : 'canvas';
  console.log(`🔹 Using selector: "${selector}"`);

  const canvases = await page.locator(selector);
  const count = await canvases.count();
  console.log(`🔹 Found ${count} canvas element(s) matching selector`);

  if (count === 0) return result;

  for (let i = 0; i < count; i++) {
    console.log(`\n--- Processing canvas #${i} ---`);
    const canvas = canvases.nth(i);
    await canvas.scrollIntoViewIfNeeded();

    const box = await canvas.boundingBox();
    if (!box) {
      console.log(`⚠️ Canvas #${i} bounding box not found`);
      continue;
    }
    const { width, height } = box;
    console.log(`Canvas #${i} size: width=${width}, height=${height}`);

    const { width: vw, height: vh } = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    console.log(`Viewport size: width=${vw}, height=${vh}`);

    const zoomOut = Math.min(1, vw / width, vh / height);
    console.log(`Calculated zoom scale: ${zoomOut}`);

    if (zoomOut < 1) {
      console.log(`Applying zoom ${zoomOut} to fit canvas #${i}`);
      await page.evaluate((scale) => {
        document.body.style.transformOrigin = '0 0';
        document.body.style.transform = `scale(${scale})`;
      }, zoomOut);
      await page.waitForTimeout(100);
    }

    console.log(`📸 Taking screenshot of canvas #${i}`);
    const buffer = await canvas.screenshot();

    if (zoomOut < 1) {
      await page.evaluate(() => {
        document.body.style.transform = '';
      });
    }

    console.log(`🧠 Running OCR on canvas #${i}...`);
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: (info) => console.log(`[Canvas ${i} OCR] ${info.status}: ${info.progress?.toFixed(2)}`),
    });

    const words = (data.words ?? []) as {
      text: string;
      bbox: { x0: number; y0: number; x1: number; y1: number };
    }[];
    console.log(`Canvas #${i} OCR found ${words.length} words`);
    if (!words.length) continue;

    const rows = groupWordsByRows(words);
    console.log(`Canvas #${i} grouped into ${rows.length} row(s)`);

    const table: TableStructure = {};
    rows.forEach((rowWords, rowIndex) => {
      const rowData: Record<number, string> = {};
      rowWords.forEach((w, colIndex) => {
        rowData[colIndex] = w.text.trim();
      });
      console.log(`Row ${rowIndex}:`, rowData);
      table[rowIndex] = rowData;
    });

    result[i] = table;
    console.log(`✅ Finished canvas #${i}`);
  }

  console.log(`\n🔹 Finished processing all canvas elements`);
  return result;
}
