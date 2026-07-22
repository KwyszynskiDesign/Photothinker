# Photothinker — kontekst projektu dla Claude Code

## Co to jest
Aplikacja do zbierania zdjęćwideo od gości weselnych na żywo, z panelem organizatora do przeglądu w czasie rzeczywistym.

## Stack (nie zmieniać bez decyzji)
- React 19 + Vite
- Tailwind CSS 4 — konfiguracja CSS-first przez `@theme` w `srcindex.css`. NIE używać `tailwind.config.js`.
- Firebase Firestore (metadane) + Storage (pliki) + Auth (Google sign-in dla organizatora)
- react-router-dom (już w repo)
- lucide-react (ikony)

## Architektura — multi-event (jeden admin)
- Wiele wydarzeń w jednym deploymencie. Admin tworzy wydarzenie przez UI w `/admin` (przycisk "Stwórz wydarzenie").
- Każde wydarzenie to dokument `events/{slug}` w Firestore (`id, name, slug, eventDate, createdAt, guestUrl, storagePrefix, archived`). Zdjęcia/wideo w `photos` mają pole `eventId` (== slug).
- Storage bez prawdziwych folderów — tylko prefiksy ścieżek `events/{slug}/...`. Stare pliki z pilota zostają pod `photos/...`.
- To **nie jest** multi-tenant SaaS: jeden admin/właściciel systemu (allowlist e-maila, `VITE_ADMIN_EMAIL`), bez wielu organizacji, workspace'ów ani ról organizatora — patrz "brak wieloosobowych ról organizatora" niżej, to nadal obowiązuje.
- `/` przekierowuje tymczasowo na wydarzenie-legacy z pilota, żeby stare linki/QR dalej działały.
- Pełne uzasadnienie pivotu: `docs/decisions.md`.

## Storage — Firebase, nie Google Drive
Wszystkie pliki gości trafiają do Firebase Storage, metadane (autor, typ, data, waga) do Firestore. Nie integrować Google Drive API.

## Design system — Editorial Warmth
Styl ciepły, stonowany, redakcyjny minimalizm. Kolory off-white canvas, terakota jako accent, szałwia jako success, cegła jako error.

ZAKAZANE ciemny brąz+złoto jako kolory bazowe, emojiserca (♥) w UI i copy, gradienty, neon, AI-glow.

Tokeny żyją w `srcindex.css` jako `@theme` (patrz `docsdecisions.md` za pełną listę wartości). Nowe tokeny lub zmiany kolorów wymagają potwierdzenia przed wdrożeniem — nie dryfować z powrotem w stronę starego stylu.

## Domyślne ustawienia MVP — zmiana wymaga wpisu w docs/decisions.md
Poniższe to punkt wyjścia dla MVP, nie sztywne, trwałe zakazy. Odejście od
dowolnego punktu jest dozwolone, ale musi najpierw dostać wpis w
`docs/decisions.md` (co się zmienia i dlaczego) — dopiero potem wolno to
zaimplementować. Bez takiego wpisu, poniższe obowiązuje.

- multi-event: w scope, patrz docs/decisions.md — admin tworzy wydarzenia przez UI
- brak multi-tenant / wielu adminów / ról organizatora / organizacji / workspace'ów — nadal poza scope, mimo multi-event
- brak Google Drive
- brak batch upload
- brak edycji zdjęć/wideo
- brak moderacji treści przed publikacją (patrz niżej: to nie to samo co kuratorstwo)
- kuratorstwo galerii przez admina (usuwanie opublikowanych plików) — w scope, patrz docs/decisions.md
- brak dark mode
- brak wieloosobowych ról organizatora
- brak raportów (statystyki liczby/wagi plików w panelu admina to wygoda UI, nie raport)
- eksport ZIP wszystkich plików (organizator) — w scope, patrz docs/decisions.md
- generator QR w apce (PNG/PDF, per wydarzenie) — w scope, patrz docs/decisions.md; odwraca wcześniejszy zapis "QR generowany zewnętrznie"
- brak płatności, brak AI retuszu

### Moderacja vs kuratorstwo galerii
- **Moderacja** = filtrowanie/blokowanie treści PRZED publikacją (np. kolejka
  akceptacji zanim zdjęcie trafi do albumu, automatyczna cenzura). Nadal poza
  scope — nie budować.
- **Kuratorstwo galerii** = usuwanie PO fakcie, przez zalogowanego admina,
  jego własna decyzja co zostaje w albumie. W scope od teraz — patrz
  `docs/decisions.md`.

## Media rules
- Dozwolone JPEG, PNG, HEIC (konwertowane do JPEG client-side), MP4, MOV (bez konwersji)
- Limity 25 MB  zdjęcie, 200 MB  wideo (do zweryfikowania względem planu Firebase SparkBlaze)
- Kompresja client-side zdjęcia już zaimplementowane (`compressImage.ts`), wideo — do dodania z fallbackiem na oryginał

## Pełny plan i decision log
Zobacz `docsdecisions.md` (skrócony decision log) i `docsmvp-plan.md` (pełny dokument analityczny) przed wprowadzaniem zmian architektonicznych.

## Zasada pracy
Małe, sprawdzalne kroki. Jedna zmiana na raz, z potwierdzeniem DoD przed przejściem dalej. Nie zgadywać struktury repo — zawsze najpierw przeczytać istniejący kod.