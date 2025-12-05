import fs from "fs";
import path from "path";

export interface AllureLabel {
  name: string;
  value: string;
}

export interface AllureResult {
  name: string;
  status?: "passed" | "failed" | "skipped" | "broken" | "unknown";
  labels: AllureLabel[];
  testCaseId?: string;
}

export interface SuiteStats {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  noData: number;
  overallStatus: string;       // Passed/Failed
  overallPercent: number;      // %
}

//
// ======================================================================================
// LABEL UTILS
// ======================================================================================
//

function getLabel(labels: AllureLabel[], name: string): string | null {
  const found = labels.find((l) => l.name === name);
  return found ? found.value : null;
}

//
// ======================================================================================
// FILE PATH EXTRACTION (очень важно)
// ======================================================================================
//

function getFilePath(r: AllureResult): string | null {
  // 1. тщательно: label "package"
  const pkg = getLabel(r.labels, "package");
  if (pkg) return pkg;

  // 2. testCaseId: "path/to/file.spec.ts#test name"
  if (r.testCaseId) {
    const pathPart = r.testCaseId.split("#")[0];
    if (pathPart.includes("/")) return pathPart;
  }

  return null;
}

//
// ======================================================================================
// SUITE RESOLVER (главная фича)
// ======================================================================================
//

const suiteCache: Record<string, string> = {};

function extractSuiteNameSmart(r: AllureResult): string {
  // 1 — твой кастомный suiteName
  const customSuite = getLabel(r.labels, "suiteName");
  if (customSuite) {
    const file = getFilePath(r);
    if (file) suiteCache[file] = customSuite;
    return customSuite;
  }

  // 2 — если в кэше уже есть для файла
  const file = getFilePath(r);
  if (file && suiteCache[file]) {
    return suiteCache[file];
  }

  // 3 — встроенный allure suite (describe)
  const builtinSuite = getLabel(r.labels, "suite");
  if (builtinSuite) {
    if (file) suiteCache[file] = builtinSuite;
    return builtinSuite;
  }

  // 4 — basename(file)
  if (file) {
    const fromFile = path.basename(file, path.extname(file));
    suiteCache[file] = fromFile;
    return fromFile;
  }

  // 5 — fallback
  return "Unknown";
}

//
// ======================================================================================
// PARSE ALL JSON IN FOLDER
// ======================================================================================
//

export function readAllureResults(folder: string): AllureResult[] {
  const files = fs.readdirSync(folder);

  const results: AllureResult[] = [];

  for (const f of files) {
    if (!f.endsWith("-result.json")) continue;

    const fullPath = path.join(folder, f);
    try {
      const json = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      results.push(json);
    } catch (err) {
      console.error("Cannot parse", fullPath, err);
    }
  }

  return results;
}

//
// ======================================================================================
// AGGREGATE BY SUITE
// ======================================================================================
//

export function aggregateSuites(results: AllureResult[]): SuiteStats[] {
  const map: Record<string, SuiteStats> = {};

  for (const r of results) {
    const suiteName = extractSuiteNameSmart(r);
    const status = r.status || "unknown";
    const resLabel = getLabel(r.labels, "res"); // no_data

    if (!map[suiteName]) {
      map[suiteName] = {
        suiteName,
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        noData: 0,
        overallStatus: "Passed",
        overallPercent: 100,
      };
    }

    const stat = map[suiteName];
    stat.total++;

    if (resLabel === "no_data") {
      stat.noData++;
    } else {
      if (status === "passed") stat.passed++;
      else if (status === "failed" || status === "broken" || status === "unknown")
        stat.failed++;
      else if (status === "skipped") stat.skipped++;
    }
  }

  // Finalize computed fields
  for (const key of Object.keys(map)) {
    const s = map[key];

    const passedOrNoData = s.passed + s.noData;
    s.overallPercent = Math.round((passedOrNoData / s.total) * 100);

    if (s.failed > 0 || s.skipped > 0) {
      s.overallStatus = "Failed";
    } else {
      s.overallStatus = "Passed";
    }
  }

  return Object.values(map);
}

//
// ======================================================================================
// GENERATE HTML
// ======================================================================================
//

export function buildHtmlReport(
  date: string,
  appName: string,
  environment: string,
  suiteStats: SuiteStats[]
): string {
  const rows = suiteStats
    .map(
      (s) => `
<tr>
  <td>${s.suiteName}</td>
  <td>${s.total}</td>
  <td>${s.passed}</td>
  <td>${s.failed}</td>
  <td>${s.skipped}</td>
  <td>${s.noData}</td>
  <td>${s.overallPercent}% (${s.overallStatus})</td>
</tr>`
    )
    .join("\n");

  return `
<html>
<head>
<style>
table {
  border-collapse: collapse;
  width: 100%;
  font-family: Arial, sans-serif;
}
th, td {
  border: 1px solid #999;
  padding: 6px 10px;
  text-align: left;
}
th {
  background: #eee;
}
</style>
</head>

<body>
<h2>Test Report</h2>
<p><b>Date:</b> ${date}</p>
<p><b>Application:</b> ${appName}</p>
<p><b>Environment:</b> ${environment}</p>

<table>
<thead>
<tr>
  <th>Tab name (suiteName)</th>
  <th>Total</th>
  <th>Passed</th>
  <th>Failed</th>
  <th>Skipped</th>
  <th>No Data</th>
  <th>Overall %</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>

</body>
</html>`;
}

//
// ======================================================================================
// FULL PIPELINE: read → aggregate → html
// ======================================================================================
//

export function generateFinalReport(allureFolder: string, meta: {
  date: string;
  appName: string;
  environment: string;
}): string {
  const results = readAllureResults(allureFolder);
  const suites = aggregateSuites(results);
  return buildHtmlReport(meta.date, meta.appName, meta.environment, suites);
}
