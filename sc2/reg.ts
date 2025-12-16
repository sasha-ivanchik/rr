import fs from "fs";
import path from "path";

const REGISTRY_FILE = path.resolve(process.cwd(), ".openfin-registry.json");

export interface AppEntry {
  app: string;
  env: string;
  cdpEndpoint: string; // например ws://127.0.0.1:9222/devtools/browser/...
  pid: number;
  createdAt: string;
}

export function saveRegistry(entry: AppEntry) {
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(entry, null, 2), "utf-8");
}

export function loadRegistry(): AppEntry {
  if (!fs.existsSync(REGISTRY_FILE)) {
    throw new Error(
      `OpenFin registry not found: ${REGISTRY_FILE}. Run "npm run openfin:start" first.`
    );
  }
  return JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
}

export function registryPath() {
  return REGISTRY_FILE;
}
