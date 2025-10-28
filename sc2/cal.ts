import { Page, Locator } from '@playwright/test';
import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';

export async function extractNumbersFromCanvas(page: Page, containerLocator: Locator) {
  console.log('🟢 [Debug] Ждем появления канваса в контейнере...');
  await containerLocator.locator('canvas').first().waitFor({ state: 'visible', timeout: 10000 });

  const canvasHandle = await containerLocator.locator('canvas').first();
  if (!canvasHandle) throw new Error('❌ [Debug] Канвас не найден');

  console.log('🟢 [Debug] Делаем скриншот первого канваса...');
  const screenshotBuffer = await canvasHandle.screenshot();
  console.log('🟢 [Debug] Скриншот получен, размер (байт):', screenshotBuffer.length);

  // Сохраняем исходный скриншот
  const screenshotPath = path.join(process.cwd(), 'canvas_debug.png');
  fs.writeFileSync(screenshotPath, screenshotBuffer);
  console.log('💾 [Debug] Скриншот канваса сохранён:', screenshotPath);

  const screenshotBase64 = screenshotBuffer.toString('base64');

  // Обработка изображения (увеличение, контраст, автоинверсия)
  console.log('🟢 [Debug] Обрабатываем изображение (resize 500x600 + контраст + автоинверсия)...');

  const dataUrl = await page.evaluate((base64: string) => {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const targetWidth = 500;
        const targetHeight = 600;

        const temp = document.createElement('canvas');
        temp.width = targetWidth;
        temp.height = targetHeight;
        const ctx = temp.getContext('2d');
        if (!ctx) return resolve('');

        // Нарисовать изображение с ресайзом
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;

        // Усиливаем контраст
        const contrast = 1.6;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        let avgLuminance = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          avgLuminance += lum;
          data[i] = factor * (r - 128) + 128;
          data[i + 1] = factor * (g - 128) + 128;
          data[i + 2] = factor * (b - 128) + 128;
        }
        avgLuminance /= (data.length / 4);

        // Если фон тёмный — инвертируем
        if (avgLuminance < 128) {
          console.log('[OCR] → Автоинверсия применена (тёмный фон)');
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(temp.toDataURL('image/png'));
      };
      img.onerror = (err) => {
        console.error('❌ [Debug] Ошибка загрузки изображения', err);
        resolve('');
      };
      img.src = 'data:image/png;base64,' + base64;
    });
  }, screenshotBase64);

  if (!dataUrl) throw new Error('❌ [Debug] Не удалось создать изображение для OCR');

  const processedPath = path.join(process.cwd(), 'canvas_debug_processed.png');
  fs.writeFileSync(processedPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('💾 [Debug] Обработанное изображение сохранено:', processedPath);

  console.log('🔍 [Debug] Запускаем Tesseract OCR...');
  const result = await Tesseract.recognize(dataUrl, 'eng', {
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:-',
    tessedit_pageseg_mode: 6, // один блок текста
  });

  const text = result?.data?.text?.trim() ?? '';
  console.log('🟢 [Debug] OCR завершен. Распознанный текст:', text);
  console.log('📊 [Debug] Средняя уверенность:', result?.data?.confidence ?? 'n/a');

  const words = text.split(/\s+/).filter(Boolean);
  console.log('🟢 [Debug] Найдено слов/чисел:', words.length);
  console.log('🔹 Пример первых 10:', words.slice(0, 10));

  return words;
}
