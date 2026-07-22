import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, FileText, RefreshCw, X } from 'lucide-react';
import type { Event } from '../../hooks/useEvents';
import { needsShareHint, saveGeneratedFile, type SaveFileResult } from '../../utils/saveFile';
import { buildEventSignPdf, type SignFormat } from '../../utils/qrPdf';

export function QrModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const guestUrl = `${window.location.origin}/e/${event.slug}`;
  const showShareHint = needsShareHint();

  useEffect(() => {
    containerRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, guestUrl, { width: 320, margin: 2 })
      .then(() => {
        canvasRef.current?.toBlob(blob => {
          if (blob) setPngBlob(blob);
          else setError('Nie udało się wygenerować kodu QR.');
        }, 'image/png');
      })
      .catch(() => setError('Nie udało się wygenerować kodu QR.'));
  }, [guestUrl]);

  function reportResult(result: SaveFileResult) {
    setStatusMessage(
      result === 'opened' ? 'Plik otworzył się w nowej karcie — użyj ikony „Udostępnij”, aby go zapisać.' : ''
    );
  }

  async function handleSavePng() {
    if (!pngBlob) return;
    setStatusMessage('');
    reportResult(await saveGeneratedFile(pngBlob, `qr-${event.slug}.png`));
  }

  async function handleSaveSign(format: SignFormat) {
    if (!canvasRef.current) return;
    setStatusMessage('');
    const blob = buildEventSignPdf(canvasRef.current, event.name, guestUrl, format);
    reportResult(await saveGeneratedFile(blob, `plansza-${event.slug}-${format}.pdf`));
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Generuj QR"
        tabIndex={-1}
        className="relative bg-surface rounded-2xl shadow-lg max-w-sm w-full p-6 flex flex-col items-center gap-4 outline-none"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Zamknij"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-canvas transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="text-center">
          <h2 className="text-lg font-semibold text-ink-900">Generuj QR</h2>
          <p className="text-xs text-ink-500 mt-1">Kod dla gości do dodawania zdjęć</p>
        </div>

        <div className="relative w-40 h-40 flex items-center justify-center bg-canvas rounded-xl border border-ink-300 overflow-hidden">
          {error ? (
            <p className="text-xs text-error-600 text-center px-4" role="alert">
              {error}
            </p>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Kod QR do wydarzenia ${event.name}`}
                className={`max-w-full max-h-full p-3 ${pngBlob ? '' : 'invisible'}`}
              />
              {!pngBlob && (
                <RefreshCw
                  className="w-6 h-6 text-ink-300 animate-spin absolute"
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </div>

        <p className="text-xs text-ink-500 text-center break-all">{guestUrl}</p>

        <div className="w-full flex flex-col gap-1.5">
          <p className="text-xs font-medium text-ink-700">Plansza do druku</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleSaveSign('a4')}
              disabled={!pngBlob}
              className="flex-1 py-2.5 bg-accent-600 text-white rounded-full text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              Plansza A4
            </button>
            <button
              onClick={() => handleSaveSign('a5')}
              disabled={!pngBlob}
              className="flex-1 py-2.5 bg-accent-600 text-white rounded-full text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              Plansza A5
            </button>
          </div>
        </div>

        <div className="w-full flex flex-col gap-1.5">
          <p className="text-xs font-medium text-ink-700">Sam kod QR</p>
          <button
            onClick={handleSavePng}
            disabled={!pngBlob}
            className="w-full py-2.5 border border-ink-300 text-ink-900 rounded-full text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            PNG
          </button>
        </div>

        {(statusMessage || showShareHint) && (
          <p className="text-[11px] text-ink-500 text-center" role="status" aria-live="polite">
            {statusMessage ||
              'Na iPhonie plik może otworzyć się w podglądzie — użyj ikony „Udostępnij”, aby go zapisać.'}
          </p>
        )}
      </div>
    </div>
  );
}
