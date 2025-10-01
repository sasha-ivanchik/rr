async readExcelSheet(
  filePath: string,
  sheetName: string,
  headers?: string[],
  rowCallback?: (row: string[]) => void
): Promise<string[][]> {
  return new Promise<string[][]>((resolve, reject) => {
    const rows: string[][] = [];
    let headerRow: string[] | null = null;
    let headerMap: Record<string, number> = {};

    const workbook = new ExcelJs.stream.xlsx.WorkbookReader(fs.createReadStream(filePath), {
      entries: "emit",
      sharedStrings: "emit", // читаем строки потоком
      styles: "ignore",      // экономим память
      worksheets: "emit",
    }) as unknown as NodeJS.EventEmitter;

    (workbook as any).on("worksheet", (worksheet: any) => {
      if (worksheet.name !== sheetName) return;

      worksheet.on("row", (row: any) => {
        const allValues: string[] = (row.values || [])
          .slice(1)
          .map((c: any) => (c != null ? String(c) : ""));

        if (!headerRow) {
          // первая строка — заголовки
          headerRow = allValues;
          headerRow.forEach((name, idx) => {
            if (name) headerMap[name.trim()] = idx;
          });

          const outputHeader = headers && headers.length > 0 ? headers : headerRow;
          rows.push(outputHeader);
          if (rowCallback) rowCallback(outputHeader);
        } else {
          let values: string[];
          if (headers && headers.length > 0) {
            values = headers.map((h) => {
              const idx = headerMap[h];
              return idx !== undefined ? allValues[idx] ?? "" : "";
            });
          } else {
            values = allValues;
          }

          rows.push(values);
          if (rowCallback) rowCallback(values);
        }
      });
    });

    (workbook as any).on("end", () => resolve(rows));
    (workbook as any).on("error", (err: any) => reject(err));
  });
}