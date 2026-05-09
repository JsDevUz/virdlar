import { useState, useEffect } from 'react';
import { VirdlarPage } from './pages/VirdlarPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';

export default function App() {
  const [page, setPage] = useState('virdlar');
  const [tgUser, setTgUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map(Number);

    if (tg?.initData) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      setTgUser(user);
      setIsAdmin(adminIds.includes(user?.id));
    } else if (import.meta.env.DEV) {
      // Brauzerda lokal test uchun mock user
      const devId = Number(import.meta.env.VITE_DEV_USER_ID || 0);
      const devUser = { id: devId, first_name: import.meta.env.VITE_DEV_USER_NAME || 'DevXonim' };
      setTgUser(devUser);
      setIsAdmin(adminIds.includes(devId));
    }
  }, []);

  if (page === 'admin') {
    return <AdminPage onBack={() => setPage('virdlar')} />;
  }

  return (
    <VirdlarPage
      tgUser={tgUser}
      isAdmin={isAdmin}
      onAdminClick={() => setPage('admin')}
    />
  );
}
