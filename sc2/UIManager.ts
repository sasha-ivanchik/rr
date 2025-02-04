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


    async getLabel(labelName: string): Promise<Locator | null> {
        if (!this.page) {
            this.addComment('Page is not initialized');
            return null;
        }

        try {
            // Поиск элемента по тексту лейбла
            const xpath = labelName.includes("'") 
                ? `//*[text()[normalize-space()="${labelName}"]]` 
                : `//*[text()[normalize-space()='${labelName}']]`;

            const labelElement = this.page.locator(xpath);
            if (await labelElement.isVisible()) {
                return labelElement.locator('xpath=..'); // Возвращаем родительский элемент
            }

            // Поиск элемента по плейсхолдеру
            const placeholderElement = this.page.locator(
                `//*[(@placeholder='${labelName}') or (@data-dx-_placeholder='${labelName}')]`
            );

            if (await placeholderElement.isVisible()) {
                return placeholderElement.locator('xpath=..'); // Возвращаем родительский элемент
            }

            // Если элемент не найден
            this.addComment(`Not able to find label: ${labelName}`);
            return null;
        } catch (error) {
            this.addComment(`Error finding label: ${error}`);
            return null;
        }
    }

    async processParent(
        labelName: string,
        fieldType: string,
        index?: number,
        fieldIndex?: number,
        treeIndex: number = 0
    ): Promise<Locator | [Locator, Locator[]] | null> {
        if (!this.page) {
            this.addComment('Page is not initialized');
            return null;
        }

        const guiMap: { [key: string]: string } = {
            "DropDown": "select, [role='combobox']",
            "muiDropDown": ".MuiSelect-root",
            "muipopup": ".MuiPopover-paper",
            "muipopupitem": ".MuiPopover-paper .MuiMenuItem",
            "checkbox": "input[type='checkbox'], [role='checkbox'], .dx-checkbox",
            "Textbox": "input[type='text'], textarea",
            "TextArea": "textarea",
            "radiobutton": "input[type='radio'], [role='radio']",
            "TreeListItem": ".MuiListItemText[title='" + labelName + "']",
            "TreeButton": "button, .dx-treeview-toggle",
            "TreeCheckbox": "input[type='checkbox'], .dx-checkbox",
            "webixlistitem": ".webix_list_item:has-text('" + labelName + "')",
            "webixTreeArrow": ".webix_tree_close",
            "webixTreeCheckbox": "input[type='checkbox']",
            "webixcolumnchooser": "button .fa-column",
            "menuitem": "[role='menuitem']:has-text('" + labelName + "')",
            "antmenuarrow": ".ant-menu-item i",
            "antsubmenu": ".ant-menu-item:has-text('" + labelName + "')",
            "antcalendercell": ".ant-calendar-table td[role='gridcell']:has-text('" + labelName + "')",
            "ComboBox": "[role='combobox'], .controlLabel",
            "Button": "[role='button']",
            "webixtreeitem": "[role='treeitem']:has-text('" + labelName + "')",
        };

        try {
            let fieldObj: Locator | null = null;

            // Если тип элемента относится к ant, muipopup, webix или menuitem
            if (['ant', 'muipopup', 'webix', 'menuitem'].some(x => fieldType.includes(x))) {
                const locator = guiMap[fieldType];
                if (!locator) {
                    this.addComment(`Unsupported field type: ${fieldType}`);
                    return null;
                }

                fieldObj = this.page.locator(locator);
                if (await fieldObj.isVisible()) {
                    return fieldObj;
                } else {
                    this.addComment(`Element not found: ${fieldType}`);
                    return null;
                }
            } else {
                // Поиск родительского элемента по лейблу
                const parentObj = await this.getLabel(labelName);
                if (parentObj) {
                    const parent = index ? parentObj.nth(index) : parentObj.first();
                    const locator = guiMap[fieldType];

                    if (locator) {
                        fieldObj = parent.locator(locator);
                        if (await fieldObj.isVisible()) {
                            if (fieldIndex !== undefined) {
                                return [fieldObj.nth(fieldIndex), await fieldObj.all()];
                            } else {
                                return fieldObj.first();
                            }
                        } else {
                            // Поиск элемента в родительском контейнере
                            fieldObj = parent.locator(`../${locator}`);
                            if (await fieldObj.isVisible()) {
                                return fieldObj.first();
                            }
                        }
                    }
                }
            }

            this.addComment(`Element of type "${fieldType}" not found`);
            return null;
        } catch (error) {
            this.addComment(`Error processing parent element: ${error}`);
            return null;
        }
    }

    async function process_parent(page: Page, labelname: string, fieldtype: string, index?: number, fieldindex?: number, treeindex: number = 0): Promise<Locator> {
        let fieldobj: Locator = null;
    
        const guimap = {
            "DropDown": "/select | .//*[@role='combobox'] | //*[contains(text(), '" + labelname + "')]/parent::*[contains(@class, 'Label')]/following-sibling::*[@role='combobox']",
            "muiDropDown": "/*[contains(@class,  MuiSelect)]",
            "muipopup": "//*[contains(@class,  MuiPopover-paper)]",
            "muipopupitem": "/*[contains(@class,  MuiPopover-paper)]//li[contains(@class, 'MuiMenuItem') and text()='" + labelname + "']",
            "checkbox": "/input[@type='checkbox'] | .//*[@role='checkbox'] | .//*[contains('class',  'dx-checkbox')]",
            "Textbox": "/input[(@type='text' or not(@type='text'))] | .//textarea",
            "TextArea": "/textarea",
            "radiobutton": "/input[@type='radio' and not [contains(@style, 'None')]] | .//*[@role='radio']",
            "TreeListItem": "/ancestor::div[(@data-react-beautiful-dnd-draggable='"+labelname+"')]//*[contains(@class, 'MuiListItemText') and @title='" + labelname + "']",
            "TreeButton": "/ancestor::div[(@data-react-beautiful-dnd-draggable='"+labelname+"')]//button | .//ancestor::li[@role='treeitem' and @aria-label='" + labelname + "']//*[contains(@class, 'dx-treeview-toggle')]",
            "TreeCheckbox": "/ancestor::div[(@data-react-beautiful-dnd-draggable='"+labelname+"')]//input[@type='checkbox'] | .//ancestor::li[@role='treeitem' and @aria-label='" + labelname + "']//*[contains(@class, 'dx-checkbox')]",
            "webixlistitem": "//*[@class='webix-scroll-count']/*[@class='webix_list_item' and text()[normalize-space()='" + labelname + "']] | //li[text()='" + labelname + "']",
            "webixTreeArrow": "//*[#role='treeitem' and contains(@webix_tm_id, '" + labelname + "')]//*[@class='webix_tree_close']",
            "webixTreeCheckbox": "//*[#role='treeitem' and contains(text(), '" + labelname + "')]//input[@type='checkbox']",
            "webixcolumnchooser": "//button/*[contains(@class, 'fa-column')]",
            "menuitem": "//*[@role='menuitem']//*[text()[normalize-space()='" + labelname + "']]",
            "antmenuarrow": "/ancestor::li[@role='menuitem']/div/span/following-sibling::i",
            "antsubmenu": "//li//*[text()[normalize-space()='" + labelname + "']]/ancestor::li[contains(@class, 'ant-menu-item')]",
            "antcalendercell": "//table[@class='ant-calendar-table' and @role='grid']//td[@role='gridcell' and text()='" + labelname + "']",
            "ComboBox": "/*[][@role='combobox'] | //*[@class='controlLabel']",
            "Button": "/*[][@role='button']",
            "webixtreeitem": "//*[@role='treeitem']//child::*[text()[normalize-space()='" + labelname + "']]",
        };
    
        try {
            if (['ant', 'muipopup', 'webix', 'menuitem'].some(x => fieldtype.includes(x))) {
                await page.waitForSelector(guimap[fieldtype]);
                fieldobj = page.locator(guimap[fieldtype]);
                return fieldobj;
            } else {
                let parentobj = await getLabel(page, labelname);
                if (parentobj && !fieldtype.includes("Tree")) {
                    parentobj = index ? parentobj.nth(index) : parentobj.first();
                    fieldobj = parentobj.locator(guimap[fieldtype]);
                } else {
                    for (let pobj of await parentobj.all()) {
                        fieldobj = pobj.locator(guimap[fieldtype]);
                    }
                    parentobj = parentobj.first();
                }
                if (!fieldobj) {
                    fieldobj = parentobj.locator(guimap[fieldtype]);
                }
                if (fieldobj && (await fieldobj.count() === 1 || (await fieldobj.count() > 1 && !fieldindex))) {
                    return fieldobj.first();
                } else if (fieldobj && fieldindex) {
                    return fieldobj.nth(fieldindex);
                } else {
                    console.log("the obj of type " + fieldtype + " not found");
                    return null;
                }
            }
        } catch (e) {
            console.log("the obj of type " + fieldtype + " not found");
            return null;
        }

    async function getLabel(page: Page, labelname: string): Promise<Locator> {
        try {
            let xpath = labelname.includes("'") ? `//*[text()[normalize-space()="${labelname}"]]` : `//*[text()[normalize-space()='${labelname}']]`;
            await page.waitForSelector(xpath);
            let labelobj = page.locator(xpath);
    
            if (await labelobj.count() > 0) {
                return labelobj.locator('xpath=..');
            } else {
                let placeholderXpath = `//*[(@placeholder='${labelname}')] | //*[@data-dx-_placeholder='${labelname}']`;
                await page.waitForSelector(placeholderXpath);
                let placeholderObj = page.locator(placeholderXpath);
                if (await placeholderObj.count() > 0) {
                    return placeholderObj.locator('xpath=..');
                } else {
                    console.log("not able to find label " + labelname);
                    return null;
                }
            }
        } catch (e) {
            console.log("not able to find label " + labelname);
            return null;
        }
    }

    async function selectDropDown(page: Page, labelname: string, sValue: string, index?: number): Promise<[boolean, Locator]> {
        try {
            let guiObject = await process_parent(page, labelname, "DropDown", index);
            if (guiObject) {
                if (await guiObject.getAttribute("role") === "combobox") {
                    await guiObject.click();
                    let listObject = await process_parent(page, sValue, "webixlistitem");
                    if (listObject) {
                        await listObject.first().hover();
                        await listObject.first().click();
                        console.log("selected dropdown value " + sValue);
                        return [true, guiObject];
                    } else {
                        console.log("not able to find dropdown value " + sValue);
                        return [false, guiObject];
                    }
                } else {
                    await guiObject.selectOption({ label: sValue });
                    console.log("selected dropdown value " + sValue);
                    return [true, guiObject];
                }
            } else {
                guiObject = await process_parent(page, labelname, "muiDropDown", index);
                if (guiObject) {
                    await guiObject.hover();
                    await guiObject.click();
                    let muipopupitem = `//*[contains(@class, 'MuiMenuItem') and (@data-value='${sValue}' or text()='${sValue}')]`;
                    let listitem = await page.locator(muipopupitem);
                    if (await listitem.count() > 0) {
                        await listitem.click();
                        console.log("selected dropdown value " + sValue);
                        return [true, listitem];
                    }
                }
                console.log("not able to find dropdown value " + sValue);
                return [false, guiObject];
            }
        } catch (e) {
            console.log("not able to find dropdown value " + sValue);
            return [false, null];
        }
    }

    async function setText(page: Page, labelname: string, sValue: string, index?: number, fieldindex?: number, skeys?: string): Promise<[string, Locator]> {
        let val = '';
        let guiObject = await process_parent(page, labelname, "Textbox", index, fieldindex);
        if (!guiObject) {
            guiObject = await process_parent(page, labelname, "TextArea", index, fieldindex);
        }
    
        guiObject = Array.isArray(guiObject) ? guiObject[0] : guiObject;
    
        if (guiObject) {
            // Очищаем поле ввода
            await guiObject.fill('');
            
            // Вводим текст
            if (skeys) {
                await guiObject.type(sValue, { delay: 100 }); // Вводим текст с задержкой
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
}

export default UIManager;