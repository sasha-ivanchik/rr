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
    // Создаем временный CSV файл
    const tempCsvPath = this.getTempCsvPath(filePath);
    
    try {
      // Конвертируем Excel в CSV потоковым способом
      await this.streamExcelToCsv(filePath, sheetName, tempCsvPath);
      
      // Читаем CSV файл построчно
      const data = await this.readCsvToArray(tempCsvPath);
      
      return data;
    } finally {
      // Всегда очищаем временный файл
      this.cleanupTempFile(tempCsvPath);
    }
  }

  /**
   * Потоковая конвертация Excel в CSV
   */
  private async streamExcelToCsv(
    excelPath: string, 
    sheetName: string, 
    csvPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(excelPath, {
        worksheets: 'emit',
        sharedStrings: 'cache',
        hyperlinks: 'ignore',
        styles: 'ignore'
      });

      const csvStream = fs.createWriteStream(csvPath, { encoding: 'utf8' });
      let targetSheetFound = false;

      workbookReader.on('worksheet', (worksheet: ExcelJS.stream.xlsx.WorksheetStreamReader) => {
        if (worksheet.name !== sheetName || targetSheetFound) {
          worksheet.skip();
          return;
        }
        
        targetSheetFound = true;
        let isFirstRow = true;

        worksheet.on('row', (row: ExcelJS.Row) => {
          try {
            const rowValues = row.values as any[];
            const csvLine = this.convertRowToCsv(rowValues, isFirstRow);
            
            if (csvLine) {
              csvStream.write(csvLine + '\n');
            }
            
            isFirstRow = false;
          } catch (rowError) {
            console.warn('Error processing row:', rowError);
            // Продолжаем обработку следующих строк
          }
        });

        worksheet.on('end', () => {
          csvStream.end();
        });
      });

      workbookReader.on('end', () => {
        if (!targetSheetFound) {
          csvStream.end();
          reject(new Error(`Sheet '${sheetName}' not found in file`));
          return;
        }
        resolve();
      });

      workbookReader.on('error', (error) => {
        csvStream.end();
        reject(error);
      });

      csvStream.on('error', (error) => {
        reject(error);
      });

      workbookReader.read();
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
    
    // Если значение содержит запятые, кавычки или переносы строк - экранируем
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
        crlfDelay: Infinity // Поддержка всех вариантов переноса строк
      });

      rl.on('line', (line) => {
        if (line.trim() === '') {
          return; // Пропускаем пустые строки
        }
        
        try {
          const row = this.parseCsvLine(line);
          result.push(row);
        } catch (error) {
          console.warn('Error parsing CSV line:', line, error);
          // Добавляем пустую строку вместо проблемной
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
    let quoteCount = 0;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        quoteCount++;
        if (inQuotes && nextChar === '"') {
          // Удвоенная кавычка внутри кавычек
          current += '"';
          i++; // Пропускаем следующую кавычку
        } else {
          // Начало/конец кавычек
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Конец ячейки
        result.push(current);
        current = '';
        quoteCount = 0;
      } else {
        current += char;
      }
    }

    // Добавляем последнюю ячейку
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