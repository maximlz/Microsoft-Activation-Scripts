import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Раскомментируем
// import { getAuth } from "firebase/auth"; // Раскомментируйте, если понадобится Firebase Auth
import { getStorage } from "firebase/storage";

// Считываем конфигурационные данные Firebase из переменных окружения
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID // Опционально, для Google Analytics
};

// Проверка, что все переменные окружения загружены
Object.entries(firebaseConfig).forEach(([key, value]) => {
    if (value === undefined) {
        console.error(`Firebase config error: Environment variable for ${key} is missing.`);
        // В реальном приложении здесь можно выбросить ошибку или показать сообщение пользователю
    }
});

// Инициализация Firebase
const app = initializeApp(firebaseConfig);

// Инициализация сервисов
const db = getFirestore(app);
const auth = getAuth(app); // Раскомментируем
// const auth = getAuth(app); // Раскомментируйте, если понадобится Firebase Auth

// Инициализируем и экспортируем storage
const storage = getStorage(app);

// Экспорт инициализированных сервисов
export { db, auth, storage }; // Добавляем auth и storage в экспорт 