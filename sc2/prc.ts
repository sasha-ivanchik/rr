async function readExcelSheet(filePath: string, sheetName: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.getWorksheet(sheetName);
  
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found in the Excel file`);
  }
  
  const result: string[][] = [];
  
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const rowData: string[] = [];
    const maxCol = row.cellCount;
    
    for (let colNum = 1; colNum <= maxCol; colNum++) {
      const cell = row.getCell(colNum);
      let value = '';
      
      try {
        if (cell.value !== null && cell.value !== undefined) {
          if (typeof cell.value === 'object') {
            if ('result' in cell.value) {
              value = String(cell.value.result ?? '');
            } else if ('text' in cell.value) {
              value = String(cell.value.text);
            } else if ('richText' in cell.value) {
              value = cell.value.richText.map((rt: any) => rt.text || '').join('');
            } else {
              value = String(cell.value);
            }
          } else {
            value = String(cell.value);
          }
        }
      } catch (error) {
        value = '';
      }
      
      rowData.push(value);
    }
    
    result.push(rowData);
  });
  
  return result;
}