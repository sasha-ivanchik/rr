import fs from "fs";
import path from "path";

export interface AllureLabel {
  name: string;
  value: string;
}

export interface AllureResult {
  name?: string;
  status?: "passed" | "failed" | "skipped" | "broken" | "unknown";
  labels?: AllureLabel[];
  testCaseId?: string;
  // бывают дополнительные поля, мы их игнорируем
}

export interface SuiteStats {
  suiteName: string;      // имя вкладки (из custom suiteName или восстановленное)
  fileKey: string;        // путь к файлу или fallback (используется для группировки)
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  noData: number;
  overallPercent: number;
  overallStatus: "Passed" | "Failed";
}

//
// ----------------- helpers -----------------
//
function getLabel(labels: AllureLabel[] | undefined, name: string): string | null {
  if (!labels) return null;
  const found = labels.find((l) => l.name === name);
  return found ? found.value : null;
}

function getFilePathFromResult(r: AllureResult): string | null {
  // 1) label 'package' (часто содержит путь)
  const pkg = getLabel(r.labels, "package");
  if (pkg) return pkg;

  // 2) testCaseId: "path/to/file.spec.ts#test name"
  if (r.testCaseId) {
    const part = r.testCaseId.split("#")[0];
    if (part && (part.includes("/") || part.includes("\\"))) return part;
  }

  // 3) иногда есть label 'file' или 'filePath'
  const fileLbl = getLabel(r.labels, "file") || getLabel(r.labels, "filePath");
  if (fileLbl) return fileLbl;

  return null;
}

function basenameFromPath(p: string | null): string | null {
  if (!p) return null;
  return path.basename(p, path.extname(p));
}

//
// ----------------- main: read and group by file -----------------
//
export function readAllureResults(folder: string): AllureResult[] {
  const files = fs.readdirSync(folder).filter((f) => f.endsWith("-result.json"));
  const results: AllureResult[] = [];

  for (const f of files) {
    const full = path.join(folder, f);
    try {
      const json = JSON.parse(fs.readFileSync(full, "utf8"));
      // normalise: ensure labels is array
      if (!json.labels) json.labels = [];
      results.push(json as AllureResult);
    } catch (err) {
      console.warn(`Cannot parse ${full}: ${(err as Error).message}`);
    }
  }

  return results;
}

//
// ----------------- resolve suite name FOR A FILE (group) -----------------
//
function resolveSuiteNameForGroup(resultsInFile: AllureResult[], fileKey: string | null): string {
  // try: most frequent custom suiteName among results in this file
  const customCounts: Record<string, number> = {};
  const builtinCounts: Record<string, number> = {};

  for (const r of resultsInFile) {
    const c = getLabel(r.labels, "suiteName");
    if (c) customCounts[c] = (customCounts[c] || 0) + 1;

    const b = getLabel(r.labels, "suite");
    if (b) builtinCounts[b] = (builtinCounts[b] || 0) + 1;
  }

  // helper to pick most frequent key from a map
  const pickMostFrequent = (map: Record<string, number>): string | null => {
    let best: string | null = null;
    let bestCount = 0;
    for (const k of Object.keys(map)) {
      if (map[k] > bestCount) {
        best = k;
        bestCount = map[k];
      }
    }
    return best;
  };

  const mostCustom = pickMostFrequent(customCounts);
  if (mostCustom) {
    // if file contains more than one custom suiteName -> log conflict
    if (Object.keys(customCounts).length > 1) {
      console.warn(
        `Conflict: multiple custom suiteName values in fileGroup=${fileKey}. Picking '${mostCustom}'. All found: ${Object.keys(
          customCounts
        ).join(", ")}`
      );
    }
    return mostCustom;
  }

  const mostBuiltin = pickMostFrequent(builtinCounts);
  if (mostBuiltin) {
    return mostBuiltin;
  }

  // fallback to basename(file)
  const base = basenameFromPath(fileKey);
  if (base) return base;

  return "Unknown";
}

