// DropdownOptionsReader.ts
export async function getDropdownOptions(
  page: Page,
  label: string,
  options: GetDropdownOptionsOptions = {}
): Promise<string[]> {
  const { type, root } = await DropdownDetector.detect(page, label);

  switch (type) {
    case "html-select":
      return HtmlSelectOptionsReader.read(root);

    case "mui-select":
      return MuiSelectOptionsReader.read(page, root, options);

    case "mui-autocomplete":
      return MuiAutocompleteOptionsReader.read(page, root, options);

    default:
      throw new Error(`Unsupported dropdown type: ${type}`);
  }
}


// VirtualScrollCollector.ts
export class VirtualScrollCollector {
  static async collect(
    page: Page,
    popup: Locator,
    options: {
      scrollPauseMs: number;
      maxScrollIterations: number;
      reopen: () => Promise<Locator>;
    }
  ): Promise<string[]> {
    const seen = new Set<string>();

    for (let i = 0; i < options.maxScrollIterations; i++) {
      if (!(await popup.isVisible())) {
        popup = await options.reopen();
      }

      const items = popup.locator('[role="option"]');
      const count = await items.count();

      for (let j = 0; j < count; j++) {
        seen.add((await items.nth(j).innerText()).trim());
      }

      const last = items.nth(count - 1);
      await last.scrollIntoViewIfNeeded();
      await page.waitForTimeout(options.scrollPauseMs);

      const newCount = await popup.locator('[role="option"]').count();
      if (newCount === count) break;
    }

    return [...seen];
  }
}


// MuiSelectOptionsReader.ts
export class MuiSelectOptionsReader {
  static async read(
    page: Page,
    root: Locator,
    opts: GetDropdownOptionsOptions
  ): Promise<string[]> {
    const options = {
      retries: opts.retries ?? 3,
      retryTimeoutMs: opts.retryTimeoutMs ?? 500,
      scrollPauseMs: opts.scrollPauseMs ?? 150,
      maxScrollIterations: opts.maxScrollIterations ?? 50,
    };

    for (let attempt = 0; attempt < options.retries; attempt++) {
      await root.click({ force: true });

      let popup = await getActivePopup(page, "mui-select");

      try {
        return await VirtualScrollCollector.collect(page, popup, {
          scrollPauseMs: options.scrollPauseMs,
          maxScrollIterations: options.maxScrollIterations,
          reopen: async () => {
            await root.click({ force: true });
            return getActivePopup(page, "mui-select");
          },
        });
      } catch (e) {
        await page.waitForTimeout(options.retryTimeoutMs);
      }
    }

    throw new Error("Failed to collect MUI Select options");
  }
}


// MuiAutocompleteOptionsReader.ts
export class MuiAutocompleteOptionsReader {
  static async read(
    page: Page,
    root: Locator,
    opts: GetDropdownOptionsOptions
  ): Promise<string[]> {
    const input = root.locator('input[role="combobox"]');

    const options = {
      retries: opts.retries ?? 3,
      retryTimeoutMs: opts.retryTimeoutMs ?? 500,
      scrollPauseMs: opts.scrollPauseMs ?? 150,
      maxScrollIterations: opts.maxScrollIterations ?? 50,
    };

    for (let attempt = 0; attempt < options.retries; attempt++) {
      await input.click({ force: true });

      let popup = await getActivePopup(page, "mui-autocomplete");

      try {
        return await VirtualScrollCollector.collect(page, popup, {
          scrollPauseMs: options.scrollPauseMs,
          maxScrollIterations: options.maxScrollIterations,
          reopen: async () => {
            await input.click({ force: true });
            return getActivePopup(page, "mui-autocomplete");
          },
        });
      } catch {
        await page.waitForTimeout(options.retryTimeoutMs);
      }
    }

    throw new Error("Failed to collect MUI Autocomplete options");
  }
}
