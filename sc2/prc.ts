import { Page } from 'playwright';

type WsData = {
  controller?: string;
  action?: string;
  payload?: any;
  raw: string;
};

/**
 * Собирает WebSocket сообщения после reload страницы.
 */
export async function collectWsAfterReload(page: Page, waitMs = 5000): Promise<WsData[]> {
  const context = page.context();
  const client = await context.newCDPSession(page);

  await client.send('Network.enable');

  const messages: WsData[] = [];
  let afterReload = false;

  const onFrame = (event: any) => {
    try {
      if (!afterReload) return; // игнорируем старые фреймы
      const raw = event.response?.payloadData;
      if (!raw) return;

      let controller, action, payload;
      try {
        const obj = JSON.parse(raw);
        controller = obj.controller;
        action = obj.action;
        payload = obj.payload;
      } catch {
        // не JSON, оставляем только raw
      }

      messages.push({ controller, action, payload, raw });
    } catch {}
  };

  client.on('Network.webSocketFrameReceived', onFrame);

  // Перезагрузка страницы
  await page.reload({ waitUntil: 'load' });

  // После reload начинаем собирать WS сообщения
  afterReload = true;

  // Ждём несколько секунд для накопления сообщений
  await page.waitForTimeout(waitMs);

  // Очистка
  client.removeListener('Network.webSocketFrameReceived', onFrame);
  await client.detach();

  return messages;
}
