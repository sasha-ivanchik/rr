import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export class ChunkedExcelToCsvReader {
    
    async readExcelToArray(
        filePath: string,
        sheetName: string,
        columnsPerChunk: number = 50
    ): Promise<string[][]> {
        const tempCsvPath = this.getTempCsvPath(filePath);
        
        try {
            // Читаем Excel и записываем в CSV по частям
            await this.readAndWriteByChunks(filePath, sheetName, tempCsvPath, columnsPerChunk);
            
            // Читаем готовый CSV и возвращаем как string[][]
            const result = await this.readCsvToArray(tempCsvPath);
            return result;
            
        } finally {
            this.cleanupTempFile(tempCsvPath);
        }
    }

    private async readAndWriteByChunks(
        filePath: string,
        sheetName: string,
        csvPath: string,
        columnsPerChunk: number
    ): Promise<void> {
        const workbook = new ExcelJS.Workbook();
        
        await workbook.xlsx.readFile(filePath, {
            ignoreNodes: ['style', 'hyperlink', 'format', 'drawing'],
            worksheets: 'emit'
        });
        
        const worksheet = workbook.getWorksheet(sheetName);
        if (!worksheet) {
            throw new Error(`Sheet '${sheetName}' not found`);
        }

        // Определяем общее количество колонок
        const totalColumns = this.getMaxColumnCount(worksheet);
        const totalRows = worksheet.rowCount;
        
        console.log(`Processing ${totalRows} rows with ${totalColumns} columns in chunks of ${columnsPerChunk}`);
        
        // Создаем или очищаем CSV файл
        fs.writeFileSync(csvPath, '');
        const csvStream = fs.createWriteStream(csvPath, { flags: 'a', encoding: 'utf8' });

        // Обрабатываем колонки чанками
        for (let startCol = 1; startCol <= totalColumns; startCol += columnsPerChunk) {
            const endCol = Math.min(startCol + columnsPerChunk - 1, totalColumns);
            console.log(`Reading columns ${startCol} to ${endCol}`);
            
            // Читаем чанк колонок
            const chunkData = await this.readColumnChunk(worksheet, startCol, endCol, totalRows);
            
            // Записываем в CSV
            if (startCol === 1) {
                // Первый чанк - записываем все строки
                this.writeChunkToCsv(csvStream, chunkData);
            } else {
                // Последующие чанки - дописываем к существующим строкам
                await this.appendChunkToCsv(csvPath, chunkData);
            }
            
            // Пауза между чанками
            await this.delay(50);
        }
        
        csvStream.end();
        
        return new Promise((resolve, reject) => {
            csvStream.on('finish', resolve);
            csvStream.on('error', reject);
        });
    }

    private async readColumnChunk(
        worksheet: ExcelJS.Worksheet,
        startCol: number,
        endCol: number,
        totalRows: number
    ): Promise<string[][]> {
        const chunkData: string[][] = [];
        
        for (let rowNum = 1; rowNum <= totalRows; rowNum++) {
            const rowData: string[] = [];
            
            for (let colNum = startCol; colNum <= endCol; colNum++) {
                try {
                    const cell = worksheet.getCell(rowNum, colNum);
                    const value = this.safeCellToString(cell.value);
                    rowData.push(value);
                } catch (error) {
                    rowData.push('');
                }
            }
            
            chunkData.push(rowData);
            
            // Пауза каждые 100 строк
            if (rowNum % 100 === 0) {
                await this.delay(1);
            }
        }
        
        return chunkData;
    }

    private writeChunkToCsv(csvStream: fs.WriteStream, chunkData: string[][]): void {
        for (const row of chunkData) {
            const csvLine = row.map(cell => this.escapeCsvValue(cell)).join(',');
            csvStream.write(csvLine + '\n');
        }
    }

    private async appendChunkToCsv(csvPath: string, chunkData: string[][]): Promise<void> {
        // Читаем существующий CSV
        const existingLines = await this.readCsvLines(csvPath);
        
        // Объединяем с новыми данными
        const mergedLines: string[] = [];
        
        for (let i = 0; i < Math.max(existingLines.length, chunkData.length); i++) {
            const existingCells = existingLines[i] ? existingLines[i].split(',') : [];
            const newCells = chunkData[i] || [];
            
            const mergedCells = [...existingCells, ...newCells.map(cell => this.escapeCsvValue(cell))];
            mergedLines.push(mergedCells.join(','));
        }
        
        // Перезаписываем файл с объединенными данными
        fs.writeFileSync(csvPath, mergedLines.join('\n'));
    }

    private async readCsvLines(csvPath: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const lines: string[] = [];
            
            const readStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
            const rl = readline.createInterface({
                input: readStream,
                crlfDelay: Infinity
            });

            rl.on('line', (line) => {
                lines.push(line);
            });

            rl.on('close', () => {
                resolve(lines);
            });

            rl.on('error', reject);
        });
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
                    // Парсим CSV строку обратно в массив
                    const row = this.parseCsvLine(line);
                    result.push(row);
                }
            });

            rl.on('close', () => {
                resolve(result);
            });

            rl.on('error', reject);
        });
    }

    private escapeCsvValue(value: string): string {
        if (value === '') return '';
        
        if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
    }

    private parseCsvLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = i + 1 < line.length ? line[i + 1] : null;

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
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

    private getMaxColumnCount(worksheet: ExcelJS.Worksheet): number {
        let maxColumns = 0;
        const sampleRows = Math.min(worksheet.rowCount, 10); // Проверяем первые 10 строк
        
        for (let rowNum = 1; rowNum <= sampleRows; rowNum++) {
            try {
                const row = worksheet.getRow(rowNum);
                if (row.actualCellCount > maxColumns) {
                    maxColumns = row.actualCellCount;
                }
            } catch (error) {
                // Пропускаем проблемные строки
            }
        }
        
        return Math.max(maxColumns, 1);
    }

    private safeCellToString(value: any): string {
        if (value === null || value === undefined) {
            return '';
        }
        
        if (typeof value === 'object') {
            if (value.formula && value.result !== undefined) {
                return this.safeCellToString(value.result);
            }
            
            if (value.richText) {
                return value.richText.map((text: any) => text.text || '').join('');
            }
            
            if (value.text !== undefined) {
                return String(value.text);
            }
            
            try {
                return String(value);
            } catch {
                return '';
            }
        }
        
        const str = String(value);
        // Ограничиваем очень длинные строки
        return str.length > 10000 ? str.substring(0, 10000) + '...' : str;
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