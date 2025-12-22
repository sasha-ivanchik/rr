import fs from "fs";
import path from "path";

const TEST_DATA_DIR = path.resolve(
  process.cwd(),
  "test-data"
);

export function readTestData<T = unknown>(
  fileName: string
): T {
  const normalizedName = fileName.endsWith(".json")
    ? fileName
    : `${fileName}.json`;

  const filePath = path.join(
    TEST_DATA_DIR,
    normalizedName
  );

  if (!filePath.startsWith(TEST_DATA_DIR)) {
    throw new Error("Invalid test-data path");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Test data file not found: ${normalizedName}`
    );
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw new Error(
      `Invalid JSON in test-data/${normalizedName}`
    );
  }
}
