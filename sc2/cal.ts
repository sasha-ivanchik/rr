import { Page } from '@playwright/test';

/**
 * Перехватывает отрисовку текста на Canvas (fillText/strokeText)
 * и возвращает все вызовы с аргументами.
 */
export async function captureCanvasText(page: Page) {
  console.log('🟦 [Playwright] Устанавливаю хук для CanvasRenderingContext2D...');

  await page.evaluate(() => {
    // Если уже установлен — пропускаем
    if ((window as any).__canvasTextHookInstalled) return;
    (window as any).__canvasTextHookInstalled = true;

    console.log('🎯 [CanvasHook] Внедрение хука...');

    // Глобальные списки вызовов
    (window as any).__canvasTextCalls = [];

    const proto = CanvasRenderingContext2D.prototype;
    const wrapMethod = (name: keyof CanvasRenderingContext2D) => {
      const orig = proto[name] as any;
      proto[name] = function (...args: any[]) {
        try {
          const [text, x, y] = args;
          const record = { fn: name, text, x, y, time: Date.now() };
          (window as any).__canvasTextCalls.push(record);
          console.log(`🖊️ [CanvasHook] ${name}("${text}", ${x}, ${y})`);
        } catch (err) {
          console.warn(`[CanvasHook] Ошибка при логировании ${name}:`, err);
        }
        return orig.apply(this, args);
      };
    };

    // Подключаем перехват для текстовых методов
    wrapMethod('fillText');
    wrapMethod('strokeText');

    console.log('✅ [CanvasHook] Хук установлен');
  });

  // Можно подождать немного, пока произойдет рендер
  await page.waitForTimeout(1000);

  // Извлекаем собранные вызовы
  const captured = await page.evaluate(() => (window as any).__canvasTextCalls || []);
  console.log('📊 [Playwright] Найденные вызовы Canvas:', captured.length);

  for (const c of captured) {
    console.log(`→ ${c.fn}("${c.text}", x=${c.x}, y=${c.y})`);
  }

  return captured;
}
