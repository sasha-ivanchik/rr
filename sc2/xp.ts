import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Делает скриншоты всех canvas с заданным классом, даже если они шире или выше экрана.
 */
export async function extractStructuredTablesFromCanvas(
  page: Page,
  targetClass: string
) {
  const LOG = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

  LOG(`🔍 Ищем канвасы с классом "${targetClass}"`);
  const canvases = await page.$$('canvas.' + targetClass);
  const total = canvases.length;
  LOG(`🔹 Найдено ${total} канвасов`);

  if (!total) {
    LOG('⚠️ Канвасы не найдены. Завершаем.');
    return;
  }

  // Создаем папку для результатов
  const outDir = path.join(process.cwd(), 'canvas_output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < total; i++) {
    LOG(`\n🧩 Обработка канваса №${i}`);
    const canvas = canvases[i];

    try {
      const visible = await canvas.isVisible();
      LOG(`🔸 Видимость: ${visible}`);

      if (!visible) {
        LOG('🔄 Канвас невидим — скроллим...');
        await canvas.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      }

      const box = await canvas.boundingBox();
      if (!box) {
        LOG(`⚠️ Canvas #${i}: boundingBox отсутствует. Делаем fullPage screenshot.`);
        await page.screenshot({
          path: path.join(outDir, `canvas_fullpage_${i}.png`),
          fullPage: true,
        });
        continue;
      }

      LOG(`📏 Размер канваса: ${box.width.toFixed(1)} x ${box.height.toFixed(1)}`);

      // Получаем размер страницы (scrollable)
      const pageSize = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      LOG(`📜 Размер всей страницы: ${pageSize.width} x ${pageSize.height}`);

      // Если канвас выходит за пределы окна — делаем fullPage скриншот
      if (
        box.width > page.viewportSize()!.width ||
        box.height > page.viewportSize()!.height
      ) {
        LOG('📸 Канвас шире/выше экрана — снимаем всю страницу и обрезаем канвас');

        const fullBuffer = await page.screenshot({ fullPage: true });
        const sharp = (await import('sharp')).default;

        const cropped = await sharp(fullBuffer)
          .extract({
            left: Math.max(0, Math.floor(box.x)),
            top: Math.max(0, Math.floor(box.y)),
            width: Math.min(Math.floor(box.width), pageSize.width - Math.floor(box.x)),
            height: Math.min(Math.floor(box.height), pageSize.height - Math.floor(box.y)),
          })
          .toBuffer();

        const filePath = path.join(outDir, `canvas_${i}.png`);
        await fs.promises.writeFile(filePath, cropped);
        LOG(`✅ Сохранён обрезанный скриншот: ${filePath}`);
      } else {
        LOG('📸 Канвас помещается в окно — снимаем напрямую');
        await canvas.screenshot({ path: path.join(outDir, `canvas_${i}.png`) });
        LOG(`✅ Сохранён canvas_${i}.png`);
      }

    } catch (err: any) {
      LOG(`❌ Ошибка при обработке канваса #${i}: ${err.message}`);
      const fallbackPath = path.join(outDir, `canvas_error_fullpage_${i}.png`);
      await page.screenshot({ path: fallbackPath, fullPage: true });
      LOG(`📸 Fallback fullPage скриншот сохранён: ${fallbackPath}`);
    }
  }

  LOG('\n🏁 Все канвасы успешно обработаны.');
}
