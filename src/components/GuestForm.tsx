import React, { useState, useEffect, useRef } from 'react';
import { useForm, SubmitHandler, Controller, useWatch } from 'react-hook-form';
import {
  Paper, Box, Typography, TextField, Button, Grid,
  Select, MenuItem, FormControl, InputLabel, FormHelperText,
  Snackbar, Alert, Container
} from '@mui/material';
import { MuiTelInput, matchIsValidTel, MuiTelInputInfo} from 'mui-tel-input';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from '../config/firebaseConfig';
import { useTranslation } from 'react-i18next';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';

// Тип для страны (экспортируется)
export interface Country {
  id: string;
  name: string;
  code: string;
}

// IGuestFormData interface
interface IGuestFormData {
  firstName: string;
  lastName: string;
  secondLastName?: string;
  birthDate: string;
  nationality: string;
  sex: string;
  documentType: string;
  documentNumber: string;
  documentSupNum?: string;
  phone: string;
  email: string;
  countryResidence: string;
  residenceAddress: string;
  city: string;
  postcode: string;
  visitDate: string;
  countryCode?: string;
}

// GuestFormProps interface
interface GuestFormProps {
  countries: Country[];
  loadingCountries: boolean;
}

// Библиотеки Google Maps для загрузки (оставляем одно определение)
const libraries: ("places")[] = ['places'];

// Функция для проверки возраста (оставляем одно определение)
const validateMinAge = (birthDateString: string): boolean | string => {
  try {
    const birthDate = new Date(birthDateString);
    const today = new Date();
    const minAgeDate = new Date(today.getFullYear() - 14, today.getMonth(), today.getDate());
    if (isNaN(birthDate.getTime())) {
      return 'errors.invalidDate';
    }
    if (birthDate > minAgeDate) {
      return 'errors.minAge';
    }
    return true;
  } catch (e) {
    return 'errors.invalidDate';
  }
};

