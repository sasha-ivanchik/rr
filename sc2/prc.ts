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
    join('')
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


    async setText(
        page: Page,
        labelname: string,
        sValue: string,
        index?: number,
        fieldindex?: number,
        skeys?: string
    ): Promise<[string, Locator | null]> {
        let val = '';
        const guiObject = await process_parent(page, labelname, "Textbox", index, fieldindex)
            .or(await process_parent(page, labelname, "TextArea", index, fieldindex));
    
        if (guiObject) {
            // Очищаем поле ввода
            await guiObject.press('Shift+Home'); // Выделяем весь текст
            await guiObject.press('Backspace'); // Удаляем выделенный текст
    
            // Вводим текст
            if (skeys) {
                await guiObject.type(sValue); // Вводим текст с задержкой
                await guiObject.press(skeys); // Отправляем специальные клавиши
            } else {
                await guiObject.fill(sValue); // Вводим текст
                await guiObject.press('Enter'); // Отправляем клавишу Enter
            }
    
            console.log("entering text " + sValue);
            val = sValue;
        } else {
            console.log("unable to find text field for label " + labelname);
        }
    
        return [val, guiObject];
    }


    async process_parent(
        page: Page,
        labelname: string,
        fieldtype: string,
        index?: number,
        fieldindex?: number,
        treeindex: number = 0
    ): Promise<Locator | null> {
        let fieldobj: Locator | null = null;
    
        const guimap: Record<string, string> = {
            "DropDown": "//select | .//*[@role='combobox'] | //*[contains(text(), '" + labelname + "')]/parent::*[contains(@class, 'Label')]/following-sibling::*[@role='combobox']",
            "muiDropDown": "//*[contains(@class, 'MuiSelect')]",
            "muipopup": "//*[contains(@class, 'MuiPopover-paper')]",
            "muipopupitem": "//*[contains(@class, 'MuiPopover-paper')]//li[contains(@class, 'MuiMenuItem') and text()='" + labelname + "']",
            "checkbox": "//input[@type='checkbox'] | .//*[@role='checkbox'] | .//*[contains(@class, 'dx-checkbox')]",
            "Textbox": "//input[(@type='text' or not(@type))] | .//textarea",
            "TextArea": "//textarea",
            "radiobutton": "//input[@type='radio' and not(contains(@style, 'None'))] | .//*[@role='radio']",
            "TreeListItem": "//ancestor::div[(@data-react-beautiful-dnd-draggable='" + labelname + "')]//*[contains(@class, 'MuiListItemText') and @title='" + labelname + "']",
            "TreeButton": "//ancestor::div[(@data-react-beautiful-dnd-draggable='" + labelname + "')]//button | .//ancestor::li[@role='treeitem' and @aria-label='" + labelname + "']//*[contains(@class, 'dx-treeview-toggle')]",
            "TreeCheckbox": "//ancestor::div[(@data-react-beautiful-dnd-draggable='" + labelname + "')]//input[@type='checkbox'] | .//ancestor::li[@role='treeitem' and @aria-label='" + labelname + "']//*[contains(@class, 'dx-checkbox')]",
            "webixlistitem": "//*[@class='webix-scroll-count']/*[@class='webix_list_item' and text()[normalize-space()='" + labelname + "']] | //li[text()='" + labelname + "']",
            "webixTreeArrow": "//*[@role='treeitem' and contains(@webix_tm_id, '" + labelname + "')]//*[@class='webix_tree_close']",
            "webixTreeCheckbox": "//*[@role='treeitem' and contains(text(), '" + labelname + "')]//input[@type='checkbox']",
            "webixcolumnchooser": "//button/*[contains(@class, 'fa-columns')]",
            "menuitem": "//*[@role='menuitem']//*[text()[normalize-space()='" + labelname + "']]",
            "antmenuarrow": "//ancestor::li[@role='menuitem']/div/span/following-sibling::i",
            "antsubmenu": "//li//*[text()[normalize-space()='" + labelname + "']]/ancestor::li[contains(@class, 'ant-menu-item')]",
            "antcalendercell": "//table[@class='ant-calendar-table' and @role='grid']//td[@role='gridcell' and text()='" + labelname + "']",
            "ComboBox": "//*[@role='combobox'] | //*[@class='controlLabel']",
            "Button": "//*[@role='button']",
            "webixtreeitem": "//*[@role='treeitem']//child::*[text()[normalize-space()='" + labelname + "']]",
        };
    
        try {
            // Если тип поля относится к ant, muipopup, webix или menuitem
            if (['ant', 'muipopup', 'webix', 'menuitem'].some(x => fieldtype.includes(x))) {
                await page.waitForSelector(guimap[fieldtype], { state: 'attached' });
                fieldobj = page.locator(guimap[fieldtype]);
                return fieldobj;
            } else {
                // Получаем родительский элемент
                const parentobj = await getLabel(page, labelname);
                if (!parentobj) {
                    console.log("Parent object not found for label: " + labelname);
                    return null;
                }
    
                // Выбираем конкретный элемент, если указан индекс
                const targetParent = index ? parentobj.nth(index) : parentobj.first();
    
                // Ищем дочерний элемент
                fieldobj = targetParent.locator(guimap[fieldtype]);
    
                // Если элемент не найден, попробуем поискать на уровень выше
                if (!(await fieldobj.count())) {
                    fieldobj = targetParent.locator(`xpath=./../${guimap[fieldtype]}`);
                }
    
                // Возвращаем элемент в зависимости от fieldindex
                if (await fieldobj.count() === 1 || (await fieldobj.count() > 1 && !fieldindex)) {
                    return fieldobj.first();
                } else if (await fieldobj.count() > 1 && fieldindex !== undefined) {
                    return fieldobj.nth(fieldindex);
                } else {
                    console.log("the obj of type " + fieldtype + " not found");
                    return null;
                }
            }
        } catch (e) {
            console.log("Error in process_parent: ", e);
            return null;
        }
    }


    async getLabel(page: Page, labelname: string): Promise<Locator | null> {
        try {
            const xpath = labelname.includes("'")
                ? `//*[text()[normalize-space()="${labelname}"]]`
                : `//*[text()[normalize-space()='${labelname}']]`;
    
            await page.waitForSelector(xpath, { state: 'attached' });
            const labelobj = page.locator(xpath);
    
            if (await labelobj.count() > 0) {
                return labelobj.locator('xpath=..'); // Возвращаем родительский элемент
            } else {
                const placeholderXpath = `//*[(@placeholder='${labelname}')] | //*[@data-dx-_placeholder='${labelname}']`;
                await page.waitForSelector(placeholderXpath, { state: 'attached' });
                const placeholderObj = page.locator(placeholderXpath);
    
                if (await placeholderObj.count() > 0) {
                    return placeholderObj.locator('xpath=..'); // Возвращаем родительский элемент
                } else {
                    console.log("not able to find label " + labelname);
                    return null;
                }
            }
        } catch (e) {
            console.log("Error in getLabel: ", e);
            return null;
        }
    }

}

export default UIManager;