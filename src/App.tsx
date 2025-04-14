import { useState, useEffect } from 'react'; // Убираем React из импорта
import { Routes, Route } from 'react-router-dom'; // Импортируем Routes и Route
import { Container, Typography, Box, Alert, CircularProgress } from '@mui/material'; // Добавили Alert, CircularProgress
import GuestForm, { Country } from './components/GuestForm'; // Импортируем Country тоже
import LanguageSwitcher from './components/LanguageSwitcher'; // Импортируем LanguageSwitcher
import { useTranslation } from 'react-i18next'; // Импортируем хук
// Импорты Firestore для загрузки стран
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app'; // Импортируем FirebaseError
import { db } from './config/firebaseConfig';

// Статический ключ для ошибки загрузки стран
const FETCH_COUNTRIES_ERROR_KEY = 'errors.fetchCountriesGeneric';
const FETCH_COUNTRIES_PERMISSION_ERROR_KEY = 'errors.fetchCountriesPermission';

// Компонент для главной страницы
function HomePage() {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState<boolean>(true);
  const [countriesError, setCountriesError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        setLoadingCountries(true);
        setCountriesError(null); // Сбрасываем ошибку перед запросом
        const countriesCol = collection(db, 'countries');
        const q = query(countriesCol, orderBy('name', 'asc'));
        const countrySnapshot = await getDocs(q);
        const countryList = countrySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name as string,
          code: doc.data().code as string
        }));
        setCountries(countryList);
      } catch (error) {
        console.error("Error fetching countries: ", error);
        let errorMsgKey = FETCH_COUNTRIES_ERROR_KEY;
        if (error instanceof FirebaseError) {
            console.error(`Firestore Error Code: ${error.code}, Message: ${error.message}`);
             if (error.code === 'permission-denied') {
                errorMsgKey = FETCH_COUNTRIES_PERMISSION_ERROR_KEY;
             }
        }
        setCountriesError(t(errorMsgKey, 'Failed to load country list.'));
      } finally {
        setLoadingCountries(false);
      }
    };

    fetchCountries();
  }, [t]); // Зависимость от t добавлена

  const renderContent = () => {
    if (loadingCountries) {
      return (
        <Box className="flex-center">
          <CircularProgress />
        </Box>
      );
    }
    if (countriesError) {
      return <Alert severity="error" className="alert-margin">{countriesError}</Alert>;
    }
    return <GuestForm countries={countries} loadingCountries={false} />;
  };

  return (
    <Container maxWidth="md" className="container-margin">
      {/* Обертка для заголовка и переключателя языка */}
      <Box className="header-container">
        <Typography variant="h4" component="h1" className="title-centered">
          {t('formTitle')} {/* Используем перевод */}
        </Typography>
        <LanguageSwitcher /> {/* Добавили переключатель */}
      </Box>

      {/* Используем функцию для рендера контента */} 
      {renderContent()}
    </Container>
  );
}

// Компонент-заглушка для админ-панели
function AdminPage() {
  return (
    <Container>
      <Typography variant="h4">Admin Panel</Typography>
      <p>Здесь будет админ-панель.</p>
    </Container>
  );
}

// Основной компонент приложения с маршрутизацией
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin" element={<AdminPage />} /> {/* Маршрут для админки */} 
      {/* Можно добавить Route path="*" для страницы 404 */}
    </Routes>
  );
}

export default App;
