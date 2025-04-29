import React from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { Controller, useFormContext, FieldValues, Path, RegisterOptions } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
// Импортируем getErrorMessage из утилит
import { getErrorMessage } from '../utils/formUtils';

// Определяем тип пропсов для нашего компонента
// Используем дженерики для большей гибкости типов формы
type ControlledTextFieldProps<TFieldValues extends FieldValues> = {
  name: Path<TFieldValues>; // Имя поля, типизированное путями в форме
  label?: string | React.ReactNode; // Метка поля (может быть JSX для звездочки)
  rules?: Omit<RegisterOptions<TFieldValues, Path<TFieldValues>>, 'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'>; // Правила валидации
  textFieldProps?: Omit<TextFieldProps, 'name' | 'label' | 'error' | 'helperText' | 'required'>; // Остальные пропсы TextField
  required?: boolean; // Флаг обязательности поля
};

function ControlledTextField<TFieldValues extends FieldValues>({
  name,
  label,
  rules,
  required,
  textFieldProps,
}: ControlledTextFieldProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>(); // Получаем control из контекста
  const { t } = useTranslation();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...textFieldProps} // Передаем все остальные пропсы TextField
          {...field} // Передаем пропсы от react-hook-form (value, onChange, onBlur, ref)
          label={label}
          required={required} // MUI добавит звездочку, если true
          error={!!error}
          helperText={getErrorMessage(error, rules, t)}
          value={field.value || ''} // Обеспечиваем контролируемый ввод (избегаем undefined)
          margin={textFieldProps?.margin ?? "dense"}
          InputLabelProps={{
             shrink: !!field.value || textFieldProps?.type === 'date' || textFieldProps?.InputLabelProps?.shrink,
            ...(textFieldProps?.InputLabelProps),
          }}
        />
      )}
    />
  );
}

export default ControlledTextField; 