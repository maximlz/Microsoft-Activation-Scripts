import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../config/firebaseConfig"; // Импортируем auth
import { Button, Container, Typography, Box, Alert } from "@mui/material";
import GoogleIcon from '@mui/icons-material/Google';
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";

function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setError(null); // Сбрасываем ошибку перед новой попыткой
    try {
      await signInWithPopup(auth, provider);
      // После успешного входа перенаправляем на /admin
      // В будущем здесь можно добавить проверку прав администратора
      navigate("/admin");
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      setError(t('login.googleError', "Login failed. Please try again.")); // Используем перевод
      // Обработка ошибок (например, всплывающее окно закрыто пользователем)
      // Можно добавить более специфичную обработку разных кодов ошибок Firebase
    }
  };

  return (
    <Container maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h5">
          {t('login.adminTitle', "Admin Panel Login")} {/* Используем перевод */}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
            {error}
          </Alert>
        )}
        <Button
          type="button"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          startIcon={<GoogleIcon />}
          onClick={handleGoogleLogin}
        >
          {t('login.signInWithGoogle', "Sign In with Google")} {/* Используем перевод */}
        </Button>
      </Box>
    </Container>
  );
}

export default LoginPage; 