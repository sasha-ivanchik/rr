import App from '../App';
import LoginPage from './page';

(async () => {
    try {
        const app = await App.connect(); // Подключение

        const loginPage = new LoginPage(app);
        await loginPage.login('username', 'password'); // Авторизация

        await app.disconnect(); // Отключение
    } catch (error) {
        console.error('Произошла ошибка:', error);
    }
})();