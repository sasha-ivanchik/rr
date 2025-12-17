import { Page } from "playwright";

export type RuntimeInfo = {
  pid: number;
  port: number;
  wsEndpoint: string;
};

export type ChildAttachResult = {
  page: Page;
  runtime: RuntimeInfo;
};
