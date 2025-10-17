import { Page, Dialog } from '@playwright/test';

export class AlertHandler {
  constructor(private page: Page) {}

  /** Принять alert/confirm */
  async accept(): Promise<string | null> {
    return this.handleDialog('accept');
  }

  /** Отклонить confirm */
  async dismiss(): Promise<string | null> {
    return this.handleDialog('dismiss');
  }

  /** Ответить на prompt */
  async prompt(value: string): Promise<string | null> {
    return this.handleDialog('accept', value);
  }

  /** Внутренний метод */
  private async handleDialog(action: 'accept' | 'dismiss', promptValue?: string): Promise<string | null> {
    let message: string | null = null;
    this.page.once('dialog', async (dialog: Dialog) => {
      message = dialog.message();
      if (action === 'accept') {
        await dialog.accept(promptValue);
      } else {
        await dialog.dismiss();
      }
    });
    // ждём короткий тик, чтобы диалог успел появиться
    await this.page.waitForTimeout(100);
    return message;
  }
}
