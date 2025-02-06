import { Locator } from 'playwright';


class CustomWaits {
    static async waitForElementText(
        locator: Locator,
        expectedText: string,
        timeout: number = 30000,
        interval: number = 1000
    ): Promise<void> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const actualText = (await locator.innerText()).trim();
            if (actualText === expectedText) return;

            await locator.page().waitForTimeout(interval);
        }

        throw new Error(`The text of the element does not match'${expectedText}' after ${timeout}ms`);
    }

    static async waitForElementState(
        locator: Locator,
        checkFn: (element: Locator) => Promise<boolean>,
        timeout: number = 30000,
        interval: number = 1000
    ): Promise<void> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            if (await checkFn(locator)) return;
            await locator.page().waitForTimeout(interval);
        }

        throw new Error(`The element state has not been reached after ${timeout}ms`);
    }
};

export default CustomWaits;



// await CustomWaits.waitForElementState(
//     calendarBody,
//     async (el) => await el.isVisible(),
//     timeout
// );

// await CustomWaits.waitForElementText(
//     dateCell,
//     day,
//     timeout
// );
