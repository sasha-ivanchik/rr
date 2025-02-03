import App from '../App';

class LoginPage {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    // Локаторы элементов
    private get usernameField(): string {
        return 'input[name="username"]';
    }

    private get passwordField(): string {
        return 'input[name="password"]';
    }

    private get loginButton(): string {
        return 'button[type="submit"]';
    }

    // Метод для авторизации
    async login(username: string, password: string): Promise<void> {
        await this.app.ui.fillTextField(this.usernameField, username);
        await this.app.ui.fillTextField(this.passwordField, password);
        await this.app.ui.clickButton(this.loginButton);
    }
}

export default LoginPage;