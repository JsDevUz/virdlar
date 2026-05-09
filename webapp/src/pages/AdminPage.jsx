import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { VIRDLAR } from '../constants.js';

function UserRow({ user, filter }) {
  const [open, setOpen] = useState(false);
  const [virdlar, setVirdlar] = useState([]);
  const [commentModal, setCommentModal] = useState(null);

  useEffect(() => {
    if (!open) return;
    const date = `${filter.year}-${String(filter.month).padStart(2,'0')}-${String(filter.day).padStart(2,'0')}`;
    api.getAdminVirdlar({ user_id: user.id, date }).then(setVirdlar);
  }, [open, filter, user.id]);

  const recordMap = Object.fromEntries(virdlar.map(r => [r.vird_key, r]));
  const doneCount = virdlar.filter(r => r.status === 'done').length;

  return (
    <>
      <div className={`user-accordion-row ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className="user-acc-name">{user.first_name}</span>
        {open && <span className="user-acc-count">{doneCount}/{VIRDLAR.length} ✅</span>}
        <span className="user-acc-arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="user-virdlar-panel">
          {VIRDLAR.map(v => {
            const rec = recordMap[v.key];
            return (
              <div
                key={v.key}
                className={`vird-row ${rec?.status === 'done' ? 'done' : rec ? 'not-done' : 'empty'}`}
                onClick={() => rec?.comment && setCommentModal(rec.comment)}
                style={{ cursor: rec?.comment ? 'pointer' : 'default' }}
              >
                <span className="vird-row-label">{v.label}</span>
                <span className="vird-row-status">
                  {rec?.comment ? '💬 ' : ''}
                  {rec?.status === 'done' ? '✅' : rec ? '—' : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {commentModal && (
        <div className="modal-overlay" onClick={() => setCommentModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Izoh</h3>
            <p>{commentModal}</p>
            <button onClick={() => setCommentModal(null)}>Yopish</button>
          </div>
        </div>
      )}
    </>
  );
}

export function AdminPage({ onBack }) {
  const now = new Date();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState({
    year:  now.getFullYear(),
    month: now.getMonth() + 1,
    day:   now.getDate(),
  });

  useEffect(() => { api.getUsers().then(setUsers); }, []);

  const years  = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days   = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="page admin-page">
      <header className="page-header">
        <button onClick={onBack}>← Orqaga</button>
        <h2>Admin panel</h2>
        <div className="filters">
          <select value={filter.year}  onChange={e => setFilter(f => ({...f, year:  Number(e.target.value)}))}>
            {years.map(y  => <option key={y}  value={y}>{y}</option>)}
          </select>
          <select value={filter.month} onChange={e => setFilter(f => ({...f, month: Number(e.target.value)}))}>
            {months.map(m => <option key={m}  value={m}>{m}-oy</option>)}
          </select>
          <select value={filter.day}   onChange={e => setFilter(f => ({...f, day:   Number(e.target.value)}))}>
            {days.map(d   => <option key={d}  value={d}>{d}</option>)}
          </select>
        </div>
      </header>

      <div className="accordion-list">
        {users.length === 0 && <p className="hint">Foydalanuvchilar yo'q</p>}
        {users.map(u => (
          <UserRow key={u.id} user={u} filter={filter} />
        ))}
      </div>
    </div>
  );
}
