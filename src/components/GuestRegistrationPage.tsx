import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { getFunctions, httpsCallable } from "firebase/functions";
import { IBooking, IBookingWithId, IGuestFormData, IGuestFormDataWithId, IGuestFormShape, Country } from '../types/guestTypes';
import GuestForm from './GuestForm'; // Импортируем ТОЛЬКО GuestForm
import { Container, Typography, Box, CircularProgress, Alert, Button, Paper, List, ListItem, Divider, Grid, Card, CardContent, Avatar, Chip, IconButton, Tooltip, Snackbar } from '@mui/material';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HotelIcon from '@mui/icons-material/Hotel';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ConfirmationDialog from './ConfirmationDialog';

// ---> ИСПРАВЛЕННЫЕ ИМПОРТЫ <---
// import { guestConverter, formatDateDDMMYYYY } from '../admin/RegistrationsList'; // Старый импорт
import { guestConverter } from '../config/firebaseConverters';
import { formatDateDDMMYYYY } from '../utils/formatters';
// -------------------------------

// Тип для состояния Snackbar
type SnackbarState = { open: boolean; message: string; severity: 'success' | 'error' } | null;

const GuestRegistrationPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [bookingDetails, setBookingDetails] = useState<IBookingWithId | null>(null);
    const [registeredGuests, setRegisteredGuests] = useState<IGuestFormDataWithId[]>([]);
    const [isLoadingBooking, setIsLoadingBooking] = useState(true);
    const [isLoadingGuests, setIsLoadingGuests] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isSavingGuest, setIsSavingGuest] = useState(false);
    const [guestSaveError, setGuestSaveError] = useState<string | null>(null);
    const [countries, setCountries] = useState<Country[]>([]);
    const [loadingCountries, setLoadingCountries] = useState(true);
    const [countriesError, setCountriesError] = useState<string | null>(null);

    // --- Новые состояния для редактирования/удаления ---
    const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
    const [editingGuestData, setEditingGuestData] = useState<IGuestFormShape | null>(null);
    const [deletingGuestId, setDeletingGuestId] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    // ----------------------------------------------------

    // --- НОВОЕ состояние для Snackbar --- 
    const [snackbar, setSnackbar] = useState<SnackbarState>(null);
    // -------------------------------------

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
    }, [token, t]);

    useEffect(() => {
        fetchBookingAndGuests();
    }, [fetchBookingAndGuests]);

    // --- Обработчик сохранения гостя (Обновленный для создания и редактирования) ---
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
        setSnackbar(null); // Скрываем предыдущие уведомления

        const operation = editingGuestId ? 'updateGuest' : 'createGuest';
        const logPrefix = editingGuestId ? 'Updating' : 'Creating';
        
        // --- Изменяем формирование requestData --- 
        let requestData: any;
        if (editingGuestId) {
            // Для обновления отправляем ТОЛЬКО данные из формы + ID
            requestData = { 
                guestId: editingGuestId, 
                // guestData здесь - это только данные из формы (параметр guestData)
                guestData: guestData 
            };
        } else {
            // Для создания добавляем bookingId и confirmationCode
            const dataToCreate: IGuestFormData = {
                ...guestData,
                bookingConfirmationCode: bookingDetails!.confirmationCode,
                bookingId: bookingDetails!.id,
            };
            requestData = { guestData: dataToCreate };
        }
        // ----------------------------------------

        console.log(`${logPrefix} guest. ID: ${editingGuestId || 'New'}. Data:`, JSON.stringify(requestData, null, 2));

        try {
            const functionsInstance = getFunctions();
            type CloudFunctionResponse = { success: boolean; guestId?: string; error?: string };
            const callCloudFunction = httpsCallable<any, CloudFunctionResponse>(functionsInstance, operation);

            const result = await callCloudFunction(requestData);

            if (result.data.success) {
                console.log(`Guest ${editingGuestId ? 'updated' : 'created'} successfully. ID: ${editingGuestId || result.data.guestId}`);
                setIsFormVisible(false);
                setEditingGuestId(null);
                setEditingGuestData(null);
                fetchBookingAndGuests();
                // Показываем Snackbar успеха
                setSnackbar({
                     open: true,
                     message: t(editingGuestId ? 'guestRegistration.updateSuccess' : 'guestRegistration.createSuccess', 
                                editingGuestId ? 'Guest updated successfully!' : 'Guest added successfully!'),
                     severity: 'success'
                 });
            } else {
                console.error(`Cloud Function (${operation}) returned error:`, result.data.error);
                const errorMessage = result.data.error || `Failed to ${editingGuestId ? 'update' : 'save'} guest information via Cloud Function.`;
                setGuestSaveError(errorMessage);
                 // Показываем Snackbar ошибки (можно использовать ту же message)
                // setSnackbar({ open: true, message: errorMessage, severity: 'error' });
            }
        } catch (err: any) {
             console.error(`Error calling ${operation} function:`, err);
            let message = `Failed to ${editingGuestId ? 'update' : 'save'} guest information.`;
            if (err.code && err.message) {
                 message = `Error (${err.code}): ${err.message}`;
            } else if (err instanceof Error) {
                message = err.message;
            }
             setGuestSaveError(message);
             // Показываем Snackbar ошибки
             setSnackbar({ open: true, message: message, severity: 'error' });
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

    // --- Новые обработчики для кнопок --- 
    const handleEditGuestClick = (guest: IGuestFormDataWithId) => {
        console.log("Editing guest:", guest);
        const { id, bookingConfirmationCode, bookingId, timestamp, ...formData } = guest; 
        setEditingGuestId(id);
        setEditingGuestData(formData); // Сохраняем данные для формы, включая apartmentNumber
        setGuestSaveError(null); // Сбрасываем прошлые ошибки формы
        setIsFormVisible(true); // Показываем форму
    };

    const handleDeleteGuestClick = (guestId: string) => {
        console.log("Requesting delete for guest:", guestId);
        setDeletingGuestId(guestId);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deletingGuestId) return;
        const guestIdToDelete = deletingGuestId; // Сохраняем ID перед сбросом состояния
        console.log("Confirming delete for guest:", guestIdToDelete);
        setIsDeleteDialogOpen(false);
        setSnackbar(null); // Скрываем предыдущие
        // Устанавливаем индикатор загрузки (можно добавить новый, если нужно)
        // setIsDeleting(true); 

        try {
            // Вызов Cloud Function deleteGuest
            const functionsInstance = getFunctions();
            const callDeleteGuest = httpsCallable<{ guestId: string }, { success: boolean; error?: string }>(functionsInstance, 'deleteGuest');
            const result = await callDeleteGuest({ guestId: guestIdToDelete });
            
            if (result.data.success) {
                console.log(`Guest ${guestIdToDelete} deleted successfully via Cloud Function`);
                setDeletingGuestId(null); // Сбрасываем ID после успеха
                fetchBookingAndGuests(); // Обновляем список
                setSnackbar({
                    open: true,
                    message: t('guestRegistration.deleteSuccess', 'Guest deleted successfully!'),
                    severity: 'success'
                });
            } else {
                console.error("Cloud Function (deleteGuest) returned error:", result.data.error);
                const errorMessage = result.data.error || 'Failed to delete guest via Cloud Function.';
                setSnackbar({ open: true, message: errorMessage, severity: 'error' });
                // ID не сбрасываем, чтобы пользователь видел, что удаление не прошло
                 setDeletingGuestId(null); // Или сбрасываем в любом случае?
            }

        } catch (err: any) {
            console.error(`Error calling deleteGuest function for ${guestIdToDelete}:`, err);
            let message = 'Failed to delete guest.';
            if (err.code && err.message) {
                 message = `Error (${err.code}): ${err.message}`;
            } else if (err instanceof Error) {
                message = err.message;
            }
            setSnackbar({ open: true, message: message, severity: 'error' });
            setDeletingGuestId(null); // Сбрасываем ID в любом случае при ошибке
        } finally {
             // setIsDeleting(false);
        }
    };

    const handleCancelDelete = () => {
        setIsDeleteDialogOpen(false);
        setDeletingGuestId(null);
    };

    const handleCancelEdit = () => {
        setIsFormVisible(false);
        setEditingGuestId(null);
        setEditingGuestData(null);
        setGuestSaveError(null);
    }

    // --- НОВЫЙ обработчик закрытия Snackbar ---
    const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar(null); // Просто скрываем Snackbar
    };
    // -----------------------------------------

    // --- Рендеринг --- 
    if (isLoadingBooking || loadingCountries) {
        return (
            <Container maxWidth="md" className="loading-container">
                <CircularProgress size={60} className="loading-spinner" />
                <Typography variant="h6" color="text.secondary" className="loading-text">
                    {t('guestRegistration.loading', 'Loading registration information...')}
                </Typography>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="sm" className="error-container">
                <Paper elevation={3} className="error-paper">
                    <Typography variant="h5" color="error" gutterBottom>
                        {t('guestRegistration.error', 'Error')}
                    </Typography>
                    <Alert severity="error" className="error-alert">{error}</Alert>
                    <Button 
                        variant="contained" 
                        onClick={() => navigate('/')}
                        className="error-return-button"
                    >
                        {t('guestRegistration.returnHome', 'Return to Home')}
                    </Button>
                </Paper>
            </Container>
        );
    }

    if (!bookingDetails) { // Дополнительная проверка
        return (
            <Container maxWidth="sm" className="container-mt-6">
                <Alert severity="warning">Booking details not found.</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" className="registration-page-container container-mt-6">
            {/* Шапка с языковым переключателем */}
            <Box className="registration-page-header">
                <Typography variant="h4" component="h1" className="registration-page-title">
                    {t('guestRegistration.title', 'Guest Registration')}
                </Typography>
                <LanguageSwitcher />
            </Box>

            {/* Детали Бронирования */} 
            <Card elevation={3} className="registration-card">
                <Box className="registration-card-header-bar registration-card-header-bar-primary" />
                <CardContent className="registration-card-content">
                    <Typography variant="h5" gutterBottom className="registration-card-title registration-card-title-primary">
                        <HotelIcon className="registration-card-title-icon" />
                        {t('guestRegistration.bookingDetails', 'Booking Details')}
                    </Typography>
                    
                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                            <Box className="registration-details-box">
                                <ConfirmationNumberIcon className="registration-details-icon" />
                                <Typography>
                                    <strong>{t('guestRegistration.confirmationCode', 'Confirmation Code')}:</strong> {bookingDetails.confirmationCode}
                                </Typography>
                            </Box>
                            <Box className="registration-details-box box-mb-0">
                                <HotelIcon className="registration-details-icon" />
                                <Typography>
                                    <strong>{t('guestRegistration.property', 'Property')}:</strong> {bookingDetails.propertyName}
                                </Typography>
                            </Box>
                        </Grid>
                        
                        <Grid item xs={12} sm={6}>
                            <Box className="registration-details-box">
                                <CalendarTodayIcon className="registration-details-icon" />
                                <Typography>
                                    <strong>{t('guestRegistration.checkIn', 'Check-in')}:</strong> {formatDateDDMMYYYY(bookingDetails.checkInDate)}
                                </Typography>
                            </Box>
                            <Box className="registration-details-box box-mb-0">
                                <CalendarTodayIcon className="registration-details-icon" />
                                <Typography>
                                    <strong>{t('guestRegistration.checkOut', 'Check-out')}:</strong> {formatDateDDMMYYYY(bookingDetails.checkOutDate)}
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Зарегистрированные Гости */} 
            <Card elevation={3} className="registration-card">
                <Box className="registration-card-header-bar registration-card-header-bar-success" />
                <CardContent className="registration-card-content">
                    <Typography variant="h5" gutterBottom className="registration-card-title registration-card-title-success">
                        <PersonIcon className="registration-card-title-icon" />
                        {t('guestRegistration.guestsRegistered', 'Guests Registered')}
                    </Typography>
                    
                    {isLoadingGuests ? (
                        <Box className="box-centered-loader box-p-3">
                            <CircularProgress size={30} />
                        </Box>
                    ) : registeredGuests.length > 0 ? (
                        <List className="guest-list">
                            {registeredGuests.map((guest, index) => (
                                <React.Fragment key={guest.id}>
                                    <ListItem className="guest-list-item">
                                        <Box className="guest-info-container">
                                            <Avatar className="guest-avatar">
                                                {guest.firstName?.charAt(0) || 'G'}
                                            </Avatar>
                                            <Box className="box-flex-grow">
                                                <Box className="guest-name-chip-container">
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
                                                <Typography variant="body2" color="text.secondary" className="guest-document-text">
                                                    {`${guest.documentType || t('guestRegistration.documentType', 'Document')}: ${guest.documentNumber || '-'}`}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Box className="guest-action-buttons">
                                            <Tooltip title={t('guestRegistration.editGuest', 'Edit Guest')}>
                                                <IconButton 
                                                    size="small" 
                                                    onClick={() => handleEditGuestClick(guest)} 
                                                    className="guest-action-icon-button"
                                                    aria-label="edit guest"
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={t('guestRegistration.deleteGuest', 'Delete Guest')}>
                                                <IconButton 
                                                    size="small" 
                                                    color="error" 
                                                    onClick={() => handleDeleteGuestClick(guest.id)}
                                                    aria-label="delete guest"
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </ListItem>
                                    {index < registeredGuests.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    ) : (
                        <Box className="guest-list-empty-box">
                            <Typography className="guest-list-empty-text">
                                {t('guestRegistration.noGuests', 'No guests registered for this booking yet.')}
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Кнопка Добавить Гостя */} 
            {!isFormVisible && (
                <Box className="add-guest-button-container">
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={() => setIsFormVisible(true)}
                        startIcon={<PersonAddIcon />}
                        size="large"
                        className="add-guest-button"
                    >
                        {t('guestRegistration.registerButton', 'Register New Guest')}
                    </Button>
                </Box>
            )}

            {/* Форма Регистрации Гостя (Условная) */} 
            {isFormVisible && (
                <Card elevation={3} className="registration-card">
                    <Box className="registration-card-header-bar registration-card-header-bar-info" />
                    <CardContent className="guest-form-card-content">
                        <Typography variant="h5" gutterBottom className="registration-card-title registration-card-title-info">
                            <PersonAddIcon className="registration-card-title-icon" />
                            {editingGuestId 
                                ? t('guestRegistration.editGuestTitle', 'Edit Guest Details') 
                                : t('guestRegistration.newGuestTitle', 'Register Guest Details')}
                        </Typography>
                        
                        {guestSaveError && <Alert severity="error" className="alert-mb-3">{guestSaveError}</Alert>}
                        {countriesError && <Alert severity="warning" className="alert-mb-3">{countriesError}</Alert>}
                        
                        <GuestForm
                            countries={countries || []}
                            loadingCountries={loadingCountries}
                            onSubmit={handleSaveGuest}
                            isSaving={isSavingGuest}
                            initialData={editingGuestData || undefined}
                            isEditMode={!!editingGuestId}
                        />
                        
                        <Box className="cancel-edit-button-container">
                            <Button 
                                onClick={handleCancelEdit}
                                disabled={isSavingGuest} 
                                variant="outlined"
                                className="cancel-edit-button"
                            >
                                {t('guestRegistration.cancel', 'Cancel')}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Кнопка Завершения */} 
            <Box className="finish-button-container">
                <Button
                    variant="contained"
                    color="success"
                    onClick={handleFinishRegistration}
                    disabled={isFinishing || isSavingGuest || registeredGuests.length === 0}
                    startIcon={<CheckCircleIcon />}
                    size="large"
                    className="finish-button"
                >
                    {isFinishing ? 
                        <CircularProgress size={24} color="inherit" /> : 
                        t('guestRegistration.finishButton', 'Finish Registration')
                    }
                </Button>
            </Box>

            {/* Диалог подтверждения удаления */} 
            <ConfirmationDialog
                open={isDeleteDialogOpen}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                title={t('guestRegistration.deleteConfirmTitle', 'Confirm Deletion')}
                message={t('guestRegistration.deleteConfirmMessage', 'Are you sure you want to delete this guest? This action cannot be undone.')}
            />

            {/* Snackbar для уведомлений */} 
            {snackbar && (
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={handleCloseSnackbar}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            )}
        </Container>
    );
};

export default GuestRegistrationPage; 