import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export class XLSXReader {
    
    /**
     * Читает Excel файл и возвращает string[][]
     * Самый надежный метод для больших файлов с 100+ колонками
     */
    async readExcelToArray(filePath: string, sheetName: string): Promise<string[][]> {
        // Проверяем существование файла
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        console.log(`Reading Excel: ${filePath}, sheet: ${sheetName}`);
        
        try {
            const workbook = XLSX.readFile(filePath, {
                // ✅ Критически важные опции для больших файлов
                dense: true,        // Использует dense mode для экономии памяти
                cellText: false,    // Не сохраняет форматирование текста
                cellDates: true,    // Конвертирует даты в JS Date
                sheetStubs: false,  // Не создает заглушки для отсутствующих листов
                bookVBA: false,     // Игнорирует VBA макросы
                password: null,     // Без пароля
                WTF: false          // Не пытается восстанавливать битые файлы
            });
            
            // Получаем все имена листов для отладки
            const sheetNames = workbook.SheetNames;
            console.log(`Available sheets: ${sheetNames.join(', ')}`);
            
            // Ищем нужный лист
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
                throw new Error(`Sheet '${sheetName}' not found. Available: ${sheetNames.join(', ')}`);
            }
            
            // Конвертируем в массив массивов
            const data = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,          // ✅ Массив массивов (не объектов)
                defval: '',         // ✅ Пустые ячейки как пустые строки
                raw: false,         // ✅ Конвертировать всё в строки
                blankrows: true,    // ✅ Сохранять пустые строки
                skipHidden: false   // ✅ Не пропускать скрытые строки/колонки
            }) as string[][];
            
            console.log(`Successfully read ${data.length} rows`);
            
            // Очищаем данные от undefined/null
            const cleanedData = this.cleanData(data);
            
            return cleanedData;
            
        } catch (error: any) {
            console.error('XLSX reading failed:', error.message);
            throw new Error(`Failed to read Excel file: ${error.message}`);
        }
    }

    /**
     * Альтернативный метод с большим контролем над процессом
     */
    async readExcelToArrayAdvanced(
        filePath: string, 
        sheetName: string,
        options: {
            maxRows?: number;
            maxColumns?: number;
            skipEmptyRows?: boolean;
        } = {}
    ): Promise<string[][]> {
        const { maxRows, maxColumns, skipEmptyRows = false } = options;
        
        const workbook = XLSX.readFile(filePath, {
            dense: true,
            cellText: false,
            cellDates: true,
            sheetRows: maxRows, // Ограничение количества строк если нужно
        });
        
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            throw new Error(`Sheet '${sheetName}' not found`);
        }
        
        // Получаем диапазон ячеек
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        const data: string[][] = [];
        
        // Проходим по строкам вручную для большего контроля
        for (let R = range.s.r; R <= range.e.r; R++) {
            // Останавливаемся если достигли maxRows
            if (maxRows && R >= maxRows) break;
            
            const row: string[] = [];
            let isEmptyRow = true;
            
            for (let C = range.s.c; C <= range.e.c; C++) {
                // Останавливаемся если достигли maxColumns
                if (maxColumns && C >= maxColumns) break;
                
                // Получаем адрес ячейки
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = worksheet[cellAddress];
                
                let value = '';
                if (cell) {
                    value = this.cellToString(cell);
                    if (value !== '') isEmptyRow = false;
                }
                
                row.push(value);
            }
            
            // Пропускаем пустые строки если нужно
            if (!skipEmptyRows || !isEmptyRow) {
                data.push(row);
            }
        }
        
        return data;
    }

    /**
     * Конвертирует значение ячейки в строку
     */
    private cellToString(cell: XLSX.CellObject): string {
        if (cell.v === null || cell.v === undefined) {
            return '';
        }
        
        // Обрабатываем разные типы ячеек
        if (cell.t === 's') { // string
            return String(cell.v);
        } else if (cell.t === 'n') { // number
            return String(cell.v);
        } else if (cell.t === 'b') { // boolean
            return cell.v ? 'TRUE' : 'FALSE';
        } else if (cell.t === 'd') { // date
            return new Date(cell.v).toISOString();
        } else if (cell.t === 'e') { // error
            return '';
        }
        
        return String(cell.v);
    }

    /**
     * Очищает данные от undefined/null
     */
    private cleanData(data: string[][]): string[][] {
        return data.map(row => 
            row.map(cell => {
                if (cell === null || cell === undefined) {
                    return '';
                }
                // Ограничиваем очень длинные строки для безопасности
                const str = String(cell);
                return str.length > 100000 ? str.substring(0, 100000) + '...' : str;
            })
        );
    }

    /**
     * Вспомогательный метод: получить список всех листов
     */
    getSheetNames(filePath: string): string[] {
        const workbook = XLSX.readFile(filePath, { dense: true });
        return workbook.SheetNames;
    }

    /**
     * Вспомогательный метод: получить информацию о файле
     */
    getFileInfo(filePath: string, sheetName: string): { rows: number; columns: number } {
        const workbook = XLSX.readFile(filePath, { dense: true });
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) {
            throw new Error(`Sheet '${sheetName}' not found`);
        }
        
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        return {
            rows: data.length,
            columns: data[0]?.length || 0
        };
    }
}