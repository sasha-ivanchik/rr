import { AllureResult, AllureLabel } from "./your-types";
import { getLabel } from "./allure-report-builder";

export interface DescribeStats {
  suiteName: string;          // откуда брали вкладку (same as first report)
  describeName: string;       // имя describe блока
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  noData: number;
  overallStatus: "Passed" | "Failed" | "Skipped";
}

export function aggregateByDescribe(results: AllureResult[]): DescribeStats[] {
  //
  // → Группируем: suiteName → describeName → тесты
  //
  const map: Record<string, Record<string, AllureResult[]>> = {};

  for (const r of results) {
    const suite = getLabel(r.labels, "suiteName") 
      || getLabel(r.labels, "suite") 
      || "Unknown Suite";

    const describe = getLabel(r.labels, "parentSuite")
      || getLabel(r.labels, "subSuite")
      || "Unknown Describe";

    if (!map[suite]) map[suite] = {};
    if (!map[suite][describe]) map[suite][describe] = [];

    map[suite][describe].push(r);
  }

  const final: DescribeStats[] = [];

  //
  // → Считаем статистику
  //
  for (const suiteName of Object.keys(map)) {
    const describes = map[suiteName];

    for (const describeName of Object.keys(describes)) {
      const list = describes[describeName];

      let total = 0;
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      let noData = 0;

      for (const r of list) {
        total++;

        const resLabel = getLabel(r.labels, "res");
        if (resLabel === "no_data") {
          noData++;
          continue;
        }

        const s = (r.status || "unknown").toLowerCase();

        if (s === "passed") passed++;
        else if (s === "failed" || s === "broken") failed++;
        else if (s === "skipped") skipped++;
      }

      // Rules:
      //   ❗ if any failed → Failed
      //   ❗ else if any skipped → Skipped
      //   ✔ else → Passed
      let overall: "Passed" | "Failed" | "Skipped";
      if (failed > 0) overall = "Failed";
      else if (skipped > 0) overall = "Skipped";
      else overall = "Passed";

      final.push({
        suiteName,
        describeName,
        total,
        passed,
        failed,
        skipped,
        noData,
        overallStatus: overall,
      });
    }
  }

  return final;
}





export function buildDescribeHtmlReport(
  date: string,
  appName: string,
  environment: string,
  stats: DescribeStats[]
): string {
  const rows = stats.map(s => `
<tr>
  <td>${escapeHtml(s.suiteName)}</td>
  <td>${escapeHtml(s.describeName)}</td>
  <td>${s.total}</td>
  <td>${s.passed}</td>
  <td>${s.failed}</td>
  <td>${s.skipped}</td>
  <td>${s.noData}</td>
  <td>${s.overallStatus}</td>
</tr>`).join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 6px; }
  th { background: #eee; }
</style>
</head>
<body>
<h2>Describe Groups Report</h2>
<p><b>Date:</b> ${date}</p>
<p><b>Application:</b> ${escapeHtml(appName)}</p>
<p><b>Environment:</b> ${escapeHtml(environment)}</p>

<table>
  <thead>
    <tr>
      <th>Suite</th>
      <th>Describe</th>
      <th>Total</th>
      <th>Passed</th>
      <th>Failed</th>
      <th>Skipped</th>
      <th>No Data</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}






export function generateFinalDescribeReport(folder: string, meta: {
  date?: string;
  appName?: string;
  environment?: string;
}) {
  const results = readAllureResults(folder);
  const describeStats = aggregateByDescribe(results);

  return buildDescribeHtmlReport(
    meta.date || new Date().toISOString(),
    meta.appName || "Unknown App",
    meta.environment || "Unknown Env",
    describeStats
  );
}
