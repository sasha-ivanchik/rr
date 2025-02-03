import { Page, Locator } from 'playwright';

class UIManager {
    private page: Page;
    private comments: string = '';

    constructor(page: Page) {
        this.page = page;
    }

    private addLog(message: string): void {
        this.comments += `<br>${message}`;
        console.log(message); // Также выводим в консоль для удобства
    }

    async findElement(locatorName: string, locatorValue: string): Promise<Locator | null> {
        const identifierDict: { [key: string]: string } = {
            "xpath": "xpath",
            "class": "class",
            "id": "id",
            "link": "text",
            "tag": "tag",
            "name": "name",
            "css": "css",
            "partial link": "text" // Playwright doesn't have a direct equivalent of "partial link text", so we use "text"
        };

        try {
            const locatorType = identifierDict[locatorName];
            if (!locatorType) {
                this.addLog(`Unsupported locator type: ${locatorName}`);
                return null;
            }

            // Поиск элемента
            const locator = this.page.locator(`${locatorType}=${locatorValue}`);
            if (await locator.isVisible()) {
                this.addLog(`Found ${locatorName} ${locatorValue}`);
                return locator;
            } else {
                this.addLog(`Element not found: ${locatorName} ${locatorValue}`);
                return null;
            }
        } catch (error) {
            this.addLog(`Error finding element: ${locatorName} ${locatorValue} - ${error}`);
            return null;
        }
    }

    // Click a button
    async clickButton(buttonText: string): Promise<void> {
        const button = await this.findElement('text', buttonText);
        if (button) {
            await button.click();
            console.log(`Clicked button: ${buttonText}`);
        }
    }

    // Fill a text field
    async fillTextField(label: string, value: string): Promise<void> {
        const field = await this.findElement('label', label);
        if (field) {
            await field.fill(value);
            console.log(`Filled field ${label} with value: ${value}`);
        }
    }
}

export default UIManager;