//
// ----------------- aggregate per file group -----------------
//
export function aggregateByFile(results: AllureResult[]): SuiteStats[] {
  // group results by fileKey
  const groups: Record<string, AllureResult[]> = {};

  for (const r of results) {
    const filePath = getFilePathFromResult(r);
    const fileKey = filePath || "__NO_FILE__";

    if (!groups[fileKey]) groups[fileKey] = [];
    groups[fileKey].push(r);
  }

  const stats: SuiteStats[] = [];

  for (const fileKey of Object.keys(groups)) {
    const group = groups[fileKey];
    const suiteName = resolveSuiteNameForGroup(group, fileKey === "__NO_FILE__" ? null : fileKey);

    // counts
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let noData = 0;
    let unknown = 0;

    for (const r of group) {
      total++;
      const status = (r.status || "unknown").toLowerCase();
      const resLabel = getLabel(r.labels, "res"); // custom no_data marker

      if (resLabel === "no_data") {
        noData++;
        // still count as a test in total, but not as failed
        continue;
      }

      if (status === "passed") passed++;
      else if (status === "skipped") skipped++;
      else if (status === "failed" || status === "broken") failed++;
      else unknown++;
    }

    // overall percent: (passed + noData) / total * 100
    const overallPercent = total === 0 ? 0 : Math.round(((passed + noData) / total) * 100);

    // overallStatus: Passed only if there are NO failed/skipped/unknown
    const overallStatus = (failed === 0 && skipped === 0 && unknown === 0) ? "Passed" : "Failed";

    stats.push({
      suiteName,
      fileKey,
      total,
      passed,
      failed,
      skipped,
      noData,
      overallPercent,
      overallStatus: overallStatus as "Passed" | "Failed",
    });
  }

  // optionally: sort by suiteName
  stats.sort((a, b) => a.suiteName.localeCompare(b.suiteName));

  return stats;
}

//
// ----------------- HTML builder -----------------
//
export function buildHtmlReport(
  date: string,
  appName: string,
  environment: string,
  suiteStats: SuiteStats[],
  options?: { highlightFailed?: boolean; includeFilePath?: boolean }
): string {
  const includeFilePath = options?.includeFilePath ?? true;
  const rows = suiteStats
    .map((s) => {
      const bad = s.overallStatus === "Failed";
      const trStyle = options?.highlightFailed && bad ? ' style="background:#ffecec"' : "";
      return `<tr${trStyle}>
  <td>${escapeHtml(s.suiteName)}</td>
  ${includeFilePath ? `<td>${escapeHtml(s.fileKey)}</td>` : ""}
  <td>${s.total}</td>
  <td>${s.passed}</td>
  <td>${s.failed}</td>
  <td>${s.skipped}</td>
  <td>${s.noData}</td>
  <td>${s.overallPercent}% (${s.overallStatus})</td>
</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background: #f7f7f7; }
</style>
</head>
<body>
  <h2>Test Report</h2>
  <p><b>Date:</b> ${escapeHtml(date)}</p>
  <p><b>Application:</b> ${escapeHtml(appName)}</p>
  <p><b>Environment:</b> ${escapeHtml(environment)}</p>

  <table>
    <thead>
      <tr>
        <th>Tab name (suiteName)</th>
        ${includeFilePath ? `<th>File</th>` : ""}
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

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

//
// ----------------- full pipeline helper -----------------
//
export function generateFinalReport(allureFolder: string, meta: {
  date?: string;
  appName?: string;
  environment?: string;
  highlightFailed?: boolean;
  includeFilePath?: boolean;
}): string {
  const date = meta.date || new Date().toISOString();
  const appName = meta.appName || "Unknown App";
  const environment = meta.environment || "Unknown Env";

  const results = readAllureResults(allureFolder);
  const suiteStats = aggregateByFile(results);
  return buildHtmlReport(date, appName, environment, suiteStats, {
    highlightFailed: meta.highlightFailed ?? true,
    includeFilePath: meta.includeFilePath ?? true,
  });
}
