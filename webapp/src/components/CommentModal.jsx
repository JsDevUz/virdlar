import { useState } from 'react';

export function CommentModal({ virdKey, initialComment, onSave, onClose }) {
  const [text, setText] = useState(initialComment || '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Izoh</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ixtiyoriy izoh..."
          rows={4}
        />
        <div className="modal-actions">
          <button onClick={onClose}>Bekor</button>
          <button className="primary" onClick={() => onSave(virdKey, text)}>Saqlash</button>
        </div>
      </div>
    </div>
  );
}
