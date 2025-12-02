import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

function assertDir(dir: string) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }
  if (!fs.statSync(dir).isDirectory()) {
    throw new Error(`Path is not a directory: ${dir}`);
  }
}

function runCommand(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });

  if (result.error) {
    throw new Error(`Failed to execute command: ${cmd}\n${result.error}`);
  }
  if (result.status !== 0) {
    throw new Error(`Command exited with code ${result.status}: ${cmd}`);
  }
}

async function main() {
  try {
    const resultsRoot = "results";
    const outputDir = "allure-final";

    assertDir(resultsRoot);

    // Collect runs (directories that match run-*)
    const runs = fs
      .readdirSync(resultsRoot)
      .filter(d => d.startsWith("run-"))
      .map(d => path.join(resultsRoot, d))
      .filter(p => fs.statSync(p).isDirectory());

    if (runs.length === 0) {
      console.error("❌ No test run directories found (run-xxx)");
      process.exit(1);
    }

    console.log(`🧩 Found ${runs.length} test run folders:`);
    runs.forEach(r => console.log("   ▸", r));

    // Clean/create output directory
    if (fs.existsSync(outputDir)) {
      console.log(`🧹 Cleaning previous ${outputDir}/ directory...`);
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir);

    // Check if allure exists
    const allureCheck = spawnSync("npx", ["allure", "--version"], { encoding: "utf-8" });
    if (allureCheck.status !== 0) {
      console.error("❌ Allure CLI not available (install: npm i -D allure-commandline)");
      process.exit(1);
    }

    console.log("📦 Merging Allure results...");

    const mergeArgs = [
      "allure",
      "merge",
      ...runs,
      "-o",
      outputDir
    ];

    runCommand("npx", mergeArgs);

    console.log(`📊 Allure results merged → ${outputDir}/`);
  } catch (err: any) {
    console.error("❌ Merge failed:", err.message);
    process.exit(1);
  }
}

main();
