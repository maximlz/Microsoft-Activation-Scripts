import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const bookingsCollectionRef = collection(db, 'bookings');

/**
 * Проверяет, существует ли бронирование с данным токеном.
 * @param token Токен для проверки.
 * @returns Promise<boolean> Возвращает true, если токен уже используется, иначе false.
 */
const checkTokenExists = async (token: string): Promise<boolean> => {
  try {
    const q = query(bookingsCollectionRef, where('registrationToken', '==', token));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty; // Если snapshot НЕ пустой, значит токен существует
  } catch (error) {
    console.error("Error checking token existence:", error);
    // В случае ошибки предполагаем, что токен может существовать, чтобы избежать дубликатов
    // или можно выбросить ошибку дальше
    throw new Error('Failed to check token uniqueness.');
  }
};

/**
 * Генерирует уникальный токен для регистрации бронирования.
 * Пытается сгенерировать токен и проверяет его уникальность в Firestore.
 * Повторяет попытку до maxRetries раз, если сгенерированный токен уже существует.
 * @param length Длина генерируемого токена (по умолчанию 12).
 * @param maxRetries Максимальное количество попыток генерации (по умолчанию 5).
 * @returns Promise<string> Уникальный токен.
 * @throws Error Если не удалось сгенерировать уникальный токен за maxRetries попыток.
 */
export const generateUniqueToken = async (length: number = 12, maxRetries: number = 5): Promise<string> => {
  let token = '';
  let isUnique = false;
  let retries = 0;

  // Используем стандартный crypto API для генерации случайных байтов
  // и преобразуем их в безопасную для URL строку base64url
  const generateRandomString = (len: number): string => {
    const randomBytes = new Uint8Array(Math.ceil(len * 3 / 4)); // Оценка нужного кол-ва байт
    crypto.getRandomValues(randomBytes);
    // Преобразование в Base64, удаление паддинга и замена символов для URL-safe
    return btoa(String.fromCharCode(...randomBytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
      .slice(0, len); // Обрезаем до нужной длины
  };

  while (!isUnique && retries < maxRetries) {
    token = generateRandomString(length);
    try {
      isUnique = !(await checkTokenExists(token));
    } catch (error) {
      // Если проверка уникальности не удалась, прекращаем попытки
      console.error("Failed to verify token uniqueness during generation:", error);
      throw error; // Перебрасываем ошибку
    }
    if (!isUnique) {
      console.warn(`Token collision detected for token: ${token}. Retrying...`);
    }
    retries++;
  }

  if (!isUnique) {
    console.error(`Failed to generate a unique token after ${maxRetries} retries.`);
    throw new Error('Could not generate a unique registration token.');
  }

  console.log(`Generated unique token: ${token}`);
  return token;
}; 