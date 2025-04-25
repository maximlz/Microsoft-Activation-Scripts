import {
    FirestoreDataConverter,
    SnapshotOptions,
    DocumentData,
    WithFieldValue,
    Timestamp
} from 'firebase/firestore';
import { IGuestFormDataWithId } from '../types/guestTypes';

/**
 * FirestoreDataConverter для коллекции 'guests'
 */
export const guestConverter: FirestoreDataConverter<IGuestFormDataWithId> = {
    toFirestore(guestWithId: WithFieldValue<IGuestFormDataWithId>): DocumentData {
        const { id, ...dataToWrite } = guestWithId;
        // Автоматически преобразует строки дат в объекты Date, если нужно, или Firebase сделает это сам?
        // Firestore обычно ожидает строки или Timestamp для дат. Оставляем как есть.
        // Если нужно преобразовывать, можно добавить здесь:
        // dataToWrite.birthDate = new Date(dataToWrite.birthDate);
        // dataToWrite.visitDate = new Date(dataToWrite.visitDate);
        return dataToWrite;
    },
    fromFirestore(snapshot: DocumentData, options: SnapshotOptions): IGuestFormDataWithId {
        const data = snapshot.data(options)!;
        return {
            id: snapshot.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            secondLastName: data.secondLastName,
            birthDate: data.birthDate || '', // Даты хранятся как строки YYYY-MM-DD
            nationality: data.nationality || '',
            sex: data.sex || '',
            documentType: data.documentType || '',
            documentNumber: data.documentNumber || '',
            documentSupNum: data.documentSupNum,
            phone: data.phone || '',
            email: data.email || '',
            countryResidence: data.countryResidence || '',
            residenceAddress: data.residenceAddress || '',
            apartmentNumber: data.apartmentNumber || '', // Раскомментировано и добавлено значение по умолчанию
            city: data.city || '',
            postcode: data.postcode || '',
            visitDate: data.visitDate || '', // Даты хранятся как строки YYYY-MM-DD
            countryCode: data.countryCode,
            bookingConfirmationCode: data.bookingConfirmationCode,
            timestamp: data.timestamp as Timestamp, // Явно указываем тип для timestamp
            bookingId: data.bookingId
        } as IGuestFormDataWithId;
    }
}; 