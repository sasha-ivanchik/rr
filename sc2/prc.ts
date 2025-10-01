import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

async function readExcel(
  filePath:string,
  sheetName: string,
): Promise<string[][]> {
  const ExcelJS = require('exceljs');
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {entries: 'emit'});
  const data: string[][] = [];

  let maxColumns = 0
  let proccessed = false

  for await (const worksheet of workbookReader) {
    const wsName = (worksheet as any).name

    for await (const row of worksheet) {
      const rowData = (row.values as any[]).slice(1).map(cell => 
        cell !== undefined && cell !== null ? String(cell).trim() : ''
      );
      maxColumns = Math.max(maxColumns, rowData.length)
      data.push(rowData);
    }
    proccessed = true
    break
  }

  if (!proccessed) {
    throw new Error('No sheets')
  }

  for (const row of data) {
    while (row.length < maxColumns) row.push('')
  }

  return data
}