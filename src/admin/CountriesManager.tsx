import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    TextField,
    CircularProgress,
    Alert,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    DialogContentText,
    Snackbar,
    Paper,
    Typography
} from '@mui/material';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Country } from '../types/guestTypes';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { DataGrid, GridColDef, GridToolbar, GridActionsCellItem, GridSortModel } from '@mui/x-data-grid';

interface CountryModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (countryData: Omit<Country, 'id'>, countryId?: string) => Promise<void>;
    isSaving: boolean;
    initialData: Country | null;
}

const CountryModal: React.FC<CountryModalProps> = ({ open, onClose, onSave, isSaving, initialData }) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData && open) {
            setName(initialData.name);
            setCode(initialData.code);
            setFormError(null);
        } else if (!open) {
            setName('');
            setCode('');
            setFormError(null);
        }
    }, [initialData, open]);

    const handleSave = async () => {
        if (!name.trim() || !code.trim()) {
            setFormError('Both Country Name and Code are required.');
            return;
        }
        try {
            await onSave({ name: name.trim(), code: code.trim().toUpperCase() }, initialData?.id);
        } catch (err: any) {
            setFormError(err.message || 'Failed to save country.');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{initialData ? 'Edit Country' : 'Add New Country'}</DialogTitle>
            <DialogContent>
                {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                <TextField
                    autoFocus
                    margin="dense"
                    label="Country Name"
                    fullWidth
                    variant="outlined"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
                <TextField
                    margin="dense"
                    label="Country Code (2 letters)"
                    fullWidth
                    variant="outlined"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
                    required
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving} variant="contained">
                    {isSaving ? <CircularProgress size={24} /> : (initialData ? 'Save Changes' : 'Add Country')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

interface ConfirmationDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
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
                <DialogContentText>
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

const countriesCollectionRef = collection(db, 'countries');

const defineColumns = (
    editHandler: (id: string) => void,
    deleteHandler: (id: string) => void
): GridColDef<Country>[] => [
    {
        field: 'name',
        headerName: 'Country Name',
        flex: 1,
        minWidth: 200,
    },
    {
        field: 'code',
        headerName: 'Country Code',
        width: 150,
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

const CountriesManager: React.FC = () => {
    const [countries, setCountries] = useState<Country[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCountry, setEditingCountry] = useState<Country | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [countryToDelete, setCountryToDelete] = useState<string | null>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);
    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

    const fetchCountries = useCallback(async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        setError(null);
        try {
            const q = query(countriesCollectionRef, orderBy('name', 'asc'));
            const data = await getDocs(q);
            const fetchedCountries = data.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name as string,
                code: doc.data().code as string
            }));
            setCountries(fetchedCountries);
        } catch (err) {
            console.error("Error fetching countries: ", err);
            setError(err instanceof Error ? err.message : 'Failed to load countries.');
        } finally {
            if (showLoading) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCountries();
    }, [fetchCountries]);

    const handleAddClick = () => {
        setEditingCountry(null);
        setIsModalOpen(true);
    };

    const handleEditAction = (id: string) => {
        const countryToEdit = countries.find(c => c.id === id);
        if (countryToEdit) {
            setEditingCountry(countryToEdit);
            setIsModalOpen(true);
        }
    };

    const handleDeleteAction = (id: string) => {
        setCountryToDelete(id);
        setIsConfirmOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCountry(null);
    };

    const handleSaveCountry = async (countryData: Omit<Country, 'id'>, countryId?: string) => {
        setIsSaving(true);
        try {
            if (countryId) {
                const countryRef = doc(db, 'countries', countryId);
                await updateDoc(countryRef, countryData);
                setSnackbar({ open: true, message: 'Country updated successfully!', severity: 'success' });
            } else {
                await addDoc(countriesCollectionRef, countryData);
                setSnackbar({ open: true, message: 'Country added successfully!', severity: 'success' });
            }
            setIsModalOpen(false);
            setEditingCountry(null);
            fetchCountries(false);
        } catch (err: any) {
            console.error(`Error ${countryId ? 'updating' : 'adding'} country: `, err);
            const message = err.message || `Failed to ${countryId ? 'update' : 'add'} country.`;
            throw new Error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (countryToDelete) {
            try {
                const countryRef = doc(db, 'countries', countryToDelete);
                await deleteDoc(countryRef);
                setSnackbar({ open: true, message: 'Country deleted successfully.', severity: 'success' });
                setCountryToDelete(null);
                fetchCountries(false);
            } catch (err) {
                console.error("Error deleting country: ", err);
                setSnackbar({ open: true, message: 'Failed to delete country.', severity: 'error' });
            }
            setIsConfirmOpen(false);
        }
    };

    const handleCloseConfirm = () => {
        setIsConfirmOpen(false);
        setCountryToDelete(null);
    };

    const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar(null);
    };

    const columns = defineColumns(handleEditAction, handleDeleteAction);

    const initialSortModel: GridSortModel = [
        {
            field: 'name',
            sort: 'asc',
        },
    ];

    return (
        <Box sx={{ p: 3, height: 'calc(100vh - 64px - 48px - 72px)', width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" component="h2">Countries Management</Typography>
                <Button variant="contained" onClick={handleAddClick} disabled={isLoading}>
                    Add New Country
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <CountryModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveCountry}
                isSaving={isSaving}
                initialData={editingCountry}
            />

            <ConfirmationDialog
                open={isConfirmOpen}
                onClose={handleCloseConfirm}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
                message="Are you sure you want to delete this country?"
            />

            <Snackbar
                open={snackbar?.open ?? false}
                autoHideDuration={4000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar?.severity ?? 'info'} sx={{ width: '100%' }}>
                    {snackbar?.message}
                </Alert>
            </Snackbar>

            <Paper sx={{ height: '100%', width: '100%' }}>
                <DataGrid
                    className="admin-data-grid"
                    rows={countries}
                    columns={columns}
                    loading={isLoading}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    pageSizeOptions={[5, 10, 25, 50]}
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

export default CountriesManager; 