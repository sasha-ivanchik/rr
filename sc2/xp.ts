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

  const allCanvases = await page.$$(selector);
  console.log(`🔹 Найдено ${allCanvases.length} канвасов`);

  // Оставляем только видимые
  const visibleCanvases = [];
  for (const [idx, canvas] of allCanvases.entries()) {
    const visible = await canvas.isVisible();
    const box = await canvas.boundingBox();
    if (visible && box) visibleCanvases.push({ canvas, index: idx, box });
  }

  if (visibleCanvases.length === 0) {
    console.warn('⚠️ Нет видимых канвасов — выходим');
    return result;
  }

  const { canvas, index: i, box } = visibleCanvases[0];
  console.log(`\n🧩 Canvas #${i}, исходный размер: ${Math.round(box.width)}x${Math.round(box.height)}`);

  try {
    // 🔹 Увеличение канваса (чтобы OCR лучше видел)
    const scaleCanvas = 2;
    const newWidth = Math.round(box.width * scaleCanvas);
    const newHeight = Math.round(box.height * scaleCanvas);

    await page.evaluate(
      ({ sel, w, h }) => {
        const el = document.querySelector(sel) as HTMLCanvasElement;
        if (el) {
          (el as any).__originalSize = { width: el.width, height: el.height };
          el.width = w;
          el.height = h;
        }
      },
      { sel: selector, w: newWidth, h: newHeight }
    );
    console.log(`🧪 Применён масштаб канваса x${scaleCanvas} → ${newWidth}x${newHeight}`);

    // 🔹 Zoom In всей страницы (для увеличения текста)
    const zoomPage = 2; // попробуй увеличить до 2x
    await page.evaluate(({ scale }) => {
      document.body.style.transformOrigin = '0 0';
      document.body.style.transform = `scale(${scale})`;
    }, { scale: zoomPage });
    console.log(`🔍 Применён zoom страницы x${zoomPage}`);

    await page.waitForTimeout(500); // небольшая пауза для отрисовки

    // 🔹 Скриншот канваса
    const screenshotPath = `./canvas_test_${Date.now()}.png`;
    console.log(`📸 Делаем скриншот → ${screenshotPath}`);
    const buffer = await canvas.screenshot();
    fs.writeFileSync(screenshotPath, buffer);

    // 🔹 Сброс zoom страницы
    await page.evaluate(() => {
      document.body.style.transform = '';
    });

    // 🔹 Восстановление исходного размера канваса
    await page.evaluate(({ sel }) => {
      const el = document.querySelector(sel) as HTMLCanvasElement;
      if (el && (el as any).__originalSize) {
        el.width = (el as any).__originalSize.width;
        el.height = (el as any).__originalSize.height;
      }
    }, { sel: selector });

    // 🔹 OCR
    console.log(`🧠 OCR через Tesseract...`);
    const { data } = await Tesseract.recognize(screenshotPath, 'eng', {
      langPath: './tessdata',
      logger: (info) => {
        if (info.status)
          console.log(`[OCR] ${info.status}: ${(info.progress * 100).toFixed(1)}%`);
      },
    });

    const words = (data.words ?? []).filter((w) => w.text?.trim());
    console.log(`🔠 OCR нашёл ${words.length} слов`);

    if (!words.length) console.warn('⚠️ Текст не распознан');
    else console.log('🧾 Пример слов:', words.slice(0, 10).map((w) => w.text));

    return result;
  } catch (err) {
    console.error(`❌ Ошибка при обработке canvas #${i}:`, err);
    return result;
  }
}
