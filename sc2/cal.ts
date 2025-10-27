import { Page } from '@playwright/test';
import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';

export async function extractWordsFromGoghGrid(page: Page) {
  console.log('🟢 [Debug] Ждем появления видимых канвасов в .goghgrid-container...');
  
  await page.waitForFunction(() => {
    const container = document.querySelector('.goghgrid-container');
    if (!container) return false;
    const canvases = container.querySelectorAll('canvas');
    return Array.from(canvases).some(c => c.offsetWidth > 0 && c.offsetHeight > 0);
  }, { timeout: 10000 });

  console.log('🟢 [Debug] Канвасы видимы, собираем их...');
  const canvasesHandles = await page.$$('.goghgrid-container canvas');

  if (!canvasesHandles.length) throw new Error('❌ [Debug] Канвасы не найдены в контейнере');

  console.log(`🟢 [Debug] Найдено ${canvasesHandles.length} канвасов`);

  // Сохраняем отдельные скриншоты канвасов и объединяем их в Node
  const buffers: Buffer[] = [];
  for (let i = 0; i < canvasesHandles.length; i++) {
    const canvas = canvasesHandles[i];
    const bbox = await canvas.boundingBox();
    if (!bbox || bbox.width === 0 || bbox.height === 0) {
      console.log(`⚪ [Debug] Канвас ${i} имеет нулевой размер, пропускаем`);
      continue;
    }
    const buffer = await canvas.screenshot();
    const screenshotPath = path.join(process.cwd(), `canvas_${i}.png`);
    fs.writeFileSync(screenshotPath, buffer);
    console.log(`💾 [Debug] Скриншот канваса ${i} сохранён: ${screenshotPath}`);
    buffers.push(buffer);
  }

  if (!buffers.length) throw new Error('❌ [Debug] Нет видимых канвасов для OCR');

  console.log('🟢 [Debug] Объединяем канвасы в один canvas через page.evaluate...');

  // Объединяем и масштабируем канвасы через page.evaluate
  const dataUrl = await page.evaluate((buffers: string[]) => {
    const temp = document.createElement('canvas');
    const ctx = temp.getContext('2d')!;
    const scale = 2;
    let width = 0;
    let height = 0;

    const images = buffers.map(b64 => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      return img;
    });

    // Вычисляем итоговый размер (максимум ширины и высоты)
    images.forEach(img => {
      width = Math.max(width, img.width);
      height = Math.max(height, img.height);
    });

    temp.width = width * scale;
    temp.height = height * scale;

    images.forEach(img => {
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * scale, img.height * scale);
    });

    // Контраст
    const imgData = ctx.getImageData(0, 0, temp.width, temp.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let val = data[i + c];
        val = ((val - 128) * 1.5 + 128);
        data[i + c] = Math.min(255, Math.max(0, val));
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return temp.toDataURL('image/png');
  }, buffers.map(b => b.toString('base64')));

  const finalBuffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  const finalPath = path.join(process.cwd(), 'goghgrid_debug.png');
  fs.writeFileSync(finalPath, finalBuffer);
  console.log('💾 [Debug] Итоговый canvas сохранён: ', finalPath);

  console.log('🔍 [Debug] Запускаем OCR через Tesseract...');
  const result = await Tesseract.recognize(finalBuffer, 'eng', {
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
