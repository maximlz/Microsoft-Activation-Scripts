import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress, Alert, Grid, TextField, Select, MenuItem, FormControl, InputLabel, FormHelperText } from '@mui/material';
import { doc, getDoc, Timestamp, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { MuiTelInput, matchIsValidTel, MuiTelInputInfo } from 'mui-tel-input';
import { db } from '../config/firebaseConfig';
import { guestConverter } from '../config/firebaseConverters';
import { formatDateDDMMYYYY } from '../utils/formatters';
import { IGuestFormData, Country } from '../types/guestTypes';
import { useTranslation } from 'react-i18next';
import { validateMinAge, validateVisitDate } from '../utils/validators';
import { sexOptions, documentTypeOptions } from '../constants/formOptions';

// Добавляем определение интерфейса
interface RegistrationDetailsModalProps {
  open: boolean;
  onClose: () => void;
  registrationId: string | null; 
  isEditMode: boolean;
  onSave: (id: string, data: IGuestFormData) => Promise<void>; 
}

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
    const [countries, setCountries] = useState<Country[]>([]);
    const [loadingCountries, setLoadingCountries] = useState<boolean>(false);
    const [phoneInfo, setPhoneInfo] = useState<MuiTelInputInfo | null>(null);

    const {
        control,
        handleSubmit,
        reset,
        setValue,
        formState: { errors, isDirty }
    } = useForm<IGuestFormData>({ mode: 'onChange' });

    useEffect(() => {
        const fetchCountries = async () => {
            setLoadingCountries(true);
            try {
                const countriesCol = collection(db, 'countries');
                const q = query(countriesCol, orderBy('name', 'asc'));
                const countrySnapshot = await getDocs(q);
                const countryList = countrySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string, code: doc.data().code as string }));
                setCountries(countryList);
            } catch (err) {
                console.error("Error fetching countries:", err);
            } finally {
                setLoadingCountries(false);
            }
        };
        if (open) {
            fetchCountries();
        }
    }, [open]);

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
                    const data = docSnap.data() as IGuestFormData;
                    setRegistrationData(data);
                    reset(data);
                    if (data.phone) {
                    }
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
            setIsSaving(false);
            setPhoneInfo(null);
        }
    }, [open, registrationId, t, reset]);

    const onSubmit: SubmitHandler<IGuestFormData> = async (formData) => {
        if (!registrationId) return;
        setIsSaving(true);
        setError(null);
        try {
            const dataToSave = {
                ...formData,
                countryCode: phoneInfo?.countryCode || ''
            }
            await onSave(registrationId, dataToSave);
        } catch (err: any) {
            console.error("Error saving registration: ", err);
            setError(t('registrationDetails.errorSaving', 'Error saving changes: ') + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const getErrorMessage = (fieldError: any): string => {
        if (!fieldError) return '';
        const message = fieldError.message || 'errors.invalidInput';
        return t(message, { field: fieldError.ref?.name || 'field' });
    };

    const handlePhoneChange = (newValue: string, info: MuiTelInputInfo) => {
        setValue('phone', newValue, { shouldValidate: true, shouldTouch: true, shouldDirty: true });
        setPhoneInfo(info);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{isEditMode ? t('registrationDetails.editTitle', 'Edit Registration') : t('registrationDetails.viewTitle', 'View Registration Details')}</DialogTitle>
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
                <DialogContent dividers>
                    {loading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>}
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {(registrationData || isEditMode) && (
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
                                                    InputLabelProps={{ shrink: true }}
                                                    error={!!errors.firstName}
                                                    helperText={errors.firstName ? getErrorMessage(errors.firstName) : ''}
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
                                                    InputLabelProps={{ shrink: true }}
                                                    error={!!errors.lastName}
                                                    helperText={errors.lastName ? getErrorMessage(errors.lastName) : ''}
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
                                                    InputLabelProps={{ shrink: true }}
                                                    error={!!errors.email}
                                                    helperText={errors.email ? getErrorMessage(errors.email) : ''}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="secondLastName"
                                            control={control}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label={t('formLabels.secondLastName', 'Second Last Name')}
                                                    variant="outlined"
                                                    fullWidth
                                                    margin="dense"
                                                    InputLabelProps={{ shrink: true }}
                                                    error={!!errors.secondLastName}
                                                    helperText={errors.secondLastName ? getErrorMessage(errors.secondLastName) : ''}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="birthDate"
                                            control={control}
                                            rules={{
                                                required: t('validation.required', 'This field is required'),
                                                validate: validateMinAge
                                            }}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label={t('formLabels.birthDate', 'Birth Date')}
                                                    type="date"
                                                    InputLabelProps={{ shrink: true }}
                                                    variant="outlined"
                                                    fullWidth
                                                    margin="dense"
                                                    required
                                                    error={!!errors.birthDate}
                                                    helperText={errors.birthDate ? getErrorMessage(errors.birthDate) : ''}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl 
                                            key={`nationality-${registrationId || 'new'}`} 
                                            fullWidth 
                                            margin="dense" 
                                            error={!!errors.nationality} 
                                            required
                                        >
                                            <InputLabel id="nationality-label">
                                                {t('formLabels.nationality', 'Nationality')}
                                            </InputLabel>
                                            <Controller
                                                name="nationality"
                                                control={control}
                                                rules={{ required: t('validation.required', 'This field is required') }}
                                                render={({ field }) => {
                                                    return (
                                                        <Select
                                                            {...field}
                                                            value={field.value ?? ''} 
                                                            labelId="nationality-label" 
                                                            label={t('formLabels.nationality', 'Nationality')} 
                                                            disabled={loadingCountries}
                                                        >
                                                            <MenuItem value="" disabled><em>{loadingCountries ? t('loading') : t('selectPlaceholder')}</em></MenuItem> 
                                                            {countries.map((country) => (
                                                                <MenuItem key={country.id} value={country.name}>
                                                                    {country.name}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    );
                                                }}
                                            />
                                            {errors.nationality && <FormHelperText>{getErrorMessage(errors.nationality)}</FormHelperText>}
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl 
                                            key={`sex-${registrationId || 'new'}`} 
                                            fullWidth 
                                            margin="dense" 
                                            error={!!errors.sex} 
                                            required
                                        >
                                            <InputLabel id="sex-label">
                                                {t('formLabels.sex', 'Sex')}
                                            </InputLabel>
                                            <Controller
                                                name="sex"
                                                control={control}
                                                rules={{ required: t('validation.required', 'This field is required') }}
                                                render={({ field }) => (
                                                    <Select
                                                        {...field}
                                                        value={field.value ?? ''} 
                                                        labelId="sex-label"
                                                        label={t('formLabels.sex', 'Sex')}
                                                    >
                                                        <MenuItem value="" disabled><em>{t('selectPlaceholder')}</em></MenuItem>
                                                        {sexOptions.map((option) => (
                                                            <MenuItem key={option.value} value={option.value}>
                                                                {t(option.labelKey, option.value)}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                )}
                                            />
                                            {errors.sex && <FormHelperText>{getErrorMessage(errors.sex)}</FormHelperText>}
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl 
                                            key={`documentType-${registrationId || 'new'}`} 
                                            fullWidth 
                                            margin="dense" 
                                            error={!!errors.documentType} 
                                            required
                                        >
                                            <InputLabel id="documentType-label">
                                                {t('formLabels.documentType', 'Document Type')}
                                            </InputLabel>
                                            <Controller
                                                name="documentType"
                                                control={control}
                                                rules={{ required: t('validation.required', 'This field is required') }}
                                                render={({ field }) => (
                                                    <Select
                                                        {...field}
                                                        value={field.value ?? ''} 
                                                        labelId="documentType-label"
                                                        label={t('formLabels.documentType', 'Document Type')}
                                                    >
                                                        <MenuItem value="" disabled><em>{t('selectPlaceholder')}</em></MenuItem>
                                                        {documentTypeOptions.map((option) => (
                                                            <MenuItem key={option.value} value={option.value}>
                                                                {t(option.labelKey, option.value)}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                )}
                                            />
                                            {errors.documentType && <FormHelperText>{getErrorMessage(errors.documentType)}</FormHelperText>}
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="documentNumber"
                                            control={control}
                                            rules={{ required: t('validation.required', 'This field is required') }}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label={t('formLabels.documentNumber', 'Document Number')}
                                                    variant="outlined"
                                                    fullWidth
                                                    margin="dense"
                                                    required
                                                    InputLabelProps={{ shrink: true }}
                                                    error={!!errors.documentNumber}
                                                    helperText={errors.documentNumber ? getErrorMessage(errors.documentNumber) : ''}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="documentSupNum"
                                            control={control}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label={t('formLabels.documentSupNum', 'Support Number')}
                                                    variant="outlined"
                                                    fullWidth
                                                    margin="dense"
                                                    InputLabelProps={{ shrink: true }}
                                                    error={!!errors.documentSupNum}
                                                    helperText={errors.documentSupNum ? getErrorMessage(errors.documentSupNum) : ''}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="phone"
                                            control={control}
                                            rules={{
                                                required: t('validation.required', 'This field is required'),
                                                validate: (value) => matchIsValidTel(value || '') || t('validation.phone', 'Invalid phone number')
                                            }}
                                            render={({ field, fieldState }) => (
                                                <MuiTelInput
                                                    {...field}
                                                    label={t('formLabels.phone', 'Phone')}
                                                    defaultCountry="ES"
                                                    onChange={handlePhoneChange}
                                                    fullWidth
                                                    required
                                                    InputLabelProps={{ shrink: true }}
                                                    error={fieldState.invalid}
                                                    helperText={fieldState.error ? getErrorMessage(fieldState.error) : ''}
                                                    variant="outlined"
                                                    margin="dense"
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl 
                                            key={`countryResidence-${registrationId || 'new'}`} 
                                            fullWidth 
                                            margin="dense" 
                                            error={!!errors.countryResidence} 
                                            required
                                        >
                                            <InputLabel id="countryResidence-label">
                                                {t('formLabels.countryResidence', 'Country of Residence')}
                                            </InputLabel>
                                            <Controller
                                                name="countryResidence"
                                                control={control}
                                                rules={{ required: t('validation.required', 'This field is required') }}
                                                render={({ field }) => (
                                                    <Select
                                                        {...field}
                                                        value={field.value ?? ''} 
                                                        labelId="countryResidence-label"
                                                        label={t('formLabels.countryResidence', 'Country of Residence')}
                                                        disabled={loadingCountries}
                                                    >
                                                        <MenuItem value="" disabled><em>{loadingCountries ? t('loading') : t('selectPlaceholder')}</em></MenuItem>
                                                        {countries.map((country) => (
                                                            <MenuItem key={country.id} value={country.name}>
                                                                {country.name}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                )}
                                            />
                                            {errors.countryResidence && <FormHelperText>{getErrorMessage(errors.countryResidence)}</FormHelperText>}
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="residenceAddress"
                                            control={control}
                                            rules={{ required: t('validation.required', 'This field is required') }}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label={t('formLabels.residenceAddress', 'Address')}
                                                    variant="outlined"
                                                    fullWidth
                                                    margin="dense"
                                                    required
                                                    InputLabelProps={{ shrink: true }}
                                                    error={!!errors.residenceAddress}
                                                    helperText={errors.residenceAddress ? getErrorMessage(errors.residenceAddress) : ''}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="city"
                                            control={control}
                                            rules={{ required: t('validation.required', 'This field is required') }}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label={t('formLabels.city', 'City')}
                                                    variant="outlined"
                                                    fullWidth
                                                    margin="dense"
                                                    required
                                                    InputLabelProps={{ shrink: true }}
                                                    error={!!errors.city}
                                                    helperText={errors.city ? getErrorMessage(errors.city) : ''}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="postcode"
                                            control={control}
                                            rules={{ required: t('validation.required', 'This field is required') }}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label={t('formLabels.postcode', 'Postcode')}
                                                    variant="outlined"
                                                    fullWidth
                                                    margin="dense"
                                                    required
                                                    InputLabelProps={{ shrink: true }}
                                                    error={!!errors.postcode}
                                                    helperText={errors.postcode ? getErrorMessage(errors.postcode) : ''}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="visitDate"
                                            control={control}
                                            rules={{
                                                required: t('validation.required', 'This field is required'),
                                                validate: validateVisitDate
                                            }}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    label={t('formLabels.visitDate', 'Visit Date')}
                                                    type="date"
                                                    InputLabelProps={{ shrink: true }}
                                                    variant="outlined"
                                                    fullWidth
                                                    margin="dense"
                                                    required
                                                    error={!!errors.visitDate}
                                                    helperText={errors.visitDate ? getErrorMessage(errors.visitDate) : ''}
                                                />
                                            )}
                                        />
                                    </Grid>
                                </>
                            ) : (
                                registrationData && <>
                                    {renderReadOnlyField(t('formLabels.firstName', 'First Name'), registrationData.firstName)}
                                    {renderReadOnlyField(t('formLabels.lastName', 'Last Name'), registrationData.lastName)}
                                    {renderReadOnlyField(t('formLabels.email', 'Email'), registrationData.email)}
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
                                </>
                            )}
                            {renderReadOnlyField(t('formLabels.timestamp', 'Registered At'), registrationData?.timestamp, true)}
                            {renderReadOnlyField('Registration ID', registrationId)}
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    {isEditMode && (
                        <Button type="submit" disabled={isSaving || !isDirty} variant="contained">
                            {isSaving ? <CircularProgress size={24} /> : t('actions.save', 'Save')}
                        </Button>
                    )}
                    <Button onClick={onClose} disabled={isSaving}>{t('actions.close', 'Close')}</Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
}

export default RegistrationDetailsModal; 