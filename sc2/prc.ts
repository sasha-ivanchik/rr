import * as ExcelJs from "exceljs";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";

/**
 * Читает Excel и возвращает string[][]
 * Для больших файлов сначала пишет во временный CSV, потом читает его
 * Только стандартные библиотеки + ExcelJS
 * 
 * @param filePath путь к Excel
 * @param sheetName имя листа
 * @param headers список заголовков (если задан – читаем только эти колонки)
 */
export async function readExcelSheet(
  filePath: string,
  sheetName: string,
  headers?: string[]
): Promise<string[][]> {
  // создаем временный файл
  const tmpFile = path.join(os.tmpdir(), `exceljs_tmp_${Date.now()}.csv`);
  const tmpStream = fs.createWriteStream(tmpFile, { encoding: "utf8" });

  let headerRow: string[] | null = null;
  let headerMap: Record<string, number> = {};

  const workbook = new ExcelJs.stream.xlsx.WorkbookReader(fs.createReadStream(filePath), {
    entries: "emit",
    sharedStrings: "emit", // потоковое чтение строк
    styles: "ignore",      // игнорируем стили
    worksheets: "emit",
  }) as unknown as NodeJS.EventEmitter;

  // записываем построчно во временный CSV
  await new Promise<void>((resolve, reject) => {
    (workbook as any).on("worksheet", (worksheet: any) => {
      if (worksheet.name !== sheetName) return;

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

          const outputHeader = headers && headers.length > 0 ? headers : headerRow;
          tmpStream.write(outputHeader.map((v) => `"${v.replace(/"/g, '""')}"`).join(",") + "\n");
        } else {
          const values = headers && headers.length > 0
            ? headers.map((h) => {
                const idx = headerMap[h];
                return idx !== undefined ? allValues[idx] ?? "" : "";
              })
            : allValues;

          tmpStream.write(values.map((v) => `"${v.replace(/"/g, '""')}"`).join(",") + "\n");
        }
      });
    });

    (workbook as any).on("end", () => resolve());
    (workbook as any).on("error", (err: any) => reject(err));
  });

  tmpStream.end();

  // читаем CSV обратно в string[][]
  const result: string[][] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(tmpFile, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    // простая CSV-разборка: кавычки и запятые
    const values = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((v) =>
      v.startsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v
    ) ?? [];
    result.push(values);
  }

  // удаляем временный файл
  fs.unlinkSync(tmpFile);

  return result;
}
