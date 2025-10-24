import { Page } from '@playwright/test';

export interface TableStructure {
  [rowIndex: number]: { [colIndex: number]: string };
}

export interface AllTables {
  [tableIndex: number]: TableStructure;
}

export async function extractStructuredTablesFromCanvas(page: Page, canvasClass?: string): Promise<AllTables> {
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

  // 🔹 Работаем с каждым видимым канвасом
  for (const { canvas, index: i } of visibleCanvases) {
    console.log(`\n🧩 Обработка canvas #${i}`);

    try {
      // 🔹 Перехватываем fillText на странице
      const texts: string[] = await page.evaluate(() => {
        const captured: string[] = [];
        const originalFillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (text: string, x: number, y: number, ...args: any[]) {
          captured.push(text);
          return originalFillText.apply(this, [text, x, y, ...args]);
        };
        return captured;
      });

      console.log(`🔠 Canvas #${i} перехватил ${texts.length} текстов`);
      if (!texts.length) {
        console.warn('⚠️ Текст не был перехвачен. Возможно, WebGL.');
      }

      // 🔹 Формируем структуру
      const table: TableStructure = {};
      texts.forEach((text, idx) => {
        table[idx] = { 0: text }; // можно доработать по колонкам/строкам
      });

      result[i] = table;
      console.log(`✅ Canvas #${i} готов, текста: ${texts.length}`);
    } catch (err) {
      console.error(`❌ Ошибка при обработке canvas #${i}:`, err);
    }
  }

  console.log('🏁 Все канвасы обработаны');
  return result;
}
