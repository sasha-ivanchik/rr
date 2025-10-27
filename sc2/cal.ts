import { Page, Locator } from '@playwright/test';
import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';

export async function extractWordsFromFirstCanvas(page: Page, containerLocator: Locator) {
  console.log('🟢 [Debug] Ждем появления канваса в контейнере...');
  
  await containerLocator.locator('canvas').first().waitFor({ state: 'visible', timeout: 10000 });

  const canvasHandle = await containerLocator.locator('canvas').first();
  if (!canvasHandle) throw new Error('❌ [Debug] Канвас не найден');

  console.log('🟢 [Debug] Делаем скриншот первого канваса...');
  const screenshotBuffer = await canvasHandle.screenshot();
  console.log('🟢 [Debug] Скриншот получен, размер (байт):', screenshotBuffer.length);

  // Сохраняем скриншот для ручного дебага
  const screenshotPath = path.join(process.cwd(), 'first_canvas_debug.png');
  fs.writeFileSync(screenshotPath, screenshotBuffer);
  console.log('💾 [Debug] Скриншот канваса сохранён:', screenshotPath);

  // Преобразуем buffer в base64 строку для передачи в page.evaluate
  const screenshotBase64 = screenshotBuffer.toString('base64');

  // Масштабируем и повышаем контраст через canvas в браузере
  const dataUrl = await page.evaluate((base64: string) => {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const temp = document.createElement('canvas');
        temp.width = img.width * scale;
        temp.height = img.height * scale;
        const ctx = temp.getContext('2d')!;
        ctx.drawImage(img, 0, 0, temp.width, temp.height);

        // Повышение контраста
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

        resolve(temp.toDataURL('image/png'));
      };
      img.onerror = (err) => {
        console.error('❌ [Debug] Ошибка загрузки изображения в canvas', err);
        resolve('');
      };
      img.src = 'data:image/png;base64,' + base64;
    });
  }, screenshotBase64);

  if (!dataUrl) throw new Error('❌ [Debug] Не удалось создать изображение для OCR');

  console.log('🔍 [Debug] Передаем изображение в Tesseract...');
  const result = await Tesseract.recognize(dataUrl, 'eng', {
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
