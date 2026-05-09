export function VirdCard({ vird, record, onToggle, onComment, disabled }) {
  const isDone = record?.status === 'done';

  return (
    <div
      className={`vird-card ${isDone ? 'done' : 'not-done'} ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && onToggle(vird.key, isDone ? 'not_done' : 'done')}
    >
      <span className="vird-emoji">{vird.label.split(' ')[0]}</span>
      <span className="vird-name">{vird.label.split(' ').slice(1).join(' ')}</span>
      {isDone && (
        <button
          className="comment-btn"
          onClick={(e) => { e.stopPropagation(); onComment(vird.key, record?.comment); }}
        >
          💬
        </button>
      )}
    </div>
  );
}
