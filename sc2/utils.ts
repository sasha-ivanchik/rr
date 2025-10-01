import * as XLSX from "xlsx";
import * as fs from "fs";

/**
 * Asynchronously reads an Excel sheet into a 2D string array.
 *
 * @param filePath - Path to the Excel file (.xlsx / .xls / .csv)
 * @param sheetName - Optional sheet name. If not provided, the first sheet will be used.
 * @returns Promise<string[][]>
 */
export async function readExcelAsArrays(
  filePath: string,
  sheetName?: string
): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(filePath)) {
        reject(new Error(`File not found: ${filePath}`));
        return;
      }

      const workbook = XLSX.readFile(filePath, { cellDates: false });

      const allSheets = workbook.SheetNames;
      if (allSheets.length === 0) {
        reject(new Error("No sheets found in the file"));
        return;
      }

      let targetName: string | undefined;

      if (sheetName) {
        // Try exact match
        targetName = allSheets.find((name) => name === sheetName);

        // Try case-insensitive and trimmed match
        if (!targetName) {
          targetName = allSheets.find(
            (name) =>
              name.trim().toLowerCase() === sheetName.trim().toLowerCase()
          );
        }

        if (!targetName) {
          reject(
            new Error(
              `Sheet "${sheetName}" not found. Available sheets: ${allSheets.join(", ")}`
            )
          );
          return;
        }
      } else {
        // Use the first sheet if no name is provided
        targetName = allSheets[0];
      }

      const sheet = workbook.Sheets[targetName];

      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,   // return rows as arrays
        defval: "",  // default empty cells to ""
        raw: false   // convert everything to strings
      });

      const result: string[][] = rows.map((row) =>
        row.map((cell) => String(cell ?? ""))
      );

      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}
