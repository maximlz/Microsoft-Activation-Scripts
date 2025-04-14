import { ReactNode } from 'react';
import { Outlet, useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box, Container, CircularProgress, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, CssBaseline } from '@mui/material';
import { signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth'; // Удобный хук для получения состояния auth
import { auth } from '../config/firebaseConfig';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTranslation } from 'react-i18next';
import ListAltIcon from '@mui/icons-material/ListAlt'; // Для Registrations
import PublicIcon from '@mui/icons-material/Public'; // Для Countries

interface AdminLayoutProps {
    children?: ReactNode; // Необязательно, т.к. будем использовать Outlet
}

const drawerWidth = 240; // Ширина бокового меню

function AdminLayout({ children }: AdminLayoutProps) {
    const [user, loading, error] = useAuthState(auth);
    const navigate = useNavigate();
    const location = useLocation(); // Получаем текущий путь
    const { t } = useTranslation();

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
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    // Если есть ошибка при загрузке пользователя (маловероятно здесь, но для полноты)
    if (error) {
        return (
            <Container sx={{mt: 4}}>
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
        { text: t('adminLayout.nav.registrations', 'Registrations'), path: '/admin', icon: <ListAltIcon /> },
        { text: t('adminLayout.nav.countries', 'Countries'), path: '/admin/countries', icon: <PublicIcon /> },
    ];

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline /> {/* Необходимо для корректного позиционирования AppBar/Drawer */}
            <AppBar
                position="fixed" // Фиксируем AppBar
                // Смещаем AppBar вправо на ширину Drawer
                sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px` }}
            >
                <Toolbar>
                    <Box sx={{ flexGrow: 1 }} /> {/* Занимаем все пространство слева */}

                    <Typography sx={{ mr: 2 }}>
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
            </AppBar>
            <Drawer
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: drawerWidth,
                        boxSizing: 'border-box',
                    },
                }}
                variant="permanent" // Постоянный Drawer
                anchor="left"
            >
                <Toolbar /> {/* Добавляем пустой Toolbar для отступа сверху, равного высоте AppBar */}
                <List>
                    {menuItems.map((item) => (
                        <ListItem key={item.text} disablePadding>
                            <ListItemButton
                                component={RouterLink}
                                to={item.path}
                                // Выделяем активный пункт меню
                                selected={location.pathname === item.path}
                            >
                                <ListItemIcon>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText primary={item.text} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Drawer>
            <Box
                component="main"
                // Добавляем flexGrow и padding, учитываем высоту AppBar
                sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
            >
                <Toolbar /> {/* Отступ для контента под AppBar */}
                {children ? children : <Outlet />}
                <Box component="footer" sx={{ p: 2, mt: 'auto' }}>
                    <Typography variant="body2" color="text.secondary" align="center">
                        {'© '} {new Date().getFullYear()} Admin Panel
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}

export default AdminLayout; 