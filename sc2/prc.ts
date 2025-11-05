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

  public async compareScreenshots(
    beforeBase64: string,
    afterBase64: string
  ): Promise<{ regions: DiffRegion[]; debugBase64: string }> {
    console.log('[DEBUG] Starting compareScreenshots');

    return await this.page.evaluate(
      async (params: {
        beforeBase64: string;
        afterBase64: string;
        diffThreshold: number;
        clusterSize: number;
        minClusterPixels: number;
        colorTolerance: number;
      }) => {
        const { beforeBase64, afterBase64, diffThreshold, clusterSize, minClusterPixels, colorTolerance } = params;

        const beforeImg = new Image();
        const afterImg = new Image();

        return await new Promise<{ regions: DiffRegion[]; debugBase64: string }>((resolve) => {
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

            console.log('[DEBUG] Images loaded');

            // 1. Найти изменившиеся пиксели
            const diffPixels: Pixel[] = [];
            for (let i = 0; i < beforeData.length; i += 4) {
              const dr = Math.abs(beforeData[i] - afterData[i]);
              const dg = Math.abs(beforeData[i + 1] - afterData[i + 1]);
              const db = Math.abs(beforeData[i + 2] - afterData[i + 2]);
              const delta = (dr + dg + db) / 3;
              if (delta > diffThreshold) {
                const idx = i / 4;
                const x = idx % canvas.width;
                const y = Math.floor(idx / canvas.width);
                diffPixels.push({
                  x, y,
                  r: afterData[i],
                  g: afterData[i + 1],
                  b: afterData[i + 2]
                });
              }
            }
            console.log('[DEBUG] Changed pixels found:', diffPixels.length);

            // 2. Кластеризация через Map для быстрого поиска соседей
            const assigned = new Set<string>();
            const pixelMap = new Map<string, Pixel>();
            diffPixels.forEach(p => pixelMap.set(`${p.x},${p.y}`, p));

            const clusters: { pixels: Pixel[] }[] = [];
            const offsets: [number, number][] = [];
            for (let dx = -clusterSize; dx <= clusterSize; dx++) {
              for (let dy = -clusterSize; dy <= clusterSize; dy++) offsets.push([dx, dy]);
            }

            const colorDist = (a: Pixel, b: Pixel) =>
              Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

            for (const p of diffPixels) {
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

                for (const [dx, dy] of offsets) {
                  const nx = cur.x + dx;
                  const ny = cur.y + dy;
                  const nKey = `${nx},${ny}`;
                  const neighbor = pixelMap.get(nKey);
                  if (!neighbor || assigned.has(nKey)) continue;
                  if (colorDist(cur, neighbor) <= colorTolerance) queue.push(neighbor);
                }
              }

              if (clusterPixels.length >= minClusterPixels) clusters.push({ pixels: clusterPixels });
            }

            console.log('[DEBUG] Clusters formed:', clusters.length);

            // 3. Формируем регионы
            const regions: DiffRegion[] = clusters.map(c => {
              const xs = c.pixels.map(p => p.x);
              const ys = c.pixels.map(p => p.y);
              return {
                x: Math.min(...xs),
                y: Math.min(...ys),
                width: Math.max(...xs) - Math.min(...xs) + 1,
                height: Math.max(...ys) - Math.min(...ys) + 1
              };
            });

            // 4. Рисуем debug
            const debugCanvas = document.createElement('canvas');
            const debugCtx = debugCanvas.getContext('2d')!;
            debugCanvas.width = canvas.width;
            debugCanvas.height = canvas.height;
            debugCtx.drawImage(afterImg, 0, 0);
            const colors = ['rgba(255,0,0,0.6)','rgba(0,255,0,0.6)','rgba(0,0,255,0.6)','rgba(255,255,0,0.6)'];
            clusters.forEach((c,i)=>{
              const xs = c.pixels.map(p=>p.x);
              const ys = c.pixels.map(p=>p.y);
              const x1 = Math.min(...xs);
              const y1 = Math.min(...ys);
              const w = Math.max(...xs)-x1+1;
              const h = Math.max(...ys)-y1+1;
              debugCtx.strokeStyle = colors[i % colors.length];
              debugCtx.lineWidth = 1;
              debugCtx.strokeRect(x1,y1,w,h);
            });

            const debugBase64 = debugCanvas.toDataURL('image/png').split(',')[1];
            resolve({ regions, debugBase64 });
          };

          beforeImg.onload = onload;
          afterImg.onload = onload;
          beforeImg.src = 'data:image/png;base64,' + beforeBase64;
          afterImg.src = 'data:image/png;base64,' + afterBase64;
        });
      },
      {
        beforeBase64,
        afterBase64,
        diffThreshold: this.diffThreshold,
        clusterSize: this.clusterSize,
        minClusterPixels: this.minClusterPixels,
        colorTolerance: this.colorTolerance
      }
    );
  }

  // Получение цвета по координатам
  public static getPixelRGB(base64: string, x: number, y: number): { r: number, g: number, b: number } {
    const img = new Image();
    img.src = 'data:image/png;base64,' + base64;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const idx = (y * canvas.width + x) * 4;
    return { r: data[idx], g: data[idx+1], b: data[idx+2] };
  }
}
