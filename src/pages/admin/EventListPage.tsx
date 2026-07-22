import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { LogOut, Plus, QrCode } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useEvents, type Event } from '../../hooks/useEvents';
import { CreateEventModal } from './CreateEventModal';
import { QrModal } from './QrModal';
import { StorageBar } from './StorageBar';

export function EventListPage() {
  const { events, loading, error } = useEvents();
  const [createOpen, setCreateOpen] = useState(false);
  const [qrEvent, setQrEvent] = useState<Event | null>(null);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="bg-surface border-b border-ink-300 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-semibold text-ink-900">Wydarzenia</h1>
        <button
          onClick={() => signOut(auth)}
          aria-label="Wyloguj się"
          className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition-colors"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Wyloguj
        </button>
      </header>

      <main className="p-4 sm:p-6 max-w-4xl mx-auto">
        <StorageBar />

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <p className="text-sm text-ink-500">{loading ? 'Ładowanie…' : `${events.length} wydarzeń`}</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 py-3 px-6 bg-accent-600 text-white rounded-full text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Stwórz wydarzenie
          </button>
        </div>

        {error && (
          <p className="text-error-600 text-sm mb-4" role="alert">
            {error}
          </p>
        )}

        {!loading && events.length === 0 ? (
          <div className="text-center py-24 flex flex-col items-center gap-4">
            <p className="text-ink-500 text-sm">Nie masz jeszcze żadnych wydarzeń.</p>
            <button
              onClick={() => setCreateOpen(true)}
              className="py-3 px-6 bg-accent-600 text-white rounded-full text-sm font-medium"
            >
              Stwórz pierwsze wydarzenie
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => (
              <EventCard key={event.id} event={event} onGenerateQr={() => setQrEvent(event)} />
            ))}
          </div>
        )}
      </main>

      {createOpen && <CreateEventModal onClose={() => setCreateOpen(false)} onCreated={() => setCreateOpen(false)} />}
      {qrEvent && <QrModal event={qrEvent} onClose={() => setQrEvent(null)} />}
    </div>
  );
}

function EventCard({ event, onGenerateQr }: { event: Event; onGenerateQr: () => void }) {
  const created = new Date(event.createdAt).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-surface rounded-2xl border border-ink-300 p-5 flex flex-col gap-4 shadow-sm">
      <div className="min-w-0">
        <h2 className="font-semibold text-ink-900 truncate">{event.name}</h2>
        <p className="text-xs text-ink-500 mt-1">
          {event.eventDate ? `${event.eventDate} · ` : ''}Utworzono {created}
        </p>
      </div>
      <div className="flex flex-col gap-2 mt-auto">
        <Link
          to={`/admin/${event.slug}`}
          className="w-full text-center py-2.5 bg-accent-600 text-white rounded-full text-sm font-medium"
        >
          Wejdź do albumu
        </Link>
        <div>
          <button
            onClick={onGenerateQr}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-ink-300 text-ink-700 rounded-full text-sm hover:bg-canvas transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
            Generuj QR
          </button>
          <p className="text-[11px] text-ink-500 mt-1 text-center">Kod dla gości do dodawania zdjęć</p>
        </div>
      </div>
    </div>
  );
}
