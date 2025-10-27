import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';

export async function extractWordsFromViewport(page: Page) {
  console.log('🟢 [Debug] Начинаем обработку контейнера .тст');

  // 1️⃣ Получаем контейнер (вьюпорт)
  const container = await page.$('.тст');
  if (!container) throw new Error('Container not found');

  console.log('🟢 [Debug] Делаем скриншот контейнера...');
  const boundingBox = await container.boundingBox();
  if (!boundingBox) throw new Error('Cannot get bounding box of container');

  const screenshotBuffer = await container.screenshot({
    clip: {
      x: boundingBox.x,
      y: boundingBox.y,
      width: Math.min(boundingBox.width, page.viewportSize()?.width || 800),
      height: Math.min(boundingBox.height, page.viewportSize()?.height || 600)
    }
  });
  console.log('🟢 [Debug] Скриншот получен, размер (байт):', screenshotBuffer.length);

  // Сохраняем скриншот для ручного дебага
  const screenshotPath = path.join(process.cwd(), 'viewport_debug.png');
  fs.writeFileSync(screenshotPath, screenshotBuffer);
  console.log('💾 [Debug] Скриншот сохранён в корне проекта:', screenshotPath);

  // 2️⃣ Создаём canvas для обработки контраста
  const dataUrl = await page.evaluate((buffer) => {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        console.log('🟢 [Debug] Изображение загружено в canvas');
        const temp = document.createElement('canvas');
        temp.width = img.width * 2;   // увеличиваем масштаб 2x
        temp.height = img.height * 2;
        const ctx = temp.getContext('2d')!;
        ctx.drawImage(img, 0, 0, temp.width, temp.height);
        console.log(`🟢 [Debug] Масштабирование завершено: ${temp.width}x${temp.height}`);

        // Повышаем контрастность
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

        resolve(temp.toDataURL('image/png'));
      };

      img.onerror = (err) => {
        console.error('❌ [Debug] Ошибка загрузки изображения в canvas', err);
        resolve('');
      };

      img.src = 'data:image/png;base64,' + buffer.toString('base64');
    });
  }, screenshotBuffer);

  if (!dataUrl) throw new Error('Failed to create canvas image for OCR');

  console.log('🔍 [Debug] Передаем изображение в Tesseract...');
  const result = await Tesseract.recognize(dataUrl, 'eng', {
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:- '
  });

  const words = result.data.words.map(w => ({
    text: w.text,
    conf: w.confidence,
    bbox: w.bbox
  }));

  console.log('🟢 [Debug] OCR завершен');
  console.log(`🟢 [Debug] Найдено слов: ${words.length}`);
  console.log('Пример первых 5 слов:', words.slice(0, 5));

  return words;
}
