type Environment = 'UAT' | 'PROD' | 'DEV';
type AppInstance = {
  name: string;
  page: Page;
  env: Environment;
  createdAt: Date;
};
    
class AppFactory {
    private static instances: Map<string, AppInstance> = new Map();
  
    static async create(
      appName: string,
      env: Environment,
      browserType: BrowserType = chromium
    ): Promise<AppInstance> {
      const instanceKey = `${appName}_${env}`;
      
      if (this.instances.has(instanceKey)) {
        return this.instances.get(instanceKey)!;
      }
  
      const browser = await browserType.launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Логика запуска десктопного приложения
      await page.goto(this.getAppUrl(appName, env));
      
      const instance: AppInstance = {
        name: appName,
        page,
        env,
        createdAt: new Date()
      };
  
      this.instances.set(instanceKey, instance);
      return instance;
    }
  
    static async close(appName: string, env: Environment) {
      const instanceKey = `${appName}_${env}`;
      const instance = this.instances.get(instanceKey);
      
      if (instance) {
        await instance.page.close();
        await instance.page.context().browser()?.close();
        this.instances.delete(instanceKey);
      }
    }
  
    private static getAppUrl(appName: string, env: Environment): string {
      const urls = {
        UAT: `app-${appName}.uat.company.com`,
        PROD: `app-${appName}.prod.company.com`,
        DEV: `localhost:8080/${appName}`
      };
      
      return `https://${urls[env]}`;
    }
  }