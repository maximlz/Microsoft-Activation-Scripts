import React from 'react';
import { MuiTelInput, MuiTelInputProps, MuiTelInputInfo } from 'mui-tel-input';
import { Controller, useFormContext, FieldValues, Path, RegisterOptions } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../utils/formUtils';

// Типы пропсов для ControlledMuiTelInput
type ControlledMuiTelInputProps<TFieldValues extends FieldValues> = {
  name: Path<TFieldValues>;
  label: string | React.ReactNode;
  rules?: Omit<RegisterOptions<TFieldValues, Path<TFieldValues>>, 'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'>;
  muiTelInputProps?: Omit<MuiTelInputProps, 'value' | 'onChange' | 'error' | 'helperText' | 'label'>;
  required?: boolean;
  // Добавляем коллбэк для получения MuiTelInputInfo, если он нужен снаружи
  onInfoChange?: (info: MuiTelInputInfo | null) => void; 
};

function ControlledMuiTelInput<TFieldValues extends FieldValues>({
  name,
  label,
  rules,
  required,
  muiTelInputProps,
  onInfoChange
}: ControlledMuiTelInputProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>();
  const { t } = useTranslation();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { onChange, onBlur, value, ref }, fieldState: { error } }) => {
        // Модифицируем onChange, чтобы он вызывал и оригинальный onChange от RHF, и наш onInfoChange
        const handleChange = (newValue: string, info: MuiTelInputInfo) => {
          onChange(newValue); // Обновляем значение в форме
          if (onInfoChange) {
            onInfoChange(info); // Передаем info наверх, если нужно
          }
        };

        return (
          <MuiTelInput
            {...muiTelInputProps} // Передаем остальные пропсы MuiTelInput
            value={value || ''} // Значение из RHF
            onChange={handleChange} // Наш модифицированный onChange
            onBlur={onBlur} // onBlur из RHF
            ref={ref} // ref из RHF
            label={label}
            required={required}
            error={!!error}
            helperText={getErrorMessage(error, rules, t)}
            fullWidth // Обычно телефонное поле делают во всю ширину
            margin="dense" // Стандартный отступ
            variant="outlined" // Стандартный вариант
          />
        );
      }}
    />
  );
}

export default ControlledMuiTelInput; 