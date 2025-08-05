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
      const rowspanMap: Record<string, string> = {}; // key = `${rowIndex},${colIndex}`

      const rows = Array.from(table.rows);

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const resultRow: string[] = [];

        let colIndex = 0;

        while (true) {
          // Заполнить ячейку из rowspanMap, если такая есть
          const key = `${rowIndex},${colIndex}`;
          if (rowspanMap[key]) {
            resultRow.push(rowspanMap[key]);
            colIndex++;
            continue;
          }

          const cell = row.cells[0]; // всегда берём первый элемент, т.к. мы его сдвигаем
          if (!cell) break;

          const text = cell.innerText.trim();
          const rowspan = Number(cell.getAttribute('rowspan') || 1);
          const colspan = Number(cell.getAttribute('colspan') || 1);

          // вставить значение текущей ячейки с учетом colspan
          for (let c = 0; c < colspan; c++) {
            resultRow[colIndex] = text;
            // если есть rowspan, запланировать вставку на будущие строки
            if (rowspan > 1) {
              for (let r = 1; r < rowspan; r++) {
                rowspanMap[`${rowIndex + r},${colIndex}`] = text;
              }
            }
            colIndex++;
          }

          row.deleteCell(0); // удаляем уже обработанную ячейку
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
