import { Timestamp } from 'firebase/firestore';

// Интерфейс данных бронирования
export interface IBooking {
    propertyName: string; // Или propertyId, если есть отдельная коллекция properties
    // propertyRef?: DocumentReference; // Альтернатива - ссылка на документ Property
    checkInDate: string; // Дата заезда 'YYYY-MM-DD'
    checkOutDate: string; // Дата выезда 'YYYY-MM-DD'
    registrationToken: string; // Уникальный токен для ссылки регистрации
    confirmationCode: string; // <-- НОВЫЙ КОД ПОДТВЕРЖДЕНИЯ
    createdAt: Timestamp; // Время создания записи бронирования
    status: 'pending' | 'completed' | 'expired'; // Статус бронирования
}

// Интерфейс бронирования с ID документа Firestore
export interface IBookingWithId extends IBooking {
    id: string;
}

// Интерфейс данных гостя, как они хранятся в Firestore
// (Можно вынести из GuestForm.tsx, если еще не вынесено)
export interface IGuestFormData {
    firstName: string;
    lastName: string;
    secondLastName?: string;
    birthDate: string; // Хранится как строка 'YYYY-MM-DD'
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
    visitDate: string; // Хранится как строка 'YYYY-MM-DD'
    countryCode?: string; // Код страны для телефона
    bookingConfirmationCode?: string; // <-- КОД БРОНИРОВАНИЯ ДЛЯ СВЯЗИ
    timestamp?: Timestamp; // Добавлено для сортировки/информации
    bookingId?: string; // <-- ДОБАВЛЯЕМ ID БРОНИРОВАНИЯ
}

// Расширенный интерфейс, включающий ID документа Firestore
export interface IGuestFormDataWithId extends IGuestFormData {
    id: string;
}

// --- Новый интерфейс для формы --- 
// Определяет поля, которые заполняются непосредственно в форме
export interface IGuestFormShape {
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
}
// --- Конец нового интерфейса --- 

// --- Property Types ---
export interface IProperty {
    name: string;
    // Add other property details here if needed in the future
    // e.g., address: string;
    // e.g., numberOfRooms: number;
    createdAt: Timestamp; // Keep track of when it was added
}

export interface IPropertyWithId extends IProperty {
    id: string;
}
// --- End of Property Types --- 