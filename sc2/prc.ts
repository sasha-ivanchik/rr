import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export class LargeExcelReader {
  
  /**
   * Чтение больших Excel файлов с возвратом string[][]
   */
  async readExcelToArray(
    filePath: string, 
    sheetName: string
  ): Promise<string[][]> {
    const tempCsvPath = this.getTempCsvPath(filePath);
    
    try {
      await this.excelToCsvWithBatchProcessing(filePath, sheetName, tempCsvPath);
      const data = await this.readCsvToArray(tempCsvPath);
      return data;
    } finally {
      this.cleanupTempFile(tempCsvPath);
    }
  }

  /**
   * Конвертация Excel в CSV с пакетной обработкой
   */
  private async excelToCsvWithBatchProcessing(
    excelPath: string, 
    sheetName: string, 
    csvPath: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    
    // Читаем файл с оптимизацией для больших файлов
    await workbook.xlsx.readFile(excelPath, {
      ignoreNodes: ['style', 'hyperlink', 'format'],
      maxRows: 0 // без ограничений
    });
    
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    const csvStream = fs.createWriteStream(csvPath, { encoding: 'utf8' });
    
    // Обрабатываем строки порциями для экономии памяти
    const batchSize = 500; // Можно настроить в зависимости от размера файла
    const totalRows = worksheet.rowCount;
    
    for (let startRow = 1; startRow <= totalRows; startRow += batchSize) {
      const endRow = Math.min(startRow + batchSize - 1, totalRows);
      
      for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
        const row = worksheet.getRow(rowNum);
        if (row && row.values) {
          const csvLine = this.convertRowToCsv(row.values as any[], rowNum === 1);
          if (csvLine) {
            csvStream.write(csvLine + '\n');
          }
        }
        
        // Освобождаем память после обработки строки
        if (worksheet.getRow(rowNum)) {
          worksheet.getRow(rowNum).commit();
        }
      }
      
      // Принудительный вызов сборщика мусора (если доступен)
      if (global.gc) {
        global.gc();
      }
    }
    
    csvStream.end();
    
    return new Promise((resolve, reject) => {
      csvStream.on('finish', resolve);
      csvStream.on('error', reject);
    });
  }

  /**
   * Альтернативный метод с использованием read вместо readFile
   */
  private async excelToCsvWithStream(
    excelPath: string, 
    sheetName: string, 
    csvPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const workbook = new ExcelJS.Workbook();
      const csvStream = fs.createWriteStream(csvPath, { encoding: 'utf8' });
      let headersWritten = false;

      const readStream = fs.createReadStream(excelPath);
      
      workbook.xlsx.read(readStream)
        .then(() => {
          const worksheet = workbook.getWorksheet(sheetName);
          if (!worksheet) {
            throw new Error(`Sheet '${sheetName}' not found`);
          }

          // Обрабатываем каждую строку
          worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            try {
              const csvLine = this.convertRowToCsv(row.values as any[], rowNumber === 1);
              if (csvLine) {
                csvStream.write(csvLine + '\n');
              }
            } catch (error) {
              console.warn(`Error processing row ${rowNumber}:`, error);
            }
          });

          csvStream.end();
          resolve();
        })
        .catch(reject);

      csvStream.on('error', reject);
    });
  }

  /**
   * Конвертация строки Excel в CSV формат
   */
  private convertRowToCsv(rowValues: any[], isFirstRow: boolean): string {
    if (!rowValues || rowValues.length === 0) {
      return '';
    }

    // Пропускаем первый элемент (обычно это номер строки в exceljs)
    const values = rowValues.slice(1);
    
    const csvCells: string[] = [];
    
    for (const value of values) {
      const stringValue = this.safeToString(value);
      csvCells.push(this.escapeCsvValue(stringValue));
    }
    
    return csvCells.join(',');
  }

  /**
   * Экранирование значения для CSV
   */
  private escapeCsvValue(value: string): string {
    if (value === '') {
      return '';
    }
    
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    
    return value;
  }

  /**
   * Безопасное преобразование в строку
   */
  private safeToString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    if (typeof value === 'object') {
      // Для формул берем результат
      if (value.formula) {
        return this.safeToString(value.result);
      }
      
      // Для богатого текста
      if (value.richText) {
        return value.richText.map((text: any) => text.text).join('');
      }
      
      try {
        return String(value);
      } catch {
        return '';
      }
    }
    
    return String(value);
  }

  /**
   * Чтение CSV файла в массив строк
   */
  private async readCsvToArray(csvPath: string): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const result: string[][] = [];
      
      const readStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        if (line.trim() === '') {
          return;
        }
        
        try {
          const row = this.parseCsvLine(line);
          result.push(row);
        } catch (error) {
          console.warn('Error parsing CSV line:', line, error);
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
   * Парсинг CSV строки
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

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

  /**
   * Генерация пути для временного CSV файла
   */
  private getTempCsvPath(originalPath: string): string {
    const dir = path.dirname(originalPath);
    const name = path.basename(originalPath, path.extname(originalPath));
    return path.join(dir, `${name}_temp_${Date.now()}.csv`);
  }

  /**
   * Очистка временного файла
   */
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