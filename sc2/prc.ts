export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  private currentLevel: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.currentLevel = level;
  }

  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }

  error(message: string, ...args: unknown[]) {
    if (this.currentLevel >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.currentLevel >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.currentLevel >= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: unknown[]) {
    if (this.currentLevel >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
}
