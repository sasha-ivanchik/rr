import { Page, Locator } from 'playwright';
import Logger from './Logger';


class GridControls {
    public gobj: Locator | null = null;
    public gtype: string | null = null;
    public gcolumnlist: { [key: string]: string } = {};
    public gridindex: number | null = null;
    public gvllist: any = null;

    private page: Page | null = null;
    private logger: Logger;
    private gridErrorState: boolean = false

    constructor(logger: Logger) {
        this.logger = logger;
    };

    setPage(page: Page): void {
        this.page = page;
    };

    getSupportedGridTypes(): string[] | null {
        if (!this.page) {
            this.logger.addComment(`Error call in "getSupportedGridTypes". Page needs to be initialized!`);
            return null;
        }

        this.logger.addComment("Supported Grid Types: reactgrid, AG Grid, html tables, ant table, webix grid, table, devex");
        return ['treegrid', 'reactgrid', 'aggrid', 'htmltables', 'anttable', 'webix', 'devex'];
    };

    async findGrid(gridindex?: string | number, optionalparam?: string): Promise<Locator | null> {
        if (!this.page) {
            this.logger.addComment(`Error call in "findGrid". Page needs to be initialized!`);
            return null;
        }
        try {
            // Parse grid index
            let parsedGridIndex = 0;
            if (typeof gridindex === 'string') {
                parsedGridIndex = parseInt(gridindex.replace('gridindex=', ''), 10) || 0;
            } else {
                parsedGridIndex = gridindex || 0;
            }
            this.gridindex = parsedGridIndex;

            // Construct XPath
            const baseXpath = [
                "@role='grid'",
                "@role='treegrid'",
                "@role='react-grid-Grid'",
                "contains(@class, 'ant-table-body')",
                "contains(@class, 'dx-pivotgrid dx-row-lines')"
            ].join(' or ');

            let gridXpath = `//*[(${baseXpath})]`;
            if (optionalparam) {
                gridXpath = `//*[(${baseXpath}) and (${optionalparam})]`;
            }

            // Find grid elements
            let grdLocator = this.page.locator(gridXpath);
            let gridCount = await grdLocator.count();

            if (parsedGridIndex > gridCount) {
                this.logger.addComment(`Grid index ${parsedGridIndex} exceeds total grids found (${gridCount})`)
                throw new Error(`Grid index ${parsedGridIndex} exceeds total grids found (${gridCount})`);
            }

            // Fallback to basic tables if no grids found
            if (gridCount === 0) {
                grdLocator = this.page.locator("//div[contains(@class, 'table')] | //table");
                gridCount = await grdLocator.count();
            }

            if (gridCount === 0) {
                throw new Error('No grid elements found');
            }

            // Select grid by index
            const index = parsedGridIndex > 0 ? parsedGridIndex - 1 : 0;
            this.gobj = grdLocator.nth(index);

            // Determine grid type
            const classAttribute = await this.gobj.getAttribute('class');
            const gridClasses = classAttribute?.split(' ') || [];

            const typeGrid: { [key: string]: string } = {
                'ant-table-body': 'anttable',
                'react-grid-Grid': 'reactgrid',
                'webix_view': 'webix',
                'ag-root': 'aggrid',
                'table': 'normal',
                'dx-datagrid': 'devex',
                'dx-widget': 'devexpivot',
            };

            this.gtype = 'html'; // default
            for (const className of gridClasses) {
                if (typeGrid[className]) {
                    this.gtype = typeGrid[className];
                    break;
                }
            }

            // Get grid headers
            this.gcolumnlist = await this.getGridHeaders();

            return this.gobj;

        } catch (error) {
            const currentIndex = this.gridindex || 0;
            const title = await this.page.title();
            const errorMessage = `Error finding grid. Frame: ${title}, Grid index: ${currentIndex}, Params: ${optionalparam}, Error: ${error}`;

            this.gridErrorState = true
            this.logger.addComment(errorMessage);
            this.gobj = null;
            return null;
        }
    };

    private async checkGridError(): Promise<void | null> {
        if (this.gridErrorState) {
            this.logger.addComment(`Grid error detected`)
            throw new Error(`Grid error detected`)
        }
        if (!this.page) {
            this.logger.addComment(`Error call in "checkGridError". Page needs to be initialized!`);
            return null;
        }
    };

