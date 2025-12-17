export type RuntimeInfo = {
  name: string;     
  env: string;      // qa, dev, prod

  pid: number;      // OS pid

  cdp: {
    port: number;       // remote-debugging-port
    wsEndpoint: string; // ws://...
  };
};


export type Registry = {
  parent: RuntimeInfo;
  child?: RuntimeInfo;
};
