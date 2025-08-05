import { Page } from '@playwright/test';
import ExcelJS from 'exceljs';

export class TablePage {
  constructor(private readonly page: Page) {}

  async exportTableToExcel(selector: string, outputPath = './output.xlsx', chunkSize = 1000) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    let currentRow = 1;
    let processedRows: string[][] = [];

    const tableData = await this.page.locator(selector).evaluate((table: HTMLTableElement) => {
      const result: string[][] = [];
      const rowspanMap: Record<string, string> = {};

      const rows = Array.from(table.rows);

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const resultRow: string[] = [];

        let colIndex = 0;
        let actualCol = 0;

        while (colIndex < row.cells.length || true) {
          const key = `${rowIndex},${actualCol}`;

          // Вставка данных из rowspanMap, если есть
          if (rowspanMap[key]) {
            resultRow.push(rowspanMap[key]);
            actualCol++;
            continue;
          }

          const cell = row.cells[colIndex];
          if (!cell) break;

          const text = cell.innerText.trim();
          const rowspan = Number(cell.getAttribute('rowspan') || 1);

          resultRow.push(text);

          if (rowspan > 1) {
            for (let offset = 1; offset < rowspan; offset++) {
              const targetKey = `${rowIndex + offset},${actualCol}`;
              rowspanMap[targetKey] = text;
            }
          }

          colIndex++;
          actualCol++;
        }

        result.push(resultRow);
      }

      return result;
    });

    // Пакетная запись в Excel
    for (let i = 0; i < tableData.length; i++) {
      processedRows.push(tableData[i]);

      if (processedRows.length === chunkSize || i === tableData.length - 1) {
        for (const row of processedRows) {
          sheet.addRow(row);
          currentRow++;
        }
        processedRows = [];
      }
    }

    await workbook.xlsx.writeFile(outputPath);
    console.log(`✅ Exported Excel: ${outputPath}`);
  }
}
