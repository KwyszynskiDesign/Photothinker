import { useEffect, useState, type ReactNode } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { RefreshCw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { LEGACY_EVENT_NAME, LEGACY_EVENT_DATE, LEGACY_EVENT_SLUG } from '../../lib/legacyEvent';

const BATCH_LIMIT = 500;

type CheckState = 'checking' | 'needed' | 'not-needed' | 'error';

// Bramka wyświetlana raz, dopóki istniejące zdjęcia z pilota nie mają eventId.
// Po migracji wydarzenie-legacy istnieje w Firestore i ten komponent nigdy więcej się nie pokazuje.
export function LegacyMigrationGate({ children }: { children: ReactNode }) {
  const [check, setCheck] = useState<CheckState>('checking');

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      try {
        const legacyEventSnap = await getDoc(doc(db, 'events', LEGACY_EVENT_SLUG));
        if (legacyEventSnap.exists()) {
          if (!cancelled) setCheck('not-needed');
          return;
        }
        const photosSnap = await getDocs(collection(db, 'photos'));
        const hasUnmigrated = photosSnap.docs.some(d => !('eventId' in d.data()));
        if (!cancelled) setCheck(hasUnmigrated ? 'needed' : 'not-needed');
      } catch (err) {
        console.error('Nie udało się sprawdzić stanu migracji:', err);
        if (!cancelled) setCheck('error');
      }
    }
    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  if (check === 'checking') {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center" role="status" aria-label="Sprawdzanie danych">
        <RefreshCw className="w-6 h-6 text-ink-300 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (check === 'error') {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center p-8 text-center">
        <p className="text-error-600 text-sm">Nie udało się sprawdzić stanu danych. Odśwież stronę.</p>
      </div>
    );
  }

  if (check === 'needed') {
    return <LegacyMigrationScreen onDone={() => setCheck('not-needed')} />;
  }

  return <>{children}</>;
}

function LegacyMigrationScreen({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [migratedCount, setMigratedCount] = useState(0);
  const [error, setError] = useState('');

  async function runMigration() {
    setState('running');
    setError('');
    try {
      await setDoc(doc(db, 'events', LEGACY_EVENT_SLUG), {
        id: LEGACY_EVENT_SLUG,
        name: LEGACY_EVENT_NAME,
        slug: LEGACY_EVENT_SLUG,
        eventDate: LEGACY_EVENT_DATE,
        createdAt: Date.now(),
        guestUrl: `${window.location.origin}/e/${LEGACY_EVENT_SLUG}`,
        storagePrefix: `events/${LEGACY_EVENT_SLUG}`,
        archived: false,
      });

      const photosSnap = await getDocs(collection(db, 'photos'));
      const toMigrate = photosSnap.docs.filter(d => !('eventId' in d.data()));

      for (let i = 0; i < toMigrate.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        for (const photoDoc of toMigrate.slice(i, i + BATCH_LIMIT)) {
          batch.update(photoDoc.ref, { eventId: LEGACY_EVENT_SLUG });
        }
        await batch.commit();
      }

      setMigratedCount(toMigrate.length);
      setState('done');
    } catch (err) {
      console.error('Migracja danych z pilota nie powiodła się:', err);
      setError('Migracja nie powiodła się. Spróbuj ponownie.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center p-8 text-center gap-4">
        <p className="text-ink-900 text-lg font-medium">
          Zmigrowano {migratedCount} {migratedCount === 1 ? 'plik' : 'plików'} do wydarzenia „{LEGACY_EVENT_NAME}”.
        </p>
        <button onClick={onDone} className="py-3 px-8 bg-accent-600 text-white rounded-full text-sm font-medium">
          Przejdź do panelu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center p-8 text-center gap-4">
      <div className="max-w-md flex flex-col items-center gap-4">
        <h1 className="text-ink-900 text-xl font-semibold">Migracja danych z pilota</h1>
        <p className="text-ink-700 text-sm">
          Wykryto zdjęcia i filmy sprzed przejścia na wiele wydarzeń, bez przypisanego wydarzenia. Jednorazowa
          migracja przypisze je do wydarzenia „{LEGACY_EVENT_NAME}” — nic nie zostanie usunięte ani przeniesione w
          Storage.
        </p>
        {error && (
          <p className="text-error-600 text-sm" role="alert">
            {error}
          </p>
        )}
        <button
          onClick={runMigration}
          disabled={state === 'running'}
          className="py-3 px-8 bg-accent-600 text-white rounded-full text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {state === 'running' && <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {state === 'running' ? 'Migruję...' : 'Uruchom migrację'}
        </button>
      </div>
    </div>
  );
}
