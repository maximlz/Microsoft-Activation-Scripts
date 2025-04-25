import { Timestamp } from 'firebase/firestore';
import { format, isValid } from 'date-fns'; // Добавляем isValid

/**
 * Форматирует дату (Timestamp или строку) в строку 'dd-MM-yyyy'.
 * Возвращает '-', если дата невалидна или отсутствует.
 * @param dateInput Дата для форматирования (Timestamp, строка YYYY-MM-DD или другая).
 * @returns string Отформатированная дата или '-'.
 */
export const formatDateDDMMYYYY = (dateInput: Timestamp | string | undefined | null): string => {
    if (!dateInput) return '-';
    try {
        // Пытаемся преобразовать в объект Date
        const date = dateInput instanceof Timestamp ? dateInput.toDate() : new Date(dateInput);

        // Проверяем валидность даты с помощью date-fns
        if (!isValid(date)) {
            // Если невалидно, но это была строка, вернем исходную строку (на случай если это не дата)
            return typeof dateInput === 'string' ? dateInput : '-';
        }
        // Форматируем валидную дату
        return format(date, 'dd-MM-yyyy');
    } catch (e) {
        console.error("Error formatting date:", dateInput, e);
        // В случае ошибки парсинга, вернем исходную строку или '-'
        return typeof dateInput === 'string' ? dateInput : '-';
    }
};

// Здесь можно добавить другие функции форматирования в будущем
// export const formatDateTime = (...) => { ... }; 