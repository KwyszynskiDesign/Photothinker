# Decision log — Photothinker MVP

## Cel dokumentu

- Ten dokument łączy wcześniejsze decyzje, które nadal obowiązują, z najnowszymi decyzjami ownera.
- Decyzje historyczne, które zostały później odwrócone, nie są tu traktowane jako aktywny stan produktu.
- Celem jest jedno źródło prawdy dla scope’u, dostępu, UX, rollout’u i infrastruktury.

## 1. Model produktu

- Aplikacja działa w modelu multi-event: wiele wydarzeń pod jedną aplikacją.
- Główny backend pozostaje oparty o Firebase Storage + Firestore.
- Google Drive wchodzi teraz jako osobny eksperyment techniczny.
- Eksperyment z Google Drive nie oznacza jeszcze pełnej migracji architektury ani porzucenia Firebase.
- Produkt nie wchodzi jeszcze w pełny multi-tenant, wiele niezależnych workspace’ów ani pełny model wielu organizatorów.
- Event nadal nie ma rozbudowanej maszyny stanów; nie budujemy osobnego lifecycle management UI.

## 2. Zakres funkcjonalny

- Upload zdjęć zostaje w zakresie.
- Upload wideo zostaje w zakresie.
- Kompresja client-side zostaje dla zdjęć i wideo, z fallbackiem na oryginał, jeśli kompresja wideo zawiedzie.
- HEIC jest konwertowany client-side do JPEG.
- MOV pozostaje bez konwersji.
- Lightbox organizatora zostaje w wariancie MVP-lite: podgląd, podstawowe metadane i zamknięcie, bez akcji destrukcyjnych i bez next/prev.
- Admin ma możliwość pobrania ZIP-a ze wszystkimi plikami wydarzenia.
- Admin może usuwać pliki z galerii wydarzenia.
- Galeria admina odświeża się automatycznie w czasie rzeczywistym; nie dodajemy osobnego przycisku ręcznego odświeżania.
- QR w aplikacji zostaje w zakresie.
- Plansze A4 i A5 do druku zostają w zakresie.
- Pasek dostępnego miejsca zostaje w zakresie jako funkcja informacyjna dla admina.
- Pasek quota nie blokuje uploadu.
- Licznik zdjęć i filmów per event wchodzi do bieżącego scope’u.
- Consent zostaje w wariancie minimalnym: mikrotekst przy CTA, bez checkboxa.
- Limity plików pozostają ustawione na 25 MB dla zdjęć i 200 MB dla wideo, z zastrzeżeniem dalszej weryfikacji względem planu.
- Styl wizualny pozostaje w kierunku Editorial Warmth.

## 3. Dostęp i bezpieczeństwo

- Dotychczasowy model jednego allowlist e-maila był poprawnym zabezpieczeniem wcześniejszego etapu i pozostaje ważnym punktem wyjścia.
- Na obecnym etapie chcemy rozszerzyć ten model o możliwość rejestracji i testowego dopuszczenia przynajmniej jednej dodatkowej osoby.
- Ten krok służy walidacji flow konta i dostępu, a nie wdrożeniu pełnego systemu ról i organizacji.
- Nadal nie wdrażamy jeszcze pełnego systemu ról, wielu niezależnych organizatorów ani workspace’ów.

## 4. Rollout i jakość

- Backfill historycznych zdjęć jest potrzebny.
- Oznacza to, że stare pliki muszą zostać poprawnie przypisane do wydarzeń w nowym modelu danych, aby galerie, liczniki i widoki eventowe działały spójnie także dla wcześniejszych uploadów.
- Polskie znaki w PDF muszą zostać poprawione.
- Brak polskich znaków nie jest już traktowany jako akceptowalne, świadomie odłożone ograniczenie.
- Artifact Registry cleanup policy trzeba wdrożyć jako housekeeping po testach funkcji.

## 5. Decyzje aktywne z wcześniejszych ustaleń

- Firebase pozostaje aktualnym, działającym fundamentem produktu.
- Multi-event pozostaje aktywnym kierunkiem produktu.
- ZIP dla admina pozostaje w scope.
- Usuwanie plików przez admina pozostaje w scope.
- QR w aplikacji oraz plansze A4/A5 pozostają w scope.
- Pasek dostępnego miejsca pozostaje funkcją informacyjną.
- Auto-refresh galerii admina pozostaje aktywnym zachowaniem systemu.
- Minimalny consent, limity plików, HEIC→JPEG, MOV bez konwersji i lightbox MVP-lite pozostają obowiązującymi decyzjami.

## 6. Decyzje zastąpione lub rozszerzone

- Wcześniejszy model single-event został zastąpiony przez multi-event.
- Wcześniejsza decyzja o QR poza aplikacją została zastąpiona przez QR generowany w aplikacji.
- Wcześniejsze odłożenie Google Drive do v2 zostało rozszerzone: teraz wchodzi jako eksperyment techniczny.
- Wcześniejszy model jednego admina przez jeden allowlist e-mail został rozszerzony o test rejestracji i dostępu dla przynajmniej jednej dodatkowej osoby.
- Wcześniejsze świadome odłożenie problemu polskich znaków w PDF zostało cofnięte: temat przechodzi do naprawy.
- Wcześniejsze podejście bez licznika zdjęć i filmów zostaje rozszerzone: licznik wchodzi teraz do scope’u.

## 7. Poza obecnym zakresem

- Pełny multi-tenant.
- Rozbudowany system ról i uprawnień.
- Wiele niezależnych workspace’ów.
- Płatności.
- Pełna migracja architektury na Google Drive jako jedyny docelowy storage bez osobnej decyzji po eksperymencie.
