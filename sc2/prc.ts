import { Page } from '@playwright/test';

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

  // Основной метод
  public async compareScreenshots(
    beforeBase64: string,
    afterBase64: string
  ): Promise<{ regions: DiffRegion[]; debugBase64: string }> {
    console.log('[DEBUG] Starting compareScreenshots');
    return await this.page.evaluate(
      async (
        beforeBase64: string,
        afterBase64: string,
        diffThreshold: number,
        clusterSize: number,
        minClusterPixels: number,
        colorTolerance: number
      ) => {
        const beforeImg = new Image();
        const afterImg = new Image();

        return await new Promise<{ regions: DiffRegion[]; debugBase64: string }>(
          (resolve) => {
            let loaded = 0;

            const onload = () => {
              loaded++;
              if (loaded < 2) return;

              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d')!;
              canvas.width = beforeImg.width;
              canvas.height = beforeImg.height;

              ctx.drawImage(beforeImg, 0, 0);
              const beforeData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(afterImg, 0, 0);
              const afterData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

              const diffCanvas = document.createElement('canvas');
              const diffCtx = diffCanvas.getContext('2d')!;
              diffCanvas.width = canvas.width;
              diffCanvas.height = canvas.height;
              diffCtx.drawImage(afterImg, 0, 0);

              // Шаг 1: найти пиксели с изменением
              const changedPixels: Pixel[] = [];
              for (let i = 0; i < beforeData.length; i += 4) {
                const dr = Math.abs(beforeData[i] - afterData[i]);
                const dg = Math.abs(beforeData[i + 1] - afterData[i + 1]);
                const db = Math.abs(beforeData[i + 2] - afterData[i + 2]);
                const delta = (dr + dg + db) / 3;
                if (delta > diffThreshold) {
                  const idx = i / 4;
                  const x = idx % canvas.width;
                  const y = Math.floor(idx / canvas.width);
                  changedPixels.push({
                    x,
                    y,
                    r: afterData[i],
                    g: afterData[i + 1],
                    b: afterData[i + 2],
                  });
                }
              }
              console.log('[DEBUG] Changed pixels found:', changedPixels.length);

              // Шаг 2: кластеризация
              const clusters = ScreenshotDiff.groupPixels(
                changedPixels,
                canvas.width,
                canvas.height,
                clusterSize,
                minClusterPixels,
                colorTolerance
              );
              console.log('[DEBUG] Clusters formed:', clusters.length);

              // Шаг 3: формируем регионы
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

              // Шаг 4: отрисовать кластеры для дебага
              const colors = ['rgba(255,0,0,0.6)','rgba(0,255,0,0.6)','rgba(0,0,255,0.6)','rgba(255,255,0,0.6)'];
              clusters.forEach((c, i) => {
                diffCtx.strokeStyle = colors[i % colors.length];
                const xs = c.pixels.map((p) => p.x);
                const ys = c.pixels.map((p) => p.y);
                const x1 = Math.min(...xs);
                const y1 = Math.min(...ys);
                const w = Math.max(...xs) - x1 + 1;
                const h = Math.max(...ys) - y1 + 1;
                diffCtx.lineWidth = 1;
                diffCtx.strokeRect(x1, y1, w, h);
              });

              const debugBase64 = diffCanvas.toDataURL('image/png').split(',')[1];
              resolve({ regions, debugBase64 });
            };

            beforeImg.onload = onload;
            afterImg.onload = onload;
            beforeImg.src = 'data:image/png;base64,' + beforeBase64;
            afterImg.src = 'data:image/png;base64,' + afterBase64;
          }
        );
      },
      beforeBase64,
      afterBase64,
      this.diffThreshold,
      this.clusterSize,
      this.minClusterPixels,
      this.colorTolerance
    );
  }

  // Статический метод для кластеризации пикселей
  private static groupPixels(
    pixels: Pixel[],
    width: number,
    height: number,
    eps: number,
    minPts: number,
    colorTolerance: number
  ): { pixels: Pixel[] }[] {
    const visited = new Set<number>();
    const assigned = new Set<number>();
    const clusters: { pixels: Pixel[] }[] = [];

    function colorDist(a: Pixel, b: Pixel) {
      return Math.sqrt(
        (a.r - b.r) ** 2 +
        (a.g - b.g) ** 2 +
        (a.b - b.b) ** 2
      );
    }

    function close(a: Pixel, b: Pixel) {
      return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps && colorDist(a, b) <= colorTolerance;
    }

    for (let i = 0; i < pixels.length; i++) {
      if (visited.has(i)) continue;
      visited.add(i);

      const neighbors = pixels.filter((p, j) => j !== i && close(pixels[i], p));

      if (neighbors.length < minPts) continue;

      const clusterPixels: Pixel[] = [];
      const queue = [pixels[i], ...neighbors];

      while (queue.length) {
        const p = queue.pop()!;
        const idx = pixels.indexOf(p);
        if (assigned.has(idx)) continue;
        assigned.add(idx);
        clusterPixels.push(p);

        const localNeighbors = pixels.filter((q, k) => !assigned.has(k) && close(p, q));
        if (localNeighbors.length >= minPts) queue.push(...localNeighbors);
      }

      clusters.push({ pixels: clusterPixels });
    }

    return clusters;
  }

  // Получение RGB по координатам из Base64 картинки
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
