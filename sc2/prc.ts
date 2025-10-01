import * as ExcelJS from 'exceljs';

/**
 * Универсальный метод для чтения Excel файлов любого размера
 * @param filePath - путь к Excel файлу
 * @param sheetName - имя листа для чтения
 * @returns Promise<string[][]> - массив строк, где каждая строка это массив ячеек
 */
async function readExcelSheet(filePath: string, sheetName: string): Promise<string[][]> {
  const result: string[][] = [];
  
  try {
    // Используем потоковое чтение для стабильности с большими файлами
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
    });
    
    let foundSheet = false;
    
    for await (const worksheetReader of workbookReader) {
      if (worksheetReader.name === sheetName) {
        foundSheet = true;
        
        // Читаем все строки из найденного листа
        for await (const row of worksheetReader) {
          const excelRow = row as ExcelJS.Row;
          const rowData: string[] = [];
          
          // Определяем максимальное количество колонок в строке
          const maxCol = excelRow.cellCount;
          
          // Читаем все ячейки в строке
          for (let colNum = 1; colNum <= maxCol; colNum++) {
            const cell = excelRow.getCell(colNum);
            let value = '';
            
            try {
              if (cell.value !== null && cell.value !== undefined) {
                // Обработка различных типов данных Excel
                if (typeof cell.value === 'object') {
                  // Формулы
                  if ('result' in cell.value) {
                    value = String(cell.value.result ?? '');
                  }
                  // Гиперссылки
                  else if ('text' in cell.value) {
                    value = String(cell.value.text);
                  }
                  // Rich Text (форматированный текст)
                  else if ('richText' in cell.value && Array.isArray(cell.value.richText)) {
                    value = cell.value.richText.map((rt: any) => rt.text || '').join('');
                  }
                  // Ошибки Excel
                  else if ('error' in cell.value) {
                    value = String(cell.value.error);
                  }
                  // Даты
                  else if (cell.value instanceof Date) {
                    value = cell.value.toISOString();
                  }
                  // Остальные объекты
                  else {
                    value = JSON.stringify(cell.value);
                  }
                } else {
                  // Простые типы: string, number, boolean
                  value = String(cell.value);
                }
              }
            } catch (error) {
              // Если не удалось обработать ячейку, оставляем пустую строку
              console.warn(`Warning: failed to read cell at row ${excelRow.number}, col ${colNum}:`, error);
              value = '';
            }
            
            rowData.push(value);
          }
          
          result.push(rowData);
        }
        
        // Нашли нужный лист, можно прекратить поиск
        break;
      }
    }
    
    if (!foundSheet) {
      throw new Error(`Sheet "${sheetName}" not found in the Excel file`);
    }
    
  } catch (error) {
    // Пробрасываем ошибку с понятным сообщением
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to read Excel file "${filePath}": ${error.message}`);
    }
    throw new Error(`Failed to read Excel file "${filePath}": Unknown error`);
  }
  
  return result;
}

export default readExcelSheet;