import { Box, Typography, Alert, CircularProgress, Paper, Button, Snackbar } from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { collection, query, orderBy, doc, addDoc, deleteDoc, FirestoreDataConverter, SnapshotOptions, DocumentData, WithFieldValue } from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { db } from '../config/firebaseConfig';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { useState } from 'react';
import ConfirmationDialog from '../components/ConfirmationDialog';
import AddCountryDialog from '../components/AddCountryDialog';
import { AddCountryFormData } from '../components/AddCountryDialog';

// Тип для страны
interface CountryData {
    id: string;
    name: string;
    code: string;
}

// Определяем конвертер для стран
const countryConverter: FirestoreDataConverter<CountryData> = {
    toFirestore(country: WithFieldValue<CountryData>): DocumentData {
        const { id, ...data } = country;
        return data;
    },
    fromFirestore(snapshot: DocumentData, options: SnapshotOptions): CountryData {
        const data = snapshot.data(options)!;
        return {
            id: snapshot.id,
            name: data.name || '',
            code: data.code || ''
        };
    }
};

function CountriesManager() {
    const { t } = useTranslation();
    const countriesCollection = collection(db, 'countries').withConverter(countryConverter);
    const q = query(countriesCollection, orderBy('name', 'asc'));
    const [countries, loading, error] = useCollectionData(q);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);
    const [addDialogOpen, setAddDialogOpen] = useState(false);

    // --- Обработчики для редактирования (пока заглушки) --- 
    const handleEditClick = (_id: string) => () => {
        alert("Edit functionality not yet implemented.");
    };

    const handleDeleteRequest = (id: string) => {
        setItemToDeleteId(id);
        setConfirmDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (itemToDeleteId) {
            try {
                await deleteDoc(doc(db, 'countries', itemToDeleteId));
                setSnackbar({ open: true, message: t('countriesManager.deleteSuccess', 'Country deleted successfully.'), severity: 'success' });
                setItemToDeleteId(null);
            } catch (err) {
                console.error("Error deleting country: ", err);
                setSnackbar({ open: true, message: t('countriesManager.deleteError', 'Error deleting country.'), severity: 'error' });
                setItemToDeleteId(null);
            }
        }
        setConfirmDialogOpen(false);
    };

    const handleCloseConfirmDialog = () => {
        setConfirmDialogOpen(false);
        setItemToDeleteId(null);
    };

    const handleOpenAddDialog = () => {
        setAddDialogOpen(true);
    };

    const handleCloseAddDialog = () => {
        setAddDialogOpen(false);
    };

    const handleAddCountry = async (data: AddCountryFormData) => {
        try {
            await addDoc(collection(db, "countries"), data);
            setSnackbar({ open: true, message: t('countriesManager.addSuccess', 'Country added successfully.'), severity: 'success' });
        } catch (err: any) {
            console.error("Error adding country: ", err);
            setSnackbar({ open: true, message: t('countriesManager.addError', 'Error adding country: ') + err.message, severity: 'error' });
            throw err;
        }
    };

    const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar(null);
    };

    // Возвращаем использование rowModesModel в getActions
    const tableColumns: GridColDef[] = [
        { field: 'name', headerName: t('countriesManager.header.name', 'Name'), width: 300, editable: true },
        { field: 'code', headerName: t('countriesManager.header.code', 'Code'), width: 100, editable: true },
        {
            field: 'actions',
            type: 'actions',
            headerName: t('countriesManager.header.actions', 'Actions'),
            width: 100,
            cellClassName: 'actions',
            getActions: ({ id }) => {
                return [
                    <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={handleEditClick(id as string)} color="inherit"/>,
                    <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={() => handleDeleteRequest(id as string)} color="inherit"/>,
                ];
            },
        },
    ];

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    }

    if (error) {
        console.error("Error fetching countries: ", error);
        return <Alert severity="error" sx={{ mt: 2 }}>{t('countriesManager.errorLoading', 'Error loading countries: ') + error.message}</Alert>;
    }

    return (
        <Paper sx={{ display: 'flex', flexDirection: 'column', minHeight: 400, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                <Typography variant="h5">
                    {t('countriesManager.title', 'Manage Countries')}
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleOpenAddDialog}
                >
                    {t('countriesManager.addButton', 'Add Country')}
                </Button>
            </Box>
            <Box sx={{ flexGrow: 1, width: '100%' }}>
                <DataGrid
                    rows={countries || []}
                    columns={tableColumns}
                    loading={loading}
                />
            </Box>
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
            <ConfirmationDialog
                open={confirmDialogOpen}
                onClose={handleCloseConfirmDialog}
                onConfirm={handleConfirmDelete}
                title={t('countriesManager.deleteConfirmTitle', 'Confirm Deletion')}
                message={t('countriesManager.deleteConfirmMessage', 'Are you sure you want to delete this country? This action cannot be undone.')}
            />
            <AddCountryDialog
                open={addDialogOpen}
                onClose={handleCloseAddDialog}
                onAdd={handleAddCountry}
            />
        </Paper>
    );
}

export default CountriesManager; 