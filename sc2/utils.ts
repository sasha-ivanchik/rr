import * as fs from "fs/promises";
import * as path from "path";
import * as XLSX from "xlsx";

/**
 * Reads an Excel file safely (including OpenFin Excel files)
 * and returns string[][]. Uses a temporary CSV next to the original file.
 *
 * @param excelPath - Path to the Excel file
 * @param sheetName - Optional sheet name. If missing, first sheet is used.
 */
export async function readExcelSafe(excelPath: string, sheetName?: string): Promise<string[][]> {
  const dir = path.dirname(excelPath);
  const base = path.basename(excelPath, path.extname(excelPath));
  const tmpCsvPath = path.join(dir, `${base}_tmp.csv`);

  try {
    // Load workbook
    const workbook = XLSX.readFile(excelPath, { cellDates: false });

    // Determine sheet
    let targetSheet = sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];

    if (!targetSheet) return [];

    const worksheet = workbook.Sheets[targetSheet];
    if (!worksheet || !worksheet["!ref"]) return [];

    // Convert to CSV temporarily
    XLSX.writeFile({ Sheets: { [targetSheet]: worksheet }, SheetNames: [targetSheet] }, tmpCsvPath, { bookType: "csv" });

    // Read CSV as string[][] line by line
    const csvContent = await fs.readFile(tmpCsvPath, "utf-8");
    const rows = csvContent
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => line.split(",").map(cell => cell.trim()));

    return rows;
  } catch (err) {
    console.error("Error reading Excel:", err);
    return [];
  } finally {
    // Cleanup temporary CSV
    await fs.unlink(tmpCsvPath).catch(() => {});
  }
}
