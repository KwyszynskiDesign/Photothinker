import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Photo {
  id: string;
  url: string;
  storagePath: string;
  type: 'image' | 'video';
  author: string | null;
  size: number;
  uploadedAt: number;
  eventId: string;
}

// Filtr po eventId celowo bez orderBy po stronie Firestore — sortowanie i tak dzieje
// się w pamięci (sortPhotos w GalleryShared), a bez orderBy wystarczy automatyczny
// indeks pojedynczego pola, więc nie trzeba indeksu złożonego.
export function usePhotos(eventId: string) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'photos'), where('eventId', '==', eventId));
    return onSnapshot(
      q,
      snap => {
        setError(null);
        setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Photo)));
        setLoading(false);
      },
      err => {
        console.error('Nie udało się wczytać zdjęć:', err);
        setError('Nie udało się wczytać zdjęć. Odśwież stronę.');
        setLoading(false);
      }
    );
  }, [eventId]);

  return { photos, loading, error };
}
