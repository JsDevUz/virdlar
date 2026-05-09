export function UsersList({ users, selectedId, onSelect }) {
  return (
    <aside className="users-list">
      {users.map(u => (
        <div
          key={u.id}
          className={`user-item ${u.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(u)}
        >
          {u.first_name}
        </div>
      ))}
    </aside>
  );
}
