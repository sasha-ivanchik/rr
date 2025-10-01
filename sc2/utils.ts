export function readExcelAsArrays(
  filePath: string,
  sheetName: string
): string[][] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Файл не найден: ${filePath}`);
  }

  // Читаем файл
  const workbook = XLSX.readFile(filePath, { cellDates: false });

  if (!workbook.Sheets[sheetName]) {
    throw new Error(`Лист "${sheetName}" не найден в файле.`);
  }

  const sheet = workbook.Sheets[sheetName];

  // Преобразуем лист в массив массивов
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,   // каждая строка → массив
    defval: "",  // если ячейка пустая → ""
    raw: false   // приводим всё к строкам
  });

  // Гарантируем, что это string[][]
  return rows.map(row => row.map(cell => String(cell ?? "")));
}