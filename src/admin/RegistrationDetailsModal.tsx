import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress, Alert, Grid, TextField } from '@mui/material';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { db } from '../config/firebaseConfig';
import { guestConverter, formatDateDDMMYYYY } from './RegistrationsList';
import { IGuestFormData } from '../types/guestTypes';
import { useTranslation } from 'react-i18next';

interface RegistrationDetailsModalProps {
    open: boolean;
    onClose: () => void;
    registrationId: string | null;
    isEditMode: boolean;
    onSave: (id: string, data: IGuestFormData) => Promise<void>;
}

// Helper для рендеринга полей (чтобы не повторяться)
const renderReadOnlyField = (label: string, value: string | Timestamp | undefined | null, isDate: boolean = false) => (
    <Grid item xs={12} sm={6} key={label}>
        <TextField
            label={label}
            value={isDate ? formatDateDDMMYYYY(value as (Timestamp | string | undefined | null)) : (value || '-')}
            InputProps={{ readOnly: true }}
            variant="outlined"
            fullWidth
            margin="dense"
        />
    </Grid>
);

function RegistrationDetailsModal({ open, onClose, registrationId, isEditMode, onSave }: RegistrationDetailsModalProps) {
    const { t } = useTranslation();
    const [registrationData, setRegistrationData] = useState<IGuestFormData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isDirty }
    } = useForm<IGuestFormData>();

    useEffect(() => {
        const fetchRegistration = async () => {
            if (!registrationId) return;
            setLoading(true);
            setError(null);
            setRegistrationData(null);
            reset({});
            try {
                const docRef = doc(db, 'guests', registrationId).withConverter(guestConverter);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setRegistrationData(data);
                    reset(data);
                } else {
                    setError(t('registrationDetails.errorNotFound', 'Registration not found.'));
                }
            } catch (err: any) {
                console.error("Error fetching registration details: ", err);
                setError(t('registrationDetails.errorLoading', 'Error loading details: ') + err.message);
            } finally {
                setLoading(false);
            }
        };

        if (open && registrationId) {
            fetchRegistration();
        } else if (!open) {
            reset({});
            setRegistrationData(null);
            setError(null);
        }
    }, [open, registrationId, t, reset]);

    const onSubmit: SubmitHandler<IGuestFormData> = async (formData) => {
        if (!registrationId) return;
        setIsSaving(true);
        setError(null);
        try {
            await onSave(registrationId, formData);
        } catch (err: any) {
            console.error("Error saving registration: ", err);
            setError(t('registrationDetails.errorSaving', 'Error saving changes: ') + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{isEditMode ? t('registrationDetails.editTitle', 'Edit Registration') : t('registrationDetails.viewTitle', 'View Registration Details')}</DialogTitle>
            <DialogContent dividers>
                {loading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>}
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off" sx={{ mt: 1 }}>
                    {registrationData && (
                        <Grid container spacing={2}>
                            {isEditMode ? (
                                <>
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="firstName"
                                            control={control}
                                            rules={{ required: t('validation.required', 'This field is required') }}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label={t('formLabels.firstName', 'First Name')}
                                                    variant="outlined"
                                                    fullWidth
                                                    margin="dense"
                                                    required
                                                    error={!!errors.firstName}
                                                    helperText={errors.firstName?.message}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="lastName"
                                            control={control}
                                            rules={{ required: t('validation.required', 'This field is required') }}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label={t('formLabels.lastName', 'Last Name')}
                                                    variant="outlined"
                                                    fullWidth
                                                    margin="dense"
                                                    required
                                                    error={!!errors.lastName}
                                                    helperText={errors.lastName?.message}
                                                />
                                            )}
                                        />
                                    </Grid>
                                     <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="email"
                                            control={control}
                                            rules={{
                                                required: t('validation.required', 'This field is required'),
                                                pattern: {
                                                     value: /^\S+@\S+\.\S+$/,
                                                     message: t('validation.email', 'Invalid email format')
                                                 }
                                            }}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label={t('formLabels.email', 'Email')}
                                                    variant="outlined"
                                                    fullWidth
                                                    margin="dense"
                                                    required
                                                    error={!!errors.email}
                                                    helperText={errors.email?.message}
                                                />
                                            )}
                                        />
                                    </Grid>
                                </>
                            ) : (
                                <>
                                    {renderReadOnlyField(t('formLabels.firstName', 'First Name'), registrationData.firstName)}
                                    {renderReadOnlyField(t('formLabels.lastName', 'Last Name'), registrationData.lastName)}
                                    {renderReadOnlyField(t('formLabels.email', 'Email'), registrationData.email)}
                                </>
                            )}

                            {renderReadOnlyField(t('formLabels.secondLastName', 'Second Last Name'), registrationData.secondLastName)}
                            {renderReadOnlyField(t('formLabels.birthDate', 'Birth Date'), registrationData.birthDate, true)}
                            {renderReadOnlyField(t('formLabels.nationality', 'Nationality'), registrationData.nationality)}
                            {renderReadOnlyField(t('formLabels.sex', 'Sex'), registrationData.sex)}
                            {renderReadOnlyField(t('formLabels.documentType', 'Document Type'), registrationData.documentType)}
                            {renderReadOnlyField(t('formLabels.documentNumber', 'Document Number'), registrationData.documentNumber)}
                            {renderReadOnlyField(t('formLabels.documentSupNum', 'Support Number'), registrationData.documentSupNum)}
                            {renderReadOnlyField(t('formLabels.phone', 'Phone'), registrationData.phone)}
                            {renderReadOnlyField(t('formLabels.countryResidence', 'Country of Residence'), registrationData.countryResidence)}
                            {renderReadOnlyField(t('formLabels.residenceAddress', 'Address'), registrationData.residenceAddress)}
                            {renderReadOnlyField(t('formLabels.city', 'City'), registrationData.city)}
                            {renderReadOnlyField(t('formLabels.postcode', 'Postcode'), registrationData.postcode)}
                            {renderReadOnlyField(t('formLabels.visitDate', 'Visit Date'), registrationData.visitDate, true)}
                            {renderReadOnlyField(t('formLabels.timestamp', 'Registered At'), registrationData.timestamp, true)}
                            {renderReadOnlyField('Registration ID', registrationId)}
                        </Grid>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                {isEditMode && (
                    <Button onClick={handleSubmit(onSubmit)} disabled={isSaving || !isDirty} variant="contained">
                        {isSaving ? <CircularProgress size={24} /> : t('actions.save', 'Save')}
                    </Button>
                )}
                <Button onClick={onClose} disabled={isSaving}>{t('actions.close', 'Close')}</Button>
            </DialogActions>
        </Dialog>
    );
}

export default RegistrationDetailsModal; 