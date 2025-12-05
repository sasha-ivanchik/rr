import * as fs from 'fs';
import * as path from 'path';

interface AllureLabel {
  name: string;
  value: string;
}

interface AllureResult {
  name: string;
  status: string;
  labels: AllureLabel[];
}

interface NormalizedResult {
  suiteName: string;
  appName: string;
  envName: string;
  res: string;          // passed, failed, skipped, no_data
  status: string;       // allure original status
}

interface SuiteStats {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  noData: number;
  overall: number;      // %
  overallStatus: "Passed" | "Failed";
}


export function loadAllureResults(resultsDir: string): NormalizedResult[] {
  const files = fs.readdirSync(resultsDir)
    .filter(f => f.endsWith("-result.json"));

  const all: NormalizedResult[] = [];

  for (const file of files) {
    const full = path.join(resultsDir, file);
    const raw = fs.readFileSync(full, "utf-8");
    const json: AllureResult = JSON.parse(raw);

    all.push(normalizeTestResult(json));
  }

  return all;
}

function getLabel(labels: AllureLabel[], name: string): string {
  const found = labels.find(l => l.name === name);
  return found?.value || "";
}

function normalizeTestResult(r: AllureResult): NormalizedResult {
  const appName = getLabel(r.labels, "appName");
  const envName = getLabel(r.labels, "envName");
  const suiteName = getLabel(r.labels, "suiteName") || "Unknown";
  const res = getLabel(r.labels, "res") || r.status;

  return {
    appName,
    envName,
    suiteName,
    status: r.status,
    res
  };
}


export function aggregateBySuite(results: NormalizedResult[]): SuiteStats[] {
  const map: Record<string, SuiteStats> = {};

  for (const r of results) {
    if (!map[r.suiteName]) {
      map[r.suiteName] = {
        suiteName: r.suiteName,
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        noData: 0,
        overall: 0,
        overallStatus: "Passed"
      };
    }

    const s = map[r.suiteName];
    s.total++;

    switch (r.res) {
      case "passed":
        s.passed++;
        break;
      case "failed":
        s.failed++;
        break;
      case "skipped":
        s.skipped++;
        break;
      case "no_data":
        s.noData++;
        break;
      default:
        s.failed++;
        break;
    }
  }

  // finalize
  Object.values(map).forEach(s => {
    const good = s.passed + s.noData;
    s.overall = Math.round((good / s.total) * 100);

    s.overallStatus =
      s.skipped > 0 || s.failed > 0 ? "Failed" : "Passed";
  });

  return Object.values(map);
}


export function generateHtmlReport(
  stats: SuiteStats[],
  appName: string,
  envName: string
): string {

  const date = new Date().toLocaleString();

  const rows = stats.map(s => `
      <tr>
        <td>${s.suiteName}</td>
        <td>${s.total}</td>
        <td>${s.passed}</td>
        <td>${s.failed}</td>
        <td>${s.skipped}</td>
        <td>${s.noData}</td>
        <td>${s.overall}% (${s.overallStatus})</td>
      </tr>
  `).join("");

  return `
    <html>
    <body style="font-family: Arial; font-size: 14px;">

      <h2>UI Automation Report</h2>

      <p><b>Date:</b> ${date}</p>
      <p><b>Application:</b> ${appName}</p>
      <p><b>Environment:</b> ${envName}</p>

      <br>

      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse;">
        <thead>
          <tr style="background: #e8e8e8;">
            <th>Tab Name</th>
            <th>Total</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Skipped</th>
            <th>No Data</th>
            <th>Overall</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

    </body>
    </html>
  `;
}


