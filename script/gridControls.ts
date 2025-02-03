import { Page, Locator } from 'playwright';

export class GridControls {
    private page: Page;
    private gridLocator: Locator | null = null;
    private gridType: string = '';
    private columnMap: Record<string, number> = {};

    constructor(page: Page) {
        this.page = page;
    }

    async findGrid(gridIndex: number = 0, optionalParam?: string): Promise<void> {
        const gridXpath = optionalParam
            ? `(//*[(@role='grid') or (@role='treegrid') or (contains(@class, 'ant-table-body')) or (contains(@class, 'dx-pivotgrid'))])[${gridIndex + 1}]`
            : `(//*[(@role='grid') or (@role='treegrid') or (contains(@class, 'ant-table-body')) or (contains(@class, 'dx-pivotgrid'))])[${gridIndex + 1}]`;

        this.gridLocator = this.page.locator(gridXpath);
        this.gridType = await this.determineGridType();
        this.columnMap = await this.getGridHeaders();
    }

    private async determineGridType(): Promise<string> {
        const classAttribute = await this.gridLocator!.getAttribute('class');
        if (classAttribute?.includes('ant-table-body')) return 'anttable';
        if (classAttribute?.includes('react-grid-Grid')) return 'reactgrid';
        if (classAttribute?.includes('webix_view')) return 'webix';
        if (classAttribute?.includes('ag-root')) return 'aggrid';
        if (classAttribute?.includes('dx-datagrid')) return 'devex';
        return 'html';
    }

    private async getGridHeaders(): Promise<Record<string, number>> {
        const headers: Record<string, number> = {};
        const headerCells = await this.gridLocator!.locator('//*[@role="columnheader"]').all();

        for (let i = 0; i < headerCells.length; i++) {
            const text = await headerCells[i].innerText();
            headers[text] = i;
        }

        return headers;
    }

    async getCellData(row: number, column: string): Promise<string> {
        const colIndex = this.columnMap[column];
        const cellLocator = this.gridLocator!.locator(`//*[@role='row'][${row}]//*[@role='gridcell'][${colIndex + 1}]`);
        return await cellLocator.innerText();
    }

    async setCellData(row: number, column: string, value: string): Promise<void> {
        const colIndex = this.columnMap[column];
        const cellLocator = this.gridLocator!.locator(`//*[@role='row'][${row}]//*[@role='gridcell'][${colIndex + 1}]`);
        await cellLocator.click();
        await cellLocator.fill(value);
    }
}