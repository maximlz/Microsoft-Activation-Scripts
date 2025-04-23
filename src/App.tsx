import { Routes, Route } from 'react-router-dom'; // Импортируем Routes и Route
import { Container, Typography, Box } from '@mui/material'; // Убрали Alert, CircularProgress
import { useTranslation } from 'react-i18next'; // Импортируем хук
import LoginPage from './admin/LoginPage'; // Импортируем LoginPage
import ProtectedRoute from './auth/ProtectedRoute'; // Импортируем ProtectedRoute
import AdminLayout from './admin/AdminLayout'; // Импортируем AdminLayout
import RegistrationsList from './admin/RegistrationsList'; // Импортируем RegistrationsList
import CountriesManager from './admin/CountriesManager'; // Импортируем CountriesManager
import BookingManagement from './admin/BookingManagement'; // <-- Добавляем импорт
import GuestRegistrationPage from './components/GuestRegistrationPage'; // <-- Импорт страницы регистрации гостя
import PropertyManagement from './admin/PropertyManagement'; // <-- Импорт нового компонента
import RegistrationSuccess from './components/RegistrationSuccess'; // <-- Импорт новой страницы успеха

// Компонент для главной страницы
function HomePage() {
  const { t } = useTranslation();

  return (
    <Container maxWidth="md" sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '80vh' 
    }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom>
          {t('welcomeTitle', 'Spain Guest Registration')} {/* Пример ключа перевода */}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          {t('welcomeSubtitle', 'Please use the registration link provided for your booking.')} {/* Пример ключа перевода */}
        </Typography>
        {/* Можно добавить кнопку для перехода на /admin/login */}
      </Box>
    </Container>
  );
}

// Основной компонент приложения с маршрутизацией
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/register/:token" element={<GuestRegistrationPage />} /> {/* <-- Публичный маршрут для регистрации */}
      <Route path="/registration-success" element={<RegistrationSuccess />} /> {/* <-- Новый маршрут для успешной регистрации */}
      <Route path="/admin/login" element={<LoginPage />} />
      {/* Защищаем маршрут /admin и используем AdminLayout */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        {/* Главная страница админки */}
        <Route index element={<RegistrationsList />} />
        {/* Маршрут для управления странами */}
        <Route path="countries" element={<CountriesManager />} />
        {/* Маршрут для управления бронированиями */}
        <Route path="bookings" element={<BookingManagement />} /> {/* <-- Добавляем маршрут */}
        {/* Маршрут для управления объектами */}
        <Route path="properties" element={<PropertyManagement />} />
        {/* Другие вложенные маршруты админки пойдут сюда */}
      </Route>
      {/* Можно добавить Route path="*" для страницы 404 */}
    </Routes>
  );
}

export default App;
