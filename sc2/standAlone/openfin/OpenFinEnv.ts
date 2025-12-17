export type OpenFinEnv = {
  app: string;
  env: string;
};

export function readOpenFinEnv(): OpenFinEnv {
  const app = process.env.APP;
  const env = process.env.ENV;

  if (!app) {
    throw new Error("ENV var APP is not defined");
  }

  if (!env) {
    throw new Error("ENV var ENV is not defined");
  }

  return {
    app: app.toLowerCase(),
    env: env.toLowerCase(),
  };
}
