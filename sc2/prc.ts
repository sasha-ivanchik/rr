import { Page } from '@playwright/test';

interface DiffRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Сравнивает два скриншота, возвращает изменённые области и debug-изображение
 */
export async function compareScreenshots(
  page: Page,
  beforeBase64: string,
  afterBase64: string,
  diffThreshold = 50,
  clusterSize = 5
): Promise<{ regions: DiffRegion[]; debugBase64: string }> {
  return await page.evaluate(
    async (beforeBase64, afterBase64, diffThreshold, clusterSize) => {
      const beforeImg = new Image();
      const afterImg = new Image();

      return await new Promise<{ regions: DiffRegion[]; debugBase64: string }>(
        (resolve) => {
          let loaded = 0;
          const diffs: { x: number; y: number }[] = [];

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

            for (let i = 0; i < beforeData.length; i += 4) {
              const dr = Math.abs(beforeData[i] - afterData[i]);
              const dg = Math.abs(beforeData[i + 1] - afterData[i + 1]);
              const db = Math.abs(beforeData[i + 2] - afterData[i + 2]);
              const delta = (dr + dg + db) / 3;

              if (delta > diffThreshold) {
                const pixelIndex = i / 4;
                const x = pixelIndex % canvas.width;
                const y = Math.floor(pixelIndex / canvas.width);
                diffs.push({ x, y });
              }
            }

            // Кластеризация изменений (группировка близких пикселей)
            const regions: DiffRegion[] = [];
            const visited = new Set<number>();

            const isClose = (a: { x: number; y: number }, b: { x: number; y: number }) =>
              Math.abs(a.x - b.x) <= clusterSize && Math.abs(a.y - b.y) <= clusterSize;

            diffs.forEach((p, i) => {
              if (visited.has(i)) return;
              let minX = p.x,
                maxX = p.x,
                minY = p.y,
                maxY = p.y;
              visited.add(i);

              for (let j = i + 1; j < diffs.length; j++) {
                if (visited.has(j)) continue;
                const q = diffs[j];
                if (isClose(p, q)) {
                  visited.add(j);
                  minX = Math.min(minX, q.x);
                  maxX = Math.max(maxX, q.x);
                  minY = Math.min(minY, q.y);
                  maxY = Math.max(maxY, q.y);
                }
              }

              regions.push({
                x: minX,
                y: minY,
                width: maxX - minX + 1,
                height: maxY - minY + 1,
              });
            });

            // Нарисовать найденные области
            diffCtx.lineWidth = 1;
            diffCtx.strokeStyle = 'rgba(255,0,0,0.8)';
            for (const r of regions) {
              diffCtx.strokeRect(r.x, r.y, r.width, r.height);
            }

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
    diffThreshold,
    clusterSize
  );
}


export async function getPixelColor(
  page: Page,
  base64: string,
  x: number,
  y: number
): Promise<{ r: number; g: number; b: number }> {
  return await page.evaluate(async (base64, x, y) => {
    const img = new Image();
    return await new Promise<{ r: number; g: number; b: number }>((resolve) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(x, y, 1, 1).data;
        resolve({ r: data[0], g: data[1], b: data[2] });
      };
      img.src = 'data:image/png;base64,' + base64;
    });
  }, base64, x, y);
}
