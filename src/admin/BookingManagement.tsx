import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, Timestamp, QuerySnapshot, DocumentData, doc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { IBooking, IBookingWithId, IPropertyWithId, IGuestFormDataWithId, IGuestFormData } from '../types/guestTypes';
import { generateUniqueToken } from '../utils/tokenGenerator';
import { getFunctions, httpsCallable } from "firebase/functions";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    DialogContentText,
    TextField,
    CircularProgress,
    Box,
    Alert,
    Snackbar,
    IconButton,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    SelectChangeEvent,
    Paper,
    Typography,
    Link,
    Grid,
    List,
    ListItemText,
    ListItemButton,
    ListItemIcon
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { DataGrid, GridColDef, GridToolbar, GridActionsCellItem, GridSortModel } from '@mui/x-data-grid';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import RegistrationDetailsModal from '../admin/RegistrationDetailsModal';

// --- Начало Заготовки для модального окна --- 
// (В идеале вынести в отдельный файл, например, AddBookingModal.tsx)
interface AddBookingModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (bookingData: Omit<IBooking, 'registrationToken' | 'createdAt' | 'mainGuestName' | 'guestCount' | 'notes'>, bookingId?: string) => Promise<void>;
    isSaving: boolean;
    initialData?: IBookingWithId | null;
    isViewMode?: boolean; // <-- Добавляем проп для режима просмотра
    onGuestClick: (guestId: string) => void; // <-- Новый проп для клика по гостю
    guestUpdateTimestamp: number | null; // <-- Добавляем новый проп для обновления списка гостей
}