    async filterGrid(column: string, value: string): Promise<{ gridcell: Locator | null; success: boolean }> {
        if (!this.page) {
            this.logger.addComment(`Error call in "filterGrid". Page needs to be initialized!`);
            return { gridcell: null, success: false };
        }

        await this.checkGridError();

        if (!this.gobj) {
            this.gobj = await this.findGrid();
            if (!this.gobj) {
                throw new Error("Grid not found.");
            }
            await this.gobj.click();
        }

        if (!this.gcolumnlist || !(column in this.gcolumnlist)) {
            this.logger.addComment(`"${column}" is not in grid`);
            return { gridcell: null, success: false };
        }

        const columndict = this.gcolumnlist;
        const columnnumber = columndict[column];

        if (this.gtype === 'webix') {
            const gridcell = this.gobj.locator(
                `.//table//td[@column='${columnnumber}']/div[@role='columnheader' and contains(@class, 'webix_ss_header')]`
            );

            if (await gridcell.count() > 0) {
                await gridcell.scrollIntoViewIfNeeded();
                await gridcell.click();
                await this.page.keyboard.press('Control+A');
                await this.page.keyboard.type(value);
                await this.page.keyboard.press('Enter');
                return { gridcell, success: true };
            } else {
                this.logger.addComment("Expected filters are not available in webix grid");
                return { gridcell: null, success: false };
            }
        }
        return { gridcell: null, success: false };
    };

    async getVisibleRow(): Promise<Locator | null> {
        if (!this.page) {
            this.logger.addComment(`Error call in "getVisibleRow". Page needs to be initialized!`);
            return null;
        }

        await this.checkGridError();

        if (!this.gobj) {
            this.gobj = await this.findGrid();
            if (!this.gobj) {
                throw new Error("Grid not found.");
            }
        }

        let rowcell: Locator | null = null;

        switch (this.gtype) {
            case 'aggrid':
                rowcell = this.gobj.locator(".//div[@class='ag-body-container']//div[@class='ag-row']")
                    .or(this.gobj.locator(".//div[@class='ag-root-wrapper-body ag-layout-normal ag-focus-managed']//div[@class='ag-row']"));
                break;

            case 'reactgrid':
                rowcell = this.gobj.locator(".//*[contains(@class, 'react-grid-Row')]");
                break;

            case 'anttable':
                rowcell = this.gobj.locator(".//tr[contains(@class, 'ant-table-row')]");
                break;

            case 'webix':
                const rgcell = this.gobj.locator(".//*[contains(@class, 'webix-column')]");
                if (await rgcell.count() > 0) {
                    rowcell = rgcell.locator("./child::*[@role='gridcell']");
                } else {
                    this.logger.addComment("Expected row cells are not available in webix grid");
                }
                break;

            case 'normal':
                rowcell = this.gobj.locator("./div[@class='tbody']/div[@class='tr']");
                break;

            case 'html':
                rowcell = this.gobj.locator("./tbody/tr");
                break;

            case 'devex':
                rowcell = this.gobj.locator("./div[contains(@class, 'dx-datagrid-rowsview')]//tbody/tr");
                break;

            case 'devexpivot':
                rowcell = this.gobj.locator("./td[@class='dx-area-row-cell dx-area-tree-view']//table/*[contains(@class, 'vertical-header')]/tr");
                break;
        }

        if (rowcell && (await rowcell.count()) > 0) {
            this.logger.addComment(`The visible rows are available in the grid ${this.gtype}`);
            return rowcell;
        } else {
            this.logger.addComment(`The visible rows are not available in the grid ${this.gtype}`);
            return null;
        }
    };

    async getVisibleRowCount(): Promise<number | null> {
        if (!this.page) {
            this.logger.addComment(`Error call in "getVisibleRowCount". Page needs to be initialized!`);
            return null;
        }
        await this.checkGridError();
        const rowcell = await this.getVisibleRow();
        return rowcell ? await rowcell.count() : 0;
    };

    async getColumnCount(): Promise<number | null> {
        if (!this.page) {
            this.logger.addComment(`Error call in "getColumnCount". Page needs to be initialized!`);
            return null;
        }
        await this.checkGridError();

        if (!this.gobj) {
            this.gobj = await this.findGrid();
            if (!this.gobj) {
                throw new Error("Grid not found.");
            }
        }
        if (!this.gcolumnlist) {
            this.logger.addComment(`Info about columns not found`);
            return null;
        }
        return Object.keys(this.gcolumnlist).length;
    };

