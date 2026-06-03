import { useState, useEffect } from 'react';
import { api } from '../api.js';

function UserRow({ user, filter, onUserUpdate, VIRDLAR }) {
  const [open, setOpen] = useState(false);
  const [virdlar, setVirdlar] = useState([]);
  const [commentModal, setCommentModal] = useState(null);
  const [customName, setCustomName] = useState(user.custom_name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCustomName(user.custom_name || '');
  }, [user.custom_name]);

  useEffect(() => {
    if (!open) return;
    const date = `${filter.year}-${String(filter.month).padStart(2,'0')}-${String(filter.day).padStart(2,'0')}`;
    api.getAdminVirdlar({ user_id: user.id, date }).then(setVirdlar);
  }, [open, filter, user.id]);

  const recordMap = Object.fromEntries(virdlar.map(r => [r.vird_key, r]));
  const doneCount = virdlar.filter(r => r.status === 'done').length;
  const displayName = user.display_name || user.custom_name || user.first_name;

  async function saveUser(patch = {}) {
    setSaving(true);
    try {
      const updated = await api.updateUser(user.id, {
        custom_name: customName,
        is_banned: Boolean(user.is_banned),
        exclude_from_report: Boolean(user.exclude_from_report),
        ...patch,
      });
      onUserUpdate(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={`user-accordion-row ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className="user-acc-name">
          {displayName}
          {user.custom_name && <small>{user.first_name}</small>}
        </span>
{user.is_banned ? <span className="user-badge banned">Ban</span> : null}
        {user.exclude_from_report ? <span className="user-badge hidden">Hisobdan yashirin</span> : null}
        {open && <span className="user-acc-count">{doneCount}/{VIRDLAR.length} ✅</span>}
        <span className="user-acc-arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="user-virdlar-panel">
          <div className="user-admin-controls" onClick={e => e.stopPropagation()}>
            <label>
              <span>Ko'rinadigan nom</span>
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                onBlur={() => saveUser()}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                placeholder={user.first_name}
                disabled={saving}
              />
            </label>
            <label className="check-control">
              <input
                type="checkbox"
                checked={Boolean(user.is_banned)}
                disabled={saving}
                onChange={e => saveUser({ is_banned: e.target.checked })}
              />
              <span>Botdan taqiqlash</span>
            </label>
            <label className="check-control">
              <input
                type="checkbox"
                checked={Boolean(user.exclude_from_report)}
                disabled={saving}
                onChange={e => saveUser({ exclude_from_report: e.target.checked })}
              />
              <span>Hisobotda ko'rsatmaslik</span>
            </label>

          </div>
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

function VirdlarConfigTab() {
  const [list, setList] = useState([]);
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => api.getVirdlarConfigAdmin().then(setList);
  useEffect(() => { reload(); }, []);

  async function add() {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      await api.addVirdConfig(label);
      setNewLabel('');
      await reload();
    } finally { setBusy(false); }
  }

  async function rename(id, label) {
    await api.updateVirdConfig(id, { label });
    await reload();
  }

  async function toggleActive(id, isActive) {
    await api.updateVirdConfig(id, { is_active: isActive });
    await reload();
  }

  async function move(id, direction) {
    await api.moveVirdConfig(id, direction);
    await reload();
  }

  return (
    <div className="vird-config-list">
      <div className="vird-config-add">
        <input
          placeholder="Masalan: 📿 Yangi vird"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          disabled={busy}
        />
        <button onClick={add} disabled={busy || !newLabel.trim()}>Qo'shish</button>
      </div>
      {list.map((v, i) => (
        <VirdConfigRow
          key={v.id}
          vird={v}
          isFirst={i === 0}
          isLast={i === list.length - 1}
          onRename={label => rename(v.id, label)}
          onToggleActive={active => toggleActive(v.id, active)}
          onMove={dir => move(v.id, dir)}
        />
      ))}
    </div>
  );
}

function VirdConfigRow({ vird, isFirst, isLast, onRename, onToggleActive, onMove }) {
  const [label, setLabel] = useState(vird.label);
  useEffect(() => { setLabel(vird.label); }, [vird.label]);
  return (
    <div className={`vird-config-row ${vird.is_active ? '' : 'inactive'}`}>
      <div className="vird-config-order">
        <button onClick={() => onMove('up')} disabled={isFirst}>▲</button>
        <button onClick={() => onMove('down')} disabled={isLast}>▼</button>
      </div>
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={() => label.trim() && label !== vird.label && onRename(label.trim())}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      <label className="check-control">
        <input
          type="checkbox"
          checked={Boolean(vird.is_active)}
          onChange={e => onToggleActive(e.target.checked)}
        />
        <span>Aktiv</span>
      </label>
    </div>
  );
}

export function AdminPage({ onBack }) {
  const now = new Date();
  const [users, setUsers] = useState([]);
  const [VIRDLAR, setVirdlar] = useState([]);
  const [tab, setTab] = useState('users');
  const [filter, setFilter] = useState({
    year:  now.getFullYear(),
    month: now.getMonth() + 1,
    day:   now.getDate(),
  });

  useEffect(() => {
    api.getUsers().then(setUsers);
    api.getVirdlarConfig().then(setVirdlar);
  }, [tab]);

  function updateUser(updated) {
    setUsers(list => list.map(user => user.id === updated.id ? updated : user));
  }

  const years  = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days   = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="page admin-page">
      <header className="page-header">
        <button onClick={onBack}>← Orqaga</button>
        <h2>Admin panel</h2>
        {tab === 'users' && (
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
        )}
      </header>

      <div className="admin-tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Foydalanuvchilar</button>
        <button className={tab === 'virdlar' ? 'active' : ''} onClick={() => setTab('virdlar')}>Virdlar</button>
      </div>

      {tab === 'users' && (
        <div className="accordion-list">
          {users.length === 0 && <p className="hint">Foydalanuvchilar yo'q</p>}
          {users.map(u => (
            <UserRow key={u.id} user={u} filter={filter} onUserUpdate={updateUser} VIRDLAR={VIRDLAR} />
          ))}
        </div>
      )}

      {tab === 'virdlar' && <VirdlarConfigTab />}
    </div>
  );
}
