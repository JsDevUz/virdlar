import { useState, useEffect } from 'react';
import { VirdlarPage } from './pages/VirdlarPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';

function getGroupSlug() {
  return new URLSearchParams(window.location.search).get('g') || '';
}

export default function App() {
  const [page, setPage] = useState('virdlar');
  const [tgUser, setTgUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const slug = getGroupSlug();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const superAdminIds = (import.meta.env.VITE_SUPER_ADMIN_IDS || '').split(',').map(Number);

    if (tg?.initData) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      setTgUser(user);
      setIsSuperAdmin(superAdminIds.includes(user?.id));
    } else if (import.meta.env.DEV) {
      const devId = Number(import.meta.env.VITE_DEV_USER_ID || 0);
      const devUser = { id: devId, first_name: import.meta.env.VITE_DEV_USER_NAME || 'DevXonim' };
      setTgUser(devUser);
      setIsSuperAdmin(superAdminIds.includes(devId));
    }
  }, []);

  if (!slug && !isSuperAdmin) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Guruh ko'rsatilmagan.</p>
        <p>Bot orqali kiring.</p>
      </div>
    );
  }

  if (page === 'admin') {
    return <AdminPage isSuperAdmin={isSuperAdmin} onBack={() => setPage('virdlar')} />;
  }

  return (
    <VirdlarPage
      tgUser={tgUser}
      isAdmin={isAdmin}
      isSuperAdmin={isSuperAdmin}
      onAdminClick={() => setPage('admin')}
    />
  );
}
