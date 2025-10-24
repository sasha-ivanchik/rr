export async function extractStructuredTablesFromCanvas(
  page: Page,
  zoomScale = 2 // во сколько раз увеличить
): Promise<AllTables> {
  const result: AllTables = {};

  try {
    console.log(`🔍 Применяем zoom-in через CSS transform x${zoomScale}...`);
    await page.evaluate((scale) => {
      document.body.style.transformOrigin = '0 0';
      document.body.style.transform = `scale(${scale})`;
    }, zoomScale);

    await page.waitForTimeout(300); // ждём применения трансформации

    console.log('📸 Делаем скриншот всей страницы...');
    const screenshotPath = path.resolve(process.cwd(), 'page_screenshot.png');
    const buffer = await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Скриншот сохранён: ${screenshotPath}, размер: ${buffer.length} байт`);

    // сброс transform
    await page.evaluate(() => {
      document.body.style.transform = '';
    });

    console.log('🧠 Запуск OCR...');
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      langPath: path.resolve(process.cwd(), 'tessdata'),
      gzip: false,
      logger: (info) => console.log(`[OCR] ${info.status}: ${info.progress?.toFixed(2)}`),
    });

    const words = (data.words ?? []).filter((w) => w.text?.trim());
    console.log(`🔠 OCR распознал ${words.length} слов`);

    if (!words.length) return result;

    const rows = groupWordsByRows(words);
    const table: TableStructure = {};

    rows.forEach((rowWords, rowIndex) => {
      const rowData: Record<number, string> = {};
      rowWords.forEach((w, colIndex) => (rowData[colIndex] = w.text.trim()));
      table[rowIndex] = rowData;
    });

    result[0] = table;
    console.log('✅ Таблица сформирована успешно');
  } catch (err) {
    console.error('❌ Ошибка в extractStructuredTablesFromCanvas:', err);
  }

  return result;
}
