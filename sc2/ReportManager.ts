import { createCanvas } from 'chartjs-node-canvas';
import * as fs from 'fs';
import * as path from 'path';
import nodemailer from 'nodemailer';
import Logger from './Logger';
import ConfigManager from './ConfigManager'; // Если есть класс для конфигурации

class ReportManager {
    private page: any; // Замените на тип Page из Playwright, если используется
    private reportPath: string;

    constructor(page: any) {
        this.page = page;
        this.reportPath = path.join(process.env.LOCALAPPDATA || '', 'seleniumlogs.html');
    }

    // Создание таблицы для отчета
    private createTable(passed: number, failed: number): string {
        return `
            <table>
                <tr>
                    <th>Step Number</th>
                    <th>Description</th>
                    <th>Status</th>
                </tr>
                <tr>
                    <td>1</td>
                    <td>Test Step 1</td>
                    <td>${passed > 0 ? 'Passed' : 'Failed'}</td>
                </tr>
                <tr>
                    <td>2</td>
                    <td>Test Step 2</td>
                    <td>${failed > 0 ? 'Failed' : 'Passed'}</td>
                </tr>
            </table>
        `;
    }

    // Генерация диаграммы (pie chart)
    private async generatePieChart(passed: number, failed: number): Promise<string> {
        const width = 600;
        const height = 400;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Step Passed', 'Step Failed'],
                datasets: [{
                    data: [passed, failed],
                    backgroundColor: ['green', 'lightcoral'],
                }],
            },
            options: {
                responsive: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Test Execution Summary',
                    },
                },
            },
        });

        const imagePath = path.join(process.env.LOCALAPPDATA || '', 'test.png');
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(imagePath, buffer);

        return imagePath;
    }

    // Подготовка HTML-отчета
    private async prepareReport(passed: number, failed: number): Promise<string> {
        const table = this.createTable(passed, failed);
        const imagePath = await this.generatePieChart(passed, failed);

        const htmlContent = `
            <html>
                <header>
                    <h2 align="center"><font color="DarkBlue">OPEN FIN EXECUTION LOGS</font></h2>
                </header>
                <body bgcolor="Silver">
                    <img src="${imagePath}" alt="Run Summary" width="600" height="400">
                    ${table}
                </body>
            </html>
        `;

        return htmlContent;
    }

    // Отправка отчета по email
    private async sendEmail(htmlContent: string, project?: string): Promise<void> {
        const supportEmail = ConfigManager.getConfig(project);

        const transporter = nodemailer.createTransport({
            service: 'gmail', // Используйте другой сервис, если нужно
            auth: {
                user: 'your-email@gmail.com', // Замените на ваш email
                pass: 'your-email-password', // Замените на ваш пароль
            },
        });

        const mailOptions = {
            from: 'your-email@gmail.com',
            to: supportEmail,
            subject: 'Execution Summary',
            html: htmlContent,
        };

        try {
            await transporter.sendMail(mailOptions);
            Logger.log('Отчет успешно отправлен по email');
        } catch (error) {
            Logger.error(`Ошибка при отправке email: ${error}`);
        }
    }

    // Сохранение отчета в файл
    private saveReportToFile(htmlContent: string): void {
        try {
            fs.writeFileSync(this.reportPath, htmlContent);
            Logger.log(`Отчет сохранен в файл: ${this.reportPath}`);
        } catch (error) {
            Logger.error(`Ошибка при сохранении отчета: ${error}`);
        }
    }

    // Основной метод для логирования
    async logReport(passed: number, failed: number, project?: string): Promise<void> {
        try {
            const htmlContent = await this.prepareReport(passed, failed);
            this.saveReportToFile(htmlContent);
            await this.sendEmail(htmlContent, project);
        } catch (error) {
            Logger.error(`Ошибка при создании отчета: ${error}`);
        }
    }
}

export default ReportManager;