import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Photo {
  id: string;
  url: string;
  storagePath: string;
  type: 'image' | 'video';
  author: string | null;
  size: number;
  uploadedAt: number;
}

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'photos'), orderBy('uploadedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Photo)));
      setLoading(false);
    });
  }, []);

  return { photos, loading };
}
