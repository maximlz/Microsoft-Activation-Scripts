import { FieldError, RegisterOptions } from 'react-hook-form';

// Вспомогательная функция для получения сообщения об ошибке
export const getErrorMessage = (
    fieldError: FieldError | undefined, 
    rules: Omit<RegisterOptions<any, any>, 'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'> | undefined,
    t: Function // Функция перевода (i18next)
): string | null => {
  if (!fieldError) return null;

  const fieldName = fieldError.ref?.name;
  const errorType = fieldError.type;
  const messageFromRule = fieldError.message;

  let finalMessageKey: string | null = null;
  let lengthValue: number | string | undefined = undefined;
  let interpolationOptions: { field: string; length?: number | string } = { field: '' };

  // 1. Проверяем, есть ли готовый ключ перевода в message
  if (typeof messageFromRule === 'string' && t(messageFromRule) !== messageFromRule) {
    finalMessageKey = messageFromRule;
  } else {
    // 2. Иначе, пробуем сформировать ключ из типа ошибки
    const genericErrorTypeKey = `errors.${errorType}`;
    
    // 3. Особая обработка для minLength/maxLength
    if (errorType === 'minLength' || errorType === 'maxLength') {
      const typedErrorType = errorType as 'minLength' | 'maxLength';
      const ruleConfig = rules?.[typedErrorType];
      let ruleValue: number | undefined = undefined;

      // Проверяем тип правила: объект или число
      if (typeof ruleConfig === 'object' && ruleConfig !== null && 'value' in ruleConfig) {
          ruleValue = ruleConfig.value as number;
      } else if (typeof ruleConfig === 'number') {
          ruleValue = ruleConfig;
      }

      // Пытаемся найти специфичный ключ (например, errors.minLength_5)
      const specificLengthKey = ruleValue !== undefined ? `errors.${typedErrorType}_${ruleValue}` : null;
      
      if(specificLengthKey && t(specificLengthKey) !== specificLengthKey) {
          finalMessageKey = specificLengthKey;
          lengthValue = ruleValue;
      } else if (t(genericErrorTypeKey) !== genericErrorTypeKey) { // Fallback на общий ключ (errors.minLength)
          finalMessageKey = genericErrorTypeKey;
          lengthValue = ruleValue; 
      }
    } else { 
      // 4. Для остальных ошибок пробуем общий ключ (например, errors.required, errors.pattern)
       if (t(genericErrorTypeKey) !== genericErrorTypeKey) {
         finalMessageKey = genericErrorTypeKey;
       } 
    }
  }

  // 5. Если ключ не найден, возвращаем message как есть или общий fallback
  if (!finalMessageKey) {
    if (typeof messageFromRule === 'string') return messageFromRule;
    return t('errors.invalidInput', 'Invalid input'); // Общий fallback
  }

  // 6. Формируем опции для интерполяции
  interpolationOptions.field = fieldName ? t(fieldName, { defaultValue: fieldName }) : t('unknownField', 'Field');
  
  if (lengthValue !== undefined) {
      interpolationOptions.length = lengthValue;
  }

  // 7. Возвращаем переведенное сообщение
  return t(finalMessageKey, interpolationOptions);
}; 