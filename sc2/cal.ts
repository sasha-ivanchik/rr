import { Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import * as fs from 'fs';

export async function parseHtmlTableInChunks(
  page: Page,
  tableSelector: string,
  chunkSize = 1000,
  outputPath = './output.xlsx'
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');

  let currentRow = 1;
  let processedRows: string[][] = [];

  const tableData = await page.locator(tableSelector).evaluate((table: HTMLTableElement) => {
    const result: string[][] = [];
    const rowspanMap: Record<string, { value: string; left: number }> = {};

    const rows = Array.from(table.rows);

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const resultRow: string[] = [];
      let colIndex = 0;

      while (colIndex < row.cells.length || Object.keys(rowspanMap).some(k => +k.split(',')[0] === rowIndex)) {
        while (rowspanMap[`${rowIndex},${resultRow.length}`]) {
          const spanData = rowspanMap[`${rowIndex},${resultRow.length}`];
          resultRow.push(spanData.value);

          if (spanData.left > 1) {
            rowspanMap[`${rowIndex + 1},${resultRow.length}`] = {
              value: spanData.value,
              left: spanData.left - 1,
            };
          }

          delete rowspanMap[`${rowIndex},${resultRow.length}`];
        }

        const cell = row.cells[colIndex];
        if (!cell) break;

        const text = cell.innerText.trim();
        const rowspan = Number(cell.getAttribute('rowspan') || 1);

        resultRow.push(text);

        if (rowspan > 1) {
          rowspanMap[`${rowIndex + 1},${resultRow.length - 1}`] = {
            value: text,
            left: rowspan - 1,
          };
        }

        colIndex++;
      }

      result.push(resultRow);
    }

    return result;
  });

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
  console.log(`✅ Done writing to ${outputPath}`);
}