import { useStorageUsage } from '../../hooks/useStorageUsage';

const LIMIT_GB = Number(import.meta.env.VITE_STORAGE_LIMIT_GB) || 5;
const LIMIT_BYTES = LIMIT_GB * 1024 * 1024 * 1024;

// Poniżej ~100 MB pokazujemy MB zamiast GB do 1 miejsca po przecinku —
// inaczej niewielkie, ale realne zużycie (np. kilka testowych zdjęć) zaokrągla
// się do mylącego "0.0 GB" i wygląda jak brak danych.
function formatUsage(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb < 100) return `${mb.toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Widoczny tylko w panelu admina (EventListPage jest pod bramką AdminLayout) — nigdy dla gościa.
export function StorageBar() {
  const { usedBytes, loading, error } = useStorageUsage();

  if (error) {
    return (
      <p className="text-xs text-error-600 mb-6" role="alert">
        {error}
      </p>
    );
  }

  const ratio = loading ? 0 : Math.min(usedBytes / LIMIT_BYTES, 1);
  const percent = Math.round(ratio * 100);
  const barColor = ratio >= 0.9 ? 'bg-error-600' : ratio >= 0.7 ? 'bg-warning-600' : 'bg-success-600';

  return (
    <div className="bg-surface rounded-2xl border border-ink-300 p-4 mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <p className="text-sm font-medium text-ink-900">Dostępne miejsce</p>
        <p className="text-xs text-ink-500">
          {loading ? 'Ładowanie…' : `${formatUsage(usedBytes)} z ${LIMIT_GB} GB wykorzystane`}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Wykorzystane miejsce"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full h-2 rounded-full bg-ink-300 overflow-hidden"
      >
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[11px] text-ink-500 mt-2">Na podstawie plików w aplikacji — nie oficjalny licznik Firebase.</p>
    </div>
  );
}
