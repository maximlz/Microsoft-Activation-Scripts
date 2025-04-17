import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, Timestamp, QuerySnapshot, DocumentData, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { IProperty, IPropertyWithId } from '../types/guestTypes'; // Импортируем новые типы
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
    Paper,
    Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
// Импорты для DataGrid
import { DataGrid, GridColDef, GridToolbar, GridActionsCellItem, GridSortModel } from '@mui/x-data-grid';

// --- Модальное окно для добавления/редактирования Property ---
interface AddEditPropertyModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (propertyData: Omit<IProperty, 'createdAt'>, propertyId?: string) => Promise<void>;
    isSaving: boolean;
    initialData?: IPropertyWithId | null;
}

const AddEditPropertyModal: React.FC<AddEditPropertyModalProps> = ({ open, onClose, onSave, isSaving, initialData }) => {
    const [propertyName, setPropertyName] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData && open) {
            setPropertyName(initialData.name);
            setFormError(null);
        } else if (!open) {
            setPropertyName('');
            setFormError(null);
        }
    }, [initialData, open]);

    const handleSaveClick = async () => {
        setFormError(null);
        if (!propertyName.trim()) {
            setFormError('Property Name cannot be empty.');
            return;
        }
        try {
            await onSave({ name: propertyName.trim() }, initialData?.id);
        } catch (error) {
            console.error("Error saving property from modal:", error);
            setFormError(error instanceof Error ? error.message : 'Failed to save property.');
            // Не закрываем окно при ошибке, чтобы пользователь мог видеть ошибку
        }
    };

    const isEditMode = !!initialData;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{isEditMode ? 'Edit Property' : 'Add New Property'}</DialogTitle>
            <DialogContent>
                {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                <TextField
                    autoFocus
                    margin="dense"
                    name="propertyName"
                    label="Property Name"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    required
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSaveClick} disabled={isSaving} variant="contained">
                    {isSaving ? <CircularProgress size={24} /> : (isEditMode ? 'Save Changes' : 'Add Property')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// --- Диалог подтверждения удаления (можно вынести в общий компонент) ---
interface ConfirmationDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ open, onClose, onConfirm, title, message }) => {
    // (Код этого компонента можно скопировать из BookingManagement или вынести в общий)
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


// --- Основной компонент PropertyManagement ---
const propertiesCollectionRef = collection(db, 'properties');

// Определяем колонки вне компонента для стабильности
const defineColumns = (
    editHandler: (id: string) => void,
    deleteHandler: (id: string) => void
): GridColDef[] => [
    {
        field: 'name',
        headerName: 'Property Name',
        flex: 1, // Занимает доступное пространство
        minWidth: 200,
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
                    color="error" // Используем error цвет для удаления
                />,
            ];
        },
    },
];

