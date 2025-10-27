import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';

export async function extractWordsFromContainer(page: Page) {
  const dataUrl = await page.evaluate(() => {
    console.log('🟢 [Debug] Начинаем обработку контейнера .тст');
    const container = document.querySelector('.тст') as HTMLElement;
    if (!container) throw new Error('Container not found');

    const width = container.scrollWidth || container.offsetWidth;
    const height = container.scrollHeight || container.offsetHeight;
    console.log('🟢 [Debug] Размер контейнера:', width, height);

    if (width === 0 || height === 0) throw new Error('Container has zero size');

    const temp = document.createElement('canvas');
    temp.width = width;
    temp.height = height;
    const ctx = temp.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');

    const containerRect = container.getBoundingClientRect();
    let canvasCount = 0;

    container.querySelectorAll('canvas').forEach((canvas, idx) => {
      const style = getComputedStyle(canvas);
      if (style.display === 'none' || style.visibility === 'hidden') {
        console.log(`⚪ [Debug] Canvas ${idx} скрыт, пропускаем`);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.log(`⚪ [Debug] Canvas ${idx} имеет нулевой размер, пропускаем`);
        return;
      }

      const offsetX = rect.left - containerRect.left;
      const offsetY = rect.top - containerRect.top;
      console.log(`🟡 [Debug] Canvas ${idx}: size=${rect.width}x${rect.height}, offset=(${offsetX},${offsetY})`);

      ctx.drawImage(canvas, offsetX, offsetY, rect.width, rect.height);
      canvasCount++;
    });

    console.log('🟢 [Debug] Всего канвасов обработано:', canvasCount);

    // Применяем контрастность
    const imgData = ctx.getImageData(0, 0, temp.width, temp.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let val = data[i + c];
        val = ((val - 128) * 1.5 + 128); // контраст 1.5
        data[i + c] = Math.min(255, Math.max(0, val));
      }
    }
    ctx.putImageData(imgData, 0, 0);
    console.log('🟢 [Debug] Контрастность применена');

    return temp.toDataURL('image/png');
  });

  console.log('🔍 [Debug] Передаем изображение в Tesseract...');
  const result = await Tesseract.recognize(dataUrl, 'eng', {
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:- '
  });

  const words = result.data.words.map(w => ({
    text: w.text,
    conf: w.confidence,
    bbox: w.bbox
  }));

  console.log(`🟢 [Debug] OCR завершен. Найдено слов: ${words.length}`);
  console.log('Пример первых 5 слов:', words.slice(0, 5));

  return words;
}