// Функция для проверки даты посещения (не раньше текущего дня)
const validateVisitDate = (visitDateString: string): boolean | string => {
  try {
    const visitDate = new Date(visitDateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Сбрасываем время до начала дня для корректного сравнения дат
    
    if (isNaN(visitDate.getTime())) {
      return 'errors.invalidDate';
    }
    if (visitDate < today) {
      return 'errors.futureDateRequired';
    }
    return true;
  } catch (e) {
    return 'errors.invalidDate';
  }
};

const GuestForm: React.FC<GuestFormProps> = ({ countries, loadingCountries }) => {
  console.log("GuestForm RENDERED. Loading countries:", loadingCountries);

  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields, touchedFields, isSubmitted },
    control,
    reset,
    setValue,
    trigger,
    getValues
  } = useForm<IGuestFormData>({
    mode: 'onTouched',
    defaultValues: {
      nationality: '',
      sex: '',
      documentType: '',
      documentNumber: '',
      documentSupNum: '',
      phone: '',
      email: '',
      countryResidence: '',
      residenceAddress: '',
      city: '',
      postcode: '',
      visitDate: '',
      countryCode: 'ES',
    }
  });

  useEffect(() => {
    console.log("GuestForm state updated:", getValues());
    console.log("Dirty fields:", dirtyFields);
    console.log("Touched fields:", touchedFields);
  });

  // Контролируем отображение ошибки для residenceAddress
  const [showResidenceError, setShowResidenceError] = useState(false);
  
  // Отслеживаем изменение поля residenceAddress и сабмит формы
  useEffect(() => {
    // Показываем ошибку только если поле было затронуто ИЛИ форма была отправлена
    setShowResidenceError(!!touchedFields.residenceAddress || isSubmitted);
  }, [touchedFields.residenceAddress, isSubmitted]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const [phoneCountryCode, setPhoneCountryCode] = useState<string>('ES');

  // Используем 'as const' для более строгого определения типа
  const preferredPhoneCountries = ['GB', 'ES', 'FR', 'IT', 'DE'] as const;

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

  const onSubmit: SubmitHandler<IGuestFormData> = async (data) => {
    setIsSubmitting(true);
    setSnackbarOpen(false);
    try {
      await addDoc(collection(db, "guests"), {
        ...data,
        countryCode: phoneCountryCode,
        timestamp: Timestamp.now()
      });
      setSnackbarMessage(t('successMessage'));
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      reset();
    } catch (error) {
      console.error("Error adding document: ", error);
      let userErrorMessage = t('errorMessage');
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'permission-denied':
            userErrorMessage = t('errors.firestorePermissionDenied', 'Permission denied. Please check Firestore rules.');
            break;
          case 'unavailable':
            userErrorMessage = t('errors.firestoreUnavailable', 'Cannot connect to the database. Please check your connection.');
            break;
        }
        console.error(`Firestore Error Code: ${error.code}, Message: ${error.message}`);
      }
      setSnackbarMessage(userErrorMessage);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sexOptions = [
    { value: 'Female', label: t('sexOptions.Female') },
    { value: 'Male', label: t('sexOptions.Male') },
    { value: 'Other', label: t('sexOptions.Other') },
  ];
  const documentTypeOptions = [
    { value: 'Passport', label: t('docTypeOptions.Passport') },
    { value: 'ID Card', label: t('docTypeOptions.ID Card') },
    { value: 'NIF', label: t('docTypeOptions.NIF') },
    { value: 'Other', label: t('docTypeOptions.Other') },
  ];

  // Полностью переработанная getErrorMessage
  const getErrorMessage = (fieldError: any) => {
    console.log("getErrorMessage called with:", fieldError);
    if (!fieldError) {
        console.log("getErrorMessage: no error object, returning null");
        return null;
    }

    const fieldName = fieldError.ref?.name;
    const errorType = fieldError.type;
    // message может быть ключом из правила (e.g., 'errors.patternEmail')
    const messageFromRule = fieldError.message;

    console.log(`getErrorMessage: fieldName='${fieldName}', errorType='${errorType}', messageFromRule:`, messageFromRule);

    let finalMessageKey: string | null = null;
    let lengthValue: number | string | undefined = undefined;
    let interpolationOptions: { field: string; length?: number | string } = { field: '' };

    // 1. Определяем ключ для перевода (finalMessageKey)
    // Приоритет специфичному ключу из правила
    if (typeof messageFromRule === 'string' && t(messageFromRule) !== messageFromRule) {
        finalMessageKey = messageFromRule;
        console.log(`getErrorMessage (Key Selection): Using specific key from rule: '${finalMessageKey}'`);
    } else {
        // Иначе используем стандартный ключ (errors.required, errors.minLength, etc.)
        // Для minLength/maxLength стандартный ключ теперь бесполезен, так как длина вшита в специфичный ключ
        const genericErrorTypeKey = `errors.${errorType}`;
        if (errorType !== 'minLength' && errorType !== 'maxLength' && t(genericErrorTypeKey) !== genericErrorTypeKey) {
            finalMessageKey = genericErrorTypeKey;
            console.log(`getErrorMessage (Key Selection): Using generic key: '${finalMessageKey}'`);
        } else if (errorType !== 'minLength' && errorType !== 'maxLength') {
             console.log(`getErrorMessage (Key Selection): Generic key '${genericErrorTypeKey}' is not a valid translation key.`);
        } else {
             console.log(`getErrorMessage (Key Selection): Skipping generic key check for minLength/maxLength.`);
        }
    }

    // Если ключ все еще не найден (например, для minLength/maxLength без валидного специфичного ключа), выходим
    if (!finalMessageKey) {
        console.log(`getErrorMessage (Key Selection): No valid key could be determined.`);
         // Можно вернуть запасной вариант, если нужно
        // return t('errors.invalidInput', 'Invalid input');
        // Или просто текст из messageFromRule, если он есть
        if (typeof messageFromRule === 'string') return messageFromRule;
        return t('errors.invalidInput', 'Invalid input');
    }

    // 2. Определяем имя поля для интерполяции
    interpolationOptions.field = fieldName ? t(fieldName, { defaultValue: fieldName }) : t('unknownField', 'Field');

    // 3. Извлекаем длину из ключа (если это minLength_N или maxLength_N)
    const lengthMatch = finalMessageKey.match(/^(?:errors\.)?(?:minLength|maxLength)_(\d+)$/);
    if (lengthMatch && lengthMatch[1]) {
        lengthValue = parseInt(lengthMatch[1], 10);
        interpolationOptions.length = lengthValue;
        console.log(`getErrorMessage (Length Extraction): Extracted length=${lengthValue} from key '${finalMessageKey}'`);
    } else if (errorType === 'min' || errorType === 'max') {
        // Для min/max пока оставляем извлечение из ref
        lengthValue = fieldError.ref?.min || fieldError.ref?.max;
        if(lengthValue !== undefined) interpolationOptions.length = lengthValue;
        console.log(`getErrorMessage (Length Extraction): Extracted min/max value=${lengthValue} from ref for type='${errorType}'`);
    }

    // 4. Возвращаем переведенное сообщение
    console.log(`getErrorMessage (Translation): Using key='${finalMessageKey}', options=`, interpolationOptions);
    const translatedMessage = t(finalMessageKey, interpolationOptions);
    console.log(`getErrorMessage (Translation): Final translated message for '${finalMessageKey}'='${translatedMessage}'`);
    return translatedMessage;
};

  const handleSnackbarClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
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
        trigger(['residenceAddress', 'city', 'postcode']);
      } else {
        trigger('residenceAddress');
      }
    } else {
      console.error("Autocomplete instance not available");
      trigger('residenceAddress');
    }
  };

  const residenceAddressValue = useWatch({ control, name: 'residenceAddress' });
  useEffect(() => {
    if (isLoaded) {
      trigger('residenceAddress');
    }
  }, [residenceAddressValue, isLoaded, trigger]);

  if (loadError) {
    console.error("Google Maps API load error: ", loadError);
    return (
      <Container maxWidth="md" className="container-margin">
        <Alert severity="error" className="alert-margin">
          {t('errors.googleMapsLoadError', 'Error loading Google Maps API. Address autocomplete will not work.')}
        </Alert>
      </Container>
    );
  }

  return (
    <Paper elevation={3} className="paper-padding">
      <Box
        component="form"
        noValidate
        autoComplete="off"
        onSubmit={handleSubmit(onSubmit)}
        className="form-margin-top"
      >
        <Typography variant="h6" component="h2" gutterBottom mb={3}>
          {t('guestDetails')}
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="firstName"
              label={t('firstName')}
              variant="outlined"
              {...register("firstName", {
                required: 'errors.required',
                minLength: { value: 2, message: 'errors.minLength_2' }
              })}
              error={!!errors.firstName}
              helperText={errors.firstName ? getErrorMessage(errors.firstName) : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="lastName"
              label={t('lastName')}
              variant="outlined"
              {...register("lastName", {
                required: 'errors.required',
                minLength: { value: 2, message: 'errors.minLength_2' }
              })}
              error={!!errors.lastName}
              helperText={errors.lastName ? getErrorMessage(errors.lastName) : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="secondLastName"
              label={t('secondLastName')}
              variant="outlined"
              {...register("secondLastName")}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="birthDate"
              label={t('birthDate')}
              type="date"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              {...register("birthDate", {
                required: 'errors.required',
                validate: validateMinAge
              })}
              error={!!errors.birthDate}
              helperText={errors.birthDate ? getErrorMessage(errors.birthDate) : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.nationality}>
              <InputLabel id="nationality-label">
                {t('nationality')} <span className="required-star">*</span>
              </InputLabel>
              <Controller
                name="nationality"
                control={control}
                rules={{ required: 'errors.required' }}
                render={({ field, fieldState }) => (
                    <Select
                      labelId="nationality"
                      id="nationality"
                      variant="outlined"
                      {...field}
                      disabled={loadingCountries}
                      value={field.value || ''}
                      error={fieldState.invalid}
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em>{loadingCountries ? t('loadingPlaceholder') : ""}</em>
                      </MenuItem>
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
                    </Select>
                )}
              />
              {errors.nationality && <FormHelperText error>{getErrorMessage(errors.nationality)}</FormHelperText>}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.sex}>
              <InputLabel id="sex-label">
                {t('sex')} <span className="required-star">*</span>
              </InputLabel>
              <Controller
                name="sex"
                control={control}
                rules={{ required: 'errors.required' }}
                render={({ field, fieldState }) => (
                    <Select
                      labelId="sex"
                      id="sex"
                      variant="outlined"
                      {...field}
                      value={field.value || ''}
                      error={fieldState.invalid}
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em></em>
                      </MenuItem>
                      {sexOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                )}
              />
              {errors.sex && <FormHelperText error>{getErrorMessage(errors.sex)}</FormHelperText>}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.documentType}>
              <InputLabel id="documentType-label">
                {t('documentType')} <span className="required-star">*</span>
              </InputLabel>
              <Controller
                name="documentType"
                control={control}
                rules={{ required: 'errors.required' }}
                render={({ field, fieldState }) => (
                    <Select
                      labelId="documentType"
                      id="documentType"
                      variant="outlined"
                      {...field}
                      value={field.value || ''}
                      error={fieldState.invalid}
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em></em>
                      </MenuItem>
                      {documentTypeOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                )}
              />
              {errors.documentType && <FormHelperText error>{getErrorMessage(errors.documentType)}</FormHelperText>}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="documentNumber"
              label={t('documentNumber')}
              variant="outlined"
              {...register("documentNumber", {
                required: 'errors.required',
                minLength: { value: 5, message: 'errors.minLength_5' },
                maxLength: { value: 20, message: 'errors.maxLength_20' }
              })}
              error={!!errors.documentNumber}
              helperText={errors.documentNumber ? getErrorMessage(errors.documentNumber) : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="documentSupNum"
              label={t('documentSupNum')}
              variant="outlined"
              {...register("documentSupNum")}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.phone}>
              <Controller
                name="phone"
                control={control}
                rules={{
                  required: 'errors.required',
                  validate: (value) => {
                    const isValid = matchIsValidTel(value || '');
                    console.log(`Phone validation: value='${value}', isValid=${isValid}`);
                    return isValid || 'errors.validatePhone';
                  }
                }}
                render={({ field, fieldState }) => {
                  // Логируем fieldState для телефона
                  console.log('Phone fieldState:', fieldState);
                  return (
                    <MuiTelInput
                      {...field}
                      label={t('phone')}
                      defaultCountry={phoneCountryCode as any}
                      preferredCountries={preferredPhoneCountries as any}
                      variant="outlined"
                      fullWidth
                      error={fieldState.invalid}
                      helperText={fieldState.error ? getErrorMessage(fieldState.error) : ''}
                      onChange={(newValue: string, info: MuiTelInputInfo) => {
                        field.onChange(newValue);
                        setPhoneCountryCode(info.countryCode || 'ES');
                      }}
                    />
                  );
                }}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="email"
              label={t('email')}
              type="email"
              variant="outlined"
              {...register("email", {
                required: 'errors.required',
                pattern: {
                  value: /^\S+@\S+\.\S+$/,
                  message: 'errors.patternEmail'
                }
              })}
              error={!!errors.email}
              helperText={errors.email ? getErrorMessage(errors.email) : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.countryResidence}>
              <InputLabel id="countryResidence-label">{t('countryResidence')}</InputLabel>
              <Controller
                name="countryResidence"
                control={control}
                rules={{ required: 'errors.required' }}
                render={({ field, fieldState }) => (
                    <Select
                      labelId="countryResidence"
                      id="countryResidence"
                      variant="outlined"
                      {...field}
                      value={field.value || ''}
                      error={fieldState.invalid}
                      displayEmpty
                      disabled={loadingCountries}
                    >
                      <MenuItem value="">
                        <em>{loadingCountries ? t('loadingPlaceholder') : ""}</em>
                      </MenuItem>
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
                    </Select>
                )}
              />
              {errors.countryResidence && <FormHelperText error>{getErrorMessage(errors.countryResidence)}</FormHelperText>}
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            {isLoaded ? (
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
                  {...register("residenceAddress", { required: 'errors.required' })}
                  error={showResidenceError}
                  helperText={showResidenceError ? getErrorMessage(errors.residenceAddress) : ''}
                />
              </Autocomplete>
            ) : (
              <TextField
                required
                fullWidth
                id="residenceAddress"
                label={t('homeAddress')}
                variant="outlined"
                disabled={true}
                {...register("residenceAddress", { required: 'errors.required' })}
                error={showResidenceError}
                helperText={showResidenceError ? getErrorMessage(errors.residenceAddress) : ''}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              key={`city-${cityKey}`}
              required
              fullWidth
              id="city"
              label={t('city')}
              variant="outlined"
              {...register("city", { required: 'errors.required' })}
              error={!!errors.city}
              helperText={errors.city ? getErrorMessage(errors.city) : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              key={`postcode-${postcodeKey}`}
              required
              fullWidth
              id="postcode"
              label={t('postcode')}
              variant="outlined"
              {...register("postcode", { required: 'errors.required' })}
              error={!!errors.postcode}
              helperText={errors.postcode ? getErrorMessage(errors.postcode) : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="visitDate"
              label={t('visitDate')}
              type="date"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              {...register("visitDate", {
                required: 'errors.required',
                validate: validateVisitDate
              })}
              error={!!errors.visitDate}
              helperText={errors.visitDate ? getErrorMessage(errors.visitDate) : ''}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              disabled={isSubmitting}
              className="button-margin-top"
            >
              {isSubmitting ? t('loadingPlaceholder') : t('submitButton')}
            </Button>
          </Grid>
        </Grid>
      </Box>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} className="alert-full-width">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default GuestForm; 