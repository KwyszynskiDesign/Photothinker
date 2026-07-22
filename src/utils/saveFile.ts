export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isAppleTouchDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ zgłasza się jako "Macintosh" — odróżnia go od desktopowego Maca dotyk.
  const isIpadOsAsMac = ua.includes('Macintosh') && navigator.maxTouchPoints > 1;
  return isAppleTouchDevice || isIpadOsAsMac;
}

function canShareFiles(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

export type SaveFileResult = 'shared' | 'downloaded' | 'opened' | 'cancelled';

// Cross-device zapis pliku wygenerowanego w przeglądarce (bez serwera).
// iOS Safari nie honoruje niezawodnie <a download> dla podglądalnych typów (obraz/PDF)
// — w pierwszej kolejności próbujemy natywnego arkusza udostępniania z plikiem, bo to
// jedyny sposób dający na iOS realną opcję "Zapisz do plików" / "Zapisz obraz".
export async function saveGeneratedFile(blob: Blob, filename: string): Promise<SaveFileResult> {
  const file = new File([blob], filename, { type: blob.type });

  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
      // spadamy do zapisu przez URL poniżej
    }
  }

  const url = URL.createObjectURL(blob);

  if (isIOS()) {
    // Safari na iOS zwykle otwiera obraz/PDF w podglądzie zamiast pobierać —
    // użytkownik zapisuje przez ikonę Udostępnij w tym widoku.
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'opened';
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}

// Do sterowania statyczną podpowiedzią UX: czy warto z góry pokazać wskazówkę "użyj Udostępnij".
export function needsShareHint(): boolean {
  const probe = new File([], 'probe.png', { type: 'image/png' });
  return isIOS() && !canShareFiles(probe);
}
