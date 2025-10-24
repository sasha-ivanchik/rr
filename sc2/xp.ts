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

  // Фильтруем только видимые
  const visibleCanvases = [];
  for (const [idx, canvas] of allCanvases.entries()) {
    const box = await canvas.boundingBox();
    if (!box) continue;
    const visible = await canvas.isVisible();
    if (visible) {
      visibleCanvases.push({ canvas, index: idx, box });
    }
  }

  console.log(`✅ Найдено ${visibleCanvases.length} видимых канвасов`);
  if (visibleCanvases.length === 0) {
    console.warn('⚠️ Нет видимых канвасов — выходим');
    return result;
  }

  // Работаем с первым видимым канвасом (тестовый)
  const { canvas, index: i, box } = visibleCanvases[0];
  console.log(`\n🧩 Тест: canvas #${i}, размер: ${Math.round(box.width)}x${Math.round(box.height)}`);

  try {
    // 🔹 Тестовый размер
    const testWidth = Math.min(1200, Math.round(box.width * 1.5));
    const testHeight = Math.min(900, Math.round(box.height * 1.5));

    await page.evaluate(({ sel, w, h }) => {
      const el = document.querySelector(sel) as HTMLCanvasElement;
      if (el) {
        (el as any).__originalStyle = el.getAttribute('style') || '';
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      }
    }, { sel: selector, w: testWidth, h: testHeight });
    console.log(`🧪 Применён тестовый размер: ${testWidth}x${testHeight}`);

    // 🔹 Zoom In
    const zoom = 2.0;
    await page.evaluate(({ scale }) => {
      document.body.style.transformOrigin = '0 0';
      document.body.style.transform = `scale(${scale})`;
    }, { scale: zoom });
    console.log(`🔍 Применён зум: ${zoom}`);

    await page.waitForTimeout(500);

    // 🔹 Скриншот
    const screenshotPath = `./canvas_test_${Date.now()}.png`;
    console.log(`📸 Делаем скриншот → ${screenshotPath}`);

    const buffer = await canvas.screenshot();
    fs.writeFileSync(screenshotPath, buffer);

    // 🔹 Сброс трансформации
    await page.evaluate(() => {
      document.body.style.transform = '';
    });

    // 🔹 Возврат оригинального стиля
    await page.evaluate(({ sel }) => {
      const el = document.querySelector(sel) as HTMLCanvasElement;
      if (el && (el as any).__originalStyle !== undefined) {
        el.setAttribute('style', (el as any).__originalStyle);
      }
    }, { sel: selector });

    // 🔹 OCR
    console.log(`🧠 OCR через Tesseract...`);
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      langPath: './tessdata',
      logger: (info) => {
        if (info.status) console.log(`[OCR] ${info.status}: ${(info.progress * 100).toFixed(1)}%`);
      },
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
  } catch (err) {
    console.error(`❌ Ошибка при обработке canvas #${i}:`, err);
    return result;
  }
}
