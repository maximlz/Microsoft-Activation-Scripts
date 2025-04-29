import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Box, CircularProgress } from '@mui/material';
import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import ControlledTextField from './ControlledTextField';

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
    const methods = useForm<AddCountryFormData>({ mode: 'onChange' });
    const { handleSubmit, reset, formState: { isDirty, isValid } } = methods;

    const onSubmit: SubmitHandler<AddCountryFormData> = async (data) => {
        setIsAdding(true);
        try {
            await onAdd(data);
            reset(); // Сбрасываем форму
            onClose(); // Закрываем диалог после успеха
        } catch (err) {
            console.error("Error in onAdd handler:", err);
        } finally {
            setIsAdding(false);
        }
    };

    const handleClose = () => {
        reset(); // Сбрасываем форму при закрытии
        onClose();
    };

    return (
        <FormProvider {...methods}>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>{t('addCountryDialog.title', 'Add New Country')}</DialogTitle>
                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <DialogContent>
                        <ControlledTextField<AddCountryFormData>
                            name="name"
                            label={t('addCountryDialog.nameLabel', 'Country Name')}
                            required
                            rules={{ required: t('validation.required', 'This field is required') }}
                            textFieldProps={{
                                autoFocus: true,
                                margin: "dense",
                                type: "text",
                                fullWidth: true,
                                variant: "standard"
                            }}
                        />
                        <ControlledTextField<AddCountryFormData>
                            name="code"
                            label={t('addCountryDialog.codeLabel', 'Country Code (2-3 letters)')}
                            required
                            rules={{
                                required: t('validation.required', 'This field is required'),
                                maxLength: { value: 3, message: t('validation.maxLength', 'Max 3 characters') },
                                pattern: { value: /^[A-Z]*$/, message: t('validation.uppercaseLetters', 'Only uppercase letters') }
                            }}
                            textFieldProps={{
                                margin: "dense",
                                type: "text",
                                fullWidth: true,
                                variant: "standard",
                                inputProps: { maxLength: 3, style: { textTransform: 'uppercase' } }
                            }}
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
        </FormProvider>
    );
}

export default AddCountryDialog;