import { useState, useEffect } from 'react';
import { UsersList } from '../components/UsersList.jsx';
import { api } from '../api.js';
import { VIRDLAR } from '../constants.js';

export function AdminPage({ onBack }) {
  const now = new Date();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [virdlar, setVirdlar] = useState([]);
  const [commentModal, setCommentModal] = useState(null);
  const [filter, setFilter] = useState({
    year:  now.getFullYear(),
    month: now.getMonth() + 1,
    day:   now.getDate(),
  });

  useEffect(() => { api.getUsers().then(setUsers); }, []);

  useEffect(() => {
    if (!selectedUser) return;
    const date = `${filter.year}-${String(filter.month).padStart(2,'0')}-${String(filter.day).padStart(2,'0')}`;
    api.getAdminVirdlar({ user_id: selectedUser.id, date }).then(setVirdlar);
  }, [selectedUser, filter]);

  const years  = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days   = Array.from({ length: 31 }, (_, i) => i + 1);

  const recordMap = Object.fromEntries(virdlar.map(r => [r.vird_key, r]));

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

      <div className="admin-body">
        <UsersList users={users} selectedId={selectedUser?.id} onSelect={setSelectedUser} />

        <main className="virdlar-table">
          {!selectedUser && <p className="hint">Foydalanuvchi tanlang</p>}
          {selectedUser && (
            <table>
              <thead>
                <tr>
                  <th>Vird</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {VIRDLAR.map(v => {
                  const rec = recordMap[v.key];
                  return (
                    <tr
                      key={v.key}
                      className={rec?.status === 'done' ? 'done' : rec ? 'not-done' : 'empty'}
                      onClick={() => rec?.comment && setCommentModal(rec.comment)}
                      style={{ cursor: rec?.comment ? 'pointer' : 'default' }}
                    >
                      <td>{v.label}</td>
                      <td>{rec?.status === 'done' ? '✅' : rec ? '—' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </main>
      </div>

      {commentModal && (
        <div className="modal-overlay" onClick={() => setCommentModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Izoh</h3>
            <p>{commentModal}</p>
            <button onClick={() => setCommentModal(null)}>Yopish</button>
          </div>
        </div>
      )}
    </div>
  );
}
