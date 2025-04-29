import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, SubmitHandler, FormProvider, SubmitErrorHandler } from 'react-hook-form';
import {
  Paper, Box, Button, Grid, MenuItem,
  Container, CircularProgress, Alert,
  Typography,
  LinearProgress,
  IconButton,
  Link
} from '@mui/material';
import { MuiTelInputInfo, matchIsValidTel } from 'mui-tel-input';
import { useTranslation } from 'react-i18next';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
// Импортируем тип формы из types
import { IGuestFormShape, IGuestFormData, Country } from '../types/guestTypes';
// Импортируем утилиты валидации
import { validateMinAge, validateVisitDate } from '../utils/validators';
// Импортируем опции для Select
import { sexOptions, documentTypeOptions } from '../constants/formOptions';
// Импортируем новые компоненты
import ControlledSelect from './ControlledSelect';
import ControlledMuiTelInput from './ControlledMuiTelInput';
// Импортируем ControlledTextField
import ControlledTextField from './ControlledTextField';
// Импортируем TextField отдельно для поля адреса
import TextField from '@mui/material/TextField';
// Импортируем getErrorMessage
import { getErrorMessage } from '../utils/formUtils';
// Импортируем getFunctions
import { getFunctions, httpsCallable, HttpsCallableResult } from "firebase/functions";
// Добавляем иконки
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ClearIcon from '@mui/icons-material/Clear';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
// Добавляем импорт react-dropzone и стилей
import { useDropzone } from 'react-dropzone';

// Библиотеки Google Maps для загрузки (оставляем одно определение)
const libraries: ("places")[] = ['places'];

// Интерфейс для пропсов компонента GuestForm
interface GuestFormProps {
  countries: Country[]; // Массив стран
  loadingCountries: boolean; // Флаг загрузки стран
  onSubmit: (data: IGuestFormData) => Promise<void>; // Функция для отправки данных формы
  isSaving?: boolean; // Необязательный флаг процесса сохранения (передается извне)
  initialData?: Partial<IGuestFormShape>; // Необязательные начальные данные для формы
  isEditMode?: boolean; // Добавляем проп для режима редактирования
  registrationToken: string; // <-- Добавляем токен регистрации
  editingGuestId: string | null; // <-- Добавляем ID редактируемого гостя
}

