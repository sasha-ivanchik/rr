import { Page } from '@playwright/test';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas'; // npm i canvas

export interface DiffRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Pixel {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
}

export class ScreenshotDiff {
  constructor(
    private page: Page,
    private diffThreshold = 50,
    private clusterSize = 5,
    private minClusterPixels = 4,
    private colorTolerance = 40
  ) {}

  // Сравниваем два скриншота
  public async compareScreenshots(
    beforeBase64: string,
    afterBase64: string,
    debugSavePath?: string
  ): Promise<{ regions: DiffRegion[]; debugBase64: string }> {
    console.log('[DEBUG] Starting compareScreenshots');

    // Загружаем картинки в Node Canvas
    const beforeImg = await loadImage(Buffer.from(beforeBase64, 'base64'));
    const afterImg = await loadImage(Buffer.from(afterBase64, 'base64'));

    const canvas = createCanvas(afterImg.width, afterImg.height);
    const ctx = canvas.getContext('2d');

    // Получаем ImageData
    ctx.drawImage(beforeImg, 0, 0);
    const beforeData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(afterImg, 0, 0);
    const afterData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    console.log('[DEBUG] Images loaded, starting pixel comparison');

    // 1. Собираем изменившиеся пиксели
    const diffPixels: Pixel[] = [];
    for (let i = 0; i < beforeData.length; i += 4) {
      const dr = Math.abs(beforeData[i] - afterData[i]);
      const dg = Math.abs(beforeData[i + 1] - afterData[i + 1]);
      const db = Math.abs(beforeData[i + 2] - afterData[i + 2]);
      const delta = (dr + dg + db) / 3;
      if (delta > this.diffThreshold) {
        const idx = i / 4;
        const x = idx % canvas.width;
        const y = Math.floor(idx / canvas.width);
        diffPixels.push({
          x,
          y,
          r: afterData[i],
          g: afterData[i + 1],
          b: afterData[i + 2],
        });
      }
    }

    console.log('[DEBUG] Changed pixels found:', diffPixels.length);

    // 2. Кластеризация
    const clusters = this.clusterPixels(diffPixels);

    console.log('[DEBUG] Clusters formed:', clusters.length);

    // 3. Преобразуем кластеры в регионы
    const regions: DiffRegion[] = clusters.map((c) => {
      const xs = c.pixels.map((p) => p.x);
      const ys = c.pixels.map((p) => p.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs) + 1,
        height: Math.max(...ys) - Math.min(...ys) + 1,
      };
    });

    // 4. Рисуем debug картинку
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(afterImg, 0, 0);

    const colors = ['rgba(255,0,0,0.6)', 'rgba(0,255,0,0.6)', 'rgba(0,0,255,0.6)', 'rgba(255,255,0,0.6)'];
    clusters.forEach((c, i) => {
      const xs = c.pixels.map((p) => p.x);
      const ys = c.pixels.map((p) => p.y);
      const x1 = Math.min(...xs);
      const y1 = Math.min(...ys);
      const w = Math.max(...xs) - x1 + 1;
      const h = Math.max(...ys) - y1 + 1;
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 1;
      ctx.strokeRect(x1, y1, w, h);
    });

    const debugBase64 = canvas.toBuffer('image/png').toString('base64');
    if (debugSavePath) fs.writeFileSync(debugSavePath, Buffer.from(debugBase64, 'base64'));
    console.log('[DEBUG] Debug image saved');

    return { regions, debugBase64 };
  }

  // Кластеризация пикселей (Node.js, быстро)
  private clusterPixels(pixels: Pixel[]): { pixels: Pixel[] }[] {
    const clusters: { pixels: Pixel[] }[] = [];
    const assigned = new Set<string>();

    // Map координат для быстрого поиска соседей
    const pixelMap = new Map<string, Pixel>();
    pixels.forEach((p) => pixelMap.set(`${p.x},${p.y}`, p));

    const neighborsOffsets = [];
    for (let dx = -this.clusterSize; dx <= this.clusterSize; dx++) {
      for (let dy = -this.clusterSize; dy <= this.clusterSize; dy++) {
        neighborsOffsets.push([dx, dy]);
      }
    }

    const colorDist = (a: Pixel, b: Pixel) =>
      Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

    for (const p of pixels) {
      const key = `${p.x},${p.y}`;
      if (assigned.has(key)) continue;

      const clusterPixels: Pixel[] = [];
      const queue: Pixel[] = [p];

      while (queue.length) {
        const cur = queue.pop()!;
        const curKey = `${cur.x},${cur.y}`;
        if (assigned.has(curKey)) continue;
        assigned.add(curKey);
        clusterPixels.push(cur);

        for (const [dx, dy] of neighborsOffsets) {
          const nx = cur.x + dx;
          const ny = cur.y + dy;
          const nKey = `${nx},${ny}`;
          const neighbor = pixelMap.get(nKey);
          if (!neighbor) continue;
          if (assigned.has(nKey)) continue;
          if (colorDist(cur, neighbor) <= this.colorTolerance) {
            queue.push(neighbor);
          }
        }
      }

      if (clusterPixels.length >= this.minClusterPixels) {
        clusters.push({ pixels: clusterPixels });
      }
    }

    return clusters;
  }

  // Получение цвета по координатам из Base64
  public static getPixelRGB(base64: string, x: number, y: number): { r: number; g: number; b: number } {
    const img = new Image();
    img.src = 'data:image/png;base64,' + base64;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const idx = (y * canvas.width + x) * 4;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
  }
}
