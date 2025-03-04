function normalizeDate(dateStr: string): string {
    // Попытка парсинга формата YYYY-MM-DD
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return `${isoMatch[2]}-${isoMatch[3]}`; // MM-DD
    }
  
    // Парсинг формата "March 4th" -> "03-04"
    const monthMap: Record<string, string> = {
      January: "01", February: "02", March: "03", April: "04",
      May: "05", June: "06", July: "07", August: "08",
      September: "09", October: "10", November: "11", December: "12"
    };
  
    const textMatch = dateStr.match(/^([A-Za-z]+) (\d{1,2})/);
    if (textMatch) {
      const month = monthMap[textMatch[1]];
      const day = textMatch[2].padStart(2, "0");
      return `${month}-${day}`; // MM-DD
    }
  
    throw new Error(`Unsupported date format: ${dateStr}`);
  }
  
  function isSameDay(date1: string, date2: string): boolean {
    return normalizeDate(date1) === normalizeDate(date2);
  }
  
  // 🔹 Примеры:
  console.log(isSameDay("March 4th", "2025-03-04")); // true
  console.log(isSameDay("April 10th", "2025-04-10")); // true
  console.log(isSameDay("March 4th", "2025-03-05")); // false
  