import * as ExcelJS from 'exceljs';
import * as fs from 'fs';

async function readExcelSheet(filePath: string, sheetName: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  
  // Используем streaming для больших файлов
  const stream = fs.createReadStream(filePath);
  await workbook.xlsx.read(stream);
  
  const worksheet = workbook.getWorksheet(sheetName);
  
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found in file`);
  }
  
  const result: string[][] = [];
  
  // Итерируем по строкам напрямую без промежуточных массивов
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const rowData: string[] = [];
    
    // Получаем количество колонок из worksheet
    const colCount = worksheet.columnCount || row.cellCount;
    
    for (let i = 1; i <= colCount; i++) {
      const cell = row.getCell(i);
      
      // Обрабатываем разные типы данных
      let value = '';
      
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object') {
          // Обработка формул, гиперссылок и других объектов
          if ('result' in cell.value) {
            value = String(cell.value.result ?? '');
          } else if ('text' in cell.value) {
            value = String(cell.value.text);
          } else {
            value = String(cell.value);
          }
        } else {
          value = String(cell.value);
        }
      }
      
      rowData.push(value);
    }
    
    result.push(rowData);
  });
  
  return result;
}

// Альтернативный метод для ОЧЕНЬ больших файлов (с потоковым чтением)
async function readExcelSheetStreaming(filePath: string, sheetName: string): Promise<string[][]> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
    worksheets: 'emit'
  });
  
  const result: string[][] = [];
  let targetSheet: ExcelJS.Worksheet | null = null;
  
  for await (const worksheetReader of workbook) {
    if (worksheetReader.name === sheetName) {
      targetSheet = worksheetReader as ExcelJS.Worksheet;
      
      for await (const row of worksheetReader) {
        const rowData: string[] = [];
        const excelRow = row as ExcelJS.Row;
        
        excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          let value = '';
          
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object') {
              if ('result' in cell.value) {
                value = String(cell.value.result ?? '');
              } else if ('text' in cell.value) {
                value = String(cell.value.text);
              } else {
                value = String(cell.value);
              }
            } else {
              value = String(cell.value);
            }
          }
          
          rowData[colNumber - 1] = value;
        });
        
        // Заполняем пустые ячейки
        const maxCol = excelRow.cellCount;
        for (let i = 0; i < maxCol; i++) {
          if (rowData[i] === undefined) rowData[i] = '';
        }
        
        result.push(rowData);
      }
      break;
    }
  }
  
  if (!targetSheet) {
    throw new Error(`Sheet "${sheetName}" not found in file`);
  }
  
  return result;
}

// Экспорт
export { readExcelSheet, readExcelSheetStreaming };