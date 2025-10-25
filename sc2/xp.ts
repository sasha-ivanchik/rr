import { Page } from "@playwright/test";

export async function extractCanvasText(page: Page): Promise<string[]> {
  console.log("🔍 Ищем тексты, нарисованные на canvas...");

  // Перехватываем fillText на странице
  await page.addInitScript(() => {
    // Хранилище текстов
    (window as any).__canvasTexts = [];

    // Сохраняем оригинальный метод
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;

    // Переопределяем fillText
    CanvasRenderingContext2D.prototype.fillText = function (
      text: string,
      x: number,
      y: number,
      maxWidth?: number
    ) {
      try {
        (window as any).__canvasTexts.push({
          text,
          x,
          y,
          maxWidth,
          time: Date.now(),
        });
      } catch (e) {
        console.error("Ошибка в перехвате fillText:", e);
      }

      // Вызываем оригинальный метод, чтобы отрисовка не ломалась
      return originalFillText.call(this, text, x, y, maxWidth);
    };
  });

  // Навигация или действия, которые отрисовывают текст на канвасе
  console.log("⏳ Ждём активности canvas...");
  await page.waitForTimeout(3000);

  // Собираем тексты
  const texts = await page.evaluate(() => {
    const arr = (window as any).__canvasTexts || [];
    return arr.map((t: any) => t.text);
  });

  console.log(`✅ Найдено ${texts.length} надписей:`, texts.slice(0, 10));
  return texts;
}