const AddBookingModal: React.FC<AddBookingModalProps> = ({ open, onClose, onSave, isSaving, initialData, isViewMode, onGuestClick, guestUpdateTimestamp }) => {
    const [formData, setFormData] = useState<Partial<Omit<IBooking, 'registrationToken' | 'createdAt' | 'mainGuestName' | 'guestCount' | 'notes'> & { id?: string }>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [properties, setProperties] = useState<IPropertyWithId[]>([]);
    const [loadingProperties, setLoadingProperties] = useState(false);
    const [propertiesError, setPropertiesError] = useState<string | null>(null);
    const [associatedGuests, setAssociatedGuests] = useState<IGuestFormDataWithId[]>([]);
    const [loadingGuests, setLoadingGuests] = useState(false);
    const [guestsError, setGuestsError] = useState<string | null>(null);

    const isEditMode = !!initialData;

    // Загрузка Properties при открытии модального окна
    useEffect(() => {
        if (open) {
            const fetchProperties = async () => {
                setLoadingProperties(true);
                setPropertiesError(null);
                try {
                    const propertiesCol = collection(db, 'properties');
                    const data = await getDocs(query(propertiesCol, orderBy('name', 'asc')));
                    const fetchedProperties = data.docs.map(doc => ({
                        ...(doc.data() as Omit<IPropertyWithId, 'id'>),
                        id: doc.id
                    }));
                    setProperties(fetchedProperties);
                } catch (err) {
                    console.error("Error fetching properties for modal: ", err);
                    setPropertiesError(err instanceof Error ? err.message : 'Failed to load properties.');
                    setProperties([]); // Очищаем список в случае ошибки
                } finally {
                    setLoadingProperties(false);
                }
            };
            fetchProperties();
        }
    }, [open]);

    // Загрузка связанных гостей при редактировании
    useEffect(() => {
        const fetchGuests = async () => {
            setLoadingGuests(true);
            setGuestsError(null);
            setAssociatedGuests([]);
            try {
                const guestsRef = collection(db, 'guests');
                const q = query(guestsRef, where("bookingConfirmationCode", "==", initialData!.confirmationCode));
                const querySnapshot = await getDocs(q);
                const guests = querySnapshot.docs.map(doc => ({ ...(doc.data() as IGuestFormData), id: doc.id }));
                setAssociatedGuests(guests);
            } catch (err) {
                console.error("Error fetching associated guests:", err);
                setGuestsError('Failed to load associated guests.');
            } finally {
                setLoadingGuests(false);
            }
        };

        if (isEditMode && initialData?.confirmationCode && open) {
            fetchGuests();
        } else {
            setAssociatedGuests([]);
            setLoadingGuests(false);
            setGuestsError(null);
        }
    }, [isEditMode, initialData?.confirmationCode, open, guestUpdateTimestamp]);

    // Предзаполнение формы при редактировании
    useEffect(() => {
        if (initialData && open) {
            setFormData({
                id: initialData.id,
                propertyName: initialData.propertyName,
                checkInDate: initialData.checkInDate,
                checkOutDate: initialData.checkOutDate,
                confirmationCode: initialData.confirmationCode,
                status: initialData.status,
            });
            setFormError(null);
        } else if (!open) {
            setFormData({});
            setFormError(null);
            setPropertiesError(null);
            setProperties([]);
            setAssociatedGuests([]);
            setGuestsError(null);
        }
    }, [initialData, open]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (isViewMode) return; // Запрещаем изменение в режиме просмотра
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (event: SelectChangeEvent<string>) => {
        if (isViewMode) return; // Запрещаем изменение в режиме просмотра
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value as IBooking['status'] }));
    };

    const handleSaveClick = async () => {
        setFormError(null);
        // Валидация
        if (!formData.propertyName || !formData.checkInDate || !formData.checkOutDate || !formData.confirmationCode || !formData.status) {
            setFormError('All fields (Property, Dates, Confirmation Code, Status) are required.');
            return;
        }

        try {
            // Собираем только нужные данные для IBooking
            const dataToSave: Omit<IBooking, 'registrationToken' | 'createdAt' | 'mainGuestName' | 'guestCount' | 'notes'> = {
                propertyName: formData.propertyName,
                checkInDate: formData.checkInDate,
                checkOutDate: formData.checkOutDate,
                confirmationCode: formData.confirmationCode,
                status: formData.status,
            };

            await onSave(dataToSave, initialData?.id);
        } catch (error) {
            console.error("Error saving booking from modal:", error);
            setFormError(error instanceof Error ? error.message : 'Failed to save booking.');
        }
    };

    const handleInternalGuestClick = (guestId: string) => {
        onGuestClick(guestId); // Вызываем колбэк, переданный из родителя
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{isViewMode ? 'View Booking Details' : (!!initialData ? 'Edit Booking' : 'Add New Booking')}</DialogTitle>
            <DialogContent>
                {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                {propertiesError && <Alert severity="warning" sx={{ mb: 2 }}>{`Warning: ${propertiesError}`}</Alert>}

                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" gutterBottom>Booking Details</Typography>
                        <FormControl fullWidth margin="dense" required disabled={loadingProperties || isViewMode}>
                            <InputLabel id="property-name-select-label">Property Name</InputLabel>
                            <Select
                                labelId="property-name-select-label"
                                id="property-name-select"
                                name="propertyName"
                                value={formData.propertyName || ''}
                                label="Property Name"
                                onChange={handleSelectChange}
                                readOnly={isViewMode}
                            >
                                {loadingProperties && (
                                    <MenuItem value="" disabled>
                                        <CircularProgress size={20} sx={{ mr: 1 }} /> Loading Properties...
                                    </MenuItem>
                                )}
                                {!loadingProperties && properties.length === 0 && (
                                     <MenuItem value="" disabled>
                                        {propertiesError ? 'Error loading' : 'No properties defined'}
                                     </MenuItem>
                                )}
                                {properties.map((prop) => (
                                    <MenuItem key={prop.id} value={prop.name}>
                                        {prop.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            margin="dense"
                            name="confirmationCode"
                            label="Confirmation Code"
                            fullWidth
                            variant="outlined"
                            value={formData.confirmationCode || ''}
                            onChange={handleChange}
                            required
                            InputProps={{ readOnly: isViewMode }}
                        />

                        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                            <TextField
                                margin="dense"
                                name="checkInDate"
                                label="Check-in Date"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                sx={{ flexGrow: 1 }}
                                value={formData.checkInDate || ''}
                                onChange={handleChange}
                                required
                                InputProps={{ readOnly: isViewMode }}
                            />
                            <TextField
                                margin="dense"
                                name="checkOutDate"
                                label="Check-out Date"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                sx={{ flexGrow: 1 }}
                                value={formData.checkOutDate || ''}
                                onChange={handleChange}
                                required
                                InputProps={{ readOnly: isViewMode }}
                            />
                        </Box>

                        <FormControl fullWidth margin="dense" required disabled={isViewMode}>
                            <InputLabel id="booking-status-select-label">Booking Status</InputLabel>
                            <Select
                                labelId="booking-status-select-label"
                                name="status"
                                value={formData.status || ''}
                                label="Booking Status"
                                onChange={handleSelectChange}
                                readOnly={isViewMode}
                            >
                                <MenuItem value="pending">Pending</MenuItem>
                                <MenuItem value="completed">Completed</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    {isEditMode && (
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle1" gutterBottom>Associated Guests</Typography>
                            {loadingGuests && <CircularProgress size={24} />}
                            {guestsError && <Alert severity="error">{guestsError}</Alert>}
                            {!loadingGuests && !guestsError && (
                                <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                                    {associatedGuests.length > 0 ? (
                                        // Используем List с ListItemButton
                                        <List dense disablePadding> 
                                            {associatedGuests.map(guest => (
                                                <ListItemButton 
                                                    key={guest.id} 
                                                    onClick={() => handleInternalGuestClick(guest.id)}
                                                    // Добавляем divider для разделения
                                                    divider 
                                                >
                                                    <ListItemIcon sx={{ minWidth: 32 }}> {/* Опциональная иконка */} 
                                                        <AccountCircleIcon fontSize="small" color="action" />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={`${guest.firstName || ''} ${guest.lastName || ''}`.trim() || 'Unnamed Guest'}
                                                        secondary={guest.email || 'No email'}
                                                    />
                                                </ListItemButton>
                                            ))}
                                        </List>
                                    ) : (
                                        <Typography sx={{ p: 2, color: 'text.secondary' }}>
                                            No guests linked to this confirmation code yet.
                                        </Typography>
                                    )}
                                </Paper>
                            )}
                        </Grid>
                    )}
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSaving && !isViewMode}>Cancel</Button>
                {!isViewMode && (
                    <Button
                        onClick={handleSaveClick}
                        disabled={isSaving || loadingProperties || (properties.length === 0 && !propertiesError) || loadingGuests}
                        variant="contained"
                    >
                        {isSaving ? <CircularProgress size={24} /> : (!!initialData ? 'Save Changes' : 'Save Booking')}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

// --- Диалог подтверждения удаления --- (можно вынести в отдельный компонент)
interface ConfirmationDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ open, onClose, onConfirm, title, message }) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
        >
            <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    {message}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={onConfirm} color="error" autoFocus>
                    Confirm Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
};
// --- Конец диалога подтверждения ---

// Вспомогательная функция форматирования даты (можно вынести в utils)
const formatNullableDate = (dateInput: string | undefined | null): string => {
    if (!dateInput) return '-';
    try {
        const date = new Date(dateInput);
        return isNaN(date.getTime()) ? dateInput : format(date, 'dd-MM-yyyy');
    } catch (e) {
        return dateInput; // Возвращаем исходную строку при ошибке
    }
};

const formatNullableTimestamp = (ts: Timestamp | undefined | null): string => {
    if (!ts) return '-';
    try {
        return format(ts.toDate(), 'dd-MM-yyyy HH:mm');
    } catch (e) {
        return 'Invalid Date';
    }
};

// Определяем колонки для DataGrid
const defineColumns = (
    getLinkFunc: (token: string) => string,
    copyHandler: (token: string) => void,
    viewHandler: (id: string) => void,
    editHandler: (id: string) => void,
    deleteHandler: (id: string) => void
): GridColDef<IBookingWithId>[] => [
    {
        field: 'propertyName',
        headerName: 'Property',
        flex: 1,
        minWidth: 150,
    },
    {
        field: 'confirmationCode',
        headerName: 'Conf. Code',
        width: 130,
    },
    {
        field: 'checkInDate',
        headerName: 'Check-in',
        width: 120,
        valueFormatter: (value) => formatNullableDate(value),
    },
    {
        field: 'checkOutDate',
        headerName: 'Check-out',
        width: 120,
        valueFormatter: (value) => formatNullableDate(value),
    },
    {
        field: 'status',
        headerName: 'Status',
        width: 110,
        renderCell: (params) => {
            const status = params.value as IBooking['status'];
            let bgColor = 'grey.100';
            let textColor = 'text.secondary';
            if (status === 'completed') {
                bgColor = 'success.light';
                textColor = 'success.dark';
            } else if (status === 'expired') {
                bgColor = 'error.light';
                textColor = 'error.dark';
            } else if (status === 'pending') {
                bgColor = 'warning.light';
                textColor = 'warning.dark';
            }
            return (
                <Box
                    component="span"
                    sx={{
                        display: 'inline-block',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '12px',
                        bgcolor: bgColor,
                        color: textColor,
                        fontSize: '0.75rem',
                        fontWeight: 'medium',
                        textTransform: 'capitalize'
                    }}
                >
                    {status}
                </Box>
            );
        },
    },
    {
        field: 'createdAt',
        headerName: 'Created At',
        width: 160,
        valueFormatter: (value) => formatNullableTimestamp(value as Timestamp | null),
        type: 'dateTime', // Указываем тип для лучшей сортировки
    },
    {
        field: 'registrationToken',
        headerName: 'Reg. Link',
        width: 130,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
            const token = params.value as string;
            const link = getLinkFunc(token);
            return (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Link href={link} target="_blank" rel="noopener noreferrer" sx={{ mr: 1 }}>
                        Open
                    </Link>
                    <IconButton
                        size="small"
                        onClick={() => copyHandler(token)}
                        title="Copy registration link"
                    >
                        <ContentCopyIcon fontSize="inherit" />
                    </IconButton>
                </Box>
            );
        },
    },
    {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 130,
        cellClassName: 'actions',
        getActions: ({ id }) => {
            const stringId = id as string;
            return [
                <GridActionsCellItem
                    icon={<VisibilityIcon />}
                    label="View"
                    onClick={() => viewHandler(stringId)}
                    color="inherit"
                />,
                <GridActionsCellItem
                    icon={<EditIcon />}
                    label="Edit"
                    className="textPrimary"
                    onClick={() => editHandler(stringId)}
                    color="inherit"
                />,
                <GridActionsCellItem
                    icon={<DeleteIcon />}
                    label="Delete"
                    onClick={() => deleteHandler(stringId)}
                    color="error"
                />,
            ];
        },
    },
];

const bookingsCollectionRef = collection(db, 'bookings');
// Получаем экземпляр Functions
const functions = getFunctions();
// Создаем callable-ссылку на функцию updateGuest
const updateGuestCallable = httpsCallable<{ guestId: string; guestData: Partial<IGuestFormData> }, { success: boolean; error?: string }>(functions, 'updateGuest');

const BookingManagement: React.FC = () => {
    const { t } = useTranslation();
    const [bookings, setBookings] = useState<IBookingWithId[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // Используем один Snackbar для всех уведомлений
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);
    const [editingBooking, setEditingBooking] = useState<IBookingWithId | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);
    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 }); // Состояние для пагинации
    const [isViewMode, setIsViewMode] = useState(false); // <-- Новое состояние для режима просмотра
    // <-- Новые состояния для модального окна деталей гостя -->
    const [isGuestDetailsModalOpen, setIsGuestDetailsModalOpen] = useState(false);
    const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
    const [guestUpdateTimestamp, setGuestUpdateTimestamp] = useState<number | null>(null); // <-- Добавляем состояние
    
    // Возвращаем fetchBookings в область видимости компонента и оборачиваем в useCallback
    const fetchBookings = useCallback(async (showLoading = true) => {
        console.log("fetchBookings called, showLoading:", showLoading);
        if (showLoading) setIsLoading(true);
        setError(null);
        try {
            console.log("Attempting to getDocs...");
            const data: QuerySnapshot<DocumentData> = await getDocs(bookingsCollectionRef);
            console.log("Firestore data fetched, docs count:", data.docs.length);
            
            const fetchedBookings = data.docs.map((doc) => {
                const docData = doc.data();
                return {
                    ...(docData as IBooking),
                    id: doc.id,
                };
            });
            console.log("Fetched bookings (before sort):", fetchedBookings);
            fetchedBookings.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
            console.log("Setting bookings state:", fetchedBookings);
            setBookings(fetchedBookings);
            
        } catch (err) {
            console.error("Error inside fetchBookings: ", err);
            setError(err instanceof Error ? err.message : 'Failed to load bookings.');
        } finally {
            console.log("fetchBookings finished, setting isLoading to false.");
            if (showLoading) setIsLoading(false);
        }
    }, []); // Пустой массив зависимостей, т.к. bookingsCollectionRef стабилен

    useEffect(() => {
        console.log("BookingManagement useEffect running.");
        // Вызываем fetchBookings из useCallback
        fetchBookings();
    }, [fetchBookings]); // Зависим от стабильной функции fetchBookings

    const handleAddBookingClick = () => {
        setEditingBooking(null);
        setIsViewMode(false); // Убедимся, что режим просмотра выключен при добавлении
        setIsModalOpen(true);
    };

    const handleViewAction = (id: string) => {
        const bookingToView = bookings.find(b => b.id === id);
        if (bookingToView) {
            setEditingBooking(bookingToView); // Используем то же состояние, что и для редактирования
            setIsViewMode(true); // Включаем режим просмотра
            setIsModalOpen(true);
        }
    };

    const handleEditAction = (id: string) => {
        const bookingToEdit = bookings.find(b => b.id === id);
        if (bookingToEdit) {
            setEditingBooking(bookingToEdit);
            setIsViewMode(false); // Убедимся, что режим просмотра выключен при редактировании
            setIsModalOpen(true);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBooking(null);
        setIsViewMode(false); // Сбрасываем режим просмотра при закрытии
    };

    const handleSaveBooking = async (bookingData: Omit<IBooking, 'registrationToken' | 'createdAt'>, bookingId?: string) => {
        setIsSaving(true);
        setError(null);
        try {
            if (bookingId) {
                // --- РЕДАКТИРОВАНИЕ ---
                const bookingRef = doc(db, 'bookings', bookingId);
                await updateDoc(bookingRef, bookingData);
                setSnackbar({ open: true, message: 'Booking updated successfully!', severity: 'success' });
            } else {
                // --- СОЗДАНИЕ ---
                const token = await generateUniqueToken();
                const bookingToAdd: IBooking = {
                    ...bookingData,
                    registrationToken: token,
                    createdAt: Timestamp.now(),
                };
                await addDoc(bookingsCollectionRef, bookingToAdd);
                 setSnackbar({ open: true, message: 'Booking added successfully!', severity: 'success' });
            }
            setIsModalOpen(false);
            setEditingBooking(null);
            fetchBookings(false);
        } catch (err) {
            console.error(`Error ${bookingId ? 'updating' : 'adding'} booking: `, err);
            throw err; // Пробрасываем ошибку для отображения в модалке
        } finally {
            setIsSaving(false);
        }
    };

    const getRegistrationLink = (token: string): string => {
        return `${window.location.origin}/register/${token}`;
    };

    const handleCopyLink = async (token: string) => {
        const link = getRegistrationLink(token);
        try {
            await navigator.clipboard.writeText(link);
            setSnackbar({ open: true, message: 'Link copied to clipboard!', severity: 'success' });
        } catch (err) {
            console.error('Failed to copy link: ', err);
             setSnackbar({ open: true, message: 'Failed to copy link.', severity: 'error' });
        }
    };

    const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar(null);
    };

    const handleDeleteAction = (id: string) => {
        setBookingToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setIsDeleteDialogOpen(false);
        setBookingToDelete(null);
    };

    const handleConfirmDelete = async () => {
        if (!bookingToDelete) return;
        setError(null); // Сброс общей ошибки
        try {
            const bookingRef = doc(db, 'bookings', bookingToDelete);
            await deleteDoc(bookingRef);
            setSnackbar({ open: true, message: 'Booking deleted successfully.', severity: 'success' });
            handleCloseDeleteDialog();
            fetchBookings(false);
        } catch (err) {
            console.error("Error deleting booking: ", err);
            const message = err instanceof Error ? err.message : 'Failed to delete booking.';
            // Показываем ошибку в Snackbar
            setSnackbar({ open: true, message, severity: 'error' });
            handleCloseDeleteDialog(); // Закрываем диалог даже при ошибке
        }
    };

    // <-- Новый обработчик для открытия деталей гостя -->
    const handleOpenGuestDetails = (guestId: string) => {
        console.log(`Opening details for guest: ${guestId}, isViewMode (booking): ${isViewMode}`);
        setSelectedGuestId(guestId);
        setIsGuestDetailsModalOpen(true);
    };

    const handleCloseGuestDetailsModal = () => {
        setIsGuestDetailsModalOpen(false);
        setSelectedGuestId(null);
    };

    // --- Обновленный обработчик сохранения гостя ---
    const handleSaveGuestRegistration = async (id: string, data: IGuestFormData) => {
        if (!id) return;
        setError(null); // Сбрасываем общую ошибку (если есть)

        const guestDataToUpdate: Partial<IGuestFormData> = {
            firstName: data.firstName,
            lastName: data.lastName,
            secondLastName: data.secondLastName,
            birthDate: data.birthDate,
            nationality: data.nationality,
            sex: data.sex,
            documentType: data.documentType,
            documentNumber: data.documentNumber,
            documentSupNum: data.documentSupNum,
            phone: data.phone,
            email: data.email,
            countryResidence: data.countryResidence,
            residenceAddress: data.residenceAddress,
            apartmentNumber: data.apartmentNumber, // Добавляем квартиру
            city: data.city,
            postcode: data.postcode,
            visitDate: data.visitDate,
            countryCode: data.countryCode,
        };

        try {
            console.log(`Calling updateGuest Cloud Function for guestId: ${id}`);
            const result = await updateGuestCallable({ guestId: id, guestData: guestDataToUpdate });

            if (result.data.success) {
                console.log(`Guest ${id} updated successfully.`);
                setSnackbar({
                    open: true,
                    message: t('bookingManagement.guestUpdateSuccess', 'Guest details updated successfully!'),
                    severity: 'success'
                });
                setGuestUpdateTimestamp(Date.now()); // <-- Обновляем timestamp при успехе
                handleCloseGuestDetailsModal(); 
                // TODO: Решить, нужно ли немедленное обновление списка гостей в AddBookingModal
                // fetchBookings(false); // Не требуется для списка гостей
            } else {
                console.error(`Cloud Function updateGuest failed for ${id}:`, result.data.error);
                throw new Error(result.data.error || t('bookingManagement.guestUpdateErrorCloud', 'Failed to update guest via Cloud Function.'));
            }

        } catch (err: any) {
            console.error(`Error calling updateGuest Cloud Function for ${id}: `, err);
            const message = err.details?.message || err.message || t('bookingManagement.guestUpdateErrorGeneric', 'An error occurred while updating guest details.');
            setSnackbar({
                open: true,
                message: message,
                severity: 'error'
            });
        }
    };

    // Передаем все обработчики в defineColumns
    const columns = defineColumns(
        getRegistrationLink, 
        handleCopyLink, 
        handleViewAction,
        handleEditAction, 
        handleDeleteAction
    );

    // Начальная сортировка
    const initialSortModel: GridSortModel = [
        {
            field: 'createdAt',
            sort: 'desc',
        },
    ];

    return (
        <Box sx={{ height: '75vh', width: '100%' }}>
            <Typography variant="h4" gutterBottom>
                {t('bookingManagement.title', 'Booking Management')}
            </Typography>
            {/* Кнопка Добавить */} 
            <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddBookingClick}
                sx={{ mb: 2 }}
            >
                {t('bookingManagement.addBooking', 'Add Booking')}
            </Button>

            {/* Отображение ошибки загрузки */} 
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {t('bookingManagement.errorLoading', 'Error loading bookings: ')} {error}
                </Alert>
            )}

            <DataGrid
                className="admin-data-grid"
                rows={bookings || []}
                columns={columns}
                loading={isLoading}
                pageSizeOptions={[10, 25, 50, 100]}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                initialState={{
                    sorting: {
                        sortModel: initialSortModel,
                    },
                }}
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                    toolbar: {
                        showQuickFilter: true,
                    },
                }}
                autoHeight={false}
            />

            {/* Модальное окно */}
            <AddBookingModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveBooking}
                isSaving={isSaving}
                initialData={editingBooking}
                isViewMode={isViewMode}
                onGuestClick={handleOpenGuestDetails}
                guestUpdateTimestamp={guestUpdateTimestamp}
            />

            {/* Модальное окно деталей гостя */}
            {selectedGuestId && (
                <RegistrationDetailsModal
                    open={isGuestDetailsModalOpen}
                    onClose={handleCloseGuestDetailsModal}
                    registrationId={selectedGuestId}
                    isEditMode={!isViewMode} 
                    onSave={handleSaveGuestRegistration}
                />
            )}

            {/* Диалог подтверждения удаления */} 
            <ConfirmationDialog
                open={isDeleteDialogOpen}
                onClose={handleCloseDeleteDialog}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
                message={`Are you sure you want to delete this booking? This action cannot be undone.`}
            />

            {/* Общий Snackbar для уведомлений */} 
            <Snackbar
                open={snackbar?.open ?? false}
                autoHideDuration={4000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar?.severity ?? 'info'}
                    sx={{ width: '100%' }}
                >
                    {snackbar?.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default BookingManagement; 