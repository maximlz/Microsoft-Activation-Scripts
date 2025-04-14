import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Box, CircularProgress } from '@mui/material';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export interface AddCountryFormData {
    name: string;
    code: string;
}

interface AddCountryDialogProps {
    open: boolean;
    onClose: () => void;
    onAdd: (data: AddCountryFormData) => Promise<void>; // Функция добавления
}

function AddCountryDialog({ open, onClose, onAdd }: AddCountryDialogProps) {
    const { t } = useTranslation();
    const [isAdding, setIsAdding] = useState(false);
    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isDirty, isValid }
    } = useForm<AddCountryFormData>({ mode: 'onChange' }); // Валидация при изменении

    const onSubmit: SubmitHandler<AddCountryFormData> = async (data) => {
        setIsAdding(true);
        try {
            await onAdd(data);
            reset(); // Сбрасываем форму
            onClose(); // Закрываем диалог после успеха
        } catch (err) {
            // Ошибки будут обработаны через Snackbar в родительском компоненте
            console.error("Error in onAdd handler:", err);
            // Можно добавить локальное сообщение об ошибке здесь, если нужно
        } finally {
            setIsAdding(false);
        }
    };

    const handleClose = () => {
        reset(); // Сбрасываем форму при закрытии
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle>{t('addCountryDialog.title', 'Add New Country')}</DialogTitle>
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                <DialogContent>
                    <Controller
                        name="name"
                        control={control}
                        defaultValue=""
                        rules={{ required: t('validation.required', 'This field is required') }}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                autoFocus
                                margin="dense"
                                label={t('addCountryDialog.nameLabel', 'Country Name')}
                                type="text"
                                fullWidth
                                variant="standard"
                                required
                                error={!!errors.name}
                                helperText={errors.name?.message}
                            />
                        )}
                    />
                    <Controller
                        name="code"
                        control={control}
                        defaultValue=""
                        rules={{
                             required: t('validation.required', 'This field is required'),
                             maxLength: { value: 3, message: t('validation.maxLength', 'Max 3 characters') },
                             pattern: { value: /^[A-Z]*$/, message: t('validation.uppercaseLetters', 'Only uppercase letters') }
                        }}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                margin="dense"
                                label={t('addCountryDialog.codeLabel', 'Country Code (2-3 letters)')}
                                type="text"
                                fullWidth
                                variant="standard"
                                required
                                error={!!errors.code}
                                helperText={errors.code?.message}
                                inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }} // Автоматический uppercase
                            />
                        )}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={isAdding}>{t('actions.cancel', 'Cancel')}</Button>
                    <Button type="submit" disabled={isAdding || !isDirty || !isValid} variant="contained">
                        {isAdding ? <CircularProgress size={24} /> : t('actions.add', 'Add')}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
}

export default AddCountryDialog; 