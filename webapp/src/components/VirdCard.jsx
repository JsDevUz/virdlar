export function VirdCard({ vird, record, onToggle, onComment, disabled, loading }) {
  const isDone = record?.status === 'done';

  return (
    <div
      className={`vird-card ${isDone ? 'done' : 'not-done'} ${disabled || loading ? 'disabled' : ''}`}
      onClick={() => !loading && onToggle(vird.key, isDone ? 'not_done' : 'done')}
    >
      {loading
        ? <span className="vird-spinner" />
        : <span className="vird-emoji">{vird.label.split(' ')[0]}</span>
      }
      <span className="vird-name">{vird.label.split(' ').slice(1).join(' ')}</span>
      {isDone && !loading && (
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
