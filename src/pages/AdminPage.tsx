import { useEffect, useRef, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { Download, ImageOff, LogOut, RefreshCw, Video, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { usePhotos, type Photo } from '../hooks/usePhotos';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
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
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
        <ImageOff className={isTile ? 'w-5 h-5 text-ink-500' : 'w-10 h-10 text-ink-300'} />
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

function PhotoTile({ photo, onOpen }: { photo: Photo; onOpen: (photo: Photo) => void }) {
  return (
    <div
      className="relative group aspect-square rounded-xl overflow-hidden bg-ink-300 cursor-pointer"
      onClick={() => onOpen(photo)}
    >
      <MediaPreview photo={photo} variant="tile" />
      {photo.type === 'video' && (
        <div className="absolute top-1.5 left-1.5 p-1 bg-ink-900/60 rounded-md">
          <Video className="w-3 h-3 text-white" />
        </div>
      )}
      <div className="absolute inset-0 bg-ink-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
        <span className="text-xs text-white/80">
          {new Date(photo.uploadedAt).toLocaleTimeString('pl-PL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <a
          href={photo.url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 bg-surface rounded-lg text-ink-900 hover:bg-canvas"
          onClick={e => e.stopPropagation()}
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

function Lightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-ink-900/90 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <button
        onClick={onClose}
        aria-label="Zamknij podgląd"
        className="absolute top-4 right-4 p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="flex flex-col items-center gap-4 max-w-2xl w-full outline-none"
        onClick={e => e.stopPropagation()}
      >
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

function AdminGallery() {
  const { photos, loading } = usePhotos();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="bg-surface border-b border-ink-300 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-semibold text-ink-900">
          Album weselny
          <span className="ml-2 text-sm font-normal text-ink-500">{photos.length} zdjęć</span>
        </h1>
        <button
          onClick={() => signOut(auth)}
          className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Wyloguj
        </button>
      </header>

      <main className="p-4">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <RefreshCw className="w-6 h-6 text-ink-300 animate-spin" />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-24 text-ink-500 text-sm">
            Brak zdjęć. Poczekaj aż goście zaczną wysyłać!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {photos.map(photo => (
              <PhotoTile key={photo.id} photo={photo} onOpen={setSelectedPhoto} />
            ))}
          </div>
        )}
      </main>

      {selectedPhoto && <Lightbox photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />}
    </div>
  );
}

export function AdminPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-ink-300 animate-spin" />
      </div>
    );
  }

  return user ? <AdminGallery /> : <AdminLogin />;
}
