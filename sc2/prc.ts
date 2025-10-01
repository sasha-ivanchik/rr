import Excel from "exceljs";
import * as fs from "fs";

export async function readExcelSheet(filePath: string, sheetName: string): Promise<string[][]> {
  return new Promise<string[][]>((resolve, reject) => {
    const rows: string[][] = [];
    const workbook = new Excel.stream.xlsx.WorkbookReader(fs.createReadStream(filePath), {
      entries: "emit",       // события по каждому entry (sheet, sharedStrings и т.д.)
      sharedStrings: "cache",
      styles: "cache",
      worksheets: "emit",    // читать только листы
    });

    workbook.on("worksheet", (worksheet) => {
      if (worksheet.name === sheetName) {
        worksheet.on("row", (row) => {
          // row.values[0] — это undefined, т.к. exceljs делает 1-based массив
          const values = row.values
            .slice(1) // убираем первый undefined
            .map((cell) => (cell != null ? String(cell) : "")); // приводим всё к string

          rows.push(values);
        });
      }
    });

    workbook.on("end", () => {
      resolve(rows);
    });

    workbook.on("error", (err) => {
      reject(err);
    });
  });
}
