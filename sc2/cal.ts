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

  // Сохраняем скриншот для ручного дебага
  const screenshotPath = path.join(process.cwd(), 'canvas_debug.png');
  fs.writeFileSync(screenshotPath, screenshotBuffer);
  console.log('💾 [Debug] Скриншот канваса сохранён:', screenshotPath);

  const screenshotBase64 = screenshotBuffer.toString('base64');

  // Масштабируем и делаем динамическую бинаризацию через canvas
  const dataUrl = await page.evaluate((base64: string) => {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = 4; // увеличиваем для мелкого текста
        const temp = document.createElement('canvas');
        temp.width = img.width * scale;
        temp.height = img.height * scale;
        const ctx = temp.getContext('2d')!;
        ctx.drawImage(img, 0, 0, temp.width, temp.height);

        const imgData = ctx.getImageData(0, 0, temp.width, temp.height);
        const data = imgData.data;

        // Динамическая бинаризация: светлые пиксели -> белые, темные -> черные
        for (let i = 0; i < data.length; i += 4) {
          const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = brightness > 50 ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = val;
          data[i + 3] = 255; // альфа
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

  console.log('🔍 [Debug] Запускаем Tesseract OCR...');
  const result = await Tesseract.recognize(dataUrl, 'eng', {
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:-',
    tessedit_pageseg_mode: 6 // один блок текста
  });

  console.log('🟢 [Debug] OCR завершен. Содержимое result.data.text:', result?.data?.text);

  let words: string[] = [];
  if (result?.data?.text) {
    words = result.data.text
      .split(/\s+/)
      .filter(Boolean);
  } else {
    console.log('⚠️ [Debug] OCR не вернул текст');
  }

  console.log('🟢 [Debug] Найдено слов/чисел:', words.length);
  console.log('Пример первых 10 слов/чисел:', words.slice(0, 10));

  return words;
}

const dataUrl = await page.evaluate((base64: string) => {
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = 4;
      const temp = document.createElement('canvas');
      temp.width = img.width * scale;
      temp.height = img.height * scale;
      const ctx = temp.getContext('2d')!;
      ctx.drawImage(img, 0, 0, temp.width, temp.height);

      const imgData = ctx.getImageData(0, 0, temp.width, temp.height);
      const data = imgData.data;

      // 1️⃣ Определяем среднюю яркость — тёмный или светлый фон
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        const b = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += b;
      }
      const avg = sum / (data.length / 4);
      const invert = avg < 128; // если фон тёмный → инвертируем

      // 2️⃣ Контраст + бинаризация + инверсия
      for (let i = 0; i < data.length; i += 4) {
        let brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (invert) brightness = 255 - brightness;
        const val = brightness > 128 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = val;
        data[i + 3] = 255;
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(temp.toDataURL('image/png'));
    };
    img.onerror = (err) => {
      console.error('❌ [Debug] Ошибка загрузки изображения', err);
      resolve('');
    };
    img.src = 'data:image/png;base64,' + base64;
  });
}, screenshotBase64);


fs.writeFileSync('canvas_debug_processed.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
