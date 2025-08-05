import { Page } from '@playwright/test';
import ExcelJS from 'exceljs';

export class TablePage {
  constructor(private readonly page: Page) {}

  async exportTableToExcel(selector: string, outputPath = './output.xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    const tableData = await this.page.locator(selector).evaluate((table: HTMLTableElement) => {
      const result: string[][] = [];
      const spanMap: Record<string, string> = {};

      const rows = Array.from(table.querySelectorAll('tr'));
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const cells = Array.from(row.querySelectorAll('th, td'));
        const rowData: string[] = [];

        let colIndex = 0;

        for (const cell of cells) {
          // Пропускаем колонки, занятые rowspan из предыдущих строк
          while (spanMap[`${rowIndex},${colIndex}`] !== undefined) {
            rowData[colIndex] = spanMap[`${rowIndex},${colIndex}`];
            colIndex++;
          }

          const text = cell.textContent?.trim() ?? '';
          const rowspan = parseInt(cell.getAttribute('rowspan') || '1');
          const colspan = parseInt(cell.getAttribute('colspan') || '1');

          // Записываем значение в текущую строку
          for (let c = 0; c < colspan; c++) {
            rowData[colIndex + c] = text;
          }

          // Запоминаем значение для будущих строк
          if (rowspan > 1) {
            for (let r = 1; r < rowspan; r++) {
              for (let c = 0; c < colspan; c++) {
                spanMap[`${rowIndex + r},${colIndex + c}`] = text;
              }
            }
          }

          colIndex += colspan;
        }

        result.push(rowData);
      }

      // Выравниваем строки по длине
      const maxCols = Math.max(...result.map(r => r.length));
      return result.map(row => {
        while (row.length < maxCols) row.push('');
        return row;
      });
    });

    for (const row of tableData) {
      sheet.addRow(row);
    }

    await workbook.xlsx.writeFile(outputPath);
    console.log(`✅ Exported Excel: ${outputPath}`);
  }
}
