/**
 * Функции-валидаторы для форм
 */

// Функция для проверки минимального возраста (14 лет)
export const validateMinAge = (birthDateString: string): boolean | string => {
    try {
        const birthDate = new Date(birthDateString);
        const today = new Date();
        // Устанавливаем дату 14 лет назад от сегодняшнего дня
        const minAgeDate = new Date(today.getFullYear() - 14, today.getMonth(), today.getDate());
        
        // Проверка на валидность самой даты рождения
        if (isNaN(birthDate.getTime())) {
            return 'errors.invalidDate'; // Ключ для перевода ошибки
        }
        
        // Проверка на минимальный возраст
        if (birthDate > minAgeDate) {
            // Если дата рождения позже, чем дата 14 лет назад, возраст меньше 14
            return 'errors.minAge'; // Ключ для перевода ошибки
        }
        
        return true; // Валидация прошла
    } catch (e) {
        // На случай других ошибок при работе с датой
        return 'errors.invalidDate'; // Ключ для перевода ошибки
    }
};

// Функция для проверки даты посещения (не раньше текущего дня)
export const validateVisitDate = (visitDateString: string): boolean | string => {
    try {
        const visitDate = new Date(visitDateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Сбрасываем время до начала дня для корректного сравнения дат
        
        // Проверка на валидность самой даты посещения
        if (isNaN(visitDate.getTime())) {
            return 'errors.invalidDate'; // Ключ для перевода ошибки
        }
        
        // Проверка, что дата не в прошлом
        if (visitDate < today) {
            return 'errors.futureDateRequired'; // Ключ для перевода ошибки
        }
        
        return true; // Валидация прошла
    } catch (e) {
        // На случай других ошибок при работе с датой
        return 'errors.invalidDate'; // Ключ для перевода ошибки
    }
}; 