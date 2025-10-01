import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export class SafeExcelReader {
    
    async readExcelToArray(
        filePath: string,
        sheetName: string,
        columnsPerChunk: number = 50
    ): Promise<string[][]> {
        const tempCsvPath = this.getTempCsvPath(filePath);
        
        try {
            await this.readExcelWithBuffer(filePath, sheetName, tempCsvPath, columnsPerChunk);
            const result = await this.readCsvToArray(tempCsvPath);
            return result;
        } finally {
            this.cleanupTempFile(tempCsvPath);
        }
    }

    private async readExcelWithBuffer(
        filePath: string,
        sheetName: string,
        csvPath: string,
        columnsPerChunk: number
    ): Promise<void> {
        // Читаем файл как буфер
        const fileBuffer = fs.readFileSync(filePath);
        
        const workbook = new ExcelJS.Workbook();
        
        // Используем read вместо readFile с минимальными опциями
        await workbook.xlsx.load(fileBuffer);
        
        const worksheet = workbook.getWorksheet(sheetName);
        if (!worksheet) {
            throw new Error(`Sheet '${sheetName}' not found`);
        }

        const totalRows = worksheet.rowCount;
        const totalColumns = this.estimateColumnCount(worksheet);
        
        console.log(`Processing ${totalRows} rows with ~${totalColumns} columns`);
        
        // Создаем CSV файл
        fs.writeFileSync(csvPath, '');
        const csvStream = fs.createWriteStream(csvPath, { flags: 'a', encoding: 'utf8' });

        // Обрабатываем строки небольшими порциями
        const rowBatchSize = 100;
        
        for (let startRow = 1; startRow <= totalRows; startRow += rowBatchSize) {
            const endRow = Math.min(startRow + rowBatchSize - 1, totalRows);
            
            const batchData: string[][] = [];
            
            for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
                const rowData = await this.readRowSafely(worksheet, rowNum, columnsPerChunk);
                batchData.push(rowData);
            }
            
            // Записываем порцию в CSV
            this.writeBatchToCsv(csvStream, batchData);
            
            // Пауза для освобождения памяти
            await this.delay(10);
        }
        
        csvStream.end();
        
        return new Promise((resolve, reject) => {
            csvStream.on('finish', resolve);
            csvStream.on('error', reject);
        });
    }

    private async readRowSafely(
        worksheet: ExcelJS.Worksheet,
        rowNum: number,
        maxColumns: number
    ): Promise<string[]> {
        const rowData: string[] = [];
        let columnsRead = 0;
        
        // Читаем ячейки до максимального количества колонок
        for (let colNum = 1; colNum <= maxColumns; colNum++) {
            try {
                const cell = worksheet.getCell(rowNum, colNum);
                
                // Проверяем, есть ли значение в ячейке
                if (cell.value !== null && cell.value !== undefined) {
                    const value = this.safeCellToString(cell.value);
                    rowData.push(value);
                } else {
                    rowData.push('');
                }
                
                columnsRead++;
                
            } catch (error) {
                // Если ячейка не существует, добавляем пустую строку
                rowData.push('');
            }
            
            // Пауза каждые 10 колонок
            if (colNum % 10 === 0) {
                await this.delay(1);
            }
        }
        
        return rowData;
    }

    private estimateColumnCount(worksheet: ExcelJS.Worksheet): number {
        // Безопасно оцениваем количество колонок по первой строке
        try {
            const firstRow = worksheet.getRow(1);
            return firstRow.actualCellCount || 100; // Дефолтное значение
        } catch (error) {
            return 100; // Дефолтное значение если не можем определить
        }
    }

    private writeBatchToCsv(csvStream: fs.WriteStream, batchData: string[][]): void {
        for (const row of batchData) {
            const csvLine = row.map(cell => this.escapeCsvValue(cell)).join(',');
            csvStream.write(csvLine + '\n');
        }
    }

    private escapeCsvValue(value: string): string {
        if (value === '') return '';
        
        if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
    }

    private safeCellToString(value: any): string {
        if (value === null || value === undefined) return '';
        
        if (typeof value === 'object') {
            if (value.formula && value.result !== undefined) {
                return this.safeCellToString(value.result);
            }
            if (value.richText) {
                return value.richText.map((text: any) => text.text || '').join('').substring(0, 1000);
            }
            try {
                return String(value).substring(0, 1000);
            } catch {
                return '';
            }
        }
        
        return String(value).substring(0, 1000);
    }

    private async readCsvToArray(csvPath: string): Promise<string[][]> {
        return new Promise((resolve, reject) => {
            const result: string[][] = [];
            
            const readStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
            const rl = readline.createInterface({
                input: readStream,
                crlfDelay: Infinity
            });

            rl.on('line', (line) => {
                if (line.trim()) {
                    const row = line.split(',').map(cell => {
                        // Упрощенный парсинг CSV
                        if (cell.startsWith('"') && cell.endsWith('"')) {
                            return cell.slice(1, -1).replace(/""/g, '"');
                        }
                        return cell;
                    });
                    result.push(row);
                }
            });

            rl.on('close', () => resolve(result));
            rl.on('error', reject);
        });
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

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}