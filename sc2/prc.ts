import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as csv from 'fast-csv';
import * as path from 'path';

export class LargeExcelReader {
  
  /**
   * Чтение больших Excel файлов с защитой от Invalid String Length
   */
  async readExcelToArray(
    filePath: string, 
    sheetName: string
  ): Promise<string[][]> {
    try {
      // Пробуем прямое чтение для небольших файлов
      return await this.readDirect(filePath, sheetName);
    } catch (error: any) {
      if (error.message?.includes('Invalid string length') || 
          error.message?.includes('Buffer allocation failed')) {
        // Для больших файлов используем потоковое чтение через CSV
        return await this.readViaStreaming(filePath, sheetName);
      }
      throw error;
    }
  }

  /**
   * Прямое чтение для небольших файлов
   */
  private async readDirect(filePath: string, sheetName: string): Promise<string[][]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    const result: string[][] = [];
    
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowData: string[] = [];
      
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // Безопасное преобразование значения в строку
        const value = this.safeToString(cell.value);
        rowData.push(value);
      });
      
      result.push(rowData);
    });

    return result;
  }

  /**
   * Потоковое чтение для больших файлов через временный CSV
   */
  private async readViaStreaming(filePath: string, sheetName: string): Promise<string[][]> {
    const tempCsvPath = this.getTempCsvPath(filePath);
    
    try {
      // Конвертируем Excel в CSV потоковым способом
      await this.streamExcelToCsv(filePath, sheetName, tempCsvPath);
      
      // Читаем CSV файл
      const data = await this.readCsvFile(tempCsvPath);
      
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
        styles: 'ignore',
        entries: 'ignore'
      });

      const csvStream = fs.createWriteStream(csvPath);
      let targetSheetFound = false;
      let isFirstRow = true;

      workbookReader.on('worksheet', (worksheet: ExcelJS.stream.xlsx.WorksheetStreamReader) => {
        if (worksheet.name !== sheetName || targetSheetFound) {
          worksheet.skip();
          return;
        }
        
        targetSheetFound = true;

        worksheet.on('row', (row: ExcelJS.Row) => {
          try {
            const rowValues = row.values as any[];
            const csvRow = this.formatRowForCsv(rowValues, isFirstRow);
            
            if (csvRow) {
              csvStream.write(csvRow + '\n');
            }
            
            isFirstRow = false;
          } catch (rowError) {
            console.warn('Error processing row:', rowError);
          }
        });

        worksheet.on('end', () => {
          csvStream.end();
        });
      });

      workbookReader.on('end', () => {
        if (!targetSheetFound) {
          reject(new Error(`Sheet '${sheetName}' not found`));
          return;
        }
        resolve();
      });

      workbookReader.on('error', reject);
      csvStream.on('error', reject);

      workbookReader.read();
    });
  }

  /**
   * Чтение CSV файла
   */
  private async readCsvFile(csvPath: string): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const data: string[][] = [];
      
      fs.createReadStream(csvPath)
        .pipe(csv.parse({ 
          headers: false,
          skipEmptyLines: true,
          trim: true
        }))
        .on('data', (row: string[]) => {
          data.push(row);
        })
        .on('end', () => {
          resolve(data);
        })
        .on('error', reject);
    });
  }

  /**
   * Форматирование строки для CSV
   */
  private formatRowForCsv(rowValues: any[], isFirstRow: boolean): string {
    if (!rowValues || rowValues.length === 0) return '';
    
    // Пропускаем первый элемент (обычно это номер строки)
    const values = rowValues.slice(1);
    
    return values
      .map(value => {
        const strValue = this.safeToString(value);
        
        // Экранирование для CSV
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        
        return strValue;
      })
      .join(',');
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
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    
    return String(value);
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