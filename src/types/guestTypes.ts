import { Timestamp } from 'firebase/firestore';

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
    timestamp: Timestamp; // Время создания записи
}

// Расширенный интерфейс, включающий ID документа Firestore
export interface IGuestFormDataWithId extends IGuestFormData {
    id: string;
} 