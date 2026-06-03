import { useState, useEffect } from 'react';
import { VirdlarPage } from './pages/VirdlarPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import { api } from './api.js';

function getGroupSlug() {
  return new URLSearchParams(window.location.search).get('g') || '';
}

export default function App() {
  const [page, setPage] = useState('virdlar');
  const [tgUser, setTgUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const slug = getGroupSlug();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const superAdminIds = (import.meta.env.VITE_SUPER_ADMIN_IDS || '').split(',').map(Number);

    let userId;
    if (tg?.initData) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      setTgUser(user);
      userId = user?.id;
      setIsSuperAdmin(superAdminIds.includes(userId));
    } else if (import.meta.env.DEV) {
      const devId = Number(import.meta.env.VITE_DEV_USER_ID || 0);
      const devUser = { id: devId, first_name: import.meta.env.VITE_DEV_USER_NAME || 'Dev' };
      setTgUser(devUser);
      userId = devId;
      setIsSuperAdmin(superAdminIds.includes(devId));
    }

    if (userId && slug) {
      api.getGroups().then(groups => {
        const group = groups.find(g => g.slug === slug);
        if (!group) return;
        const adminIds = (group.admin_ids || '').split(',').map(Number).filter(Boolean);
        setIsAdmin(superAdminIds.includes(userId) || adminIds.includes(userId));
      });
    } else if (superAdminIds.includes(userId)) {
      setIsAdmin(true);
    }

    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (!slug && !isSuperAdmin) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Guruh ko'rsatilmagan.</p>
        <p>Bot orqali kiring.</p>
      </div>
    );
  }

  // Slugsiz super-admin to'g'ridan admin paneliga
  if (!slug && isSuperAdmin) {
    return <AdminPage isSuperAdmin={true} onBack={null} />;
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
