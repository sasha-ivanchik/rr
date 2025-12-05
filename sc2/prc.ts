import { AllureResult, getLabel, readAllureResults } from "./allure-report-builder"; // твои базовые импорты

export function extractAppName(results: AllureResult[]): string {
  const names = new Set<string>();

  for (const r of results) {
    const a = getLabel(r.labels, "appName");
    if (a) names.add(a);
  }

  if (names.size === 0) return "Unknown App";
  if (names.size > 1) {
    console.warn(
      `Warning: multiple appName values found in this test run: ${Array.from(names).join(
        ", "
      )}. Using first.`
    );
  }

  return Array.from(names)[0];
}

export function extractEnvName(results: AllureResult[]): string {
  const names = new Set<string>();

  for (const r of results) {
    const e = getLabel(r.labels, "envName");
    if (e) names.add(e);
  }

  if (names.size === 0) return "Unknown Env";
  if (names.size > 1) {
    console.warn(
      `Warning: multiple envName values found in this test run: ${Array.from(names).join(
        ", "
      )}. Using first.`
    );
  }

  return Array.from(names)[0];
}
