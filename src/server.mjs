import express from 'express';
import scrape from 'website-scraper';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { promisify } from 'util';
import * as rimraf from 'rimraf';  // Импортируем все как объект
import archiver from 'archiver';  // Для создания ZIP-архива
import cors from 'cors';  // Импортируем cors

const app = express();
app.use(express.json());

// Разрешаем запросы с других доменов
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rimrafAsync = promisify(rimraf.rimraf);  // Промисификация функции rimraf

function createDirectoryName(url) {
    const domain = url.replace(/^https?:\/\//, '').split('.')[0];
    return domain;
}

// Функция для определения, является ли запрос от человека
const isHumanRequest = (userAgent) => {
    const humanAgents = ['Mozilla', 'Chrome', 'Safari', 'Firefox', 'Edge', ' YaBrowser'];
    return humanAgents.some(agent => userAgent.includes(agent));
};

// Функция для вставки скрипта в HTML-файлы
const insertScriptIntoHTML = (htmlContent) => {
    const script = `
        <style>
            html, body { 
                visibility: hidden; 
                opacity: 0;
                transition: visibility 0s, opacity 0.5s ease-in-out;
            }
        </style>
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                document.documentElement.style.visibility = 'visible';
                document.documentElement.style.opacity = '1';
            });
        </script>
        <noscript>
            <style>
                html, body { 
                    visibility: visible; 
                    opacity: 1;
                }
            </style>
        </noscript>
    `;
    // Вставляем скрипт и стили сразу после открывающего тега <head>
    return htmlContent.replace('<head>', `<head>${script}`);
};



app.post('/download', async (req, res) => {
    const { url } = req.body;
    console.log(`Запрос на скачивание получен для URL: ${url}`);

    const userAgent = req.headers['user-agent'] || '';

    // Логируем User-Agent
    console.log(`User-Agent: ${userAgent}`);

    const isHuman = isHumanRequest(userAgent);
    const directoryName = createDirectoryName(url);
    const directory = path.join(__dirname, directoryName); // Директория для сохранения файлов

    try {
        // Если папка существует, удаляем её
        if (fs.existsSync(directory)) {
            console.log(`Папка ${directory} уже существует. Удаление...`);
            await rimrafAsync(directory);
            console.log(`Папка ${directory} удалена.`);
        }

        // Скачиваем сайт
        console.log(`Скачивание сайта ${url} в папку ${directory}...`);
        await scrape({
            urls: [url],
            directory: directory,
            recursive: true,
            maxDepth: 2,
            urlFilter: function (scrapedUrl) {
                return scrapedUrl.indexOf(url) === 0;
            },
        });
        console.log(`Сайт ${url} успешно скачан в папку ${directory}.`);

        // Если запрос от человека, вставляем скрипт в HTML-файлы
        if (isHuman) {
            console.log('Запрос от человека, вставляем скрипт...');
            const files = fs.readdirSync(directory);
            for (const file of files) {
                const filePath = path.join(directory, file);
                if (file.endsWith('.html')) {
                    let htmlContent = fs.readFileSync(filePath, 'utf8');
                    htmlContent = insertScriptIntoHTML(htmlContent);
                    fs.writeFileSync(filePath, htmlContent, 'utf8');
                }
            }
        }

        // Создаем ZIP-архив из скачанных файлов
        const zipFilePath = path.join(__dirname, `${directoryName}.zip`);
        console.log(`Создание ZIP-архива ${zipFilePath}...`);

        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`${archive.pointer()} total bytes`);
            console.log('Архив создан, отправка клиенту.');
            res.download(zipFilePath);  // Отправляем архив клиенту
        });

        archive.on('error', (err) => {
            console.error('Ошибка при создании архива:', err);
            throw err;
        });

        archive.pipe(output);
        archive.directory(directory, false);
        await archive.finalize();

    } catch (error) {
        console.error('Ошибка при скачивании:', error.message);
        res.status(500).json({ message: `Ошибка при скачивании: ${error.message}` });
    }
});

app.listen(3001, () => {
    console.log('Сервер запущен на порту 3001');
});
