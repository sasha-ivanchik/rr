// src/core/registry/registry.ts
import fs from "fs";
import path from "path";
import { Registry, RuntimeInfo } from "./types";

const REG_PATH = path.resolve(process.cwd(), "registry.json");

export function readRegistry(): Registry {
  if (!fs.existsSync(REG_PATH)) {
    throw new Error("registry.json not found");
  }
  return JSON.parse(fs.readFileSync(REG_PATH, "utf-8"));
}

export function writeRegistry(reg: Registry): void {
  fs.writeFileSync(REG_PATH, JSON.stringify(reg, null, 2), "utf-8");
}

export function writeParent(parent: RuntimeInfo): void {
  writeRegistry({ parent });
}

export function writeChild(child: RuntimeInfo): void {
  const reg = readRegistry();
  writeRegistry({
    ...reg,
    child
  });
}

export function clearRegistry(): void {
  if (fs.existsSync(REG_PATH)) {
    fs.unlinkSync(REG_PATH);
  }
}
