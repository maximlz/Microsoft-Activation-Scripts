import React from 'react';
import { Container, Typography, Paper, Button, Divider, Box, Icon } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HomeIcon from '@mui/icons-material/Home';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface RegistrationSuccessProps {
  bookingConfirmationCode?: string;
}

const RegistrationSuccess: React.FC<RegistrationSuccessProps> = ({ bookingConfirmationCode }) => {
  const { t } = useTranslation();

  return (
    <Container maxWidth="md" className="success-page-container">
      <Paper elevation={3} className="success-paper">
        <Box className="success-decorative-bar" />
        <Icon className="success-icon">
          <CheckCircleOutlineIcon fontSize="inherit" />
        </Icon>
        <Typography variant="h4" component="h2" align="center" className="success-heading">
          {t('registrationSuccess.heading')}
        </Typography>
        <Typography variant="body1" align="center" className="success-message">
          {t('registrationSuccess.message')}
        </Typography>
        <Divider variant="middle" className="success-divider" />
        <Typography variant="body2" align="center" className="success-details">
          {bookingConfirmationCode
            ? t('registrationSuccess.confirmationCode', { code: bookingConfirmationCode })
            : t('registrationSuccess.confirmationCodeMissing')}
            {' '}
            {t('registrationSuccess.nextSteps')}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<HomeIcon />}
          component={RouterLink}
          to="/"
          className="success-home-button"
        >
          {t('registrationSuccess.backHome')}
        </Button>
      </Paper>
    </Container>
  );
};

export default RegistrationSuccess; 