class Logger {
    private comments: string = '';

    addComment(message: string): void {
        this.comments += `<br>${message}`;
        console.log(message);
    }

    getComments(): string {
        return this.comments;
    }

    clearComments(): void {
        this.comments = '';
    }

    generateReport(): string {
        return `
            <html>
                <head><title>Test Report</title></head>
                <body>
                    <h1>Test Execution Logs</h1>
                    <div>${this.comments}</div>
                </body>
            </html>
        `;
    }

    saveReportToFile(filePath: string): void {
        const report = this.generateReport();
        const fs = require('fs');
        fs.writeFileSync(filePath, report);
        console.log(`Report saved to ${filePath}`);
    }
}

export default Logger;