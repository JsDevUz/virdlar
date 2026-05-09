import { useState, useEffect } from 'react';
import { VirdCard } from '../components/VirdCard.jsx';
import { CommentModal } from '../components/CommentModal.jsx';
import { api } from '../api.js';
import { VIRDLAR } from '../constants.js';

function getTodayStr() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tashkent' }).format(new Date());
}

function isLocked() {
  const hour = Number(
    new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Tashkent',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  );
  return hour >= 23;
}

export function VirdlarPage({ tgUser, isAdmin, onAdminClick }) {
  const today = getTodayStr();
  const locked = isLocked() || import.meta.env.VITE_FORCE_LOCKED === 'true';
  const [records, setRecords] = useState([]);
  const [loadingKey, setLoadingKey] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    api.getVirdlar(today).then(setRecords).catch(console.error);
  }, [today]);

  const recordMap = Object.fromEntries(records.map(r => [r.vird_key, r]));

  const showLockedToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  };

  const handleToggle = async (key, newStatus) => {
    setLoadingKey(key);
    try {
      const updated = await api.postVird({
        vird_key: key,
        date: today,
        status: newStatus,
        comment: recordMap[key]?.comment || ''
      });
      setRecords(prev => {
        const idx = prev.findIndex(r => r.vird_key === key);
        if (idx >= 0) return prev.map(r => r.vird_key === key ? updated : r);
        return [...prev, updated];
      });
    } finally {
      setLoadingKey(null);
    }
  };

  const handleSaveComment = async (key, comment) => {
    const updated = await api.postVird({
      vird_key: key,
      date: today,
      status: recordMap[key]?.status || 'done',
      comment
    });
    setRecords(prev => prev.map(r => r.vird_key === key ? updated : r));
    setModal(null);
  };

  const [y, m, d] = today.split('-');
  const dateLabel = `${d}.${m}.${y}`;

  return (
    <div className="page virdlar-page">
      <header className="page-header">
        <div>
          <div className="date">{dateLabel}</div>
          <div className="username">{tgUser?.first_name} xonim</div>
        </div>
        {isAdmin && (
          <button className="admin-btn" onClick={onAdminClick}>Admin</button>
        )}
      </header>

      {locked && (
        <div className="locked-banner">🔒 Bugungi virdlar yopildi</div>
      )}

      <div className="virdlar-grid">
        {VIRDLAR.map(vird => (
          <VirdCard
            key={vird.key}
            vird={vird}
            record={recordMap[vird.key]}
            onToggle={locked ? showLockedToast : handleToggle}
            onComment={(key, comment) => setModal({ key, comment })}
            disabled={locked}
            loading={loadingKey === vird.key}
          />
        ))}
      </div>

      {toast && (
        <div className="toast">🔒 Kechikdingiz! Virdlar yopilgan</div>
      )}

      {modal && (
        <CommentModal
          virdKey={modal.key}
          initialComment={modal.comment}
          onSave={handleSaveComment}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
