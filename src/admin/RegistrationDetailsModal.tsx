import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress, Alert, Grid, TextField, MenuItem } from '@mui/material';
import { doc, getDoc, Timestamp, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { MuiTelInputInfo, matchIsValidTel } from 'mui-tel-input';
import { db } from '../config/firebaseConfig';
import { guestConverter } from '../config/firebaseConverters';
import { formatDateDDMMYYYY } from '../utils/formatters';
import { IGuestFormData, Country } from '../types/guestTypes';
import { useTranslation } from 'react-i18next';
import { validateMinAge, validateVisitDate } from '../utils/validators';
import { sexOptions, documentTypeOptions } from '../constants/formOptions';
import ControlledTextField from '../components/ControlledTextField';
import ControlledSelect from '../components/ControlledSelect';
import ControlledMuiTelInput from '../components/ControlledMuiTelInput';

// Добавляем определение интерфейса
interface RegistrationDetailsModalProps {
    open: boolean;
    onClose: () => void;
    registrationId: string | null;
    isEditMode: boolean;
    onSave: (id: string, data: IGuestFormData) => Promise<void>;
}

// Модифицируем renderReadOnlyField для объединения адреса и квартиры
const renderReadOnlyField = (
    label: string, 
    value: string | Timestamp | undefined | null, 
    isDate: boolean = false,
    fullAddress: string | undefined = undefined // Доп. параметр для полного адреса
) => (
    <Grid item xs={12} sm={6} key={label}>
        <TextField
            label={label}
            // Используем fullAddress если он передан, иначе стандартное значение
            value={fullAddress ?? (isDate ? formatDateDDMMYYYY(value as (Timestamp | string | undefined | null)) : (value || '-'))}
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

    const methods = useForm<IGuestFormData>({ mode: 'onChange' });
    const { handleSubmit, reset, formState: { isDirty } } = methods;

    useEffect(() => {
        const fetchCountries = async () => {
            setLoadingCountries(true);
            try {
                const countriesCol = collection(db, 'countries');
                const q = query(countriesCol, orderBy('name', 'asc'));
                const countrySnapshot = await getDocs(q);
                const countryList = countrySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string, code: doc.data().code as string }));
                setCountries(countryList);
            } catch (err: unknown) {
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
                } else {
                    setError(t('registrationDetails.errorNotFound', 'Registration not found.'));
                }
            } catch (err: unknown) {
                console.error("Error fetching registration details: ", err);
                const message = err instanceof Error ? err.message : 'Unknown error fetching details';
                setError(t('registrationDetails.errorLoading', 'Error loading details: ') + message);
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
        } catch (err: unknown) {
            console.error("Error saving registration: ", err);
            const message = err instanceof Error ? err.message : 'Unknown error saving changes';
            setError(t('registrationDetails.errorSaving', 'Error saving changes: ') + message);
        } finally {
            setIsSaving(false);
        }
    };

    // Helper для форматирования полного адреса в режиме просмотра
    const formatFullAddress = (data: IGuestFormData | null): string | undefined => {
        if (!data?.residenceAddress) return undefined;
        let address = data.residenceAddress;
        if (data.apartmentNumber) {
            address += `, ${data.apartmentNumber}`;
        }
        return address;
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{isEditMode ? t('registrationDetails.editTitle', 'Edit Registration') : t('registrationDetails.viewTitle', 'View Registration Details')}</DialogTitle>
            <FormProvider {...methods}>
                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
            <DialogContent dividers>
                {loading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>}
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        {(registrationData || isEditMode) && (
                        <Grid container spacing={2}>
                            {isEditMode ? (
                                <>
                                    <Grid item xs={12} sm={6}>
                                            <ControlledTextField<IGuestFormData>
                                            name="firstName"
                                                    label={t('formLabels.firstName', 'First Name')}
                                                    required
                                                rules={{ required: t('validation.required', 'This field is required') }}
                                                textFieldProps={{ 
                                                    variant: "outlined", 
                                                    fullWidth: true, 
                                                    margin: "dense" 
                                                }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                            <ControlledTextField<IGuestFormData>
                                            name="lastName"
                                                label={t('formLabels.lastName', 'Last Name')}
                                                required
                                            rules={{ required: t('validation.required', 'This field is required') }}
                                                textFieldProps={{ variant: "outlined", fullWidth: true, margin: "dense" }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <ControlledTextField<IGuestFormData>
                                                name="email"
                                                label={t('formLabels.email', 'Email')}
                                                    required
                                                rules={{
                                                    required: t('validation.required', 'This field is required'),
                                                    pattern: { value: /^\S+@\S+\.\S+$/, message: t('validation.email', 'Invalid email format') }
                                                }}
                                                textFieldProps={{ variant: "outlined", fullWidth: true, margin: "dense", type: 'email' }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <ControlledTextField<IGuestFormData>
                                                name="secondLastName"
                                                label={t('formLabels.secondLastName', 'Second Last Name')}
                                                textFieldProps={{ variant: "outlined", fullWidth: true, margin: "dense" }}
                                        />
                                    </Grid>
                                     <Grid item xs={12} sm={6}>
                                            <ControlledTextField<IGuestFormData>
                                                name="birthDate"
                                                label={t('formLabels.birthDate', 'Birth Date')}
                                                required
                                            rules={{
                                                required: t('validation.required', 'This field is required'),
                                                    validate: (value) => {
                                                        if (typeof value !== 'string' || !value) return true;
                                                        return validateMinAge(value) || t('validation.minAge');
                                                    } 
                                                }}
                                                textFieldProps={{ 
                                                    variant: "outlined", 
                                                    fullWidth: true, 
                                                    margin: "dense", 
                                                    type: 'date',
                                                    InputLabelProps: { shrink: true } 
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <ControlledSelect<IGuestFormData>
                                                name="nationality"
                                                label={t('formLabels.nationality', 'Nationality')}
                                                required
                                                rules={{ required: t('validation.required') }}
                                                selectProps={{ 
                                                    disabled: loadingCountries, 
                                                    variant: "outlined"
                                                }}
                                                emptyLabel={loadingCountries ? t('loading') : t('selectPlaceholder')}
                                            >
                                                {countries.map((country) => <MenuItem key={country.id} value={country.name}>{country.name}</MenuItem>)} 
                                            </ControlledSelect>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <ControlledSelect<IGuestFormData>
                                                name="sex"
                                                label={t('formLabels.sex', 'Sex')}
                                                required
                                                rules={{ required: t('validation.required') }}
                                                selectProps={{ variant: "outlined" }}
                                                emptyLabel={t('selectPlaceholder')}
                                            >
                                                 {sexOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey, option.value)}</MenuItem>)} 
                                            </ControlledSelect>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <ControlledSelect<IGuestFormData>
                                                name="documentType"
                                                label={t('formLabels.documentType', 'Document Type')}
                                                required
                                                rules={{ required: t('validation.required') }}
                                                selectProps={{ variant: "outlined" }}
                                                emptyLabel={t('selectPlaceholder')}
                                            >
                                                {documentTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey, option.value)}</MenuItem>)} 
                                            </ControlledSelect>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                             <ControlledTextField<IGuestFormData>
                                                name="documentNumber"
                                                label={t('formLabels.documentNumber', 'Document Number')}
                                                required
                                                rules={{ required: t('validation.required', 'This field is required') }}
                                                textFieldProps={{ variant: "outlined", fullWidth: true, margin: "dense" }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                             <ControlledTextField<IGuestFormData>
                                                name="documentSupNum"
                                                label={t('formLabels.documentSupNum', 'Support Number')}
                                                textFieldProps={{ variant: "outlined", fullWidth: true, margin: "dense" }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <ControlledMuiTelInput<IGuestFormData>
                                                name="phone"
                                                label={t('formLabels.phone', 'Phone')}
                                                required
                                                rules={{ 
                                                    required: t('validation.required'), 
                                                    validate: (value: string | unknown) => {
                                                        if (typeof value !== 'string') {
                                                            return value ? t('validation.phone') : true;
                                                        }
                                                        return matchIsValidTel(value) || t('validation.phone');
                                                    } 
                                                }}
                                                muiTelInputProps={{
                                                    defaultCountry: "ES" 
                                                }}
                                                onInfoChange={setPhoneInfo}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                             <ControlledSelect<IGuestFormData>
                                                name="countryResidence"
                                                label={t('formLabels.countryResidence', 'Country of Residence')}
                                                required
                                                rules={{ required: t('validation.required') }}
                                                selectProps={{ 
                                                    disabled: loadingCountries, 
                                                    variant: "outlined"
                                                }}
                                                emptyLabel={loadingCountries ? t('loading') : t('selectPlaceholder')}
                                            >
                                                {countries.map((country) => <MenuItem key={country.id} value={country.name}>{country.name}</MenuItem>)} 
                                             </ControlledSelect>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                             <ControlledTextField<IGuestFormData>
                                                name="residenceAddress"
                                                label={t('formLabels.residenceAddress', 'Address')}
                                                required
                                                rules={{ required: t('validation.required', 'This field is required') }}
                                                textFieldProps={{ variant: "outlined", fullWidth: true, margin: "dense" }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                             <ControlledTextField<IGuestFormData>
                                                name="apartmentNumber"
                                                label={t('formLabels.apartmentNumber')}
                                                textFieldProps={{
                                                     variant: "outlined", 
                                                     fullWidth: true, 
                                                     margin: "dense", 
                                                     placeholder: t('placeholders.apartmentNumberOptional'),
                                                     InputLabelProps: { shrink: true } 
                                                 }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <ControlledTextField<IGuestFormData>
                                                name="city"
                                                label={t('formLabels.city', 'City')}
                                                required
                                                rules={{ required: t('validation.required', 'This field is required') }}
                                                textFieldProps={{ variant: "outlined", fullWidth: true, margin: "dense" }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <ControlledTextField<IGuestFormData>
                                                name="postcode"
                                                label={t('formLabels.postcode', 'Postcode')}
                                                    required
                                                rules={{ required: t('validation.required', 'This field is required') }}
                                                textFieldProps={{ variant: "outlined", fullWidth: true, margin: "dense" }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <ControlledTextField<IGuestFormData>
                                                name="visitDate"
                                                label={t('formLabels.visitDate', 'Visit Date')}
                                                required
                                                rules={{ 
                                                    required: t('validation.required', 'This field is required'), 
                                                    validate: (value) => {
                                                        if (typeof value !== 'string' || !value) return true;
                                                        return validateVisitDate(value) || t('validation.visitDate');
                                                    } 
                                                }}
                                                textFieldProps={{ 
                                                    variant: "outlined", 
                                                    fullWidth: true, 
                                                    margin: "dense", 
                                                    type: 'date',
                                                    InputLabelProps: { shrink: true } 
                                                }}
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
                            {renderReadOnlyField(t('formLabels.city', 'City'), registrationData.city)}
                            {renderReadOnlyField(t('formLabels.postcode', 'Postcode'), registrationData.postcode)}
                                        {renderReadOnlyField(
                                            t('formLabels.residenceAddress', 'Address'), 
                                            registrationData.residenceAddress,
                                            false,
                                            formatFullAddress(registrationData)
                                        )}
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
            </FormProvider>
        </Dialog>
    );
}

export default RegistrationDetailsModal; 