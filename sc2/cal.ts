import { Page, Locator } from '@playwright/test';

export class DatePickerPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async selectDate(dateString: string): Promise<void> {
    const [month, day, year] = this.parseDate(dateString);
    await this.openCalendar();
    await this.navigateToDate(year, month);
    await this.selectDay(day);
  }

  private parseDate(dateString: string): [number, number, number] {
    const [month, day, year] = dateString.split('/').map(Number);
    return [month, day, year];
  }

  private async openCalendar(): Promise<void> {
    await this.page.locator('[role="combobox"]').click();
    await this.page.waitForSelector('.MuiPickersBasePicker-container');
  }

  private async navigateToDate(targetYear: number, targetMonth: number): Promise<void> {
    const currentDate = await this.getCurrentCalendarDate();
    const targetDate = new Date(targetYear, targetMonth - 1);
    
    const diffMonths = this.calculateMonthDifference(currentDate, targetDate);
    
    if (diffMonths === 0) return;

    const navigationButton = diffMonths > 0 
      ? this.page.locator('[aria-label="Next month"]')
      : this.page.locator('[aria-label="Previous month"]');

    for (let i = 0; i < Math.abs(diffMonths); i++) {
      await navigationButton.click();
      await this.waitForDateUpdate();
      
      // Дополнительная проверка после каждого клика
      const newDate = await this.getCurrentCalendarDate();
      if (this.isTargetMonthReached(newDate, targetYear, targetMonth)) break;
    }
  }

  private async getCurrentCalendarDate(): Promise<Date> {
    const headerText = await this.page.locator('.MuiPickersCalendarHeader-switchHeader')
      .textContent() || '';
    
    // Парсинг разных форматов даты (пример: "July 2023", "Jul 2023", "7/2023")
    const [monthPart, yearPart] = headerText
      .replace(/(\d+)\s*\/\s*(\d+)/, '$1 $2') // Для формата "MM/YYYY"
      .split(/\s+/);
    
    const month = new Date(`${monthPart} 1, ${yearPart}`).getMonth() + 1;
    return new Date(Number(yearPart), month - 1);
  }

  private calculateMonthDifference(a: Date, b: Date): number {
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  }

  private async waitForDateUpdate(): Promise<void> {
    await this.page.waitForFunction(() => {
      const header = document.querySelector('.MuiPickersCalendarHeader-switchHeader');
      return header && !header.textContent?.includes('…');
    });
  }

  private isTargetMonthReached(currentDate: Date, targetYear: number, targetMonth: number): boolean {
    return currentDate.getFullYear() === targetYear && 
           currentDate.getMonth() === targetMonth - 1;
  }

  private async selectDay(day: number): Promise<void> {
    const dayLocator = this.page.locator(
      `//button[contains(@class, 'MuiPickersDay-day')]
      [not(contains(@class, 'MuiPickersDay-hidden'))]
      [not(@disabled)]
      [.//text()="${day}"]`
    ).first();

    if (!(await dayLocator.isVisible())) {
      throw new Error(`Day ${day} not found in calendar`);
    }

    await dayLocator.click();
  }
}