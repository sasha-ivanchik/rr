import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';
import fs from 'fs';

export interface TableStructure {
  [rowIndex: number]: { [colIndex: number]: string };
}

export interface AllTables {
  [tableIndex: number]: TableStructure;
}

export async function extractStructuredTablesFromCanvas(
  page: Page,
  canvasClass?: string
): Promise<AllTables> {
  const result: AllTables = {};
  const selector = canvasClass ? `canvas.${canvasClass}` : 'canvas';
  console.log(`🔹 Используется селектор: "${selector}"`);

  const canvases = page.locator(selector);
  const count = await canvases.count();
  console.log(`🔹 Найдено ${count} канвасов`);

  if (count === 0) {
    console.warn('⚠️ Канвасы не найдены');
    return result;
  }

  const i = 0; // тестируем первый канвас
  console.log(`\n🧩 Тест: canvas #${i}`);

  const canvas = canvases.nth(i);
  await canvas.scrollIntoViewIfNeeded();

  const box = await canvas.boundingBox();
  if (!box) {
    console.warn('⚠️ boundingBox не найден');
    return result;
  }

  console.log(`📏 Исходный размер canvas: ${box.width}x${box.height}`);

  // 🔹 Устанавливаем временный размер (тестовый)
  const testWidth = 1000;
  const testHeight = 800;

  await page.evaluate(
    (sel, w, h) => {
      const el = document.querySelector(sel) as HTMLCanvasElement;
      if (el) {
        (el as any).__originalStyle = el.getAttribute('style') || '';
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      }
    },
    selector,
    testWidth,
    testHeight
  );
  console.log(`🧪 Применён тестовый размер: ${testWidth}x${testHeight}`);

  // 🔹 Зум ин
  const zoom = 1.8;
  await page.evaluate((scale) => {
    document.body.style.transformOrigin = '0 0';
    document.body.style.transform = `scale(${scale})`;
  }, zoom);
  console.log(`🔍 Применён зум: ${zoom}`);

  await page.waitForTimeout(300);

  // 🔹 Скриншот
  const screenshotPath = `./canvas_test_${Date.now()}.png`;
  console.log(`📸 Делаем скриншот → ${screenshotPath}`);
  const buffer = await canvas.screenshot();
  fs.writeFileSync(screenshotPath, buffer);

  // 🔹 Возврат zoom
  await page.evaluate(() => {
    document.body.style.transform = '';
  });

  // 🔹 Возврат оригинальных размеров
  await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLCanvasElement;
    if (el && (el as any).__originalStyle !== undefined) {
      el.setAttribute('style', (el as any).__originalStyle);
    }
  }, selector);

  console.log(`🧠 OCR через Tesseract...`);
  const { data } = await Tesseract.recognize(buffer, 'eng', {
    langPath: './tessdata',
    logger: (info) =>
      console.log(`[OCR] ${info.status}: ${(info.progress * 100).toFixed(1)}%`),
  });

  const words = (data.words ?? []).filter((w) => w.text?.trim());
  console.log(`🔠 OCR нашёл ${words.length} слов`);

  if (!words.length) {
    console.warn('⚠️ Текст не распознан');
  } else {
    console.log('🧾 Пример слов:', words.slice(0, 10).map((w) => w.text));
  }

  console.log('🏁 Готово');
  return result;
}
