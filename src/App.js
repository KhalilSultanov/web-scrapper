import React, { useState } from 'react';
import axios from 'axios';

function App() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleDownload = async () => {
        setLoading(true);
        setError('');
        console.log('Отправка запроса на сервер с URL:', url);

        try {
            const response = await axios.post('http://localhost:3001/download', { url }, { responseType: 'blob' });
            console.log('Запрос успешно выполнен, создание файла для скачивания...');

            const blob = new Blob([response.data], { type: 'application/zip' });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = `${url.replace(/^https?:\/\//, '').split('.')[0]}.zip`;
            link.click();
            console.log('Файл успешно создан и передан на скачивание.');

            setLoading(false);
        } catch (error) {
            console.error('Ошибка при скачивании:', error);
            setError('Ошибка при скачивании файла.');
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.header}>Скачивание файлов с сайта</h1>
            <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Введите URL"
                style={styles.input}
            />
            <button onClick={handleDownload} style={styles.button} disabled={loading}>
                {loading ? 'Скачивание...' : 'Скачать'}
            </button>
            {error && <p style={styles.error}>{error}</p>}
        </div>
    );
}

const styles = {
    container: {
        maxWidth: '600px',
        margin: '0 auto',
        padding: '40px',
        textAlign: 'center',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f4f4f4',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginTop: '100px', // Центрирование по вертикали
    },
    header: {
        marginBottom: '30px',
        fontSize: '24px',
        color: '#333',
    },
    input: {
        padding: '10px',
        width: '80%',
        borderRadius: '4px',
        border: '1px solid #ddd',
        fontSize: '16px',
        marginBottom: '20px', // Отступ снизу для кнопки
    },
    button: {
        padding: '10px 20px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: '#4CAF50',
        color: 'white',
        fontSize: '16px',
        cursor: 'pointer',
        transition: 'background-color 0.3s ease',
    },
    buttonHover: {
        backgroundColor: '#45a049',
    },
    error: {
        marginTop: '20px',
        color: 'red',
        fontSize: '14px',
    },
};

export default App;
