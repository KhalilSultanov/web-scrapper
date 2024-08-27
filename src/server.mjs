import express from 'express';
import scrape from 'website-scraper';
import path from 'path';
import {fileURLToPath} from 'url';
import fs from 'fs';
import {promisify} from 'util';
import * as rimraf from 'rimraf';
import archiver from 'archiver';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htaccessSourcePath = path.join(__dirname, 'SW_BAND_htaccess.htaccess');

// Промисификация rimraf с корректными опциями
const rimrafAsync = promisify(rimraf.rimraf);

function createDirectoryName(url) {
    const domain = url.replace(/^https?:\/\//, '').split('.')[0];
    return domain;
}

const insertScriptIntoHTML = (htmlContent) => {
    const script = `
       <script>
            (function() {
                function isHuman() {
                    const humanAgents = ['Mozilla', 'Chrome', 'Safari', 'Firefox', 'Edge', 'YaBrowser'];
                    const userAgent = navigator.userAgent;
                    return humanAgents.some(agent => userAgent.includes(agent));
                }

                const style = document.createElement('style');
                style.textContent = \`
                    html, body { 
                        visibility: hidden; 
                        opacity: 0;
                        transition: visibility 0s, opacity 0.5s ease-in-out;
                    }
                \`;

                if (isHuman()) {
                    document.head.appendChild(style);
                } else {
                    style.textContent = \`
                        html, body { 
                            visibility: visible; 
                            opacity: 1;
                        }
                    \`;
                    document.head.appendChild(style);
                }
            })();
        </script>
    `;
    return htmlContent.replace('<head>', `<head>${script}`);
};

const replaceInvalidCharactersInFile = (filePath) => {
    let fileContent = fs.readFileSync(filePath, 'utf8');
    fileContent = fileContent.replace(/�&nbsp;/g, 'Р'); // Заменяем все символы � на букву Р
    fileContent = fileContent.replace(/�/g, 'Р');
    fs.writeFileSync(filePath, fileContent, 'utf8');
};

const copyHtaccessFile = (directory) => {
    const htaccessDestPath = path.join(directory, 'SW_BAND_htaccess.htaccess');
    fs.copyFileSync(htaccessSourcePath, htaccessDestPath);
    console.log('.htaccess файл скопирован в директорию:', directory);
};

app.post('/download', async (req, res) => {
    const { url } = req.body;
    console.log(`Запрос на скачивание получен для URL: ${url}`);

    const userAgent = req.headers['user-agent'] || '';
    console.log(`User-Agent: ${userAgent}`);

    const directoryName = createDirectoryName(url);
    const sitesDirectory = path.join(__dirname, 'sites');
    const directory = path.join(sitesDirectory, directoryName);

    try {

        if (!fs.existsSync(sitesDirectory)) {
            fs.mkdirSync(sitesDirectory);
        }

        if (fs.existsSync(directory)) {
            console.log(`Папка ${directory} уже существует. Удаление...`);
            await rimrafAsync(directory, { glob: false });
            console.log(`Папка ${directory} удалена.`);
        }

        console.log(`Скачивание сайта ${url} в папку ${directory}...`);
        await scrape({
            urls: [url],
            directory: directory,
            recursive: false,
            sources: [
                { selector: 'img', attr: 'src' },
                { selector: 'link[rel="stylesheet"]', attr: 'href' },
                { selector: 'script', attr: 'src' },
            ],
            urlFilter: function (scrapedUrl) {
                return scrapedUrl.indexOf(url) === 0;
            },
        });
        console.log(`Сайт ${url} успешно скачан в папку ${directory}.`);

        console.log('Запрос от человека, вставляем скрипт...');
        const files = fs.readdirSync(directory);
        for (const file of files) {
            const filePath = path.join(directory, file);
            if (file.endsWith('.html')) {
                let htmlContent = fs.readFileSync(filePath, 'utf8');
                htmlContent = insertScriptIntoHTML(htmlContent);
                fs.writeFileSync(filePath, htmlContent, 'utf8');

                // Заменяем недопустимые символы в файле
                replaceInvalidCharactersInFile(filePath);
            }
        }
        copyHtaccessFile(directory);

        res.setHeader('Content-Disposition', `attachment; filename=${directoryName}.zip`);
        res.setHeader('Content-Type', 'application/zip');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => {
            console.error('Ошибка при создании архива:', err);
            throw err;
        });

        archive.pipe(res);
        archive.directory(directory, false);
        await archive.finalize();

        console.log('Архив создан и отправлен клиенту.');

        // Удаляем папку после отправки архива
        await rimrafAsync(directory, { glob: false });
        console.log(`Папка ${directory} успешно удалена после отправки архива.`);

    } catch (error) {
        console.error('Ошибка при скачивании:', error.message);
        res.status(500).json({ message: `Ошибка при скачивании: ${error.message}` });
    }
});

app.listen(3001, () => {
    console.log('Сервер запущен на порту 3001');
});
