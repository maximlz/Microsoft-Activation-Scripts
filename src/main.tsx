import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import './index.css'
import './i18n'; // Импортируем конфигурацию i18next

// Создаем базовую тему MUI (можно настроить позже)
const theme = createTheme({
  // Здесь можно добавить кастомизацию темы: palette, typography и т.д.
  // Например:
  // palette: {
  //   primary: {
  //     main: '#1976d2', // Синий цвет по умолчанию
  //   },
  // },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline /> {/* Сброс стилей браузера и применение базовых стилей MUI */}
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
