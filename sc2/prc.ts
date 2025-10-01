async function readExcelSheet(filePath: string, sheetName: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  
  try {
    await workbook.xlsx.readFile(filePath);
  } catch (error) {
    throw new Error(`Failed to read Excel file "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  const worksheet = workbook.getWorksheet(sheetName);
  
  if (!worksheet) {
    const availableSheets = workbook.worksheets.map(ws => ws.name).join(', ');
    throw new Error(`Sheet "${sheetName}" not found. Available sheets: ${availableSheets}`);
  }
  
  const result: string[][] = [];
  const CHUNK_SIZE = 1000; // Обрабатываем по 1000 строк за раз
  let tempChunk: string[][] = [];
  let processedRows = 0;
  
  try {
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowData: string[] = [];
      
      // Используем actualCellCount для экономии памяти
      const cellCount = row.actualCellCount || row.cellCount || 0;
      const maxCols = Math.min(cellCount, 500); // Ограничиваем разумным количеством колонок
      
      for (let colNum = 1; colNum <= maxCols; colNum++) {
        const cell = row.getCell(colNum);
        let value = '';
        
        try {
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object') {
              if ('result' in cell.value) {
                const res = cell.value.result;
                value = res !== null && res !== undefined ? String(res) : '';
              } else if ('text' in cell.value) {
                value = String(cell.value.text);
              } else if ('richText' in cell.value && Array.isArray(cell.value.richText)) {
                value = cell.value.richText
                  .map((rt: any) => (rt && rt.text) ? String(rt.text) : '')
                  .join('');
              } else if ('error' in cell.value) {
                value = String(cell.value.error);
              } else if (cell.value instanceof Date) {
                value = cell.value.toISOString();
              } else {
                value = String(cell.value);
              }
            } else {
              value = String(cell.value);
            }
            
            // Ограничиваем длину строки
            if (value.length > 10000) {
              value = value.substring(0, 10000);
            }
          }
        } catch (err) {
          value = '';
        }
        
        rowData.push(value);
      }
      
      // Добавляем строку во временный чанк
      tempChunk.push(rowData);
      processedRows++;
      
      // Когда накопили CHUNK_SIZE строк, переносим в основной результат
      if (tempChunk.length >= CHUNK_SIZE) {
        result.push(...tempChunk);
        tempChunk = []; // Очищаем временный чанк
        
        if (processedRows % 5000 === 0) {
          console.log(`Processed ${processedRows} rows...`);
        }
      }
    });
    
    // Добавляем оставшиеся строки
    if (tempChunk.length > 0) {
      result.push(...tempChunk);
    }
    
    console.log(`Completed: read ${processedRows} rows from "${sheetName}"`);
    
  } catch (error) {
    throw new Error(`Error during reading: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return result;
}