import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ConfirmationDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

function ConfirmationDialog({ open, onClose, onConfirm, title, message }: ConfirmationDialogProps) {
    const { t } = useTranslation();

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
                <Button onClick={onClose}>{t('actions.cancel', 'Cancel')}</Button>
                <Button onClick={onConfirm} color="primary" autoFocus>
                    {t('actions.confirm', 'Confirm')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default ConfirmationDialog; 