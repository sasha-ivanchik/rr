import { Page, Locator } from 'playwright';
import Logger from './Logger';

class UIManager {
    private page: Page | null = null;
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    };

    setPage(page: Page): void {
        this.page = page;
    };

    // ===========================================================================================

    async findElement(locatorName: string, locatorValue: string): Promise<Locator | null> {
        if (!this.page) {
            this.logger.addComment("Error: Page not initialized");
            return null;
        }

        const locatorStrategies: { [key: string]: string } = {
            "xpath": `xpath=${locatorValue}`,
            "class": `.${locatorValue}`,
            "id": `#${locatorValue}`,
            "link": `text=${locatorValue}`,
            "tag": locatorValue,
            "name": `[name="${locatorValue}"]`,
            "css": locatorValue,
            "partial link": `text=${locatorValue}`
        };

        try {
            const strategy = locatorStrategies[locatorName];
            if (!strategy) {
                this.logger.addComment(`Unsupported locator type: ${locatorName}`);
                return null;
            }

            const locator = this.page.locator(strategy);
            await locator.waitFor({ state: 'attached', timeout: 15000 });
            this.logger.addComment(`Found element: ${locatorName}=${locatorValue}`);
            return locator.first();
        } catch (error) {
            this.logger.addComment(`Element not found: ${locatorName}=${locatorValue}`);
            return null;
        }
    }

    async getText(sPath: string): Promise<string | null> {
        try {
            const element = await this.findElement('xpath', sPath);
            if (!element) {
                this.logger.addComment(`Element not found for path: ${sPath}`);
                return null;
            }

            const text = await element.innerText({ timeout: 10000 });
            this.logger.addComment(`Retrieved text from: ${sPath}`);
            return text.trim();
        } catch (error) {
            this.logger.addComment(`Failed to get text from: ${sPath}`);
            return null;
        }
    }

    async getValueNearLabel(labelName: string, index: number = 0): Promise<string | null> {
        const labelLocator = await this.findElement('xpath', `//label[contains(normalize-space(), '${labelName}')]`);

        if (!labelLocator) {
            this.logger.addComment(`Label '${labelName}' not found`);
            return null;
        }

        const searchPaths = [
            { base: './', selectors: [
                '*:not(:has-text("' + labelName + '"))',
                '[class*="webix_el_box"]:not(:has-text("' + labelName + '"))',
                'textarea',
                'input',
                '[type="text"]'
            ]},
            { base: './../', selectors: [
                '*:not(:has-text("' + labelName + '"))',
                '[class*="webix_el_box"]:not(:has-text("' + labelName + '"))',
                'textarea',
                'input',
                '[type="text"]'
            ]}
        ];

        for (const path of searchPaths) {
            for (const selector of path.selectors) {
                const fullPath = `${path.base}${selector}`;
                const targetElement = labelLocator.locator(fullPath).nth(index);

                if (await targetElement.count() > 0) {
                    const value = await targetElement.inputValue().catch(() =>
                        targetElement.innerText()
                    );
                    return value.trim();
                }
            }
        }

        this.logger.addComment(`Value near label '${labelName}' not found`);
        return null;
    }

    async clickTab(tabName: string): Promise<boolean> {
        const tabSelector = [
            `//*[@role='tab' and contains(normalize-space(), '${tabName}')]`,
            `//*[contains(@class, 'tab') and contains(normalize-space(), '${tabName}')]`
        ].join(' | ');

        try {
            const tabLocator = this.page!.locator(tabSelector);
            await tabLocator.waitFor({ state: 'visible', timeout: 20000 });

            await tabLocator.scrollIntoViewIfNeeded();
            await tabLocator.click({ force: true });

            this.logger.addComment(`Successfully clicked tab: ${tabName}`);
            return true;
        } catch (error) {
            this.logger.addComment(`Failed to click tab: ${tabName}`);
            return false;
        }
    }

    async clickImage(imgText: string): Promise<boolean> {
        try {
            const imgLocator = this.page!.locator(
                `//img[@alt~='${imgText}' or @title~='${imgText}' or @aria-label~='${imgText}']`
            );

            await imgLocator.waitFor({ state: 'visible', timeout: 15000 });
            await imgLocator.scrollIntoViewIfNeeded();

            if (await imgLocator.isVisible()) {
                await imgLocator.click({ force: true });
                this.logger.addComment(`Clicked image: ${imgText}`);
                return true;
            }
            throw new Error('Image not visible');
        } catch (error) {
            this.logger.addComment(`Image not found: ${imgText}`);
            return false;
        }
    }

    async closeDialog(selector: string): Promise<boolean> {
        const closeButton = this.page!.locator(selector)
            .locator('[role="button"], .Dialog__close, button')
            .first();

        try {
            await closeButton.waitFor({ state: 'attached', timeout: 10000 });
            if (await closeButton.isVisible()) {
                await closeButton.click({ timeout: 5000 });
                await this.page!.waitForSelector(selector, { state: 'hidden' });
                this.logger.addComment('Dialog closed successfully');
                return true;
            }
            return false;
        } catch (error) {
            this.logger.addComment('Failed to close dialog');
            return false;
        }
    }

    async selectCalendar(labelName: string, dateStr: string, index?: number): Promise<boolean> {
        const monthMap: { [key: string]: string } = {
            '01': 'January',
            '02': 'February',
            '03': 'March',
            '04': 'April',
            '05': 'May',
            '06': 'June',
            '07': 'July',
            '08': 'August',
            '09': 'September',
            '10': 'October',
            '11': 'November',
            '12': 'December'
        };

        const [month, day, year] = dateStr.split('/').map(p => p.padStart(2, '0'));
        const monthName = monthMap[month];

        try {
            const calendarTrigger = await this.processParent(labelName, 'combobox', index);
            await calendarTrigger!.click();

            const calendarBody = this.page!.locator('.webix_calendar, .dx-calendar-body');
            await calendarBody.waitFor({ state: 'visible' });

            if (await calendarBody.getAttribute('class')?.includes('webix')) {
                await this.handleWebixCalendar(monthName, year, day);
            }
            else {
                await this.handleDevExpressCalendar(day);
            }

            this.logger.addComment(`Date selected: ${dateStr}`);
            return true;
        } catch (error) {
            this.logger.addComment(`Failed to select date: ${dateStr}`);
            return false;
        }
    }

    private async handleWebixCalendar(targetMonth: string, year: string, day: string): Promise<void> {
        let attempts = 0;
        while (attempts++ < 12) {
            const currentHeader = await this.page!.locator('.webix_cal_month_name').textContent();
            if (currentHeader?.includes(targetMonth) && currentHeader?.includes(year)) break;

            await this.page!.click(currentHeader!.includes(targetMonth)
                ? '.webix_cal_next_button'
                : '.webix_cal_prev_button');

            await this.page!.waitForTimeout(500);
        }

        const dateCell = this.page!.locator(
            `//div[@role='gridcell' and contains(@aria-label, '${day} ${targetMonth} ${year}')]`
        );
        await dateCell.click();
    }

    private async handleDevExpressCalendar(day: string): Promise<void> {
        await this.page!.click(`//td[@class='dx-calendar-cell' and text()='${day}']`);
    }

    async setAntCalendar(labelName: string, dateStr: string): Promise<boolean> {
        try {
            const dateParts = dateStr.split('-');
            const [year, month, day] = dateParts;

            const input = await this.processParent(labelName, 'ant-calendar-picker');
            await input!.click();

            // select month and year
            await this.page!.click('.ant-calendar-year-select');
            await this.page!.click(`//a[text()='${year}']`);

            await this.page!.click('.ant-calendar-month-select');
            await this.page!.click(`//a[text()='${month}']`);

            // select day
            const dayCell = this.page!.locator(
                `//td[contains(@class, 'ant-calendar-cell') and text()='${day}']`
            );
            await dayCell.click();

            this.logger.addComment(`Ant Calendar set to: ${dateStr}`);
            return true;
        } catch (error) {
            this.logger.addComment(`Failed to set Ant Calendar: ${dateStr}`);
            return false;
        }
    }

    async clickLabel(labelText: string, index: number = 0): Promise<boolean> {
        const labelLocator = this.page!.locator(
            `//label[normalize-space()='${labelText}']`
        ).nth(index);

        try {
            await labelLocator.waitFor({ state: 'visible', timeout: 15000 });
            await labelLocator.scrollIntoViewIfNeeded();
            await labelLocator.click({ force: true });

            this.logger.addComment(`Clicked label: ${labelText}`);
            return true;
        } catch (error) {
            this.logger.addComment(`Label not found: ${labelText}`);
            return false;
        }
    }

    async clickCheckbox(labelName: string): Promise<boolean> {
        const checkbox = await this.processParent(labelName, 'checkbox');
        if (!checkbox) {
            this.logger.addComment(`Checkbox '${labelName}' not found`);
            return false;
        }

        try {
            await checkbox.waitFor({ state: 'visible' });
            const isChecked = await checkbox.isChecked();

            // TODO do we need to click on a checkbox if it's unchecked?
            if (!isChecked) {
                await checkbox.click({ force: true });
                this.logger.addComment(`Checkbox '${labelName}' checked`);
            } else {
                this.logger.addComment(`Checkbox '${labelName}' already checked`);
            }
            return true;
        } catch (error) {
            this.logger.addComment(`Failed to click checkbox '${labelName}'`);
            return false;
        }
    }

    async clickRadioButton(labelName: string, index: number = 0): Promise<boolean> {
        const radioGroup = await this.processParent(labelName, 'radiobutton');
        const radioButtons = radioGroup?.locator('[type="radio"], [role="radio"]');

        if (!radioButtons || (await radioButtons.count()) <= index) {
            this.logger.addComment(`Radio button '${labelName}' not found`);
            return false;
        }

        const targetRadio = radioButtons.nth(index);
        try {
            await targetRadio.waitFor({ state: 'attached' });

            if (!await targetRadio.isEnabled()) {
                throw new Error('Radio button disabled');
            }

            await targetRadio.click({ force: true });
            this.logger.addComment(`Radio button '${labelName}' clicked`);
            return true;
        } catch (error) {
            this.logger.addComment(`Failed to click radio '${labelName}'`);
            return false;
        }
    }

    async dragAndDrop(sourceSelector: string, targetSelector: string): Promise<boolean> {
        const source = this.page!.locator(sourceSelector);
        const target = this.page!.locator(targetSelector);

        try {
            await source.waitFor({ state: 'visible' });
            await target.waitFor({ state: 'visible' });

            await source.hover();
            await this.page!.mouse.down();
            await this.page!.mouse.move(
                await target.boundingBox().then(b => b!.x + b!.width/2),
                await target.boundingBox().then(b => b!.y + b!.height/2),
                { steps: 20 }
            );
            await this.page!.mouse.up();

            this.logger.addComment(`Drag and drop from ${sourceSelector} to ${targetSelector} successful`);
            return true;
        } catch (error) {
            this.logger.addComment(`Drag and drop failed: ${error}`);
            return false;
        }
    }

    async dragAndDropByOffset(sourceSelector: string, x: number, y: number): Promise<boolean> {
        const source = this.page!.locator(sourceSelector);

        try {
            await source.waitFor({ state: 'visible' });
            const sourceBox = await source.boundingBox();

            await source.hover();
            await this.page!.mouse.down();
            await this.page!.mouse.move(
                sourceBox!.x + x,
                sourceBox!.y + y,
                { steps: 15 }
            );
            await this.page!.mouse.up();

            this.logger.addComment(`Drag and drop by offset (${x}, ${y}) successful`);
            return true;
        } catch (error) {
            this.logger.addComment(`Drag and drop by offset failed: ${error}`);
            return false;
        }
    }

    async getElement(labelName: string, fieldType: string): Promise<{ success: boolean; element: Locator | null }> {
        try {
            const element = await this.processParent(labelName, fieldType);

            if (!element) {
                throw new Error('Element not found');
            }

            await element.waitFor({ state: 'attached' });
            await element.scrollIntoViewIfNeeded();

            switch(fieldType.toLowerCase()) {
                case 'button':
                    if (!await element.isEnabled()) {
                        throw new Error('Button is disabled');
                    }
                    break;

                case 'input':
                    if (!await element.isEditable()) {
                        throw new Error('Input is readonly');
                    }
                    break;
            }

            this.logger.addComment(`Element '${labelName}' found and valid`);
            return { success: true, element };
        } catch (error) {
            this.logger.addComment(`Element '${labelName}' error: ${error}`);
            return { success: false, element: null };
        }
    }
    // ====================================================================================================================================
    // ====================================================================================================================================
    // ====================================================================================================================================
    async doubleClickElement(element: Locator): Promise<void> {
        if (await element.isVisible()) {
            await element.dblclick();
            this.comments += '<br>double click event is successful';
        }
    }
    
    async rightClickElement(element: Locator): Promise<void> {
        if (await element.isVisible()) {
            await element.click({ button: 'right' });
            this.comments += '<br>right click event is successful';
        }
    }

    async mouseHover(element: Locator): Promise<void> {
        if (await element.isVisible()) {
            await element.hover();
            this.comments += '<br>mouse hover event is successful';
        }
    }

    async closeWindow(): Promise<void> {
        const title = await this.page.title();
        await this.page.close();
        this.comments += `<br>closed window ${title}`;
    }

    async clickMenuItem(menuPath: string): Promise<void> {
        const labels = menuPath.split('|');
        for (const labelName of labels) {
            if (labelName) {
                const guiObject = await this.processParent(labelName, 'menuitem');
                if (guiObject) {
                    await guiObject.click();
                    await this.page.waitForTimeout(5000);
                    this.comments += `<br>clicking menuitem ${labelName}`;
                }
            }
        }
    }

    async clickTreeButton(treePath: string, treeIndex: number = 0): Promise<void> {
        const labels = treePath.split('|');
        const objCheck = await this.getLabel(labels[0]);

        if (objCheck) {
            for (const labelName of labels) {
                let guiObject: Locator | null = null;
                if (labelName === labels[labels.length - 1] && !(await objCheck.getAttribute('class'))?.includes('dx-')) {
                    guiObject = await this.processParent(labelName, 'TreeListItem', treeIndex);
                } else {
                    guiObject = await this.processParent(labelName, 'TreeButton', treeIndex);
                }

                if (guiObject && !(await guiObject.getAttribute('class'))?.includes('visibility-opened')) {
                    await guiObject.click();
                    await this.page.waitForTimeout(2000);
                }
            }
        } else {
            this.comments += `<br>the element ${treePath} not found`;
        }
    }

    async clickTreeCheckbox(treePath: string, treeIndex: number = 0): Promise<void> {
        await this.clickTreeButton(treePath, treeIndex);
        const labelName = treePath.split('|').pop() || '';
        const guiObject = await this.processParent(labelName, 'TreeCheckbox', treeIndex);
        if (guiObject) {
            await guiObject.click();
        }
    }

    async clickTreeItem(labelName: string): Promise<boolean> {
        const listObject = await this.processParent(labelName, 'webixtreeitem');
        if (listObject) {
            await listObject.hover();
            await listObject.click();
            this.comments += `<br>dropdown: selected ${labelName}`;
            return true;
        }
        this.comments += `<br>dropdown: not able to find ${labelName}`;
        return false;
    }

    async clickWebixTreeCheckbox(treePath: string): Promise<void> {
        const labels = treePath.split('|');
        for (const [index, label] of labels.entries()) {
            let guiObject: Locator | null = null;
            if (index === labels.length - 1) {
                guiObject = await this.processParent(label, 'webixTreeCheckbox');
                if (guiObject && !(await guiObject.isChecked())) {
                    await guiObject.click();
                }
            } else {
            guiObject = await this.processParent(label, 'webixTreeArrow');
                if (guiObject) {
                    await guiObject.click();
                }
            }
        }
    }
    
    async clickWebixListItem(labelname: string, index: number = 0): Promise<[boolean, Locator | null]> {
        const listObject = await this.processParent(labelname, "webixlistitem");
        if (listObject) {
            const targetElement = listObject.nth(index);
            if (await targetElement.isVisible()) {
                await targetElement.hover();
                await targetElement.click();
                this.comments += `<br>dropdown: selected ${labelname}`;
                return [true, listObject];
            }
        }
        this.comments += `<br>dropdown: not able to find ${labelname}`;
        return [false, null];
    }
    
    async getParentInformation(obj: Locator): Promise<Locator | null> {
        try {
            return obj.locator('xpath=./..');
        } catch (e) {
            console.error('Error getting parent element:', e);
            return null;
        }
    }
    
    async getChildInformation(obj: Locator): Promise<Locator | null> {
        try {
            return obj.locator('xpath=./child::*');
        } catch (e) {
            console.error('Error getting child element:', e);
            return null;
        }
    }
    
    async columnchooser(treepath: string): Promise<Locator | null> {
        const guiObject = await this.processParent("", "webixcolumnchooser");
        if (guiObject) {
            await guiObject.hover();
            await guiObject.click();
            await this.clickWebixTreeCheckbox(treepath);
        }
        return guiObject;
    }
    
    async multiplecolumnchooser(treepath: string, treevalues: string[]): Promise<Locator | null> {
        const guiObject = await this.processParent("", "webixcolumnchooser");
        if (guiObject) {
            await guiObject.hover();
            await guiObject.click();
            await this.page.waitForTimeout(5000);
            
            const labelname = treepath;
            try {
                const targetElement = this.page.locator(`//div[@webix_tm_id='${labelname}']`).last();
                await targetElement.scrollIntoViewIfNeeded();
                
                const arrow = await this.processParent(labelname, "webixTreeArrow");
                if (arrow) await arrow.click();
            } catch (e) {
                console.error('Error in multiplecolumnchooser:', e);
            }
        
            for (const i of treevalues) {
                const element = this.page.locator(`//div[@webix_tm_id='${i}']`).last();
                await element.scrollIntoViewIfNeeded();
                
                const checkbox = await this.processParent(i, "webixTreeCheckbox");
                if (checkbox && !(await checkbox.isChecked())) {
                    await checkbox.click();
                }
            }
        }
        return guiObject;
    }
      
    // TODO need to implement using python
    async readqztablefromsandra(dbname: string, dbpath: string): Promise<any> {
        try {
            const dbConn = await this.connectToSandra(dbname);
            return await dbConn.read(dbpath).contents;
        } catch (e) {
            console.error("Exception while reading data from sandra:", e);
            throw e;
        }
    }
    
    async waitForLoadElement(timeout: number = 30000): Promise<void> {
        const progressBarLocator = this.page!.locator("div.webix_progress_icon[role='progressbar']");
        
        await this.page!.waitForFunction(async () => {
            const element = document.querySelector("div.webix_progress_icon[role='progressbar']");
            return !element || window.getComputedStyle(element).display === 'none';
        }, { timeout });
    
        console.log('Page loaded successfully');
    }
    
    // TODO need to implement using python
    async connectToSandra(dbname: string) {
        return 'some string';
    }
}
    
//     // TODO need to implement using python
//     async function connectToSandra(dbname: string) {
//       return {
//         read: (path: string) => ({
//           contents: {}
//         })
//     };


export default UIManager;