    async getGridHeaders(): Promise<{ [key: string]: string }> {
        if (!this.page) {
            this.logger.addComment(`Error call in "getGridHeaders". Page needs to be initialized!`);
            return {};
        }
        await this.checkGridError();

        if (!this.gobj) {
            this.gobj = await this.findGrid();
            if (!this.gobj) {
                throw new Error("Grid not found.");
            }
        }

        const gcolumnlist: { [key: string]: string } = {};
        const gvllist: { [key: string]: string } = {};

        switch (this.gtype) {
            case 'aggrid':
                const aghdrcell = this.gobj.locator(
                    "//*[(@class='ag-header-cell-label' or @class='ag-header-cell' or @class='ag-header-cell ag-header-cell-sortable ag-focus-managed') and @role='columnheader']"
                );
                const count = await aghdrcell.count();
                for (let i = 0; i < count; i++) {
                    const text = await aghdrcell.nth(i).innerText();
                    const colIndex = await aghdrcell.nth(i).getAttribute('aria-colindex');
                    if (text && colIndex) {
                        gcolumnlist[text] = colIndex;
                    }
                }
                break;

            case 'reactgrid':
                const gcolumnheader = this.gobj.locator(
                    ".//*[contains(@class, 'react-grid-HeaderRow')]//*[@class='react-grid-HeaderCell-sortable']"
                );
                const headerCount = await gcolumnheader.count();
                for (let i = 0; i < headerCount; i++) {
                    const text = await gcolumnheader.nth(i).innerText();
                    gcolumnlist[text] = i.toString();
                }
                break;

            case 'anttable':
                const gcol = this.gobj.locator(".//thead[@class='ant-table-thead']//tr");

                //TODO: check selectors
                //const qcolumnhdrs = gcol.locator(".//*[@class='ant-table-column-title']");
                const qcolumnhdrs = gcol.locator(".ant-table-column-title:visible");
                const hdrCount = await qcolumnhdrs.count();
                for (let i = 0; i < hdrCount; i++) {
                    const text = await qcolumnhdrs.nth(i).innerText();
                    gcolumnlist[text] = i.toString();
                }
                break;

            case 'webix':
                const webixCol = this.gobj.locator(".//*[(@role='columnheader') and contains(@class, 'webix_hcell')]");
                const webixCount = await webixCol.count();
                for (let i = 0; i < webixCount; i++) {
                    const item = webixCol.nth(i);
                    const text = await item.innerText();
                    const colIndex = await item.getAttribute('column');
                    if (text && colIndex) {
                        gcolumnlist[text] = colIndex;
                    }
                }
                break;

            case 'normal':
                const normalCol = this.gobj.locator("./div[@class='thead']/div[@class='tr']/div[not(contains(@class, 'title'))]");
                const normalCount = await normalCol.count();
                for (let i = 0; i < normalCount; i++) {
                    const text = await normalCol.nth(i).innerText();
                    const colIndex = await normalCol.nth(i).getAttribute('colindex');
                    if (text && colIndex) {
                        gcolumnlist[text] = colIndex;
                    }
                }
                break;

            case 'html':
                const htmlCol = this.gobj.locator("./thead/tr/th");
                const htmlCount = await htmlCol.count();
                for (let i = 0; i < htmlCount; i++) {
                    const text = await htmlCol.nth(i).innerText();
                    gcolumnlist[text] = i.toString();
                }
                break;

            case 'devex':
                const devexCol = this.gobj.locator(
                    "./*[contains(@class, 'dx-datagrid-headers')]/tr[@class='dx-row dx-header-row' and @role='row']/td[@role='columnheader']/child::div"
                );
                const devexCount = await devexCol.count();
                for (let i = 0; i < devexCount; i++) {
                    const text = await devexCol.nth(i).innerText();
                    gcolumnlist[text] = i.toString();
                }
                break;

            case 'devexpivot':
                const pivotCol = this.gobj.locator(
                    ".//table[not(@class='dx-pivot-grid-fake-table dx-hidden')]/thead[contains(@class, 'dx-pivotgrid-horizontal-headers')]/tr[2]/td/child::*"
                );
                const pivotCount = await pivotCol.count();
                for (let i = 0; i < pivotCount; i++) {
                    const text = await pivotCol.nth(i).innerText();
                    gcolumnlist[text] = i.toString();
                }

                const gvlheaders = this.gobj.locator(
                    ".//table//table[not(@class='dx-pivot-grid-fake-table dx-hidden')]/*[contains(@class, 'vertical-header')]/tr/td[@class!='dx-white-space-column']/child::span"
                );
                const gvlCount = await gvlheaders.count();
                for (let i = 0; i < gvlCount; i++) {
                    const text = await gvlheaders.nth(i).innerText();
                    gvllist[text] = i.toString();
                }
                break;

            default:
                throw new Error(`Usupported grid type: ${this.gtype}`)
        }

        this.gcolumnlist = gcolumnlist;
        this.gvllist = gvllist;

        return gcolumnlist;
    };

