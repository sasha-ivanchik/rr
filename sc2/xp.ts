import { Page } from 'playwright';
import Tesseract from 'tesseract.js';

/**
 * Распознаёт текст с канвасов (по заданному классу) и возвращает словарь словарей
 */
export async function extractCanvasTables(page: Page, canvasClass: string) {
  console.log(`🚀 Начинаем обработку канвасов с классом "${canvasClass}"`);

  // Получаем все канвасы с нужным классом
  const canvases = await page.$$('canvas');
  console.log(`🔍 Найдено ${canvases.length} канвасов на странице`);

  // Фильтруем по классу
  const filteredCanvases = [];
  for (const [i, canvas] of canvases.entries()) {
    const cls = await canvas.getAttribute('class');
    if (cls?.includes(canvasClass)) {
      filteredCanvases.push(canvas);
      console.log(`✅ Canvas #${i} (${cls}) подходит под фильтр`);
    } else {
      console.log(`⏭️ Canvas #${i} (${cls}) пропущен`);
    }
  }

  if (filteredCanvases.length === 0) {
    console.warn(`⚠️ Нет канвасов с классом "${canvasClass}"`);
    return {};
  }

  // Получаем размеры окна (для авто-зум)
  const { width: vw, height: vh } = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const result: Record<number, Record<number, Record<number, string>>> = {};

  // Защита от зависания
  async function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`⏰ Timeout: ${msg}`)), ms)
      ),
    ]);
  }

  // Обрабатываем каждый canvas
  for (const [index, canvas] of filteredCanvases.entries()) {
    console.log(`\n🧩 Processing canvas #${index}`);

    try {
      // Проверяем, что элемент видим
      const isVisible = await canvas.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0'
        );
      });
      console.log(`👁️ Canvas #${index} visible: ${isVisible}`);
      if (!isVisible) continue;

      // Получаем размеры
      const box = await canvas.boundingBox();
      if (!box) {
        console.warn(`⚠️ Canvas #${index} не имеет boundingBox`);
        continue;
      }

      const { width, height } = box;
      console.log(`📏 Canvas #${index} size: ${width}x${height}`);

      // Зум-аут при необходимости
      const zoomOut = Math.min(1, vw / width, vh / height);
      if (zoomOut < 1) {
        console.log(`🔍 Применяем zoom-out ${zoomOut.toFixed(2)}`);
        await page.evaluate((scale) => {
          document.body.style.transformOrigin = '0 0';
          document.body.style.transform = `scale(${scale})`;
        }, zoomOut);
        await page.waitForTimeout(200);
      }

      // Скроллим к элементу
      await canvas.scrollIntoViewIfNeeded();
      console.log(`📜 Canvas #${index} прокручен в зону видимости`);

      // Скриншот
      console.log(`📸 Делаем скриншот canvas #${index}`);
      const buffer = await page.screenshot({
        clip: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
      });
      console.log(`✅ Скриншот готов (${buffer.byteLength} байт)`);

      // OCR с таймаутом
      console.log(`🧠 Запуск OCR для canvas #${index}`);
      const { data } = await withTimeout(
        Tesseract.recognize(buffer, 'eng', {
          logger: (info) =>
            console.log(`[Canvas ${index} OCR] ${info.status}: ${info.progress?.toFixed(2)}`),
        }),
        90000,
        `OCR for canvas #${index} took too long`
      );

      const words = data.words || [];
      console.log(`🔤 Распознано слов: ${words.length}`);

      // Преобразуем результат в словарь словарей
      const tableDict: Record<number, Record<number, string>> = {};
      let currentRow = 0;
      let currentY = null as number | null;

      for (const w of words) {
        if (!w.text?.trim()) continue;

        if (currentY === null) {
          currentY = w.bbox.y0;
        } else if (Math.abs(w.bbox.y0 - currentY) > 20) {
          currentRow++;
          currentY = w.bbox.y0;
        }

        if (!tableDict[currentRow]) tableDict[currentRow] = {};
        const colIndex = Object.keys(tableDict[currentRow]).length;
        tableDict[currentRow][colIndex] = w.text;
      }

      result[index] = tableDict;
      console.log(`✅ Таблица #${index} сформирована (${Object.keys(tableDict).length} строк)`);

    } catch (err) {
      console.error(`❌ Ошибка при обработке canvas #${index}:`, err);
    }
  }

  console.log(`\n🏁 Все канвасы обработаны. Возвращаем результат.`);
  return result;
}
