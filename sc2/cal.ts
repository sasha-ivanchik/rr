import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';

export async function extractWordsFromContainer(page: Page) {
  // 1️⃣ Получаем объединенный DataURL с контрастом
  const dataUrl = await page.evaluate(() => {
    console.log('🟢 [Debug] Начинаем обработку контейнера .тст');
    const container = document.querySelector('.тст') as HTMLElement;
    if (!container) throw new Error('Container not found');

    // Размеры контейнера (включая контент вне вьюпорта)
    const width = container.scrollWidth || container.offsetWidth;
    const height = container.scrollHeight || container.offsetHeight;
    console.log('🟢 [Debug] Размер контейнера:', width, height);

    if (width === 0 || height === 0) throw new Error('Container has zero size');

    const temp = document.createElement('canvas');
    temp.width = width;
    temp.height = height;
    const ctx = temp.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');

    let canvasCount = 0;

    // Проходим по всем канвасам в контейнере
    container.querySelectorAll('canvas').forEach((canvas, idx) => {
      const style = getComputedStyle(canvas);
      if (style.display === 'none' || style.visibility === 'hidden') {
        console.log(`⚪ [Debug] Canvas ${idx} скрыт, пропускаем`);
        return;
      }

      // Используем реальные размеры канваса
      if (canvas.width === 0 || canvas.height === 0) {
        console.log(`⚪ [Debug] Canvas ${idx} имеет нулевой размер, пропускаем`);
        return;
      }

      const offsetX = canvas.offsetLeft;
      const offsetY = canvas.offsetTop;
      console.log(`🟡 [Debug] Canvas ${idx}: size=${canvas.width}x${canvas.height}, offset=(${offsetX},${offsetY})`);

      ctx.drawImage(canvas, offsetX, offsetY, canvas.width, canvas.height);
      canvasCount++;
    });

    console.log('🟢 [Debug] Всего канвасов обработано:', canvasCount);

    // Применяем ручное повышение контрастности
    const imgData = ctx.getImageData(0, 0, temp.width, temp.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let val = data[i + c];
        val = ((val - 128) * 1.5 + 128); // коэффициент контраста 1.5
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
