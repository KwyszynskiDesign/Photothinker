# Photothinker — kontekst projektu dla Claude Code

## Co to jest
Aplikacja do zbierania zdjęćwideo od gości weselnych na żywo, z panelem organizatora do przeglądu w czasie rzeczywistym.

## Stack (nie zmieniać bez decyzji)
- React 19 + Vite
- Tailwind CSS 4 — konfiguracja CSS-first przez `@theme` w `srcindex.css`. NIE używać `tailwind.config.js`.
- Firebase Firestore (metadane) + Storage (pliki) + Auth (Google sign-in dla organizatora)
- react-router-dom (już w repo)
- lucide-react (ikony)

## Architektura — single-event
- Jeden event na deployment, konfigurowany przez zmienne `.env` (`VITE_EVENT_NAME`, `VITE_EVENT_DATE`).
- Brak multi-tenant, brak listy eventów, brak tworzenia eventu przez UI.
- Jeśli trzeba zmienić dane eventu edytuj `.env` i redeploy. Nie budować UI ustawień.

## Storage — Firebase, nie Google Drive
Wszystkie pliki gości trafiają do Firebase Storage, metadane (autor, typ, data, waga) do Firestore. Nie integrować Google Drive API.

## Design system — Editorial Warmth
Styl ciepły, stonowany, redakcyjny minimalizm. Kolory off-white canvas, terakota jako accent, szałwia jako success, cegła jako error.

ZAKAZANE ciemny brąz+złoto jako kolory bazowe, emojiserca (♥) w UI i copy, gradienty, neon, AI-glow.

Tokeny żyją w `srcindex.css` jako `@theme` (patrz `docsdecisions.md` za pełną listę wartości). Nowe tokeny lub zmiany kolorów wymagają potwierdzenia przed wdrożeniem — nie dryfować z powrotem w stronę starego stylu.

## Scope boundaries (MVP) — NIE dodawać bez wyraźnej decyzji
- brak multi-eventmulti-tenant
- brak tworzenia eventu przez UI
- brak Google Drive
- brak batch upload
- brak edycji zdjęćwideo
- brak moderacji plików
- brak dark mode
- brak wieloosobowych ról organizatora
- brak eksportówraportów
- brak generatora QR w apce (link statyczny, QR generowany zewnętrznie przez organizatora)
- brak płatności, brak AI retuszu

## Media rules
- Dozwolone JPEG, PNG, HEIC (konwertowane do JPEG client-side), MP4, MOV (bez konwersji)
- Limity 25 MB  zdjęcie, 200 MB  wideo (do zweryfikowania względem planu Firebase SparkBlaze)
- Kompresja client-side zdjęcia już zaimplementowane (`compressImage.ts`), wideo — do dodania z fallbackiem na oryginał

## Pełny plan i decision log
Zobacz `docsdecisions.md` (skrócony decision log) i `docsmvp-plan.md` (pełny dokument analityczny) przed wprowadzaniem zmian architektonicznych.

## Zasada pracy
Małe, sprawdzalne kroki. Jedna zmiana na raz, z potwierdzeniem DoD przed przejściem dalej. Nie zgadywać struktury repo — zawsze najpierw przeczytać istniejący kod.