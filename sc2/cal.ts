import { Page, Locator } from '@playwright/test';

export class DatePickerPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async selectDate(dateString: string): Promise<void> {
    // Парсим дату
    const [month, day, year] = this.parseDate(dateString);
    
    // Открываем календарь
    await this.openCalendar();
    
    // Настраиваем правильный месяц и год
    await this.navigateToCorrectMonth(year, month);
    
    // Выбираем день
    await this.selectDay(day);
  }

  private parseDate(dateString: string): [number, number, number] {
    const [month, day, year] = dateString.split('/').map(Number);
    return [month, day, year];
  }

  private async openCalendar(): Promise<void> {
    const calendarTrigger = this.page.locator('[role="combobox"]');
    await calendarTrigger.click();
    await this.page.waitForSelector('.MuiPickersBasePicker-container');
  }

  private async navigateToCorrectMonth(targetYear: number, targetMonth: number): Promise<void> {
    const monthHeader = this.page.locator('.MuiPickersCalendarHeader-switchHeader');
    const nextButton = this.page.locator('[aria-label="Next month"]');
    
    let maxAttempts = 12;
    let currentHeader = await monthHeader.textContent();

    while (maxAttempts-- > 0 && !this.isCorrectMonth(currentHeader, targetYear, targetMonth)) {
      await nextButton.click();
      currentHeader = await monthHeader.textContent();
    }

    if (maxAttempts <= 0) {
      throw new Error('Превышено количество попыток поиска месяца');
    }
  }

  private isCorrectMonth(headerText: string | null, targetYear: number, targetMonth: number): boolean {
    if (!headerText) return false;
    
    // Форматируем дату в формат календаря (пример: "July 2023")
    const targetDate = new Date(targetYear, targetMonth - 1);
    const formattedTarget = targetDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    return headerText.trim() === formattedTarget;
  }

  private async selectDay(day: number): Promise<void> {
    const dayButton = this.page.locator(
      `button[role="gridcell"]:not([disabled]) [data-mui-test="day"]:text-is("${day}")`
    ).first();

    if (!(await dayButton.isEnabled())) {
      throw new Error(`Дата ${day} недоступна для выбора`);
    }

    await dayButton.click();
  }
}