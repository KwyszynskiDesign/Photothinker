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

Pełne uzasadnienia i kontekst: `docs/mvp-plan.md`.