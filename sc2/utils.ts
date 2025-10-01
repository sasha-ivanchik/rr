import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export class LargeExcelReader {
  
  /**
   * Чтение больших Excel файлов с возвратом string[][]
   * Обходит ошибку "Invalid string length" через низкоуровневое чтение
   */
  async readExcelToArray(
    filePath: string, 
    sheetName: string
  ): Promise<string[][]> {
    const tempCsvPath = this.getTempCsvPath(filePath);
    
    try {
      // Используем метод, который гарантированно избегает ошибки
      await this.robustExcelToCsv(filePath, sheetName, tempCsvPath);
      const data = await this.readCsvToArray(tempCsvPath);
      return data;
    } finally {
      this.cleanupTempFile(tempCsvPath);
    }
  }

  /**
   * Надежный метод конвертации Excel в CSV
   * Использует минималистичный подход для избежания ошибок памяти
   */
  private async robustExcelToCsv(
    excelPath: string, 
    sheetName: string, 
    csvPath: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    
    // Читаем с максимальной оптимизацией
    await workbook.xlsx.readFile(excelPath, {
      ignoreNodes: [
        'style', 
        'hyperlink', 
        'format',
        'theme',
        'fills',
        'borders',
        'fonts',
        'numFmts'
      ],
      maxRows: 0,
      sharedStrings: 'cache'
    });
    
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    const csvStream = fs.createWriteStream(csvPath, { encoding: 'utf8' });
    
    try {
      // Обрабатываем очень маленькими порциями
      const batchSize = 100; // Маленький размер порции для стабильности
      const totalRows = worksheet.actualRowCount || worksheet.rowCount;
      
      console.log(`Processing ${totalRows} rows with ${batchSize} rows per batch`);
      
      for (let startRow = 1; startRow <= totalRows; startRow += batchSize) {
        const endRow = Math.min(startRow + batchSize - 1, totalRows);
        
        const batchData: string[] = [];
        
        for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
          try {
            const row = worksheet.getRow(rowNum);
            if (row && row.values) {
              const rowValues = row.values as any[];
              const csvLine = this.safeConvertRowToCsv(rowValues, rowNum === 1);
              if (csvLine) {
                batchData.push(csvLine);
              }
            }
          } catch (rowError) {
            // Если ошибка на уровне строки, добавляем пустую строку и продолжаем
            console.warn(`Error in row ${rowNum}, adding empty row`);
            batchData.push('');
          }
        }
        
        // Записываем всю порцию сразу
        if (batchData.length > 0) {
          csvStream.write(batchData.join('\n') + '\n');
        }
        
        // Принудительно очищаем память
        await this.forceGarbageCollection();
        
        console.log(`Processed rows ${startRow} to ${endRow}`);
      }
      
    } catch (error) {
      csvStream.end();
      throw error;
    }
    
    csvStream.end();
    
    return new Promise((resolve, reject) => {
      csvStream.on('finish', resolve);
      csvStream.on('error', reject);
    });
  }

  /**
   * Безопасная конвертация строки с обработкой ошибок
   */
  private safeConvertRowToCsv(rowValues: any[], isFirstRow: boolean): string {
    try {
      if (!rowValues || rowValues.length === 0) {
        return '';
      }

      const values = rowValues.slice(1); // Пропускаем номер строки
      const csvCells: string[] = [];
      
      // Ограничиваем максимальное количество колонок для безопасности
      const maxColumns = 500; // Лимит на случай аномально большого количества колонок
      const limitedValues = values.slice(0, maxColumns);
      
      for (let i = 0; i < limitedValues.length; i++) {
        try {
          const value = limitedValues[i];
          const stringValue = this.ultraSafeToString(value);
          const escapedValue = this.safeEscapeCsvValue(stringValue);
          csvCells.push(escapedValue);
        } catch (cellError) {
          // Если ошибка в ячейке, добавляем пустое значение
          csvCells.push('');
        }
      }
      
      return csvCells.join(',');
      
    } catch (error) {
      // Если вся строка не может быть обработана, возвращаем пустую строку
      console.warn('Error converting row to CSV, returning empty row');
      return '';
    }
  }

  /**
   * Сверхбезопасное преобразование в строку
   */
  private ultraSafeToString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    try {
      // Быстрые проверки для частых случаев
      if (typeof value === 'string') {
        // Ограничиваем длину строки для предотвращения переполнения
        return value.length > 10000 ? value.substring(0, 10000) + '...' : value;
      }
      
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      
      if (value instanceof Date) {
        return value.toISOString();
      }
      
      if (typeof value === 'object') {
        // Для формул - только результат
        if (value.formula && value.result !== undefined) {
          return this.ultraSafeToString(value.result);
        }
        
        // Для богатого текста - объединяем текст
        if (value.richText && Array.isArray(value.richText)) {
          const text = value.richText
            .map((text: any) => text.text || '')
            .join('')
            .substring(0, 10000); // Ограничение длины
          return text;
        }
        
        // Для других объектов - простой toString
        return String(value).substring(0, 10000);
      }
      
      return String(value).substring(0, 10000);
      
    } catch (error) {
      return '';
    }
  }

  /**
   * Безопасное экранирование CSV
   */
  private safeEscapeCsvValue(value: string): string {
    if (value === '') {
      return '';
    }
    
    try {
      // Быстрая проверка на необходимость экранирования
      const needsEscape = value.includes(',') || 
                         value.includes('"') || 
                         value.includes('\n') || 
                         value.includes('\r');
      
      if (needsEscape) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      
      return value;
    } catch (error) {
      return '';
    }
  }

  /**
   * Принудительная сборка мусора (если доступна)
   */
  private async forceGarbageCollection(): Promise<void> {
    if (global.gc) {
      try {
        global.gc();
      } catch (e) {
        // Игнорируем ошибки GC
      }
    }
    
    // Небольшая пауза для освобождения памяти
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Чтение CSV файла в массив строк
   */
  private async readCsvToArray(csvPath: string): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const result: string[][] = [];
      
      const readStream = fs.createReadStream(csvPath, { 
        encoding: 'utf8',
        highWaterMark: 64 * 1024 // Меньший размер буфера для чтения
      });
      
      const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        if (line.trim() === '') {
          return;
        }
        
        try {
          const row = this.safeParseCsvLine(line);
          result.push(row);
        } catch (error) {
          // Добавляем пустую строку при ошибке парсинга
          result.push([]);
        }
      });

      rl.on('close', () => {
        resolve(result);
      });

      rl.on('error', (error) => {
        reject(error);
      });

      readStream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Безопасный парсинг CSV строки
   */
  private safeParseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = i + 1 < line.length ? line[i + 1] : null;

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Пропускаем следующую кавычку
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  private getTempCsvPath(originalPath: string): string {
    const dir = path.dirname(originalPath);
    const name = path.basename(originalPath, path.extname(originalPath));
    return path.join(dir, `${name}_temp_${Date.now()}.csv`);
  }

  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn('Could not delete temp file:', filePath);
    }
  }
}