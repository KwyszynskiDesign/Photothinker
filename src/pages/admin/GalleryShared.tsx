import { useEffect, useRef, useState } from 'react';
import { Download, ImageOff, Video, X } from 'lucide-react';
import type { Photo } from '../../hooks/usePhotos';

export const ANONYMOUS_FILTER = '__anon__';
export type SortOrder = 'newest' | 'oldest' | 'author';

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sortPhotos(list: Photo[], order: SortOrder): Photo[] {
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

export function MediaPreview({ photo, variant }: { photo: Photo; variant: 'tile' | 'full' }) {
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

export function PhotoTile({
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

export function Lightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
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
