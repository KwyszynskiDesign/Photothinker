# Decision log — Photothinker MVP

| Decyzja | Rozstrzygnięcie | Uzasadnienie |
|---|---|---|
| Storage backend | Firebase Storage + Firestore | Zgodnie z już działającym scaffoldem, nie Google Drive z oryginalnego briefu. |
| Multi-event vs single-event | Single-event, `.env` | Brak potrzeby multi-tenant na MVP. Brak listy/tworzenia/ustawień eventu w UI. |
| Wsparcie wideo | Dodane | Brief wprost wymagał "zdjęcie lub film" — nie było częścią decyzji o zawężeniu scope'u. |
| Styl wizualny | Restyle na Editorial Warmth | Obecny brąz/złoto/serca łamie explicit "nie chcę kiczu weselnego" z briefu. |
| Dystrybucja linku/QR | Poza apką | URL deploymentu statyczny, organizator generuje QR zewnętrznym narzędziem. |
| Lightbox pliku (organizator) | MVP-lite | Preview + metadata (autor, data, waga) + close. Bez akcji destrukcyjnych, bez next/prev. |
| Kompresja client-side | Zdjęcia i wideo | Fallback na oryginał jeśli kompresja wideo zawiedzie na słabszym urządzeniu. |
| Consent scope | Minimalny | Mikrotekst pod CTA, upload = domyślna zgoda, bez checkboxa. |
| Limity plików | 25 MB foto / 200 MB wideo | Do zweryfikowania względem realnego planu Firebase (Spark/Blaze). |
| HEIC/MOV | HEIC→JPEG client-side, MOV bez konwersji | — |
| Event lifecycle | Brak maszyny stanów | Bez UI zarządzania eventem — event "żyje" tak długo jak apka jest zdeployowana. |
| Google Drive jako storage / multi-tenant / płatności | Odroczone do v2 | Rozważane jako pivot (własny Drive właściciela, dokupowanie GB, kampania/portfolio), ale wymagałoby backendu (Cloud Function proxy do Drive) i przekreśla single-event MVP. Pilot na jednym weselu zostaje na obecnym Firebase; decyzja o Drive/multi-tenant/płatnościach po zebraniu realnych danych zużycia GB i feedbacku z pilota. |
| Odświeżanie galerii admina | Automatyczne (real-time), bez przycisku | Galeria w `AdminPage.tsx` odświeża się przez `onSnapshot` w `usePhotos.ts` — nowe zdjęcia pojawiają się bez akcji użytkownika. `RefreshCw` (lucide-react) występuje w kodzie wyłącznie jako dekoracyjny spinner ładowania (logowanie, ładowanie zdjęć, ładowanie stanu auth) — nie jest klikalnym przyciskiem i nie ma `aria-label` typu "Odśwież galerię", bo ogłaszałoby nieistniejącą akcję screen readerowi. Manualny przycisk odświeżania (np. na wypadek problemów z real-time sync) to nowa funkcja produktowa wymagająca osobnej decyzji, nie poprawka accessibility. |
| Eksport ZIP wszystkich plików (organizator) | W scope, wbrew pierwotnej granicy MVP | Odwraca wcześniejszy zapis "brak eksportów/raportów" — organizator chce pojedynczy plik ze wszystkimi zdjęciami/filmami z wesela do archiwizacji, zamiast pobierania kafelek po kafelku. Świadoma decyzja. Filtr/sortowanie/statystyki w galerii admina traktowane jako wygoda UI, nie jako "raport" — nie wymagały osobnej decyzji. |
| Kuratorstwo galerii (usuwanie plików przez admina) | W scope, wbrew pierwotnej granicy MVP | Odwraca wcześniejszy zapis "brak moderacji plików" — ale to nie jest moderacja (filtrowanie/blokowanie PRZED publikacją, dalej poza scope), tylko kuratorstwo PO fakcie: zalogowany admin może usunąć opublikowane zdjęcie/wideo, którego nie chce w albumie. X na kafelku w siatce (nie w lightboksie — tam zostaje MVP-lite bez akcji destrukcyjnych), z potwierdzeniem `confirm()` przed usunięciem. Usuwa dokument z Firestore ORAZ plik z Firebase Storage, żeby nie zostawiać martwych plików zajmujących miejsce. Wymaga reguły `allow delete` w `storage.rules` dla zalogowanego admina (Firestore już na to pozwalał). |

Pełne uzasadnienia i kontekst: `docs/mvp-plan.md`.