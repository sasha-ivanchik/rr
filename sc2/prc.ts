import { test, Page } from '@playwright/test';
import fs from 'fs';

async function findRedDotsOnly(
  page: Page,
  beforeBase64: string,
  afterBase64: string
): Promise<{
  boxes: { x: number; y: number; w: number; h: number }[];
  debugBase64: string;
}> {
  return await page.evaluate(
    async ([beforeBase64, afterBase64]) => {
      function toImageData(base64: string): Promise<ImageData> {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, img.width, img.height));
          };
          img.src = 'data:image/png;base64,' + base64;
        });
      }

      const beforeData = await toImageData(beforeBase64);
      const afterData = await toImageData(afterBase64);

      const width = beforeData.width;
      const height = beforeData.height;
      const changedPixels: { x: number; y: number }[] = [];

      // 🔹 Сравнение пикселей
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r1 = beforeData.data[idx];
          const g1 = beforeData.data[idx + 1];
          const b1 = beforeData.data[idx + 2];

          const r2 = afterData.data[idx];
          const g2 = afterData.data[idx + 1];
          const b2 = afterData.data[idx + 2];

          const dr = r2 - r1;
          const dg = g2 - g1;
          const db = b2 - b1;

          // “Появился красный пиксель”
          if (dr > 60 && r2 > 160 && g2 < 120 && b2 < 120) {
            changedPixels.push({ x, y });
          }
        }
      }

      // 🔹 Группировка в bounding boxes
      const boxes: { x: number; y: number; w: number; h: number }[] = [];
      const visited = new Set<string>();

      function floodFill(sx: number, sy: number) {
        const stack = [{ x: sx, y: sy }];
        let minX = sx,
          maxX = sx,
          minY = sy,
          maxY = sy;

        while (stack.length) {
          const { x, y } = stack.pop()!;
          const key = `${x},${y}`;
          if (visited.has(key)) continue;
          visited.add(key);

          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);

          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = x + dx;
            const ny = y + dy;
            const nkey = `${nx},${ny}`;
            if (
              nx >= 0 &&
              ny >= 0 &&
              nx < width &&
              ny < height &&
              !visited.has(nkey) &&
              changedPixels.some((p) => p.x === nx && p.y === ny)
            ) {
              stack.push({ x: nx, y: ny });
            }
          }
        }

        boxes.push({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
      }

      for (const p of changedPixels) {
        const key = `${p.x},${p.y}`;
        if (!visited.has(key)) floodFill(p.x, p.y);
      }

      // 🔹 Фильтрация: только маленькие точки
      const smallBoxes = boxes.filter((b) => b.w < 30 && b.h < 30);

      // 🔹 Создание debug-изображения
      const debugCanvas = document.createElement('canvas');
      debugCanvas.width = width;
      debugCanvas.height = height;
      const debugCtx = debugCanvas.getContext('2d')!;

      // Рисуем исходное "после" изображение
      const img = new Image();
      const afterLoaded = new Promise<void>((resolve) => {
        img.onload = () => {
          debugCtx.drawImage(img, 0, 0);
          resolve();
        };
        img.src = 'data:image/png;base64,' + afterBase64;
      });
      await afterLoaded;

      // Обводим найденные области
      debugCtx.lineWidth = 2;
      debugCtx.strokeStyle = 'lime';
      debugCtx.font = '12px monospace';
      debugCtx.fillStyle = 'lime';

      smallBoxes.forEach((b, i) => {
        debugCtx.strokeRect(b.x, b.y, b.w, b.h);
        debugCtx.fillText(`${i + 1}`, b.x, b.y - 2);
      });

      const debugBase64 = debugCanvas.toDataURL('image/png').split(',')[1];

      return { boxes: smallBoxes, debugBase64 };
    },
    [beforeBase64, afterBase64]
  );
}

test('поиск только красных точек + debug', async ({ page }) => {
  await page.goto('https://your-app');

  // --- Скриншот ДО ---
  const before = await page.screenshot({ encoding: 'base64' });

  // --- Выполняем действие ---
  await page.click('#some-action');
  await page.waitForTimeout(800);

  // --- Скриншот ПОСЛЕ ---
  const after = await page.screenshot({ encoding: 'base64' });

  const { boxes, debugBase64 } = await findRedDotsOnly(page, before, after);

  fs.writeFileSync('debug_red_dots.png', Buffer.from(debugBase64, 'base64'));

  if (boxes.length === 0) {
    console.log('❌ Красные точки не найдены или есть лишние отличия.');
  } else {
    console.log(`✅ Найдено ${boxes.length} красных точек`);
    console.table(boxes);
    console.log('📸 Сохранён debug файл: debug_red_dots.png');
  }
});
