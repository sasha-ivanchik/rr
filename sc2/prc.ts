function isDateBetween(start: string | Date, end: string | Date, target: string | Date): boolean {
  function parse(input: string | Date): Date {
    if (input instanceof Date) return input;

    let str = input.trim();

    // убираем "st", "nd", "rd", "th"
    str = str.replace(/\b(\d{1,2})(st|nd|rd|th)\b/, "$1");

    // заменяем пробелы и "/" на "-"
    str = str.replace(/[\/\s]+/g, "-");

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return new Date(str + "T00:00:00Z");
    }

    const d = new Date(str);
    if (isNaN(d.getTime())) throw new Error(`Invalid date format: ${input}`);
    return d;
  }

  function normalize(date: Date): number {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  const s = normalize(parse(start));
  const e = normalize(parse(end));
  const t = normalize(parse(target));

  return t >= s && t <= e;
}
