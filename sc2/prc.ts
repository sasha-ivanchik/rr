const suiteCache: Record<string, string> = {};

function extractSuiteNameSmart(r: AllureResult): string {
  // 1 — ТВОЙ кастомный suiteName
  const customSuite = getLabel(r.labels, "suiteName");
  if (customSuite) {
    // запомним его в кэш
    const file = getFilePath(r);
    if (file) suiteCache[file] = customSuite;
    return customSuite;
  }

  // 2 — смотрим, есть ли для файла ранее определённый suite
  const file = getFilePath(r);
  if (file && suiteCache[file]) {
    return suiteCache[file];
  }

  // 3 — берём встроенный allure suite (describe)
  const builtinSuite = getLabel(r.labels, "suite");
  if (builtinSuite) {
    if (file) suiteCache[file] = builtinSuite;
    return builtinSuite;
  }

  // 4 — имя файла как suite
  if (file) {
    const fromFile = path.basename(file, path.extname(file));
    suiteCache[file] = fromFile;
    return fromFile;
  }

  // 5 — fallback (крайне редко)
  return "Unknown";
}

function getFilePath(r: AllureResult): string | null {
  const pkg = getLabel(r.labels, "package");
  if (pkg) return pkg;

  if (r.testCaseId) {
    const part = r.testCaseId.split("#")[0];
    if (part.includes("/")) return part;
  }

  return null;
}
