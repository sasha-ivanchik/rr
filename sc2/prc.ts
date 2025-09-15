function isDateBetween(start: string | Date, end: string | Date, target: string | Date): boolean {
  function parse(input: string | Date): Date {
    if (input instanceof Date) {
      console.log(`[parse] Date instance → ${input.toISOString()}`);
      return input;
    }

    let str = input.trim();
    console.log(`\n[parse] raw input: "${str}"`);

    // убираем суффиксы (1st → 1, 2nd → 2)
    str = str.replace(/\b(\d{1,2})(st|nd|rd|th)\b/, "$1");

    // === DD/MM/YYYY или MM/DD/YYYY ===
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      const [a, b, y] = str.split("/").map(Number);
      let d: number, m: number;

      if (a > 12) {
        d = a; m = b;
        console.log(`[parse] detected format DD/MM/YYYY → ${d}-${m}-${y}`);
      } else if (b > 12) {
        m = a; d = b;
        console.log(`[parse] detected format MM/DD/YYYY → ${m}-${d}-${y}`);
      } else {
        m = a; d = b;
        console.log(`[parse] ambiguous, default MM/DD/YYYY → ${m}-${d}-${y}`);
      }
      return new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00Z`);
    }

    // === DD-MM-YYYY или MM-DD-YYYY ===
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
      const [a, b, y] = str.split("-").map(Number);
      let d: number, m: number;

      if (a > 12) {
        d = a; m = b;
        console.log(`[parse] detected format DD-MM-YYYY → ${d}-${m}-${y}`);
      } else if (b > 12) {
        m = a; d = b;
        console.log(`[parse] detected format MM-DD-YYYY → ${m}-${d}-${y}`);
      } else {
        m = a; d = b;
        console.log(`[parse] ambiguous, default MM-DD-YYYY → ${m}-${d}-${y}`);
      }
      return new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00Z`);
    }

    // === YYYY/MM/DD или YYYY MM DD ===
    if (/^\d{4}[\/\s]\d{2}[\/\s]\d{2}$/.test(str)) {
      const parts = str.split(/[\/\s]/);
      console.log(`[parse] detected format YYYY/MM/DD → ${parts.join("-")}`);
      return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00Z`);
    }

    // === YYYY-MM-DD ===
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      console.log(`[parse] detected format YYYY-MM-DD → ${str}`);
      return new Date(str + "T00:00:00Z");
    }

    // === Month Day (March 4, March 4th) ===
    if (/^[A-Za-z]+ \d{1,2}$/.test(str)) {
      str += ` ${new Date().getFullYear()}`;
      console.log(`[parse] detected format Month Day, added current year → ${str}`);
    }

    // стандартный парсер
    const d = new Date(str);
    if (isNaN(d.getTime())) {
      console.error(`[parse] invalid date format: ${input}`);
      throw new Error(`Invalid date format: ${input}`);
    }
    console.log(`[parse] parsed via JS Date → ${d.toISOString()}`);
    return d;
  }

  function normalize(date: Date): number {
    const norm = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    console.log(`[normalize] ${date.toISOString()} → ${new Date(norm).toISOString().split("T")[0]}`);
    return norm;
  }

  console.log("\n=== isDateBetween START ===");

  let s = normalize(parse(start));
  let e = normalize(parse(end));
  const t = normalize(parse(target));

  if (s > e) {
    console.log(`[range] start > end, swapping`);
    [s, e] = [e, s];
  }

  const result = t >= s && t <= e;
  console.log(`[compare] target between start & end? → ${result}`);

  console.log("=== isDateBetween END ===\n");

  return result;
}
