import { execSync } from "child_process";

async function main() {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.error("❌ Provide at least one test file");
    process.exit(1);
  }

  const timestamp = Date.now();
  const resultsDir = `results/run-${timestamp}`;

  console.log(`▶️ Running files:`, files);
  console.log(`📁 Saving results to: ${resultsDir}`);

  const cmd = [
    "npx playwright test",
    ...files,
    `--output=${resultsDir}`,
    `--reporter=line,allure-playwright`
  ].join(" ");

  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    console.error("⚠️ Some tests failed.");
  }

  console.log("✔️ Run finished");
}

main();
