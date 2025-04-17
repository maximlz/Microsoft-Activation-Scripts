import React from 'react';
import { Container, Typography, Paper, Box, Button, Divider, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LanguageSwitcher from './LanguageSwitcher';
import HomeIcon from '@mui/icons-material/Home';

const RegistrationSuccess: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Container maxWidth="md" sx={{ my: 4 }}>
      {/* Шапка с языковым переключателем */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">{t('registrationSuccess.title', 'Registration Completed')}</Typography>
        <LanguageSwitcher />
      </Box>

      {/* Основной контент */}
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          borderRadius: 2,
          backgroundColor: theme.palette.background.paper,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Декоративный элемент */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '8px',
            background: 'linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%)',
          }}
        />
        
        {/* Иконка успеха */}
        <CheckCircleOutlineIcon 
          sx={{ 
            fontSize: 80, 
            color: 'success.main',
            mb: 2
          }} 
        />
        
        <Typography 
          variant="h4" 
          component="h2" 
          align="center"
          sx={{ 
            mb: 2,
            fontWeight: 'bold',
            color: 'text.primary'
          }}
        >
          {t('registrationSuccess.heading', 'Thank You!')}
        </Typography>
        
        <Typography 
          variant="h6" 
          component="p" 
          align="center"
          sx={{ 
            mb: 3,
            color: 'text.secondary'
          }}
        >
          {t('registrationSuccess.message', 'Your registration has been completed successfully.')}
        </Typography>
        
        <Divider sx={{ width: '80%', my: 2 }} />
        
        <Typography 
          variant="body1" 
          align="center"
          sx={{ 
            mb: 4,
            maxWidth: '80%',
            color: 'text.secondary'
          }}
        >
          {t('registrationSuccess.details', 'You will receive a confirmation email with your registration details. If you have any questions, please contact the property manager.')}
        </Typography>
        
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<HomeIcon />}
          onClick={() => navigate('/')}
          sx={{ 
            mt: 2,
            py: 1,
            px: 4,
            borderRadius: 2,
            fontWeight: 'medium'
          }}
        >
          {t('registrationSuccess.homeButton', 'Return to Home')}
        </Button>
      </Paper>
    </Container>
  );
};

export default RegistrationSuccess; 