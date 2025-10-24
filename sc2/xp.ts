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

  // 🔹 Оставляем только видимые
  const visibleCanvases = [];
  for (const [idx, canvas] of allCanvases.entries()) {
    const visible = await canvas.isVisible();
    const box = await canvas.boundingBox();
    if (visible && box) visibleCanvases.push({ canvas, index: idx, box });
  }

  console.log(`✅ Найдено ${visibleCanvases.length} видимых канвасов`);
  if (visibleCanvases.length === 0) {
    console.warn('⚠️ Нет видимых канвасов — выходим');
    return result;
  }

  // 🧩 Работаем с первым видимым
  const { canvas, index: i, box } = visibleCanvases[0];
  console.log(`\n🧩 Тест: canvas #${i}, размер: ${Math.round(box.width)}x${Math.round(box.height)}`);

  try {
    // 🔹 Увеличиваем сам канвас, а не body
    const zoom = 2.0;
    console.log(`🔍 Применяем зум: ${zoom} и фильтры контраста`);

    await page.evaluate(
      ({ sel, scale }) => {
        const el = document.querySelector(sel) as HTMLElement;
        if (el) {
          (el as any).__originalStyle = {
            transform: el.style.transform,
            transformOrigin: el.style.transformOrigin,
            filter: el.style.filter,
          };
          el.style.transformOrigin = '0 0';
          el.style.transform = `scale(${scale})`;
          el.style.filter = 'contrast(180%) brightness(120%) grayscale(100%)';
        }
      },
      { sel: selector, scale: zoom }
    );

    await page.waitForTimeout(800);

    // 🔹 Скриншот
    const screenshotPath = `./canvas_test_${Date.now()}.png`;
    console.log(`📸 Делаем скриншот → ${screenshotPath}`);
    const buffer = await canvas.screenshot();
    fs.writeFileSync(screenshotPath, buffer);
    console.log(`💾 Скриншот сохранён: ${screenshotPath}`);

    // 🔹 Сброс трансформаций и фильтров
    await page.evaluate(({ sel }) => {
      const el = document.querySelector(sel) as HTMLElement;
      if (el && (el as any).__originalStyle) {
        const s = (el as any).__originalStyle;
        el.style.transform = s.transform;
        el.style.transformOrigin = s.transformOrigin;
        el.style.filter = s.filter;
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
