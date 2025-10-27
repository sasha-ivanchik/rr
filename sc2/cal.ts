import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';

export async function extractWordsFromContainer(page: Page, containerSelector: string) {
  // 1️⃣ Получаем объединенный DataURL с контрастом
  const dataUrl = await page.evaluate((selector) => {
    const container = document.querySelector(selector) as HTMLElement;
    if (!container) throw new Error('Container not found');

    const width = container.scrollWidth;
    const height = container.scrollHeight;

    const temp = document.createElement('canvas');
    temp.width = width;
    temp.height = height;
    const ctx = temp.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');

    const containerRect = container.getBoundingClientRect();

    // Объединяем все видимые канвасы
    container.querySelectorAll('canvas').forEach(canvas => {
      const style = getComputedStyle(canvas);
      if (style.display === 'none' || style.visibility === 'hidden') return;

      const rect = canvas.getBoundingClientRect();
      const offsetX = rect.left - containerRect.left;
      const offsetY = rect.top - containerRect.top;

      ctx.drawImage(canvas, offsetX, offsetY, rect.width, rect.height);
    });

    // 2️⃣ Применяем ручное повышение контрастности
    const imgData = ctx.getImageData(0, 0, temp.width, temp.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      // простой контраст: усиление по яркости
      for (let c = 0; c < 3; c++) { // R,G,B
        let val = data[i + c];
        val = ((val - 128) * 1.5 + 128); // коэффициент контраста 1.5
        data[i + c] = Math.min(255, Math.max(0, val));
      }
    }
    ctx.putImageData(imgData, 0, 0);

    return temp.toDataURL('image/png');
  }, containerSelector);

  // 3️⃣ OCR с Tesseract.js
  console.log('🔍 [OCR] Распознаем текст...');
  const result = await Tesseract.recognize(dataUrl, 'eng', {
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:- '
  });

  // 4️⃣ Возвращаем список слов для дебага
  const words = result.data.words.map(w => ({
    text: w.text,
    conf: w.confidence,
    bbox: w.bbox
  }));

  console.log(`🧠 [OCR] Найдено слов: ${words.length}`);
  console.log('Пример первых слов:', words.slice(0, 5));

  return words;
}
