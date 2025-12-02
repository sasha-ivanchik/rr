import fs from "fs";
import path from "path";

export function parseAllureResults(allureDir = "allure-final"): FinalParsedData {
  const jsonDir = path.join(allureDir, "data", "test-cases");

  const files = fs.readdirSync(jsonDir).filter(f => f.endsWith(".json"));

  const apps = new Set<string>();
  const envs = new Set<string>();
  const suites = new Set<string>();

  let passed = 0;
  let failed = 0;

  for (const file of files) {
    const content = fs.readFileSync(path.join(jsonDir, file), "utf8");
    const test = JSON.parse(content);

    // collect labels
    const labels = test.labels || [];

    const app = labels.find(l => l.name === "appName")?.value;
    if (app) apps.add(app);

    const env = labels.find(l => l.name === "envName")?.value;
    if (env) envs.add(env);

    labels
      .filter(l => l.name === "suite")
      .forEach(l => suites.add(l.value));

    // collect status
    if (test.status === "passed") passed++;
    else failed++;
  }

  const status = failed === 0 ? "pass" : "fail";

  return {
    date: new Date().toISOString(),
    apps: [...apps],
    envs: [...envs],
    suites: [...suites],
    total: passed + failed,
    passed,
    failed,
    status
  };
}



export function generateFinalHtml(data: FinalParsedData): string {
  const color = data.status === "pass" ? "#2ecc71" : "#e74c3c";
  const statusText = data.status === "pass" ? "PASSED" : "FAILED";

  const suitesHtml = data.suites
    .map(s => `<li style="margin-bottom:4px;">${s}</li>`)
    .join("");

  return `
  <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
    <h2 style="margin-top:0;">🧪 Final Test Report</h2>

    <p><strong>Date:</strong> ${data.date}</p>

    <p><strong>Application:</strong> ${data.apps.join(", ") || "N/A"}</p>
    <p><strong>Environment:</strong> ${data.envs.join(", ") || "N/A"}</p>

    <p><strong>Suites:</strong></p>
    <ul style="padding-left:18px; margin-top:4px; margin-bottom:18px;">
        ${suitesHtml}
    </ul>

    <p><strong>Total:</strong> ${data.total}</p>
    <p><strong>Passed:</strong> ${data.passed}</p>
    <p><strong>Failed:</strong> ${data.failed}</p>

    <h3 style="color:${color}; margin-top:20px;">
       Overall Status: ${statusText}
    </h3>
  </div>
  `;
}
