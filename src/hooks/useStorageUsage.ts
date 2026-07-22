import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Suma pola `size` po WSZYSTKICH plikach (wszystkie wydarzenia) — proxy zużycia
// Firebase Storage liczone z danych aplikacji. Nie jest oficjalnym licznikiem
// Firebase (ten wymagałby backendu/Cloud Monitoring API) — patrz docs/decisions.md.
export function useStorageUsage() {
  const [usedBytes, setUsedBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      collection(db, 'photos'),
      snap => {
        setError(null);
        setUsedBytes(snap.docs.reduce((sum, d) => sum + (Number(d.data().size) || 0), 0));
        setLoading(false);
      },
      err => {
        console.error('Nie udało się wczytać zużycia miejsca:', err);
        setError('Nie udało się wczytać zużycia miejsca.');
        setLoading(false);
      }
    );
  }, []);

  return { usedBytes, loading, error };
}
