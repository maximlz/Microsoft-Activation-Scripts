import { useState } from 'react';
import { Box, Typography, Alert, CircularProgress, Paper, Link, Snackbar } from '@mui/material';
import { DataGrid, GridColDef, GridToolbar, GridActionsCellItem, GridSortModel, GridRowClassNameParams } from '@mui/x-data-grid';
import { collection, query, orderBy, Timestamp, FirestoreDataConverter, SnapshotOptions, DocumentData, WithFieldValue, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { db } from '../config/firebaseConfig';
import { useTranslation } from 'react-i18next';
import { IGuestFormData, IGuestFormDataWithId } from '../types/guestTypes';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RegistrationDetailsModal from './RegistrationDetailsModal';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { styled } from '@mui/material/styles';
import { format } from 'date-fns'; // Используем date-fns для надежного форматирования

// Добавляем export
export const guestConverter: FirestoreDataConverter<IGuestFormDataWithId> = {
    toFirestore(guestWithId: WithFieldValue<IGuestFormDataWithId>): DocumentData {
        const { id, ...dataToWrite } = guestWithId; // Используем деструктуризацию
        // Не нужно удалять id, так как мы его исключили при деструктуризации
        return dataToWrite;
    },
    fromFirestore(snapshot: DocumentData, options: SnapshotOptions): IGuestFormDataWithId {
        const data = snapshot.data(options)!;
        // Добавляем bookingConfirmationCode
        return {
            id: snapshot.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            secondLastName: data.secondLastName,
            birthDate: data.birthDate || '',
            nationality: data.nationality || '',
            sex: data.sex || '',
            documentType: data.documentType || '',
            documentNumber: data.documentNumber || '',
            documentSupNum: data.documentSupNum,
            phone: data.phone || '',
            email: data.email || '',
            countryResidence: data.countryResidence || '',
            residenceAddress: data.residenceAddress || '',
            city: data.city || '',
            postcode: data.postcode || '',
            visitDate: data.visitDate || '',
            countryCode: data.countryCode,
            bookingConfirmationCode: data.bookingConfirmationCode, // <-- Добавляем код бронирования
            timestamp: data.timestamp, // timestamp остается
        } as IGuestFormDataWithId;
    }
};

// Добавляем export
export const formatDateDDMMYYYY = (dateInput: Timestamp | string | undefined | null): string => {
    if (!dateInput) return '-';
    try {
        const date = dateInput instanceof Timestamp ? dateInput.toDate() : new Date(dateInput);
        if (isNaN(date.getTime())) {
            return typeof dateInput === 'string' ? dateInput : '-';
        }
        return format(date, 'dd-MM-yyyy');
    } catch (e) {
        console.error("Error formatting date:", dateInput, e);
        return typeof dateInput === 'string' ? dateInput : '-';
    }
};

// Определяем колонки для DataGrid
const columns = (
    t: Function,
    viewHandler: (id: string) => void,
    editHandler: (id: string) => void,
    deleteHandler: (id: string) => void
): GridColDef[] => [
    {
        field: 'id',
        headerName: 'ID',
        width: 220,
        renderCell: (params) => (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                {params.value}
            </Typography>
        )
    },
    {
        field: 'timestamp',
        headerName: t('registrations.header.timestamp', 'Registration Date'),
        width: 170,
        valueGetter: (value: Timestamp | any) => formatDateDDMMYYYY(value),
    },
    { field: 'firstName', headerName: t('registrations.header.firstName', 'First Name'), width: 130 },
    { field: 'lastName', headerName: t('registrations.header.lastName', 'Last Name'), width: 150 },
    {
        field: 'bookingConfirmationCode',
        headerName: t('registrations.header.confCode', 'Conf. Code'),
        width: 130,
        renderCell: (params) => (
             <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                 {params.value || '-'} {/* Показываем прочерк, если кода нет */}
            </Typography>
        )
    },
    {
        field: 'email', headerName: t('registrations.header.email', 'Email'), width: 200,
        renderCell: (params) => (
            <Link href={`mailto:${params.value}`}>{params.value}</Link>
        ),
    },
    { field: 'phone', headerName: t('registrations.header.phone', 'Phone'), width: 150 },
    { field: 'nationality', headerName: t('registrations.header.nationality', 'Nationality'), width: 150 },
    {
        field: 'visitDate',
        headerName: t('registrations.header.visitDate', 'Visit Date'),
        width: 130,
        valueGetter: (value: string | any) => formatDateDDMMYYYY(value),
    },
    {
        field: 'actions',
        type: 'actions',
        headerName: t('registrations.header.actions', 'Actions'),
        width: 120,
        cellClassName: 'actions',
        getActions: ({ id }) => {
            const stringId = id as string;
            return [
                <GridActionsCellItem
                    icon={<VisibilityIcon />}
                    label={t('actions.view', 'View')}
                    onClick={() => viewHandler(stringId)}
                    color="inherit"
                />,
                <GridActionsCellItem
                    icon={<EditIcon />}
                    label={t('actions.edit', 'Edit')}
                    className="textPrimary"
                    onClick={() => editHandler(stringId)}
                    color="inherit"
                />,
                <GridActionsCellItem
                    icon={<DeleteIcon />}
                    label={t('actions.delete', 'Delete')}
                    onClick={() => deleteHandler(stringId)}
                    color="inherit"
                />,
            ];
        },
    },
];

// Стили для выделения строк
const StyledDataGrid = styled(DataGrid)(({ theme }) => ({
    '& .highlighted-row': {
        backgroundColor: theme.palette.action.hover, // Легкий фон для выделения
        // Можно добавить другие стили
    },
}));

function RegistrationsList() {
    const { t } = useTranslation();
    const guestsCollection = collection(db, 'guests').withConverter(guestConverter);
    const q = query(guestsCollection, orderBy('timestamp', 'desc'));
    const [guestsData, loading, error] = useCollectionData(q);
    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

    // Состояния для модального окна
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    // --> Состояние для Snackbar
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);
    // --> Состояние для диалога подтверждения
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);

    // --- Обработчики действий --- 
    const handleViewClick = (id: string) => {
        setSelectedRegistrationId(id);
        setIsEditMode(false);
        setModalOpen(true);
    };

    const handleEditClick = (id: string) => {
        setSelectedRegistrationId(id);
        setIsEditMode(true);
        setModalOpen(true);
    };

    // Открывает диалог подтверждения
    const handleDeleteRequest = (id: string) => {
        setItemToDeleteId(id);
        setConfirmDialogOpen(true);
    };

    // Вызывается при подтверждении в диалоге
    const handleConfirmDelete = async () => {
        if (itemToDeleteId) {
            try {
                await deleteDoc(doc(db, 'guests', itemToDeleteId));
                setSnackbar({ open: true, message: t('registrations.deleteSuccess', 'Registration deleted successfully.'), severity: 'success' });
                setItemToDeleteId(null);
            } catch (err) {
                console.error("Error deleting registration: ", err);
                setSnackbar({ open: true, message: t('registrations.deleteError', 'Error deleting registration.'), severity: 'error' });
                setItemToDeleteId(null);
            }
        }
        setConfirmDialogOpen(false); // Закрываем диалог в любом случае
    };

    // Закрывает диалог подтверждения
    const handleCloseConfirmDialog = () => {
        setConfirmDialogOpen(false);
        setItemToDeleteId(null);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedRegistrationId(null);
        setIsEditMode(false);
    };

    const handleSaveRegistration = async (id: string, data: IGuestFormData) => {
        const { id: guestId, timestamp, ...dataToUpdate } = data as IGuestFormDataWithId;
        console.log("Saving data for:", id, dataToUpdate);
        const docRef = doc(db, 'guests', id);
        try {
            await updateDoc(docRef, dataToUpdate);
            // Показываем Snackbar успеха
            setSnackbar({ open: true, message: t('registrations.saveSuccess', 'Registration updated successfully.'), severity: 'success' });
            handleCloseModal();
        } catch (err: any) { // Добавляем any тип временно
            console.error("Error updating registration: ", err);
            // Показываем Snackbar ошибки прямо здесь, не передавая наверх
            setSnackbar({ open: true, message: t('registrations.saveError', 'Error saving changes: ') + err.message, severity: 'error' });
            // throw err; // Ошибку больше не пробрасываем в модалку
        }
    };

    // Обработчик закрытия Snackbar
    const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar(null);
    };

    // Определяем начальное состояние сортировки
    const initialSortModel: GridSortModel = [
        {
            field: 'timestamp',
            sort: 'desc',
        },
    ];

    const tableColumns = columns(t, handleViewClick, handleEditClick, handleDeleteRequest);

    // Используем правильный тип GridRowClassNameParams и приведение типа для row
    const getRowClassName = (params: GridRowClassNameParams) => {
        // Приводим params.row к нашему типу данных
        const rowData = params.row as IGuestFormDataWithId;
        // Пример: выделяем регистрации из Испании
        return rowData.nationality === 'Spain' ? 'highlighted-row' : '';
    };

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    }

    if (error) {
        console.error("Error fetching guests: ", error);
        return <Alert severity="error" sx={{ mt: 2 }}>{t('registrations.errorLoading', 'Error loading registrations: ') + error.message}</Alert>;
    }

    return (
        <Paper sx={{ display: 'flex', flexDirection: 'column', minHeight: 400, height: '100%' /* Занимаем всю высоту Box */ }}>
            <Typography variant="h5" sx={{ p: 2 }}>
                {t('registrations.title', 'Guest Registrations')}
            </Typography>
            <Box sx={{ flexGrow: 1, width: '100%' }}>
                <StyledDataGrid
                    rows={guestsData || []}
                    columns={tableColumns}
                    loading={loading}
                    initialState={{
                        sorting: {
                            sortModel: initialSortModel,
                        },
                    }}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    pageSizeOptions={[5, 10, 25, 50]}
                    checkboxSelection
                    disableRowSelectionOnClick
                    slots={{ toolbar: GridToolbar }}
                    slotProps={{
                        toolbar: {
                            showQuickFilter: true,
                        },
                    }}
                    getRowClassName={getRowClassName}
                />
            </Box>
            <RegistrationDetailsModal
                open={modalOpen}
                onClose={handleCloseModal}
                registrationId={selectedRegistrationId}
                isEditMode={isEditMode}
                onSave={handleSaveRegistration}
            />
            {/* Snackbar для уведомлений */} 
            {snackbar && (
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={handleCloseSnackbar}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            )}
            {/* Диалог подтверждения удаления */} 
            <ConfirmationDialog
                open={confirmDialogOpen}
                onClose={handleCloseConfirmDialog}
                onConfirm={handleConfirmDelete}
                title={t('registrations.deleteConfirmTitle', 'Confirm Deletion')}
                message={t('registrations.deleteConfirmMessage', 'Are you sure you want to delete this registration? This action cannot be undone.')}
            />
        </Paper>
    );
}

export default RegistrationsList; 