const PropertyManagement: React.FC = () => {
    const [properties, setProperties] = useState<IPropertyWithId[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingProperty, setEditingProperty] = useState<IPropertyWithId | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
    const [snackbarOpen, setSnackbarOpen] = useState(false); // Общий Snackbar для уведомлений
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 }); // Состояние для пагинации

    const fetchProperties = useCallback(async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        setError(null);
        try {
            const data: QuerySnapshot<DocumentData> = await getDocs(propertiesCollectionRef);
            const fetchedProperties = data.docs.map((doc) => ({
                ...(doc.data() as IProperty),
                id: doc.id,
            }));
            // Сортировка по имени для удобства
            fetchedProperties.sort((a, b) => a.name.localeCompare(b.name));
            setProperties(fetchedProperties);
        } catch (err) {
            console.error("Error fetching properties: ", err);
            setError(err instanceof Error ? err.message : 'Failed to load properties.');
        } finally {
            if (showLoading) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProperties();
    }, [fetchProperties]);

    const handleAddPropertyClick = () => {
        setEditingProperty(null);
        setIsModalOpen(true);
    };

    // Переименуем для ясности, т.к. вызывается из GridActionsCellItem
    const handleEditAction = (id: string) => {
        const propertyToEdit = properties.find(p => p.id === id);
        if (propertyToEdit) {
            setEditingProperty(propertyToEdit);
            setIsModalOpen(true);
        }
    };

    // Переименуем для ясности
    const handleDeleteAction = (id: string) => {
        setPropertyToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProperty(null);
    };

    const handleSaveProperty = async (propertyData: Omit<IProperty, 'createdAt'>, propertyId?: string) => {
        setIsSaving(true);
        setError(null); // Сброс общей ошибки
        try {
            if (propertyId) {
                // --- РЕДАКТИРОВАНИЕ ---
                const propertyRef = doc(db, 'properties', propertyId);
                // Обновляем только имя
                await updateDoc(propertyRef, { name: propertyData.name });
                setSnackbarMessage('Property updated successfully!');
            } else {
                // --- СОЗДАНИЕ ---
                const propertyToAdd: IProperty = {
                    ...propertyData,
                    createdAt: Timestamp.now(),
                };
                await addDoc(propertiesCollectionRef, propertyToAdd);
                setSnackbarMessage('Property added successfully!');
            }
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            setIsModalOpen(false);
            setEditingProperty(null);
            fetchProperties(false); // Обновляем список без индикатора загрузки
        } catch (err) {
            console.error(`Error ${propertyId ? 'updating' : 'adding'} property: `, err);
            const errorMessage = err instanceof Error ? err.message : `Failed to ${propertyId ? 'update' : 'add'} property.`;
            // Показываем ошибку в Snackbar вместо общей ошибки над таблицей
            setSnackbarMessage(errorMessage);
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            // Оставляем модальное окно открытым в случае ошибки сохранения
            // setError(errorMessage); // Можно оставить и общую ошибку, если нужно
             throw err; // Передаем ошибку дальше, чтобы AddEditPropertyModal мог ее обработать
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseDeleteDialog = () => {
        setIsDeleteDialogOpen(false);
        setPropertyToDelete(null);
    };

    const handleConfirmDelete = async () => {
        if (!propertyToDelete) return;
        setError(null); // Сброс ошибки перед удалением
        try {
            const propertyRef = doc(db, 'properties', propertyToDelete);
            await deleteDoc(propertyRef);
            setSnackbarMessage('Property deleted successfully.');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            handleCloseDeleteDialog(); // Закрываем диалог
            fetchProperties(false); // Обновляем список
        } catch (err) {
            console.error("Error deleting property: ", err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete property.';
            setSnackbarMessage(errorMessage);
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            // Можно показать и общую ошибку
            // setError(`Delete Error: ${errorMessage}`);
            handleCloseDeleteDialog(); // Закрываем диалог даже при ошибке
        }
    };

    const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbarOpen(false);
    };

    // Определяем колонки, передавая обработчики
    const columns = defineColumns(handleEditAction, handleDeleteAction);

    // Начальная сортировка по имени
    const initialSortModel: GridSortModel = [
        {
            field: 'name',
            sort: 'asc',
        },
    ];

    return (
        <Box sx={{ p: 3, height: 'calc(100vh - 64px - 48px - 72px)', width: '100%' }}> {/* Адаптируем высоту под Layout */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                 <Typography variant="h5" component="h2">Property Management</Typography>
                 <Button
                    variant="contained"
                    onClick={handleAddPropertyClick}
                    disabled={isLoading} // Блокируем кнопку во время начальной загрузки
                >
                    Add New Property
                </Button>
            </Box>

            {/* Показываем ошибку загрузки данных */} 
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <AddEditPropertyModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveProperty}
                isSaving={isSaving}
                initialData={editingProperty}
            />

            <ConfirmationDialog
                open={isDeleteDialogOpen}
                onClose={handleCloseDeleteDialog}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
                message={`Are you sure you want to delete this property? This might affect existing bookings linked to it.`}
            />

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={4000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>

            {/* Используем DataGrid вместо Table */}
             <Paper sx={{ height: '100%', width: '100%' }}>
                <DataGrid
                    rows={properties} // Данные
                    columns={columns} // Определения колонок
                    loading={isLoading} // Индикатор загрузки
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    pageSizeOptions={[5, 10, 25]} // Варианты кол-ва строк на странице
                    initialState={{
                        pagination: {
                           paginationModel: { page: 0, pageSize: 10 },
                        },
                         sorting: {
                            sortModel: initialSortModel,
                        },
                    }}
                    slots={{ toolbar: GridToolbar }} // Добавляем панель инструментов
                    slotProps={{
                        toolbar: {
                            showQuickFilter: true, // Включаем быстрый поиск
                        },
                    }}
                    autoHeight={false} // Занимаем доступную высоту Paper
                    disableRowSelectionOnClick // Отключаем выделение строки по клику
                    // getRowClassName можно использовать для стилизации строк, если нужно
                     // localeText можно использовать для перевода текста DataGrid
                />
            </Paper>
        </Box>
    );

};

export default PropertyManagement; 