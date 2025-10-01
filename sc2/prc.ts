import * as ExcelJs from "exceljs";
import * as fs from "fs";

/**
 * Читает Excel в string[][]
 * @param filePath путь к файлу .xlsx
 * @param sheetName имя листа
 * @param headers список заголовков (если есть – читаем только их, иначе все)
 */
export async function readExcelSheet(
  filePath: string,
  sheetName: string,
  headers?: string[]
): Promise<string[][]> {
  return new Promise<string[][]>((resolve, reject) => {
    const rows: string[][] = [];
    let headerRow: string[] | null = null;
    let headerMap: Record<string, number> = {};

    // 🚀 Главное отличие: sharedStrings: 'emit'
    const workbook = new ExcelJs.stream.xlsx.WorkbookReader(fs.createReadStream(filePath), {
      entries: "emit",
      sharedStrings: "emit", // ⚡ читаем строки потоком, не кэшируем
      styles: "ignore",      // игнорируем стили (ускоряет и экономит память)
      worksheets: "emit",
    }) as unknown as NodeJS.EventEmitter;

    (workbook as any).on("worksheet", (worksheet: any) => {
      if (worksheet.name === sheetName) {
        worksheet.on("row", (row: any) => {
          const allValues: string[] = (row.values || [])
            .slice(1)
            .map((c: any) => (c != null ? String(c) : ""));

          if (!headerRow) {
            // первая строка — заголовки
            headerRow = allValues;
            headerRow.forEach((name, idx) => {
              if (name) headerMap[name.trim()] = idx;
            });

            rows.push(headers && headers.length > 0 ? headers : headerRow);
          } else {
            let values: string[];
            if (headers && headers.length > 0) {
              values = headers.map((h) => {
                const idx = headerMap[h];
                return idx !== undefined ? allValues[idx] ?? "" : "";
              });
            } else {
              values = allValues;
            }
            rows.push(values);
          }
        });
      }
    });

    (workbook as any).on("end", () => resolve(rows));
    (workbook as any).on("error", (err: any) => reject(err));
  });
}
