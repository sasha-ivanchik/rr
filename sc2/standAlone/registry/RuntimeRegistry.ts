import fs from "fs";
import path from "path";
import { RuntimeInfo } from "../openfin/OpenFinTypes";

const REG_PATH = path.resolve(".runtime-registry.json");

export class RuntimeRegistry {
  static write(appId: string, runtime: RuntimeInfo) {
    const data = this.read();
    data.apps[appId] = runtime;
    fs.writeFileSync(REG_PATH, JSON.stringify(data, null, 2));
  }

  static read() {
    if (!fs.existsSync(REG_PATH)) {
      return { apps: {} };
    }
    return JSON.parse(fs.readFileSync(REG_PATH, "utf-8"));
  }
}
