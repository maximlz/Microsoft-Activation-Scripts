import { useState, useEffect, ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { Box, CircularProgress, Container, Typography, Alert } from '@mui/material';

interface ProtectedRouteProps {
  children?: ReactNode; // Для использования с вложенными маршрутами, если понадобится
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isAuthorizedDomain, setIsAuthorizedDomain] = useState<boolean>(false);

  useEffect(() => {
    // Слушатель изменения состояния аутентификации
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Проверяем домен почты
        const emailDomain = currentUser.email?.split('@')[1];
        setIsAuthorizedDomain(emailDomain === 'artbutton.com');
      } else {
        setIsAuthorizedDomain(false); // Сбрасываем, если пользователя нет
      }
      setLoading(false);
      setAuthChecked(true); // Отмечаем, что проверка аутентификации завершена
    });

    // Отписываемся при размонтировании компонента
    return () => unsubscribe();
  }, []);

  if (loading || !authChecked) {
    // Показываем индикатор загрузки, пока идет проверка
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    // Если пользователь не аутентифицирован, перенаправляем на страницу входа
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAuthorizedDomain) {
    // Если пользователь аутентифицирован, но домен неверный
    console.warn(`Access denied for user: ${user.email}. Incorrect domain.`);
    // Можно показать сообщение или перенаправить на главную
    // return <Navigate to="/" replace />;
    // Или показать сообщение об отказе в доступе
    return (
        <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="h5" gutterBottom>
                Access Denied
            </Typography>
            <Alert severity="error">
                Your account ({user.email}) does not have permission to access this area.
            </Alert>
            {/* Можно добавить кнопку для выхода или возврата */}
        </Container>
    );
  }

  // Если пользователь аутентифицирован и домен верный,
  // рендерим дочерний компонент (переданный через element в Route)
  // или Outlet для вложенных маршрутов
  return children ? <>{children}</> : <Outlet />;
}

export default ProtectedRoute; 