const GuestForm: React.FC<GuestFormProps> = ({ 
  countries, 
  loadingCountries, 
  onSubmit, 
  isSaving: isSavingProp, 
  initialData, 
  isEditMode,
  registrationToken, 
  editingGuestId // <-- Получаем ID из пропсов
}) => {
  const { t } = useTranslation();

  const methods = useForm<IGuestFormShape>({
    mode: 'onBlur',
    defaultValues: initialData || {
      firstName: '',
      lastName: '',
      secondLastName: '',
      birthDate: '',
      nationality: '',
      sex: '',
      documentType: '',
      documentNumber: '',
      documentSupNum: '',
      phone: '',
      email: '',
      countryResidence: '',
      residenceAddress: '',
      apartmentNumber: '',
      city: '',
      postcode: '',
      visitDate: '',
    }
  });
  const { handleSubmit, formState: { errors, isDirty, isValid }, reset, setValue, trigger, setFocus, register, watch } = methods;

  useEffect(() => {
    if (initialData) {
      reset(initialData);
    } else {
      reset({
        firstName: '',
        lastName: '',
        secondLastName: '',
        birthDate: '',
      nationality: '',
      sex: '',
      documentType: '',
      documentNumber: '',
      documentSupNum: '',
      phone: '',
      email: '',
      countryResidence: '',
      residenceAddress: '',
        apartmentNumber: '',
      city: '',
      postcode: '',
      visitDate: '',
      });
    }
  }, [initialData, reset]);

  const [isSubmittingInternal, setIsSubmittingInternal] = useState<boolean>(false);
  const isSubmitting = isSavingProp ?? isSubmittingInternal;

  const [phoneInfo, setPhoneInfo] = useState<MuiTelInputInfo | null>(null);

  const preferredPhoneCountries = ['GB', 'ES', 'FR', 'IT', 'DE'];

  const preferredCountryNames = ['United Kingdom of Great Britain and Northern Ireland', 'Spain', 'France', 'Italy', 'Germany'];

  const sortedCountries = React.useMemo(() => {
    if (!countries || countries.length === 0) {
      return { preferred: [], others: [] };
    }
    const preferred = countries
      .filter(country => preferredCountryNames.includes(country.name))
      .sort((a, b) => preferredCountryNames.indexOf(a.name) - preferredCountryNames.indexOf(b.name));
    const others = countries
      .filter(country => !preferredCountryNames.includes(country.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { preferred, others };
  }, [countries]);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: libraries,
  });
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [cityKey, setCityKey] = useState(0);
  const [postcodeKey, setPostcodeKey] = useState(0);

  const onInvalid: SubmitErrorHandler<IGuestFormShape> = (errors) => {
    const firstErrorField = Object.keys(errors)[0] as keyof IGuestFormShape;
    if (firstErrorField) {
      setFocus(firstErrorField);
    }
  };

  // Вспомогательная функция для чтения файла как base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file); // readAsDataURL включает префикс data:mime/type;base64,
    });
  };

  const handleFormSubmit: SubmitHandler<IGuestFormShape> = async (data) => {
    if (isSavingProp === undefined) setIsSubmittingInternal(true);
    setUploadError(null); // Сбрасываем ошибки загрузки перед новой попыткой

    let passportPhotoUrl: string | undefined = data.passportPhotoUrl; // Используем существующий URL по умолчанию

    // --- НОВАЯ ЛОГИКА ЗАГРУЗКИ ФАЙЛА ЧЕРЕЗ CLOUD FUNCTION --- 
    if (selectedFile) {
      setIsUploading(true);
      // setUploadProgress(0); // Прогресс больше не отслеживаем напрямую

      try {
        // Читаем файл как base64
        const fileData = await readFileAsBase64(selectedFile);

        // Вызываем Cloud Function
        const functionsInstance = getFunctions();
        // Определяем тип возвращаемого значения функции
        interface UploadResultData {
          success: boolean;
          downloadURL?: string;
          error?: string;
        }
        const callUploadFunction = httpsCallable<
          { registrationToken: string; fileData: string; fileName: string; contentType: string }, 
          UploadResultData // Используем интерфейс для результата
        >(functionsInstance, 'uploadGuestPassport');

        console.log(`Calling uploadGuestPassport for token: ${registrationToken}`);
        const result: HttpsCallableResult<UploadResultData> = await callUploadFunction({
          registrationToken: registrationToken,
          fileData: fileData,         // base64 строка
          fileName: selectedFile.name,
          contentType: selectedFile.type,
        });

        if (result.data.success && result.data.downloadURL) {
          passportPhotoUrl = result.data.downloadURL;
          setValue('passportPhotoUrl', passportPhotoUrl); // Обновляем поле формы
          setSelectedFile(null); // Очищаем выбранный файл после успеха
          console.log('File uploaded via function. URL:', passportPhotoUrl);
        } else {
          console.error("Cloud Function (uploadGuestPassport) failed:", result.data.error);
          const errorMessage = result.data.error || t('errors.uploadFailedGeneric', 'Failed to upload photo via Cloud Function.');
          setUploadError(errorMessage);
          // Прерываем отправку формы, если загрузка не удалась
          if (isSavingProp === undefined) setIsSubmittingInternal(false);
          setIsUploading(false);
          return; 
        }

      } catch (error: any) {
        console.error("Error calling uploadGuestPassport function:", error);
        // Обработка ошибок вызова httpsCallable (сети, прав доступа к функции и т.д.)
        let message = t('errors.uploadFunctionCallFailed', 'Error occurred while trying to upload the file.');
        if (error.code && error.message) {
             message = `Error (${error.code}): ${error.message}`;
        } else if (error instanceof Error) {
            message = error.message;
        }
        setUploadError(message);
        // Прерываем отправку формы
        if (isSavingProp === undefined) setIsSubmittingInternal(false);
        setIsUploading(false);
        return;
      } finally {
         setIsUploading(false); 
         // setUploadProgress(100); // Или скрыть прогресс
      }
    } // --- КОНЕЦ НОВОЙ ЛОГИКИ ЗАГРУЗКИ ---

    // --- ОСТАЛЬНАЯ ЛОГИКА ОТПРАВКИ (без изменений) --- 
    try {
      // Убеждаемся, что birthDate и visitDate точно строки
      const dataToSend: IGuestFormData = {
        ...data,
          birthDate: data.birthDate!, 
          visitDate: data.visitDate!, 
        countryCode: phoneInfo?.countryCode || '',
          passportPhotoUrl: passportPhotoUrl, // Используем URL (новый или старый)
      };
      await onSubmit(dataToSend); 
      // Сбрасываем состояние файла здесь не нужно, т.к. сделали это после успеха загрузки
    } catch (error) {
      console.error("Error during onSubmit call from GuestForm:", error);
      // Можно установить ошибку, если onSubmit фейлится ПОСЛЕ успешной загрузки
      setUploadError(t('errors.saveGuestFailedAfterUpload', "File uploaded, but failed to save guest data."));
    } finally {
      if (isSavingProp === undefined) setIsSubmittingInternal(false);
    }
  };

  const handleAutocompleteLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const handlePlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place && place.address_components) {
        let streetNumber = "";
        let route = "";
        let city = "";
        let postalCode = "";
        let country = "";
        place.address_components.forEach(component => {
          const types = component.types;
          if (types.includes("street_number")) streetNumber = component.long_name;
          if (types.includes("route")) route = component.long_name;
          if (types.includes("locality")) city = component.long_name;
          if (types.includes("postal_code")) postalCode = component.long_name;
          if (types.includes("country")) country = component.long_name;
        });
        const fullAddress = `${route} ${streetNumber}`.trim();
        setValue('residenceAddress', fullAddress, { shouldValidate: true });
        setValue('city', city, { shouldValidate: true });
        setCityKey(prev => prev + 1);
        setValue('postcode', postalCode, { shouldValidate: true });
        setPostcodeKey(prev => prev + 1);
        if (country && countries.some(c => c.name === country)) {
          setValue('countryResidence', country, { shouldValidate: true });
        }
      } else {
      }
    } else {
      console.error("Autocomplete instance not available");
    }
  };

  const residenceAddressValue = methods.watch('residenceAddress');
  useEffect(() => {
    if (isLoaded) {
    }
  }, [residenceAddressValue, isLoaded, trigger]);

  // --- НОВОЕ СОСТОЯНИЕ ДЛЯ ЗАГРУЗКИ/УДАЛЕНИЯ ФАЙЛА --- 
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isRemovingFile, setIsRemovingFile] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const currentPassportPhotoUrl = watch('passportPhotoUrl');
  // -----------------------------------------------------

  // --- НОВЫЙ ОБРАБОТЧИК ДЛЯ REACT-DROPZONE --- 
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
        // Валидация типа и размера (можно вынести в валидатор Dropzone)
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setUploadError(t('errors.invalidFileType', 'Invalid file type. Please upload PDF, JPG, or PNG.'));
            setSelectedFile(null);
            return;
        }
        const maxSize = 5 * 1024 * 1024; 
        if (file.size > maxSize) {
             setUploadError(t('errors.fileTooLarge', 'File is too large. Maximum size is 5MB.'));
             setSelectedFile(null);
            return;
        }

        setSelectedFile(file);
        setUploadError(null);
        setValue('passportPhotoUrl', undefined, { shouldValidate: false }); 
    }
  }, [t, setValue]);

  // Настройка react-dropzone
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isFocused,
    isDragAccept,
    isDragReject
  } = useDropzone({
    onDrop,
    accept: { 
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'application/pdf': ['.pdf']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false // Только один файл
  });

  // Обработчик очистки ВЫБРАННОГО файла (до загрузки)
  const handleClearFile = () => {
      setSelectedFile(null);
      setUploadError(null);
      // Не нужно менять passportPhotoUrl здесь, он еще не установлен
      // Сбрасываем значение скрытого инпута Dropzone (на всякий случай)
      // const input = document.getElementById('passport-upload-input') as HTMLInputElement;
      // if (input) input.value = ''; // Это может быть не нужно с Dropzone
  };
  // --------------------------------------

  // --- ОБНОВЛЕННЫЙ обработчик удаления СУЩЕСТВУЮЩЕГО файла --- 
  const handleRemoveExistingFile = async () => {
    const guestIdToRemove = editingGuestId; // Захватываем ID в локальную переменную

    if (!guestIdToRemove) { 
        console.error("Cannot remove file without guest ID.");
        setUploadError("Cannot remove file: Guest ID is missing."); 
        return;
    }
    
    setIsRemovingFile(true);
    setUploadError(null);

    try {
      const functionsInstance = getFunctions();
      const callDeletePassport = httpsCallable<
          { guestId: string }, 
          { success: boolean; error?: string } 
      >(functionsInstance, 'deleteGuestPassport');
      
      console.log(`Calling deleteGuestPassport for guestId: ${guestIdToRemove}`);
      // Передаем локальную переменную
      const result = await callDeletePassport({ guestId: guestIdToRemove }); 

      if (result.data.success) {
        console.log(`Passport file removed successfully for guestId: ${guestIdToRemove}`);
        setValue('passportPhotoUrl', undefined, { shouldDirty: true }); 
      } else {
        console.error("Cloud Function (deleteGuestPassport) failed:", result.data.error);
        const errorMessage = result.data.error || t('errors.removeFileFailed', 'Failed to remove uploaded file.');
        setUploadError(errorMessage);
      }

    } catch (error: any) {
        console.error(`Error calling deleteGuestPassport function for ${guestIdToRemove}:`, error);
        let message = t('errors.removeFileFunctionCallFailed', 'Error occurred while trying to remove the file.');
        if (error.code && error.message) {
             message = `Error (${error.code}): ${error.message}`;
        } else if (error instanceof Error) {
            message = error.message;
        }
        setUploadError(message);
    } finally {
        setIsRemovingFile(false);
    }
  };
  // -----------------------------------------------------

  if (loadError) {
    return (
      <Container maxWidth="md" className="container-margin">
        <Alert severity="error" className="alert-margin">
          {t('errors.googleMapsLoadError', 'Error loading Google Maps API. Address autocomplete will not work.')}
        </Alert>
      </Container>
    );
  }

  return (
    <FormProvider {...methods}>
    <Container component={Paper} elevation={0} className="guest-form-container">
        <Box component="form" onSubmit={handleSubmit(handleFormSubmit, onInvalid)} noValidate className="guest-form-box">
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
              <ControlledTextField<IGuestFormShape>
                name="firstName"
                label={t('firstName')}
              required
                rules={{ required: 'errors.required', minLength: { value: 2, message: 'errors.minLength_2' } }}
                textFieldProps={{ variant: "outlined", fullWidth: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledTextField<IGuestFormShape>
                name="lastName"
                label={t('lastName')}
              required
                rules={{ required: 'errors.required', minLength: { value: 2, message: 'errors.minLength_2' } }}
                textFieldProps={{ variant: "outlined", fullWidth: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledTextField<IGuestFormShape>
                name="secondLastName"
              label={t('secondLastName')}
                textFieldProps={{ variant: "outlined", fullWidth: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledTextField<IGuestFormShape>
                name="birthDate"
                label={t('birthDate')}
              required
                rules={{
                required: 'errors.required',
                  validate: (value: string | unknown) => {
                      if (typeof value !== 'string' || !value) return true; 
                      return validateMinAge(value) || 'errors.minAge';
                  }
                }}
                textFieldProps={{ variant: "outlined", fullWidth: true, type: "date", InputLabelProps: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledSelect<IGuestFormShape>
                name="nationality"
                label={t('nationality')}
                required
                rules={{ required: 'errors.required' }}
                selectProps={{ 
                  disabled: loadingCountries,
                  variant: "outlined"
                }}
                emptyLabel={loadingCountries ? t('loadingPlaceholder') : <em></em>}
                forceShrink={true}
              >
                      {sortedCountries.preferred.map((country) => (
                        <MenuItem key={country.id} value={country.name}>
                          {country.name}
                        </MenuItem>
                      ))}
                      {sortedCountries.preferred.length > 0 && sortedCountries.others.length > 0 && (
                        <MenuItem disabled value="-" className="divider-centered">──────────</MenuItem>
                      )}
                      {sortedCountries.others.map((country) => (
                        <MenuItem key={country.id} value={country.name}>
                          {country.name}
                        </MenuItem>
                      ))}
              </ControlledSelect>
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledSelect<IGuestFormShape>
                name="sex"
                label={t('sex')}
                required
                rules={{ required: 'errors.required' }}
                selectProps={{ variant: "outlined" }}
                emptyLabel={<em></em>}
                forceShrink={true}
              >
                      {sexOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                    {t(option.labelKey, option.value)}
                        </MenuItem>
                      ))}
              </ControlledSelect>
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledSelect<IGuestFormShape>
                name="documentType"
                label={t('documentType')}
                required
                rules={{ required: 'errors.required' }}
                selectProps={{ variant: "outlined" }}
                emptyLabel={<em></em>}
                forceShrink={true}
              >
                      {documentTypeOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                    {t(option.labelKey, option.value)}
                        </MenuItem>
                      ))}
              </ControlledSelect>
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledTextField<IGuestFormShape>
                name="documentNumber"
                label={t('documentNumber')}
              required
                rules={{ required: 'errors.required', minLength: { value: 5, message: 'errors.minLength_5' }, maxLength: { value: 20, message: 'errors.maxLength_20' } }}
                textFieldProps={{ variant: "outlined", fullWidth: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledTextField<IGuestFormShape>
                name="documentSupNum"
              label={t('documentSupNum')}
                textFieldProps={{ variant: "outlined", fullWidth: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledMuiTelInput<IGuestFormShape>
                name="phone"
                label={t('phone')}
                required
                rules={{
                  required: 'errors.required',
                  validate: (value: string | unknown) => {
                    if (typeof value !== 'string') {
                       return value ? 'errors.validatePhone' : true;
                    }
                    const isValid = matchIsValidTel(value);
                    return isValid || 'errors.validatePhone';
                  }
                }}
                muiTelInputProps={{ 
                  defaultCountry: "ES",
                  preferredCountries: preferredPhoneCountries as any
                }}
                onInfoChange={setPhoneInfo}
              />
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledTextField<IGuestFormShape>
                name="email"
                label={t('email')}
              required
                rules={{
                required: 'errors.required',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'errors.patternEmail' }
                }}
                textFieldProps={{ variant: "outlined", fullWidth: true, type: 'email' }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledSelect<IGuestFormShape>
                name="countryResidence"
                label={t('countryResidence')}
                required
                rules={{ required: 'errors.required' }}
                selectProps={{ 
                  disabled: loadingCountries,
                  variant: "outlined"
                }}
                emptyLabel={loadingCountries ? t('loadingPlaceholder') : <em></em>}
                forceShrink={true}
              >
                      {sortedCountries.preferred.map((country) => (
                        <MenuItem key={country.id} value={country.name}>
                          {country.name}
                        </MenuItem>
                      ))}
                      {sortedCountries.preferred.length > 0 && sortedCountries.others.length > 0 && (
                        <MenuItem disabled value="-" className="divider-centered">──────────</MenuItem>
                      )}
                      {sortedCountries.others.map((country) => (
                        <MenuItem key={country.id} value={country.name}>
                          {country.name}
                        </MenuItem>
                      ))}
              </ControlledSelect>
          </Grid>
          <Grid item xs={12}>
            {isLoaded ? (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
              <Autocomplete
                onLoad={handleAutocompleteLoad}
                onPlaceChanged={handlePlaceChanged}
                options={{ types: ['address'] }}
              >
                <TextField
                  required
                  fullWidth
                  id="residenceAddress"
                  label={t('homeAddress')}
                  variant="outlined"
                        margin="dense"
                  {...register("residenceAddress", { required: 'errors.required' })}
                      error={!!errors.residenceAddress}
                        helperText={errors.residenceAddress ? getErrorMessage(errors.residenceAddress, { required: 'errors.required' }, t) : ''}
                      placeholder={t('placeholders.streetAddressOnly', 'Enter street address and number')}
                />
              </Autocomplete>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <ControlledTextField<IGuestFormShape>
                      name="apartmentNumber"
                      label={t('formLabels.apartmentNumberOptional')}
                      textFieldProps={{ variant: "outlined", fullWidth: true }}
                  />
                </Grid>
              </Grid>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                    <ControlledTextField<IGuestFormShape>
                      name="residenceAddress"
                      label={t('homeAddress')}
                required
                      rules={{ required: 'errors.required' }}
                      textFieldProps={{ variant: "outlined", fullWidth: true, disabled: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <ControlledTextField<IGuestFormShape>
                      name="apartmentNumber"
                      label={t('formLabels.apartmentNumberOptional')}
                      textFieldProps={{ variant: "outlined", fullWidth: true, disabled: true }}
                  />
                </Grid>
              </Grid>
            )}
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledTextField<IGuestFormShape>
                name="city"
                label={t('city')}
              required
                rules={{ required: 'errors.required' }}
                textFieldProps={{ variant: "outlined", fullWidth: true, key: `city-${cityKey}` }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledTextField<IGuestFormShape>
                name="postcode"
                label={t('postcode')}
              required
                rules={{ required: 'errors.required' }}
                textFieldProps={{ variant: "outlined", fullWidth: true, key: `postcode-${postcodeKey}` }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
              <ControlledTextField<IGuestFormShape>
                name="visitDate"
                label={t('visitDate')}
              required
                rules={{
                required: 'errors.required',
                  validate: (value: string | unknown) => {
                      if (typeof value !== 'string' || !value) return true;
                      return validateVisitDate(value) || 'errors.futureDateRequired';
                  }
                }}
                textFieldProps={{ variant: "outlined", fullWidth: true, type: 'date', InputLabelProps: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>
                    {t('passportPhoto', 'Passport Photo/Scan')}
                </Typography>
                
                {/* --- БЛОК ЗАГРУЗКИ С REACT-DROPZONE --- */}
                <div {...getRootProps({
                    style: {
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        borderWidth: 2,
                        borderRadius: 4,
                        borderColor: isDragReject ? '#ff1744' : (isDragAccept ? '#00e676' : (isFocused ? '#2196f3' : '#eeeeee')),
                        borderStyle: 'dashed',
                        backgroundColor: isDragReject ? '#ffebee' : (isDragAccept ? '#e8f5e9' : '#fafafa'),
                        color: '#bdbdbd',
                        outline: 'none',
                        transition: 'border .24s ease-in-out',
                        minHeight: '100px',
                        cursor: 'pointer'
                    }
                 })} >
                    <input {...getInputProps()} />
                    <CloudUploadIcon sx={{ fontSize: 40, mb: 1, color: isDragActive ? 'primary.main' : 'inherit' }} />
                    {isDragActive ? (
                        isDragReject ? 
                        <Typography>{t('dropzone.reject', 'File type not accepted')}</Typography> : 
                        <Typography>{t('dropzone.active', 'Drop the file here ...')}</Typography>
                    ) : (
                        <Typography>{t('dropzone.prompt', "Drag 'n' drop file here, or click to select file")}</Typography>
                    )}
                    <Typography variant="caption" sx={{ mt: 0.5 }}>
                        {t('dropzone.hint', 'PDF, JPG, PNG up to 5MB')}
                    </Typography>
                </div>
                {/* --------------------------------------------- */}

                {/* Отображение выбранного файла (остается как было) */} 
                {selectedFile && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <AttachFileIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ mr: 1 }}>
                            {selectedFile.name}
                        </Typography>
                        <IconButton onClick={handleClearFile} size="small" disabled={isUploading} title={t('clearSelection', 'Clear selection') ?? 'Clear selection'}>
                            <ClearIcon fontSize="small" />
                        </IconButton>
                    </Box>
                )}

                {/* Отображение уже загруженного URL + КНОПКА УДАЛЕНИЯ */} 
                {!selectedFile && currentPassportPhotoUrl && (
                     <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}> 
                         <Link href={currentPassportPhotoUrl} target="_blank" rel="noopener noreferrer" variant="body2">
                              {t('viewUploadedPassport', 'View Uploaded Document')}
                         </Link>
                         <IconButton 
                            size="small" 
                            onClick={handleRemoveExistingFile} 
                            disabled={isUploading || isRemovingFile} 
                            title={t('removeUploadedFile', 'Remove uploaded file') ?? 'Remove uploaded file'}
                            color="error"
                            sx={{ ml: 1 }}
                         >
                             {isRemovingFile ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon fontSize="small" />}
                         </IconButton>
                     </Box>
                )}

                {/* Индикатор загрузки (остается как было) */} 
                {isUploading && (
                    <Box sx={{ width: '100%', mt: 1 }}>
                        <LinearProgress variant="indeterminate" /> 
                    </Box>
                )}
                {/* Ошибка загрузки/удаления файла */} 
                {uploadError && (
                    <Alert severity="error" sx={{ mt: 1 }}>{uploadError}</Alert>
                )}
            </Grid>
        </Grid>
        <Box className="guest-form-submit-box">
            <Button
              type="submit"
              variant="contained"
              disabled={
                !isValid || // Форма не валидна
                isUploading || // Идет загрузка файла
                isRemovingFile || // Идет удаление файла
                isSubmitting || // Идет сохранение формы (через пропс или внутреннее)
                loadingCountries || // Идет загрузка стран
                (isEditMode ? !(isDirty || selectedFile) : !isDirty) // Логика изменения
              }
            className="guest-form-submit-button"
          >
              {/* Обновляем текст для isUploading */} 
              {isUploading ? 
                t('uploading','Uploading') + '...' : 
                (isSubmitting ? <CircularProgress size={24} /> : (isEditMode ? t('updateButton') : t('submitButton')))}
            </Button>
        </Box>
      </Box>
    </Container>
    </FormProvider>
  );
};

export default GuestForm; 