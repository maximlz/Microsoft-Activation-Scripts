import { ReactNode, useState } from 'react';
import { Outlet, useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { 
    AppBar, Toolbar, Typography, Button, Box, Container, CircularProgress, 
    Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, 
    CssBaseline, IconButton, Tooltip
} from '@mui/material';
import { styled, Theme, CSSObject } from '@mui/material/styles';
import { signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth'; // Удобный хук для получения состояния auth
import { auth } from '../config/firebaseConfig';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu'; // Иконка для открытия/закрытия меню
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'; // Иконка для закрытия
import { useTranslation } from 'react-i18next';
import ListAltIcon from '@mui/icons-material/ListAlt'; // Для Registrations
import PublicIcon from '@mui/icons-material/Public'; // Для Countries
import BookOnlineIcon from '@mui/icons-material/BookOnline'; // <-- Иконка для Bookings
import BusinessIcon from '@mui/icons-material/Business'; // <-- Иконка для Properties

interface AdminLayoutProps {
    children?: ReactNode; // Необязательно, т.к. будем использовать Outlet
}

const drawerWidthExpanded = 240;
const drawerWidthCollapsed = 60; // Ширина свернутого меню (только иконки)

// --- Стилизованный Drawer --- (Взято из документации MUI с адаптацией)
const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidthExpanded,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `${drawerWidthCollapsed}px`,
//   [theme.breakpoints.up('sm')]: {
//     width: `${drawerWidthCollapsed}px`, // Можно сделать разную ширину для разных экранов
//   },
});

const StyledDrawer = styled(Drawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidthExpanded, // Базовая ширина для расчета
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);
// --- Конец стилизованного Drawer ---

// --- Стилизованный Main Content Area --- 
const StyledMain = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })
(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  overflowX: 'hidden',
}));

// --- Стилизованный AppBar --- 
const StyledAppBar = styled(AppBar, { shouldForwardProp: (prop) => prop !== 'open' })<{ open?: boolean; }>
(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width'], { 
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  width: `calc(100% - ${drawerWidthCollapsed}px)`,
  ...(open && {
    width: `calc(100% - ${drawerWidthExpanded}px)`,
    transition: theme.transitions.create(['width'], { 
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

function AdminLayout({ children }: AdminLayoutProps) {
    const [user, loading, error] = useAuthState(auth);
    const navigate = useNavigate();
    const location = useLocation(); // Получаем текущий путь
    const { t } = useTranslation();
    const [open, setOpen] = useState(true); // Состояние для Drawer (изначально открыт)

    const handleDrawerToggle = () => {
        setOpen(!open);
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            // После выхода перенаправляем на страницу входа
            navigate('/admin/login');
        } catch (err) {
            console.error("Logout Error:", err);
            // Можно добавить обработку ошибок выхода
        }
    };

    // Пока идет загрузка состояния пользователя
    if (loading) {
        return (
            <Box className="flex-center-vh-100">
                <CircularProgress />
            </Box>
        );
    }

    // Если есть ошибка при загрузке пользователя (маловероятно здесь, но для полноты)
    if (error) {
        return (
            <Container className="container-mt-4">
                <Typography color="error">Error loading user information: {error.message}</Typography>
                {/* Можно добавить кнопку для повторной попытки или перехода на логин */}
            </Container>
        )
    }

    // Если пользователя нет (хотя ProtectedRoute должен был отсечь это)
    if (!user) {
        // Можно добавить <Navigate to="/admin/login" /> или null
        return null; 
    }

    // Навигационные элементы меню
    const menuItems = [
        { text: t('adminLayout.nav.bookings', 'Bookings'), path: '/admin/bookings', icon: <BookOnlineIcon /> }, 
        { text: t('adminLayout.nav.registrations', 'Registrations'), path: '/admin', icon: <ListAltIcon /> },
        { text: t('adminLayout.nav.countries', 'Countries'), path: '/admin/countries', icon: <PublicIcon /> },
        { text: t('adminLayout.nav.properties', 'Properties'), path: '/admin/properties', icon: <BusinessIcon /> },
    ];

    // const currentDrawerWidth = open ? drawerWidthExpanded : drawerWidthCollapsed; // Больше не нужно здесь

    return (
        <Box className="admin-layout-root">
            <CssBaseline /> {/* Необходимо для корректного позиционирования AppBar/Drawer */}
            {/* Используем StyledAppBar */}
            <StyledAppBar position="fixed" open={open}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label={open ? "close drawer" : "open drawer"}
                        onClick={handleDrawerToggle}
                        edge="start"
                        sx={{ 
                            marginRight: 5, 
                            // Не нужно скрывать кнопку, когда открыто, просто меняем иконку
                        }}
                    >
                        {open ? <ChevronLeftIcon /> : <MenuIcon />}
                    </IconButton>

                    {/* Заголовок можно добавить сюда, если нужно */} 
                    {/* <Typography variant="h6" noWrap component="div">
                        Admin Panel
                    </Typography> */}

                    <Box className="toolbar-spacer" />

                    <Typography className="user-email-spacing">
                        {user.email}
                    </Typography>
                    <Button
                        color="inherit"
                        onClick={handleLogout}
                        startIcon={<LogoutIcon />}
                    >
                        {t('adminLayout.logout', 'Logout')}
                    </Button>
                </Toolbar>
            </StyledAppBar>
            {/* Используем StyledDrawer */} 
            <StyledDrawer variant="permanent" open={open}>
                {/* Добавляем пустой Toolbar или DrawerHeader для отступа */} 
                <Toolbar /> {/* Компенсация высоты AppBar */} 
                <List sx={{ pt: 0 }}> {/* Убираем верхний padding у List */}
                    {menuItems.map((item) => (
                        <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                            <Tooltip title={!open ? item.text : ""} placement="right">{/* Убираем пробел/перенос перед ListItemButton */} 
                            <ListItemButton
                                component={RouterLink}
                                to={item.path}
                                selected={location.pathname === item.path}
                                    // Стили для расположения иконки над текстом
                                    sx={{
                                        minHeight: 48,
                                        justifyContent: open ? 'initial' : 'center', // Центрируем иконку при сворачивании
                                        px: 2.5,
                                        flexDirection: 'column', // Иконка над текстом
                                        alignItems: 'center', // Центрируем по горизонтали
                                        py: 1 // Добавляем вертикальный padding
                                    }}
                                >
                                    <ListItemIcon
                                        sx={{
                                            minWidth: 0,
                                            justifyContent: 'center', // Центрируем иконку
                                            mb: open ? 0.5 : 0, // Отступ снизу у иконки, когда текст виден
                                        }}
                                    >
                                    {item.icon}
                                </ListItemIcon>
                                    {/* Текст показываем только когда меню открыто */} 
                                    <ListItemText primary={item.text} sx={{ opacity: open ? 1 : 0, textAlign: 'center' }} />
                            </ListItemButton>
                            {/* Убираем пробел/перенос после ListItemButton */}</Tooltip>
                        </ListItem>
                    ))}
                </List>
            </StyledDrawer>
             {/* Добавляем key, зависящий от open */}
            <StyledMain>
                 <Toolbar /> 
                 <Box className="admin-content-wrapper">
                {children ? children : <Outlet />}
                </Box>
                <Box component="footer" className="admin-footer">
                    <Typography variant="body2" color="text.secondary" align="center">
                        {'© '} {new Date().getFullYear()} Admin Panel
                    </Typography>
                </Box>
            </StyledMain>
        </Box>
    );
}

export default AdminLayout; 