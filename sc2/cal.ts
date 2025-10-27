import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';

export async function extractWordsFromCanvases(page: Page) {
  console.log('🟢 [Debug] Начинаем обработку канвасов в .тст');

  // 1️⃣ Собираем все канвасы внутри контейнера
  const canvasCount = await page.evaluate(() => {
    const container = document.querySelector('.тст');
    if (!container) return 0;
    return container.querySelectorAll('canvas').length;
  });

  if (!canvasCount) throw new Error('❌ [Debug] Канвасы не найдены в контейнере');

  console.log(`🟢 [Debug] Найдено ${canvasCount} канвасов`);

  // 2️⃣ Объединяем канвасы в один временный canvas и увеличиваем
  const dataUrl = await page.evaluate(() => {
    const container = document.querySelector('.тст')!;
    const canvases = Array.from(container.querySelectorAll('canvas')).filter(c => c.offsetWidth > 0 && c.offsetHeight > 0);

    if (!canvases.length) return '';

    // Определяем размеры итогового canvas (по максимуму канвасов)
    const width = Math.max(...canvases.map(c => c.offsetLeft + c.width));
    const height = Math.max(...canvases.map(c => c.offsetTop + c.height));

    const scale = 2; // увеличиваем для OCR
    const temp = document.createElement('canvas');
    temp.width = width * scale;
    temp.height = height * scale;
    const ctx = temp.getContext('2d')!;

    // Копируем каждый канвас
    canvases.forEach((c, idx) => {
      const offsetX = c.offsetLeft * scale;
      const offsetY = c.offsetTop * scale;
      ctx.drawImage(c, 0, 0, c.width, c.height, offsetX, offsetY, c.width * scale, c.height * scale);
      console.log(`🟡 [Debug] Canvas ${idx}: ${c.width}x${c.height} -> ${c.width*scale}x${c.height*scale}`);
    });

    // Повышаем контраст
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
    console.log('🟢 [Debug] Контраст применен');

    return temp.toDataURL('image/png');
  });

  if (!dataUrl) throw new Error('❌ [Debug] Не удалось создать итоговое изображение для OCR');

  // 3️⃣ Сохраняем итоговое изображение для ручного дебага
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  const screenshotPath = path.join(process.cwd(), 'canvases_debug.png');
  fs.writeFileSync(screenshotPath, buffer);
  console.log('💾 [Debug] Итоговый canvas сохранён в:', screenshotPath);

  // 4️⃣ OCR через Tesseract
  console.log('🔍 [Debug] Запускаем OCR через Tesseract...');
  const result = await Tesseract.recognize(buffer, 'eng', {
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:- '
  });

  const words = result.data.words.map(w => ({
    text: w.text,
    conf: w.confidence,
    bbox: w.bbox
  }));

  console.log('🟢 [Debug] OCR завершен. Найдено слов:', words.length);
  console.log('Пример первых 5 слов:', words.slice(0, 5));

  return words;
}
