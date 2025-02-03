import * as xlsx from 'xlsx';

class ExcelUtil {
  private workbook: xlsx.WorkBook;
  private sheet: xlsx.WorkSheet;
  private columnDict: { [key: string]: number } = {};

  constructor(path: string, sheetName: string) {
    this.workbook = xlsx.readFile(path);

    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet ${sheetName} not found.`);
    }
    this.sheet = sheet;

    // Populate column dictionary from the first row (header)
    const headers = this.getExcelRow(0);
    headers.forEach((header, index) => {
      if (typeof header === 'string') {
        this.columnDict[header] = index;
      }
    });
  }

  getExcelRowCount(): number {
    const range = xlsx.utils.decode_range(this.sheet['!ref'] || '');
    return range.e.r + 1;
  }

  getExcelColumnCount(): number {
    const range = xlsx.utils.decode_range(this.sheet['!ref'] || '');
    return range.e.c + 1;
  }

  getExcelRow(rowIndex: number): (string | number)[] {
    const columnCount = this.getExcelColumnCount();
    const row: (string | number)[] = [];

    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
      const cellAddress = xlsx.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = this.sheet[cellAddress];
      row.push(cell ? cell.v : '');
    }

    return row;
  }

  getExcelCellData(row: number, columnName: string): string | number | undefined {
    const columnIndex = this.columnDict[columnName];

    if (columnIndex === undefined) {
      throw new Error(`Column ${columnName} not found.`);
    }

    const cellAddress = xlsx.utils.encode_cell({ r: row, c: columnIndex });
    const cell = this.sheet[cellAddress];

    return cell ? cell.v : undefined;
  }
}

// Example usage
// const excel = new ExcelUtil('path/to/your/file.xlsx', 'Sheet1');
// console.log(excel.getExcelRowCount());
// console.log(excel.getExcelColumnCount());
// console.log(excel.getExcelRow(1));
// console.log(excel.getExcelCellData(1, 'ColumnName'));
