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
// Добавляем импорт getStorage
import { getStorage } from "firebase-admin/storage";
import { Buffer } from "buffer"; // Для работы с base64

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
  passportPhotoUrl?: string; // Добавляем сюда
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
// Инициализируем Storage
const storage = getStorage();

// --- Cloud Function: createGuest --- 
interface CreateGuestData {
  guestData: IGuestFormData; 
}

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

// --- Cloud Function: updateGuest --- 
interface UpdateGuestData {
  guestId: string;
  guestData: Partial<IGuestFormData>;
}

export const updateGuest = onCall(
  async (request): Promise<{ success: boolean; error?: string }> => {
    const { guestId, guestData } = request.data as UpdateGuestData;

    logger.info(`Attempting to update guest: ${guestId}`);

    // 1. Валидация входных данных
    if (!guestId || !guestData) {
      logger.error("Update failed: Missing guestId or guestData", request.data);
      throw new HttpsError("invalid-argument", "Required data (guestId and guestData) is missing.");
    }

    // Запрещаем изменение bookingId и bookingConfirmationCode при обновлении
    if (guestData.bookingId || guestData.bookingConfirmationCode) {
      logger.error(`Update failed for ${guestId}: Attempted to modify bookingId or bookingConfirmationCode.`);
      throw new HttpsError("invalid-argument", "Updating bookingId or bookingConfirmationCode is not allowed.");
    }

    try {
      const guestRef = db.collection("guests").doc(guestId);
      const guestSnap = await guestRef.get();

      // 2. Проверка существования гостя
      if (!guestSnap.exists) {
        logger.error(`Update failed: Guest not found for guestId: ${guestId}`);
        throw new HttpsError("not-found", `Guest with ID ${guestId} not found.`);
      }

      // 3. Обновляем документ
      await guestRef.update({
        ...guestData,
        timestampUpdated: FieldValue.serverTimestamp()
      });

      logger.info(`Successfully updated guest ${guestId}`);
      return { success: true };

    } catch (error: any) {
      logger.error(`Error updating guest ${guestId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal", 
        "An internal error occurred while updating the guest.",
        error.message
      );
    }
  }
);

// --- Cloud Function: deleteGuest --- 
interface DeleteGuestData {
  guestId: string;
}

export const deleteGuest = onCall(
  async (request): Promise<{ success: boolean; error?: string }> => {
    const { guestId } = request.data as DeleteGuestData;

    logger.info(`Attempting to delete guest: ${guestId}`);

    // 1. Валидация входных данных
    if (!guestId) {
      logger.error("Delete failed: Missing guestId", request.data);
      throw new HttpsError("invalid-argument", "Required data (guestId) is missing.");
    }

    try {
      const guestRef = db.collection("guests").doc(guestId);
      const guestSnap = await guestRef.get();

      // 2. Проверка существования гостя (опционально)
      if (!guestSnap.exists) {
        logger.warn(`Delete request for non-existent guestId: ${guestId}`);
        // Можно вернуть успех или ошибку
        // return { success: true }; 
      }
      
      // 3. Удаляем документ
      await guestRef.delete();
      
      logger.info(`Successfully deleted guest ${guestId}`);
      return { success: true };

    } catch (error: any) {
      logger.error(`Error deleting guest ${guestId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal", 
        "An internal error occurred while deleting the guest.",
        error.message
      );
    }
  }
);

// --- Cloud Function: uploadGuestPassport ---
interface UploadGuestPassportData {
  registrationToken: string;
  fileData: string; // base64 encoded file content
  fileName: string; // original file name (для расширения)
  contentType: string; // Mime type (e.g., 'image/jpeg')
}

interface UploadGuestPassportResult {
  success: boolean;
  downloadURL?: string;
  error?: string;
}

export const uploadGuestPassport = onCall(
  // Добавляем опции для CORS
  {
    // Разрешаем запросы только с вашего опубликованного приложения
    // или используйте true для разрешения всех доменов (менее безопасно)
    cors: ["https://lchome-registration.web.app"],
    // Можно добавить другие опции, если необходимо, например, region
    // region: 'us-central1',
  },
  async (request): Promise<UploadGuestPassportResult> => {
    const { registrationToken, fileData, fileName, contentType } =
      request.data as UploadGuestPassportData;

    logger.info(
      `Attempting passport upload for token: ${registrationToken}, filename: ${fileName}, type: ${contentType}`,
    );

    // 1. Валидация входных данных
    if (!registrationToken || !fileData || !fileName || !contentType) {
      logger.error(
        "Upload failed: Missing registrationToken, fileData, fileName, or contentType",
        request.data,
      );
      throw new HttpsError(
        "invalid-argument",
        "Required data (registrationToken, fileData, fileName, contentType) is missing.",
      );
    }
    
    // Ограничения (пример)
    const maxSizeMb = 5;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    // Приблизительный размер base64 строки (может быть чуть больше реального)
    if (fileData.length * 0.75 > maxSizeBytes) {
      logger.error(`Upload failed for token ${registrationToken}: File size exceeds ${maxSizeMb}MB`);
      throw new HttpsError("invalid-argument", `File size exceeds ${maxSizeMb}MB.`);
    }
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(contentType)) {
      logger.error(`Upload failed for token ${registrationToken}: Invalid content type ${contentType}`);
      throw new HttpsError("invalid-argument", "Invalid file type. Only PDF, JPG, PNG allowed.");
    }


    try {
      // 2. Ищем бронирование по токену
      const bookingsRef = db.collection("bookings");
      const q = bookingsRef
        .where("registrationToken", "==", registrationToken)
        .limit(1);
      const querySnapshot = await q.get();

      if (querySnapshot.empty) {
        logger.error(
          `Upload failed: Booking not found for token: ${registrationToken}`,
        );
        throw new HttpsError(
          "not-found",
          "Invalid or expired registration link (booking not found).",
        );
      }

      const bookingDoc = querySnapshot.docs[0];
      const bookingData = bookingDoc.data();
      const bookingId = bookingDoc.id;

      // 3. Проверяем статус бронирования
      if (!bookingData || bookingData.status !== "pending") {
        logger.error(
          `Upload failed: Booking status is not pending for token: ${registrationToken}. Status: ${bookingData?.status}`,
        );
        throw new HttpsError(
          "failed-precondition",
          "Guest registration is not allowed for this booking (status is not 'pending').",
        );
      }

      // 4. Подготовка файла к загрузке
      // Извлекаем base64 данные (убираем data:mime/type;base64,)
      const base64Data = fileData.split(",")[1] ?? fileData; // Убираем префикс если есть
      const fileBuffer = Buffer.from(base64Data, "base64");

      // Определяем расширение файла
      const fileExtension = fileName.split(".").pop() || "bin"; // 'bin' как запасной вариант
      const uniqueFileName = `${Date.now()}_passport.${fileExtension}`;
      const filePath = `passport_photos/${bookingId}/${uniqueFileName}`;

      // 5. Загрузка файла в Storage
      const bucket = storage.bucket(); // Используем default bucket
      const file = bucket.file(filePath);

      logger.info(`Uploading file to Storage path: ${filePath}`);

      await file.save(fileBuffer, {
        metadata: {
          contentType: contentType,
          // Можно добавить кастомные метаданные, если нужно
          // metadata: { registrationToken: registrationToken }
        },
        // Делаем файл публично читаемым сразу (проще для клиента)
        // В качестве альтернативы, можно генерировать signed URL
        public: true,
      });

      const downloadURL = file.publicUrl();
      logger.info(
        `File uploaded successfully for token ${registrationToken}. URL: ${downloadURL}`,
      );

      // 6. Возвращаем URL
      return { success: true, downloadURL: downloadURL };

    } catch (error: any) {
      logger.error(
        `Error uploading passport for token ${registrationToken}:`,
        error,
      );
      if (error instanceof HttpsError) {
        throw error;
      }
      // Добавляем детализацию для ошибок Storage
      let errorMessage = "An internal error occurred during file upload.";
      if (error.code) {
        errorMessage = `Storage error (${error.code}): ${error.message}`;
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw new HttpsError(
        "internal",
        errorMessage,
        error // Передаем исходную ошибку для возможного анализа
      );
    }
  },
);

// --- Cloud Function: getBookingDetailsByToken ---
interface GetBookingDetailsData {
  token: string;
}

// Интерфейс для возвращаемых данных
interface BookingDataForGuest {
  id: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  confirmationCode: string;
  // Обновляем тип для registeredGuests, чтобы соответствовать RegisteredGuestState
  registeredGuests: {
    id: string;
    firstName: string;
    lastName: string;
    nationality: string; // Добавляем для Chip
    documentType: string; // Добавляем для отображения
    documentNumber: string; // Добавляем для отображения
    passportPhotoUrl?: string;
    // Добавляем остальные поля, необходимые для handleEditGuestClick
    secondLastName?: string;
    birthDate?: string;
    sex?: string;
    documentSupNum?: string;
    phone?: string;
    email?: string;
    countryResidence?: string;
    residenceAddress?: string;
    apartmentNumber?: string;
    city?: string;
    postcode?: string;
    visitDate?: string;
    countryCode?: string;
  }[];
}

interface GetBookingDetailsResult {
  success: boolean;
  booking?: BookingDataForGuest;
  error?: string;
}

export const getBookingDetailsByToken = onCall(
  {
    // Разрешаем вызов с хостинга
    cors: ["https://lchome-registration.web.app"],
  },
  async (request): Promise<GetBookingDetailsResult> => {
    const { token } = request.data as GetBookingDetailsData;
    logger.info(`Fetching booking details for token: ${token}`);

    if (!token) {
      logger.error("Fetch failed: Missing token");
      throw new HttpsError("invalid-argument", "Registration token is missing.");
    }

    try {
      // 1. Ищем бронирование по токену
      const bookingsRef = db.collection("bookings");
      const q = bookingsRef.where("registrationToken", "==", token).limit(1);
      const querySnapshot = await q.get();

      if (querySnapshot.empty) {
        logger.error(`Fetch failed: Booking not found for token: ${token}`);
        throw new HttpsError(
          "not-found",
          "Invalid or expired registration link (booking not found).",
        );
      }

      const bookingDoc = querySnapshot.docs[0];
      const bookingData = bookingDoc.data();
      const bookingId = bookingDoc.id;

      // 2. Проверяем статус бронирования
      if (!bookingData || bookingData.status !== "pending") {
        logger.error(
          `Fetch failed: Booking status is not pending for token: ${token}. Status: ${bookingData?.status}`,
        );
        throw new HttpsError(
          "failed-precondition",
          "This registration link has already been used or expired.", // Сообщение для пользователя
        );
      }

      // 3. Получаем список зарегистрированных гостей для этого бронирования
      const guestsCollection = db.collection("guests");
      const guestsQuery = guestsCollection
        .where("bookingId", "==", bookingId)
        .orderBy("timestamp", "asc"); // Или orderBy("firstName", "asc");
      const guestDocs = await guestsQuery.get();

      // 4. Формируем массив данных гостей
      const registeredGuestsData = guestDocs.docs.map((doc) => {
        const data = doc.data();
        // Гарантируем возврат всех полей, ожидаемых фронтендом (RegisteredGuestState)
        return {
          id: doc.id,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          nationality: data.nationality || "",
          documentType: data.documentType || "",
          documentNumber: data.documentNumber || "",
          passportPhotoUrl: data.passportPhotoUrl || undefined, // Используем undefined если нет
          // Добавляем остальные поля с проверкой на существование
          secondLastName: data.secondLastName || "",
          birthDate: data.birthDate || "",
          sex: data.sex || "",
          documentSupNum: data.documentSupNum || "",
          phone: data.phone || "",
          email: data.email || "",
          countryResidence: data.countryResidence || "",
          residenceAddress: data.residenceAddress || "",
          apartmentNumber: data.apartmentNumber || "",
          city: data.city || "",
          postcode: data.postcode || "",
          visitDate: data.visitDate || "",
          countryCode: data.countryCode || "",
        };
      });

      // 5. Формируем объект ответа
      const bookingResponse: BookingDataForGuest = {
        id: bookingId,
        propertyName: bookingData.propertyName,
        checkInDate: bookingData.checkInDate,
        checkOutDate: bookingData.checkOutDate,
        confirmationCode: bookingData.confirmationCode,
        registeredGuests: registeredGuestsData,
      };

      logger.info(`Successfully retrieved booking details and ${registeredGuestsData.length} guests for token ${token}`);
      return { success: true, booking: bookingResponse };

    } catch (error: any) {
      logger.error(`Error fetching booking details for token ${token}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        "Failed to load registration details. Please try again later.", // Общее сообщение для пользователя
        error.message,
      );
    }
  },
);

// --- Cloud Function: deleteGuestPassport ---
interface DeleteGuestPassportData {
  guestId: string;
  // Токен не нужен, т.к. предполагаем, что вызов идет с формы, где есть guestId
}

export const deleteGuestPassport = onCall(
  {
    cors: ["https://lchome-registration.web.app"],
  },
  async (request): Promise<{ success: boolean; error?: string }> => {
    const { guestId } = request.data as DeleteGuestPassportData;
    logger.info(`Attempting to delete passport for guestId: ${guestId}`);

    if (!guestId) {
      logger.error("Delete passport failed: Missing guestId");
      throw new HttpsError("invalid-argument", "Guest ID is missing.");
    }

    try {
      const guestRef = db.collection("guests").doc(guestId);
      const guestSnap = await guestRef.get();

      if (!guestSnap.exists) {
        logger.warn(`Delete passport: Guest not found for guestId: ${guestId}`);
        // Если гостя нет, считаем операцию успешной (удалять нечего)
        return { success: true }; 
      }

      const guestData = guestSnap.data();
      const existingUrl = guestData?.passportPhotoUrl;

      if (!existingUrl) {
        logger.info(`Delete passport: No existing passport URL for guestId: ${guestId}`);
        return { success: true }; // Файла нет, удалять нечего
      }

      // Обновляем Firestore СНАЧАЛА (или параллельно), чтобы избежать состояния, когда файл удален, а ссылка осталась
      await guestRef.update({ passportPhotoUrl: FieldValue.delete() }); // Удаляем поле
      logger.info(`Firestore field passportPhotoUrl removed for guestId: ${guestId}`);

      // Пытаемся удалить файл из Storage
      try {
        // Пытаемся извлечь путь из URL (это может быть ненадежно, зависит от формата URL)
        // Пример URL: https://storage.googleapis.com/YOUR_BUCKET_ID/passport_photos/BOOKING_ID/FILENAME.jpg
        // Нужно извлечь: passport_photos/BOOKING_ID/FILENAME.jpg
        const urlObject = new URL(existingUrl);
        // Путь начинается после имени бакета (первый слеш после хоста)
        const filePath = urlObject.pathname.substring(urlObject.pathname.indexOf("/", 1) + 1);
          
        if (filePath) {
          logger.info(`Attempting to delete Storage file at path: ${filePath}`);
          const bucket = storage.bucket(); 
          const file = bucket.file(filePath);
          await file.delete();
          logger.info(`Successfully deleted Storage file: ${filePath}`);
        } else {
          logger.warn(`Could not extract file path from URL: ${existingUrl}`);
        }
      } catch (storageError: any) {
        // Логируем ошибку удаления файла, но НЕ прерываем функцию,
        // так как Firestore уже обновлен (это важнее)
        logger.error(`Failed to delete Storage file for URL ${existingUrl}. Error:`, storageError);
        // Можно добавить механизм повторной попытки или репортинга
      }

      return { success: true };

    } catch (error: any) {
      logger.error(`Error deleting passport for guest ${guestId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        "An internal error occurred while deleting the passport photo.",
        error.message,
      );
    }
  },
);
