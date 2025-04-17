import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { getFunctions, httpsCallable } from "firebase/functions";
import { IBooking, IBookingWithId, IGuestFormData, IGuestFormDataWithId, IGuestFormShape } from '../types/guestTypes';
import GuestForm, { Country } from './GuestForm'; // Импортируем как именованный экспорт
import { Container, Typography, Box, CircularProgress, Alert, Button, Paper, List, ListItem, Divider, Grid, Card, CardContent, Avatar, Chip, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HotelIcon from '@mui/icons-material/Hotel';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import PersonIcon from '@mui/icons-material/Person';

// Используем guestConverter из RegistrationsList
import { guestConverter, formatDateDDMMYYYY } from '../admin/RegistrationsList';

const GuestRegistrationPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const theme = useTheme();

    const [bookingDetails, setBookingDetails] = useState<IBookingWithId | null>(null);
    const [registeredGuests, setRegisteredGuests] = useState<IGuestFormDataWithId[]>([]);
    const [isLoadingBooking, setIsLoadingBooking] = useState(true);
    const [isLoadingGuests, setIsLoadingGuests] = useState(false); // Начинаем загрузку гостей после загрузки брони
    const [error, setError] = useState<string | null>(null);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isFormVisible, setIsFormVisible] = useState(false); // Управляем видимостью формы
    const [isSavingGuest, setIsSavingGuest] = useState(false); // Индикатор сохранения гостя
    const [guestSaveError, setGuestSaveError] = useState<string | null>(null);
    // Состояние для стран нужно загрузить здесь или передать в GuestForm
    const [countries, setCountries] = useState<Country[]>([]);
    const [loadingCountries, setLoadingCountries] = useState(true);
    const [countriesError, setCountriesError] = useState<string | null>(null);

    // --- Загрузка стран (аналогично HomePage) ---
    useEffect(() => {
        const fetchCountries = async () => {
            try {
                setLoadingCountries(true);
                setCountriesError(null);
                const countriesCol = collection(db, 'countries');
                const q = query(countriesCol, orderBy('name', 'asc'));
                const countrySnapshot = await getDocs(q);
                const countryList = countrySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string, code: doc.data().code as string }));
                setCountries(countryList);
            } catch (err) {
                console.error("Error fetching countries for registration page: ", err);
                setCountriesError(t('errors.fetchCountriesGeneric', 'Failed to load country list.'));
            } finally {
                setLoadingCountries(false);
            }
        };
        fetchCountries();
    }, [t]);

    // --- Загрузка данных бронирования и гостей --- 
    const fetchBookingAndGuests = useCallback(async () => {
        if (!token) {
            setError('Registration token is missing.');
            setIsLoadingBooking(false);
            return;
        }
        setIsLoadingBooking(true);
        setError(null);
        setRegisteredGuests([]); // Сбрасываем гостей перед загрузкой

        try {
            const bookingsRef = collection(db, 'bookings');
            const q = query(bookingsRef, where("registrationToken", "==", token));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError('Invalid or expired registration link.');
                setIsLoadingBooking(false);
                return;
            }

            const bookingDoc = querySnapshot.docs[0];
            const bookingData = { ...bookingDoc.data() as IBooking, id: bookingDoc.id };

            if (bookingData.status !== 'pending') {
                setError('This registration link has already been used or expired.');
                setIsLoadingBooking(false);
                return;
            }

            setBookingDetails(bookingData);

            // Загружаем гостей, если есть confirmationCode
            if (bookingData.confirmationCode) {
                setIsLoadingGuests(true);
                try {
                    const guestsRef = collection(db, 'guests').withConverter(guestConverter);
                    const guestsQuery = query(guestsRef, where("bookingConfirmationCode", "==", bookingData.confirmationCode), orderBy('timestamp', 'asc'));
                    const guestsSnapshot = await getDocs(guestsQuery);
                    setRegisteredGuests(guestsSnapshot.docs.map(doc => doc.data()));
                } catch (guestErr) {
                    console.error("Error fetching registered guests:", guestErr);
                    // Не блокируем всю страницу, но можно показать предупреждение
                } finally {
                    setIsLoadingGuests(false);
                }
            }
        } catch (err) {
            console.error("Error fetching booking details:", err);
            setError('Failed to load registration details. Please try again later.');
        } finally {
            setIsLoadingBooking(false);
        }
    }, [token, t]); // Добавляем t в зависимости

    useEffect(() => {
        fetchBookingAndGuests();
    }, [fetchBookingAndGuests]);

    // --- Обработчик сохранения гостя (Обновленный) --- 
    const handleSaveGuest = async (guestData: IGuestFormShape) => {
        console.log("handleSaveGuest called. Current bookingDetails:", bookingDetails);
        console.log("Confirmation code from bookingDetails:", bookingDetails?.confirmationCode);

        // Проверка bookingDetails остается важной перед формированием dataToSave
        if (!bookingDetails?.id || !bookingDetails?.confirmationCode) {
            setGuestSaveError("Cannot save guest: Booking details (ID or confirmation code) are missing.");
            console.error("Save failed: Booking details missing.", bookingDetails);
            return;
        }
        
        setIsSavingGuest(true);
        setGuestSaveError(null);

        // Готовим данные так же, как раньше (включая bookingId и bookingConfirmationCode)
        const dataToSave: IGuestFormData = {
            ...guestData,
            bookingConfirmationCode: bookingDetails.confirmationCode,
            bookingId: bookingDetails.id, 
            // Timestamp теперь будет устанавливаться на сервере, можно убрать отсюда
            // timestamp: Timestamp.now() // Убрано
        };

        console.log("Attempting to call createGuest function with data:", JSON.stringify({ guestData: dataToSave }, null, 2));

        try {
            // Получаем ссылку на Cloud Function
            const functionsInstance = getFunctions(); // Инициализируем Firebase Functions
            const callCreateGuest = httpsCallable<{ guestData: IGuestFormData }, { success: boolean; guestId?: string; error?: string }>(functionsInstance, 'createGuest');

            // Вызываем функцию
            const result = await callCreateGuest({ guestData: dataToSave });

            if (result.data.success) {
                console.log(`Guest created successfully via Cloud Function. Guest ID: ${result.data.guestId}`);
                // Успешно сохранено
                setIsFormVisible(false); // Скрываем форму
                fetchBookingAndGuests(); // Перезагружаем данные (включая список гостей)
                // Можно добавить Snackbar об успехе здесь
            } else {
                // Если функция вернула { success: false, error: '...' }
                console.error("Cloud Function returned error:", result.data.error);
                setGuestSaveError(result.data.error || 'Failed to save guest information via Cloud Function.');
            }
        } catch (err: any) {
            console.error("Error calling createGuest function:", err);
            // Обрабатываем ошибки HttpsError
            let message = 'Failed to save guest information.';
            if (err.code && err.message) {
                 message = `Error (${err.code}): ${err.message}`;
            } else if (err instanceof Error) {
                message = err.message;
            }
             setGuestSaveError(message);
        } finally {
            setIsSavingGuest(false);
        }
    };

    // --- Обработчик завершения регистрации --- 
    const handleFinishRegistration = async () => {
        if (!bookingDetails) return;
        setIsFinishing(true);
        setError(null);
        try {
            const bookingRef = doc(db, 'bookings', bookingDetails.id);
            await updateDoc(bookingRef, { status: 'completed' });
            // Перенаправляем на страницу успеха
            navigate('/registration-success');
        } catch (err) {
            console.error("Error finishing registration:", err);
            setError('Failed to finalize registration. Please try again.');
            setIsFinishing(false);
        }
    };

    // --- Рендеринг --- 
    if (isLoadingBooking || loadingCountries) {
        return (
            <Container maxWidth="md" sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '80vh',
                flexDirection: 'column'
            }}>
                <CircularProgress size={60} sx={{ mb: 3 }} />
                <Typography variant="h6" color="text.secondary">
                    {t('guestRegistration.loading', 'Loading registration information...')}
                </Typography>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="sm" sx={{ mt: 6 }}>
                <Paper elevation={3} sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h5" color="error" gutterBottom>
                        {t('guestRegistration.error', 'Error')}
                    </Typography>
                    <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
                    <Button 
                        variant="contained" 
                        onClick={() => navigate('/')}
                        sx={{ mt: 2 }}
                    >
                        {t('guestRegistration.returnHome', 'Return to Home')}
                    </Button>
                </Paper>
            </Container>
        );
    }

    if (!bookingDetails) { // Дополнительная проверка
        return (
            <Container maxWidth="sm" sx={{ mt: 6 }}>
                <Alert severity="warning">Booking details not found.</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ my: 4 }}>
            {/* Шапка с языковым переключателем */}
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                mb: 4,
                pb: 2,
                borderBottom: `1px solid ${theme.palette.divider}`
            }}>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                    {t('guestRegistration.title', 'Guest Registration')}
                </Typography>
                <LanguageSwitcher />
            </Box>

            {/* Детали Бронирования */} 
            <Card 
                elevation={3} 
                sx={{ 
                    mb: 4, 
                    borderRadius: 2,
                    overflow: 'hidden',
                    position: 'relative'
                }}
            >
                <Box sx={{ 
                    height: '8px', 
                    width: '100%', 
                    bgcolor: 'primary.main' 
                }} />
                
                <CardContent sx={{ p: 3 }}>
                    <Typography variant="h5" gutterBottom sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        mb: 3,
                        color: 'primary.main'
                    }}>
                        <HotelIcon sx={{ mr: 1 }} />
                        {t('guestRegistration.bookingDetails', 'Booking Details')}
                    </Typography>
                    
                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <ConfirmationNumberIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                <Typography>
                                    <strong>{t('guestRegistration.confirmationCode', 'Confirmation Code')}:</strong> {bookingDetails.confirmationCode}
                                </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <HotelIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                <Typography>
                                    <strong>{t('guestRegistration.property', 'Property')}:</strong> {bookingDetails.propertyName}
                                </Typography>
                            </Box>
                        </Grid>
                        
                        <Grid item xs={12} sm={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <CalendarTodayIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                <Typography>
                                    <strong>{t('guestRegistration.checkIn', 'Check-in')}:</strong> {formatDateDDMMYYYY(bookingDetails.checkInDate)}
                                </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <CalendarTodayIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                <Typography>
                                    <strong>{t('guestRegistration.checkOut', 'Check-out')}:</strong> {formatDateDDMMYYYY(bookingDetails.checkOutDate)}
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Зарегистрированные Гости */} 
            <Card 
                elevation={3} 
                sx={{ 
                    mb: 4, 
                    borderRadius: 2,
                    overflow: 'hidden'
                }}
            >
                <Box sx={{ 
                    height: '8px', 
                    width: '100%', 
                    bgcolor: 'success.main' 
                }} />
                
                <CardContent sx={{ p: 3 }}>
                    <Typography variant="h5" gutterBottom sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        mb: 3,
                        color: 'success.main'
                    }}>
                        <PersonIcon sx={{ mr: 1 }} />
                        {t('guestRegistration.guestsRegistered', 'Guests Registered')}
                    </Typography>
                    
                    {isLoadingGuests ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress size={30} />
                        </Box>
                    ) : registeredGuests.length > 0 ? (
                        <List sx={{ 
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            border: `1px solid ${theme.palette.divider}`
                        }}>
                            {registeredGuests.map((guest, index) => (
                                <React.Fragment key={guest.id}>
                                    <ListItem sx={{ py: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                            <Avatar 
                                                sx={{ 
                                                    bgcolor: 'primary.light',
                                                    mr: 2
                                                }}
                                            >
                                                {guest.firstName?.charAt(0) || 'G'}
                                            </Avatar>
                                            <Box sx={{ flexGrow: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                                    <Typography variant="h6" component="div">
                                                        {`${guest.firstName || ''} ${guest.lastName || ''}`.trim() || t('guestRegistration.unnamedGuest', 'Unnamed Guest')}
                                                    </Typography>
                                                    <Chip 
                                                        size="small" 
                                                        label={guest.nationality || '-'} 
                                                        variant="outlined" 
                                                        color="primary"
                                                    />
                                                </Box>
                                                <Typography variant="body2" color="text.secondary">
                                                    {`${guest.documentType || t('guestRegistration.documentType', 'Document')}: ${guest.documentNumber || '-'}`}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </ListItem>
                                    {index < registeredGuests.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    ) : (
                        <Box sx={{ 
                            bgcolor: 'background.paper',
                            p: 3,
                            borderRadius: 1,
                            border: `1px solid ${theme.palette.divider}`,
                            textAlign: 'center'
                        }}>
                            <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                {t('guestRegistration.noGuests', 'No guests registered for this booking yet.')}
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Кнопка Добавить Гостя */} 
            {!isFormVisible && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={() => setIsFormVisible(true)}
                        startIcon={<PersonAddIcon />}
                        size="large"
                        sx={{ 
                            py: 1.5, 
                            px: 4, 
                            borderRadius: 2,
                            fontWeight: 'medium'
                        }}
                    >
                        {t('guestRegistration.registerButton', 'Register New Guest')}
                    </Button>
                </Box>
            )}

            {/* Форма Регистрации Гостя (Условная) */} 
            {isFormVisible && (
                <Card 
                    elevation={3} 
                    sx={{ 
                        mb: 4, 
                        borderRadius: 2,
                        overflow: 'hidden'
                    }}
                >
                    <Box sx={{ 
                        height: '8px', 
                        width: '100%', 
                        bgcolor: 'info.main' 
                    }} />
                    
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h5" gutterBottom sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            mb: 3,
                            color: 'info.main'
                        }}>
                            <PersonAddIcon sx={{ mr: 1 }} />
                            {t('guestRegistration.newGuestTitle', 'Register Guest Details')}
                        </Typography>
                        
                        {guestSaveError && <Alert severity="error" sx={{ mb: 3 }}>{guestSaveError}</Alert>}
                        {countriesError && <Alert severity="warning" sx={{ mb: 3 }}>{countriesError}</Alert>}
                        
                        <GuestForm
                            countries={countries}
                            loadingCountries={loadingCountries}
                            onSubmit={handleSaveGuest}
                            isSaving={isSavingGuest}
                        />
                        
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                            <Button 
                                onClick={() => setIsFormVisible(false)} 
                                disabled={isSavingGuest} 
                                variant="outlined"
                                sx={{ mr: 2 }}
                            >
                                {t('guestRegistration.cancel', 'Cancel')}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Кнопка Завершения */} 
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                mt: 5,
                mb: 3
            }}>
                <Button
                    variant="contained"
                    color="success"
                    onClick={handleFinishRegistration}
                    disabled={isFinishing || isSavingGuest || registeredGuests.length === 0}
                    startIcon={<CheckCircleIcon />}
                    size="large"
                    sx={{ 
                        py: 1.5, 
                        px: 4, 
                        borderRadius: 2,
                        fontWeight: 'bold'
                    }}
                >
                    {isFinishing ? 
                        <CircularProgress size={24} color="inherit" /> : 
                        t('guestRegistration.finishButton', 'Finish Registration')
                    }
                </Button>
            </Box>
        </Container>
    );
};

export default GuestRegistrationPage; 