import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { createEvent, SlugTakenError } from '../../hooks/useEvents';

export function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await createEvent(name, eventDate.trim() || null);
      onCreated();
    } catch (err) {
      if (err instanceof SlugTakenError) {
        setError(err.message);
      } else {
        console.error('Nie udało się utworzyć wydarzenia:', err);
        setError('Nie udało się utworzyć wydarzenia. Spróbuj ponownie.');
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Stwórz wydarzenie"
        className="relative bg-surface rounded-2xl shadow-lg max-w-sm w-full p-6 outline-none"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Zamknij"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-canvas transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <h2 className="text-lg font-semibold text-ink-900 mb-4">Stwórz wydarzenie</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="event-name" className="block text-sm text-ink-700 mb-1.5">
              Nazwa wydarzenia
            </label>
            <input
              ref={inputRef}
              id="event-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="np. Ania & Marek"
              maxLength={80}
              required
              className="w-full py-2.5 px-3 rounded-xl border border-ink-300 text-sm text-ink-900 placeholder:text-ink-500 focus:outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100"
            />
          </div>

          <div>
            <label htmlFor="event-date" className="block text-sm text-ink-700 mb-1.5">
              Data wydarzenia (opcjonalnie)
            </label>
            <input
              id="event-date"
              type="text"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              placeholder="np. 14 czerwca 2026"
              maxLength={60}
              className="w-full py-2.5 px-3 rounded-xl border border-ink-300 text-sm text-ink-900 placeholder:text-ink-500 focus:outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100"
            />
          </div>

          {error && (
            <p className="text-error-600 text-sm" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="py-3 bg-accent-600 text-white rounded-full text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Tworzenie...' : 'Stwórz wydarzenie'}
          </button>
        </form>
      </div>
    </div>
  );
}
