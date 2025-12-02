import { execSync } from "child_process";
import { readdirSync } from "fs";

async function main() {
  const runs = readdirSync("results").filter(dir => dir.startsWith("run-"));

  if (runs.length === 0) {
    console.error("❌ No runs found in results/");
    process.exit(1);
  }

  const mergeCmd = [
    "npx allure merge",
    ...runs.map(run => `results/${run}`),
    "-o",
    "allure-final"
  ];

  console.log("🧩 Merging runs:", runs);

  execSync(mergeCmd.join(" "), { stdio: "inherit" });

  console.log("📊 Final report ready: allure-final/");
}

main();
