import { useState, useEffect } from 'react';
import { VirdlarPage } from './pages/VirdlarPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';

export default function App() {
  const [page, setPage] = useState('virdlar');
  const [tgUser, setTgUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      setTgUser(user);
      const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map(Number);
      setIsAdmin(adminIds.includes(user?.id));
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
