/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Импортируем onCall из v2
// Удаляем неиспользуемый HttpsOptions
import { /* HttpsOptions, */ onCall } from "firebase-functions/v2/https"; 
// Удаляем общий импорт v1
// import * as functions from "firebase-functions"; 
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
// Импортируем logger и HttpsError
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v2/https";

// Определяем интерфейс IGuestFormData локально вместо импорта из основного проекта
interface IGuestFormData {
  firstName: string;
  lastName: string;
  secondLastName?: string;
  birthDate: string;
  nationality: string;
  sex: string;
  documentType: string;
  documentNumber: string;
  documentSupNum?: string;
  phone: string;
  email: string;
  countryResidence: string;
  residenceAddress: string;
  city: string;
  postcode: string;
  visitDate: string;
  countryCode?: string;
  bookingConfirmationCode?: string;
  timestamp?: any; // FirebaseFirestore.Timestamp или admin.firestore.Timestamp
  bookingId?: string;
}

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Инициализируем Firebase Admin с использованием отдельных функций для ESM
initializeApp();
const db = getFirestore();

interface CreateGuestData {
  // Ожидаем получить объект, который уже содержит все поля, 
  // включая bookingId и bookingConfirmationCode, подготовленные на клиенте
  guestData: IGuestFormData; 
}

// Используем импортированный onCall из v2
export const createGuest = onCall(
  // Для v2 функции обработчик принимает объект запроса
  async (request): Promise<{ success: boolean; guestId?: string; error?: string }> => {
    
    // Данные клиента теперь в request.data
    const data = request.data as CreateGuestData;
    // Контекст аутентификации в request.auth
    // const auth = request.auth;

    // 1. Проверка: вызывается неаутентифицированным пользователем? (Опционально, но полезно)
    // if (auth) { ... }

    const { guestData } = data;

    // 2. Валидация входных данных (базовая)
    if (!guestData || !guestData.bookingId || !guestData.bookingConfirmationCode) {
      // Используем импортированный logger
      logger.error("Validation failed: Missing guestData, bookingId, or bookingConfirmationCode", data);
      // Используем импортированный HttpsError
      throw new HttpsError(
        "invalid-argument", 
        "Required data (guestData with bookingId and bookingConfirmationCode) is missing."
      );
    }

    const bookingId = guestData.bookingId;
    const confirmationCodeFromGuest = guestData.bookingConfirmationCode;

    logger.info(`Attempting to create guest for bookingId: ${bookingId}`); // Используем импортированный logger

    try {
      // 3. Получаем документ бронирования
      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingSnap = await bookingRef.get();

      // 4. Проверка существования бронирования
      if (!bookingSnap.exists) {
        logger.error(`Booking not found for bookingId: ${bookingId}`);
        throw new HttpsError( // Используем импортированный HttpsError
          "not-found", 
          `Booking with ID ${bookingId} not found.`
        );
      }

      const bookingData = bookingSnap.data();

      // 5. Проверка статуса бронирования
      if (!bookingData || bookingData.status !== "pending") {
        logger.error(`Booking status is not pending for bookingId: ${bookingId}. Status: ${bookingData?.status}`);
        throw new HttpsError(
          "failed-precondition", 
          "Guest registration is not allowed for this booking (status is not 'pending')."
        );
      }

      // 6. Проверка кода подтверждения
      if (bookingData.confirmationCode !== confirmationCodeFromGuest) {
        logger.error(`Confirmation code mismatch for bookingId: ${bookingId}. Expected: ${bookingData.confirmationCode}, Received: ${confirmationCodeFromGuest}`);
        throw new HttpsError(
          "failed-precondition", 
          "Invalid confirmation code."
        );
      }

      // 7. Все проверки пройдены. Создаем гостя.
      const finalGuestData = {
        ...guestData,
        timestamp: FieldValue.serverTimestamp(), 
      };

      const newGuestRef = await db.collection("guests").add(finalGuestData);
      logger.info(`Successfully created guest ${newGuestRef.id} for booking ${bookingId}`);

      return { success: true, guestId: newGuestRef.id };

    } catch (error: any) {
      logger.error(`Error creating guest for booking ${bookingId}:`, error);
      if (error instanceof HttpsError) { // Проверяем на импортированный HttpsError
        throw error;
      }
      throw new HttpsError(
        "internal", 
        "An internal error occurred while creating the guest.",
        error.message
      );
    }
  }
);
