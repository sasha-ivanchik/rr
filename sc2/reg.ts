import fs from "fs";
import path from "path";

const REGISTRY_FILE = path.resolve(process.cwd(), ".openfin-registry.json");

export interface AppEntry {
  app: string;
  env: string;
  pid: number;
  cdpEndpoint: string;
  createdAt: string;
}

export function registryExists(): boolean {
  return fs.existsSync(REGISTRY_FILE);
}

export function loadRegistry(): AppEntry | null {
  if (!fs.existsSync(REGISTRY_FILE)) return null;
  return JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
}

export function saveRegistry(entry: AppEntry) {
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(entry, null, 2), "utf-8");
}

export function clearRegistry() {
  if (fs.existsSync(REGISTRY_FILE)) {
    fs.unlinkSync(REGISTRY_FILE);
  }
}