    async getCelldata(row: number, col: string, movetofirst: boolean = true): Promise<[string | null, Locator | null]> {
        if (!this.page) {
            this.logger.addComment(`Error call in "getCelldata". Page needs to be initialized!`);
            return [null, null];
        }

        if (!this.gcolumnlist) {
            this.logger.addComment(`Column info not found.`);
            return [null, null];
        }

        await this.checkGridError();
        if (!this.gobj) {
            this.gobj = await this.findGrid();
            if (!this.gobj) {
                throw new Error("Grid not found.");
            }
        }

        let celldata: Locator | null = null;
        const scrolcount = 20;

        try {
            switch (this.gtype) {
                case 'aggrid':
                    const colIndex = this.gcolumnlist[col];
                    celldata = this.gobj.locator(
                        `.//div[@role='row'][@row-index='${row}'] ` +
                        `//*[@role='gridcell'][@aria-colindex='${colIndex}']`
                    );
                    for (let attempt = 0; attempt < 5; attempt++) {
                        if (await celldata.count() > 0) break;
                        await this.page.mouse.wheel(0, 100);
                        await this.page.waitForTimeout(500);
                        celldata = this.gobj.locator(
                            `.//div[@role='row'][@row-index='${row}'] ` +
                            `//*[@role='gridcell'][@aria-colindex='${colIndex}']`
                        );
                    }
                    if (await celldata.count() > 0) {
                        await celldata.scrollIntoViewIfNeeded();
                    }
                    break;

                case 'webix':
                    for (let i = 0; i < scrolcount; i++) {
                        const gridRow = this.gobj.locator(
                            `div.webix-ss-body div.webix-ss-center ` +
                            `*[role='gridcell'][aria-rowindex='${row}']`
                        );

                        if (!(await gridRow.count())) {
                            const availableCell = this.gobj.locator('div.webix-ss-center [role="gridcell"]').first();
                            const rowIndex = await availableCell.getAttribute('aria-rowindex');

                            if (rowIndex) {
                                if (parseInt(rowIndex) < row) {
                                    await this.page.keyboard.press('PageDown');
                                } else {
                                    await this.page.keyboard.press('PageUp');
                                }
                            }
                        }

                        const targetCol = this.gobj.locator(
                            `div.webix-ss-center .webix_column[column='${this.gcolumnlist[col]}'] ` +
                            `[role='gridcell'][aria-rowindex='${row}']`
                        );

                        if (await targetCol.count()) {
                            celldata = targetCol;
                            break;
                        }
                    }
                    break;

                case 'reactgrid':
                    const gridRow = this.gobj.locator(`.react-grid-Row >> nth=${row - 1}`);
                    celldata = gridRow.locator('.react-grid-Cell').nth(parseInt(this.gcolumnlist[col]));
                    break;

                case 'anttable':
                    const antRow = this.gobj.locator(`tr.ant-table-row >> nth=${row - 1}`);
                    celldata = antRow.locator('span').nth(parseInt(this.gcolumnlist[col]));
                    break;

                case 'html':
                    const htmlRow = this.gobj.locator(`tr >> nth=${row - 1}`);
                    celldata = htmlRow.locator('td, th').nth(parseInt(this.gcolumnlist[col]));
                    break;

                case 'devex':
                    const dxRow = this.gobj.locator(`tr[aria-rowindex='${row}']`);
                    celldata = dxRow.locator(`td[aria-colindex='${this.gcolumnlist[col]}']`);
                    break;
            }

            if (celldata && (await celldata.count())) {
                const text = await celldata.innerText();
                this.logger.addComment(`Cell [${row}, ${col}] found`);
                return [text, celldata];
            }
        } catch (e) {
            this.logger.addComment(`Error getting cell: ${e}`);
        }
        this.logger.addComment(`Cell [${row}, ${col}] NOT found`);
        return [null, null];
    };

    async setCelldata(row: number, col: string, value: string, key: string = 'Enter'): Promise<Locator | null> {
        if (!this.page) {
            this.logger.addComment(`Error call in "setCelldata". Page needs to be initialized!`);
            return null;
        }
        const [_, cell] = await this.getCelldata(row, col, false);
        if (!cell) return null;

        await cell.click();
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.type(value);

        if (key) await this.page.keyboard.press(key);
        return cell;
    };

    async clickCell(row: number, col: string, clickType?: 'double'): Promise<[boolean, Locator | null]> {
        if (!this.page) {
            this.logger.addComment(`Error call in "clickCell". Page needs to be initialized!`);
            return [false, null];
        }
        const [_, cell] = await this.getCelldata(row, col, false);
        if (!cell) return [false, null];

        if (clickType === 'double') {
            await cell.dblclick();
        } else {
            await cell.click();
        }

        return [true, cell];
    };

    async verifyGridcelldata(row: number, col: string, expected: string): Promise<[boolean, string | null]> {
        if (!this.page) {
            this.logger.addComment(`Error call in "verifyGridcelldata". Page needs to be initialized!`);
            return [false, null];
        }

        // ****************************************************
        // TODO: do we need to normolize `text` and `expected`? ==> use  .trim().toLowerCase()

        const [text, _] = await this.getCelldata(row, col);
        if (text === expected) {
            this.logger.addComment(`Cell value matches: ${expected}`);
            return [true, text];
        }
        this.logger.addComment(`Expected ${expected}, got ${text}`);
        return [false, text];
    };
}

export default GridControls;