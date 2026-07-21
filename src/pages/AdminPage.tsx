import { useEffect, useRef, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { Archive, Download, ImageOff, LogOut, RefreshCw, Video, X } from 'lucide-react';
import JSZip from 'jszip';
import { auth, db, storage } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { usePhotos, type Photo } from '../hooks/usePhotos';

const ZIP_SIZE_WARNING_BYTES = 1.5 * 1024 * 1024 * 1024;
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminLogin({ unauthorized }: { unauthorized?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(unauthorized ? 'To konto nie ma dostępu do panelu.' : '');

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      if (result.user.email !== ADMIN_EMAIL) {
        await signOut(auth);
        setError('To konto nie ma dostępu do panelu.');
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? 'unknown';
      setError(`Błąd: ${code}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center p-6">
      <div className="bg-surface rounded-2xl shadow-sm border border-ink-300 p-8 w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-ink-900 mb-1">Panel admina</h1>
        <p className="text-ink-500 text-sm mb-8">Zaloguj się, aby zobaczyć zdjęcia</p>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 border border-ink-300 rounded-xl text-sm font-medium text-ink-700 hover:bg-canvas disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          {loading ? 'Logowanie...' : 'Zaloguj przez Google'}
        </button>
        {error && <p className="text-error-600 text-sm mt-4">{error}</p>}
      </div>
    </div>
  );
}

function MediaPreview({ photo, variant }: { photo: Photo; variant: 'tile' | 'full' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const isTile = variant === 'tile';

  if (photo.type === 'video') {
    return (
      <video
        src={photo.url}
        className={isTile ? 'w-full h-full object-cover' : 'max-h-[85dvh] max-w-full rounded-2xl'}
        preload="metadata"
        muted={isTile}
        controls={!isTile}
      />
    );
  }

  if (imgFailed) {
    return (
      <div
        className={
          isTile
            ? 'w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 text-center bg-ink-300/40'
            : 'flex flex-col items-center justify-center gap-3 p-12 text-center bg-ink-300/20 rounded-2xl min-w-[280px]'
        }
      >
        <ImageOff className={isTile ? 'w-5 h-5 text-ink-500' : 'w-10 h-10 text-ink-300'} aria-hidden="true" />
        <p className={isTile ? 'text-xs text-ink-700' : 'text-sm text-white/80'}>
          Podgląd niedostępny dla tego formatu
        </p>
        <a
          href={photo.url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className={isTile ? 'text-xs text-accent-600 underline' : 'text-sm text-accent-600 underline'}
          onClick={e => e.stopPropagation()}
        >
          Pobierz oryginał
        </a>
      </div>
    );
  }

  return (
    <img
      src={photo.url}
      alt=""
      className={isTile ? 'w-full h-full object-cover' : 'max-h-[85dvh] max-w-full rounded-2xl object-contain'}
      loading="lazy"
      onError={() => setImgFailed(true)}
    />
  );
}

function PhotoTile({
  photo,
  onOpen,
  onDelete,
}: {
  photo: Photo;
  onOpen: (photo: Photo, trigger: HTMLElement) => void;
  onDelete: (photo: Photo) => void;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  const time = new Date(photo.uploadedAt).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const label = `Otwórz podgląd — ${photo.author || 'Anonimowo'}, ${time}`;

  function open() {
    if (tileRef.current) onOpen(photo, tileRef.current);
  }

  return (
    <div
      ref={tileRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={open}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="relative group aspect-square rounded-xl overflow-hidden bg-ink-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
    >
      <MediaPreview photo={photo} variant="tile" />
      {photo.type === 'video' && (
        <div className="absolute top-1.5 left-1.5 p-1 bg-ink-900/60 rounded-md">
          <Video className="w-3 h-3 text-white" aria-hidden="true" />
        </div>
      )}
      <button
        onClick={e => {
          e.stopPropagation();
          onDelete(photo);
        }}
        aria-label="Usuń plik"
        className="absolute top-1.5 right-1.5 p-1.5 bg-surface rounded-lg text-error-600 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity hover:bg-error-100 z-10"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      <div className="absolute inset-0 bg-ink-900/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-end justify-between p-2">
        <span className="text-xs text-white/80">{time}</span>
        <a
          href={photo.url}
          download
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Pobierz oryginał"
          className="p-1.5 bg-surface rounded-lg text-ink-900 hover:bg-canvas"
          onClick={e => e.stopPropagation()}
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function Lightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-ink-900/90 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative flex flex-col items-center gap-4 max-w-2xl w-full outline-none"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Zamknij podgląd"
          className="absolute top-2 right-2 z-10 p-2 rounded-full bg-ink-900/60 text-white hover:bg-ink-900/80 transition-colors"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <MediaPreview photo={photo} variant="full" />

        <div className="text-center flex flex-col gap-1">
          <p className="text-white text-sm font-medium">{photo.author || 'Anonimowo'}</p>
          <p className="text-white/60 text-xs">
            {new Date(photo.uploadedAt).toLocaleString('pl-PL', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' · '}
            {photo.size ? formatSize(photo.size) : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

const ANONYMOUS_FILTER = '__anon__';
type SortOrder = 'newest' | 'oldest' | 'author';

function sortPhotos(list: Photo[], order: SortOrder): Photo[] {
  const sorted = [...list];
  if (order === 'newest') {
    sorted.sort((a, b) => b.uploadedAt - a.uploadedAt);
  } else if (order === 'oldest') {
    sorted.sort((a, b) => a.uploadedAt - b.uploadedAt);
  } else {
    sorted.sort((a, b) => {
      if (!a.author && !b.author) return b.uploadedAt - a.uploadedAt;
      if (!a.author) return 1;
      if (!b.author) return -1;
      return a.author.localeCompare(b.author, 'pl') || b.uploadedAt - a.uploadedAt;
    });
  }
  return sorted;
}

function AdminGallery() {
  const { photos, loading } = usePhotos();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [zipState, setZipState] = useState<'idle' | 'zipping' | 'error'>('idle');
  const [zipProgress, setZipProgress] = useState({ done: 0, total: 0 });
  const [zipMessage, setZipMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  function openPhoto(photo: Photo, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setSelectedPhoto(photo);
  }

  async function handleDelete(photo: Photo) {
    const ok = window.confirm('Usunąć to zdjęcie/film z albumu? Tej operacji nie można cofnąć.');
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'photos', photo.id));
    } catch (err) {
      console.error('Firestore delete failed:', err);
      window.alert('Nie udało się usunąć pliku. Spróbuj ponownie.');
      return;
    }

    try {
      await deleteObject(ref(storage, photo.storagePath));
    } catch (err) {
      console.error('Storage delete failed (plik może zostać osierocony w Storage):', err);
    }
  }

  function closeLightbox() {
    setSelectedPhoto(null);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }

  async function handleDownloadZip(photosToZip: Photo[], totalBytes: number) {
    if (photosToZip.length === 0) return;

    if (totalBytes > ZIP_SIZE_WARNING_BYTES) {
      const proceed = window.confirm(
        `Łączny rozmiar to ok. ${formatSize(totalBytes)} — pakowanie może być wolne albo zawiesić przeglądarkę. Kontynuować?`
      );
      if (!proceed) return;
    }

    setZipState('zipping');
    setZipMessage(null);
    setZipProgress({ done: 0, total: photosToZip.length });

    const zip = new JSZip();
    let failed = 0;

    for (const photo of photosToZip) {
      try {
        const response = await fetch(photo.url);
        const blob = await response.blob();
        const filename = photo.storagePath.split('/').pop() || photo.id;
        zip.file(filename, blob);
      } catch {
        failed += 1;
      }
      setZipProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `album-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setZipState('idle');
      setZipMessage(
        failed > 0
          ? `Spakowano ${photosToZip.length - failed} z ${photosToZip.length} plików — ${failed} nie udało się pobrać.`
          : null
      );
    } catch {
      setZipState('error');
      setZipMessage('Nie udało się spakować plików. Spróbuj ponownie lub pobierz je pojedynczo.');
    }
  }

  const authors = Array.from(new Set(photos.map(p => p.author).filter((a): a is string => !!a))).sort(
    (a, b) => a.localeCompare(b, 'pl')
  );
  const hasAnonymous = photos.some(p => !p.author);

  const filteredPhotos = photos.filter(p => {
    if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    if (authorFilter === 'all') return true;
    if (authorFilter === ANONYMOUS_FILTER) return !p.author;
    return p.author === authorFilter;
  });
  const visiblePhotos = sortPhotos(filteredPhotos, sortOrder);
  const imageCount = filteredPhotos.filter(p => p.type === 'image').length;
  const videoCount = filteredPhotos.filter(p => p.type === 'video').length;
  const totalSize = filteredPhotos.reduce((sum, p) => sum + (p.size ?? 0), 0);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="bg-surface border-b border-ink-300 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-semibold text-ink-900">
          Album weselny
          <span className="ml-2 text-sm font-normal text-ink-500">{photos.length} zdjęć</span>
        </h1>
        <button
          onClick={() => signOut(auth)}
          aria-label="Wyloguj się"
          className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition-colors"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Wyloguj
        </button>
      </header>

      {photos.length > 0 && (
        <div className="bg-surface border-b border-ink-300 px-4 py-3 flex flex-wrap gap-2">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as 'all' | 'image' | 'video')}
            aria-label="Filtruj po typie pliku"
            className="py-2 px-3 rounded-lg border border-ink-300 text-sm text-ink-700 bg-surface"
          >
            <option value="all">Wszystkie typy</option>
            <option value="image">Tylko zdjęcia</option>
            <option value="video">Tylko wideo</option>
          </select>

          <select
            value={authorFilter}
            onChange={e => setAuthorFilter(e.target.value)}
            aria-label="Filtruj po autorze"
            className="py-2 px-3 rounded-lg border border-ink-300 text-sm text-ink-700 bg-surface"
          >
            <option value="all">Wszyscy autorzy</option>
            {authors.map(a => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            {hasAnonymous && <option value={ANONYMOUS_FILTER}>Anonimowo</option>}
          </select>

          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as SortOrder)}
            aria-label="Sortuj galerię"
            className="py-2 px-3 rounded-lg border border-ink-300 text-sm text-ink-700 bg-surface"
          >
            <option value="newest">Najnowsze najpierw</option>
            <option value="oldest">Najstarsze najpierw</option>
            <option value="author">Autor (A-Z)</option>
          </select>
        </div>
      )}

      <main className="p-4">
        {photos.length > 0 && !loading && (
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="text-xs text-ink-500">
              {imageCount} zdjęć · {videoCount} filmów · {filteredPhotos.length} plików łącznie · {formatSize(totalSize)}
            </p>
            <button
              onClick={() => handleDownloadZip(filteredPhotos, totalSize)}
              disabled={zipState === 'zipping' || filteredPhotos.length === 0}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-ink-300 text-xs text-ink-700 hover:bg-canvas disabled:opacity-50 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" aria-hidden="true" />
              {zipState === 'zipping'
                ? `Pakowanie ${zipProgress.done}/${zipProgress.total}...`
                : 'Pobierz wszystko (ZIP)'}
            </button>
          </div>
        )}

        {zipMessage && (
          <p
            className={`text-xs mb-3 ${zipState === 'error' ? 'text-error-600' : 'text-ink-500'}`}
            role="alert"
            aria-live="polite"
          >
            {zipMessage}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-24" role="status" aria-label="Ładowanie zdjęć">
            <RefreshCw className="w-6 h-6 text-ink-300 animate-spin" aria-hidden="true" />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-24 text-ink-500 text-sm">
            Brak zdjęć. Poczekaj aż goście zaczną wysyłać!
          </div>
        ) : visiblePhotos.length === 0 ? (
          <div className="text-center py-24 text-ink-500 text-sm">Brak wyników dla wybranego filtra.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {visiblePhotos.map(photo => (
              <PhotoTile key={photo.id} photo={photo} onOpen={openPhoto} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      {selectedPhoto && <Lightbox photo={selectedPhoto} onClose={closeLightbox} />}
    </div>
  );
}

export function AdminPage() {
  const { user, loading } = useAuth();
  const unauthorized = !!user && user.email !== ADMIN_EMAIL;

  useEffect(() => {
    if (unauthorized) signOut(auth);
  }, [unauthorized]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center" role="status" aria-label="Ładowanie">
        <RefreshCw className="w-6 h-6 text-ink-300 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (unauthorized) return <AdminLogin unauthorized />;

  return user ? <AdminGallery /> : <AdminLogin />;
}
