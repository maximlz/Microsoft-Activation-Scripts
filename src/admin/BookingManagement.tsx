import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, Timestamp, QuerySnapshot, DocumentData, doc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../config/firebaseConfig'; // Исправленный путь
import { IBooking, IBookingWithId, IPropertyWithId, IGuestFormDataWithId, IGuestFormData } from '../types/guestTypes';
import { generateUniqueToken } from '../utils/tokenGenerator'; // Предполагаем, что будет такой файл
// Импорты для модального окна MUI (предполагаем использование MUI)
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
    Alert, // Для отображения ошибок
    Snackbar, // <-- Импорт Snackbar
    IconButton, // <-- Для кнопки-иконки копирования
    Select, // <-- Импорт Select
    MenuItem, // <-- Импорт MenuItem
    FormControl, // <-- Импорт FormControl
    InputLabel, // <-- Импорт InputLabel
    SelectChangeEvent, // <-- Импорт типа события для Select
    Paper, // <-- Импорт Paper
    Typography, // <-- Импорт Typography
    Link, // <-- Импорт Link для ссылки
    Grid, // <-- Используем Grid для расположения полей
    List, // <-- Для списка гостей
    ListItem, // <-- Для списка гостей
    ListItemText // <-- Для списка гостей
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy'; // <-- Иконка копирования
import EditIcon from '@mui/icons-material/Edit'; // <-- Иконка редактирования
import DeleteIcon from '@mui/icons-material/Delete'; // <-- Иконка удаления
// Импорты для DataGrid
import { DataGrid, GridColDef, GridToolbar, GridActionsCellItem, GridSortModel } from '@mui/x-data-grid';
import { format } from 'date-fns'; // Для форматирования дат

// --- Начало Заготовки для модального окна --- 
// (В идеале вынести в отдельный файл, например, AddBookingModal.tsx)
interface AddBookingModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (bookingData: Omit<IBooking, 'registrationToken' | 'createdAt' | 'mainGuestName' | 'guestCount' | 'notes'>, bookingId?: string) => Promise<void>;
    isSaving: boolean;
    initialData?: IBookingWithId | null;
}

const AddBookingModal: React.FC<AddBookingModalProps> = ({ open, onClose, onSave, isSaving, initialData }) => {
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
        if (isEditMode && initialData?.confirmationCode && open) {
            const fetchGuests = async () => {
                setLoadingGuests(true);
                setGuestsError(null);
                setAssociatedGuests([]);
                try {
                    const guestsRef = collection(db, 'guests');
                    // Ищем гостей по bookingConfirmationCode
                    const q = query(guestsRef, where("bookingConfirmationCode", "==", initialData.confirmationCode));
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
            fetchGuests();
        } else {
            // Сбрасываем гостей, если не режим редактирования или нет кода
            setAssociatedGuests([]);
            setLoadingGuests(false);
            setGuestsError(null);
        }
    }, [isEditMode, initialData?.confirmationCode, open]);

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

    // Генерация кода для нового бронирования
    useEffect(() => {
        if (open && !isEditMode && !formData.confirmationCode) {
            // Генерируем код только один раз при открытии для нового бронирования
            const generateCode = async () => {
                const newCode = await generateUniqueToken(8); // Генерируем код (длина 8?) 
                setFormData(prev => ({ ...prev, confirmationCode: newCode }));
            }
            generateCode();
        }
    }, [open, isEditMode, formData.confirmationCode]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (event: SelectChangeEvent<string>) => {
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

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{isEditMode ? 'Edit Booking' : 'Add New Booking'}</DialogTitle>
            <DialogContent>
                {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                {propertiesError && <Alert severity="warning" sx={{ mb: 2 }}>{`Warning: ${propertiesError}`}</Alert>}

                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" gutterBottom>Booking Details</Typography>
                        <FormControl fullWidth margin="dense" required disabled={loadingProperties}>
                            <InputLabel id="property-name-select-label">Property Name</InputLabel>
                            <Select
                                labelId="property-name-select-label"
                                id="property-name-select"
                                name="propertyName"
                                value={formData.propertyName || ''}
                                label="Property Name"
                                onChange={handleSelectChange}
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
                            InputProps={{
                                readOnly: isEditMode,
                            }}
                            helperText={!isEditMode ? "Generated automatically" : "Cannot be changed"}
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
                            />
                        </Box>

                        <FormControl fullWidth margin="dense" required>
                            <InputLabel id="booking-status-select-label">Booking Status</InputLabel>
                            <Select
                                labelId="booking-status-select-label"
                                name="status"
                                value={formData.status || ''}
                                label="Booking Status"
                                onChange={handleSelectChange}
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
                                        <List dense>
                                            {associatedGuests.map(guest => (
                                                <ListItem key={guest.id}>
                                                    <ListItemText
                                                        primary={`${guest.firstName || ''} ${guest.lastName || ''}`.trim() || 'Unnamed Guest'}
                                                        secondary={guest.email || 'No email'}
                                                    />
                                                </ListItem>
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
                <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
                <Button
                    onClick={handleSaveClick}
                    disabled={isSaving || loadingProperties || (properties.length === 0 && !propertiesError) || loadingGuests}
                    variant="contained"
                >
                    {isSaving ? <CircularProgress size={24} /> : (isEditMode ? 'Save Changes' : 'Save Booking')}
                </Button>
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
        width: 100,
        cellClassName: 'actions',
        getActions: ({ id }) => {
            const stringId = id as string;
            return [
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

const BookingManagement: React.FC = () => {
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
        setIsModalOpen(true);
    };

    const handleEditAction = (id: string) => {
        const bookingToEdit = bookings.find(b => b.id === id);
        if (bookingToEdit) {
            setEditingBooking(bookingToEdit);
            setIsModalOpen(true);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBooking(null);
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

    // --- ВЫЗЫВАЕМ defineColumns ЗДЕСЬ, ПОСЛЕ ОПРЕДЕЛЕНИЯ ОБРАБОТЧИКОВ ---
    const columns = defineColumns(getRegistrationLink, handleCopyLink, handleEditAction, handleDeleteAction);

    // Начальная сортировка
    const initialSortModel: GridSortModel = [
        {
            field: 'createdAt',
            sort: 'desc',
        },
    ];

    return (
        <Box sx={{ p: 3, height: 'calc(100vh - 64px - 48px - 72px)', width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" component="h2">Booking Management</Typography>
                <Button
                    variant="contained"
                    onClick={handleAddBookingClick}
                    disabled={isLoading}
                >
                    Add New Booking
                </Button>
            </Box>

            {/* Показываем общую ошибку загрузки */}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Модальное окно добавления/редактирования */} 
            <AddBookingModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveBooking}
                isSaving={isSaving}
                initialData={editingBooking}
            />

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

             {/* Используем DataGrid */}
            <Paper sx={{ height: '100%', width: '100%' }}>
                 <DataGrid
                    rows={bookings}
                    columns={columns}
                    loading={isLoading}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    pageSizeOptions={[5, 10, 25]}
                     initialState={{
                        pagination: {
                           paginationModel: { page: 0, pageSize: 10 },
                        },
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
                    disableRowSelectionOnClick
                />
            </Paper>
        </Box>
    );
};

export default BookingManagement; 