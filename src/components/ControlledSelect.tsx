import { ReactNode } from 'react';
import { Select, SelectProps, FormControl, InputLabel, FormHelperText, MenuItem } from '@mui/material';
import { Controller, useFormContext, FieldValues, Path, RegisterOptions } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../utils/formUtils';

// Типы пропсов для ControlledSelect
type ControlledSelectProps<TFieldValues extends FieldValues> = {
  name: Path<TFieldValues>;
  label: string | ReactNode; // Label обязателен для Select
  rules?: Omit<RegisterOptions<TFieldValues, Path<TFieldValues>>, 'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'>;
  selectProps?: Omit<SelectProps, 'name' | 'label' | 'error' | 'value' | 'onChange' | 'onBlur'>;
  required?: boolean;
  children: ReactNode; // MenuItem должны передаваться как children
  labelId?: string; // ID для связки label и select
  showEmpty?: boolean; // Показывать ли пустой MenuItem
  emptyLabel?: string | ReactNode; // Текст для пустого MenuItem
  forceShrink?: boolean; // Принудительно сжимать лейбл для outlined варианта
};

function ControlledSelect<TFieldValues extends FieldValues>({
  name,
  label,
  rules,
  required,
  selectProps,
  children,
  labelId: customLabelId,
  showEmpty = true, // По умолчанию показываем пустой элемент
  emptyLabel = '', // По умолчанию пустая строка для значения пустого элемента
  forceShrink = false // По умолчанию не принуждаем
}: ControlledSelectProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>();
  const { t } = useTranslation();
  const labelId = customLabelId || `${name}-label`; // Генерируем ID, если не передан

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        // FormControl нужен для связки Label, Select и HelperText
        <FormControl 
          fullWidth 
          margin="dense" // Стандартный отступ
          error={!!error} 
          required={required}
        >
          <InputLabel id={labelId} shrink={forceShrink || !!field.value}>
            {label}
          </InputLabel>
          <Select
            {...selectProps} // Передаем все остальные пропсы Select
            {...field} // Передаем пропсы от react-hook-form
            labelId={labelId}
            label={label} // Label нужен Select для корректного отображения
            value={field.value ?? ''} // Гарантируем, что value не undefined
            displayEmpty={showEmpty} // Управляем отображением пустого MenuItem
          >
            {showEmpty && (
                <MenuItem value="" disabled>
                    <em>{emptyLabel || t('selectPlaceholder', 'Select...')}</em>
                </MenuItem>
            )}
            {children} {/* Рендерим переданные MenuItem */}
          </Select>
          {/* Отображаем helperText только если есть ошибка */}
          {error && (
            <FormHelperText>{getErrorMessage(error, rules, t)}</FormHelperText>
          )}
        </FormControl>
      )}
    />
  );
}

export default ControlledSelect; 