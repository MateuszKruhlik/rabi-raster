# Rabi Raster: decyzje UX writing

## Context recap

Panel losowania ma zastąpić sześć równorzędnych przycisków jednym polem wyboru celu, jednym dynamicznym CTA i stale widocznym Undo. Copy interfejsu jest po angielsku, a nazwy muszą odpowiadać temu, co rzeczywiście zmienia `src/app/variation.ts`.

## Change

Zmień grupę przycisków na ten zestaw:

| Element | Final copy |
| --- | --- |
| Etykieta pola | `Target` |
| Opcje | `Look`, `Motion`, `Pattern`, `Points`, `Accents` |
| CTA | `Randomize look`, `Randomize motion`, `Randomize pattern`, `Randomize points`, `Randomize accents` |
| Cofnięcie | `Undo` |

Dynamiczny helper dla dostępnej akcji:

| Target | Helper |
| --- | --- |
| Look | `Changes density, mark size, and contrast. Halftone also changes shape.` |
| Motion | `Changes strength, direction, frequency, and variation. Movement and duration stay the same.` |
| Pattern | `Changes the seed and scale of this generated pattern.` |
| Points | `Changes point placement and irregularity.` |
| Accents | `Changes two accent colors, their amount, and distribution.` |

Powód stanu disabled ma zastąpić zwykły helper i podać bezpośredni następny krok:

| Warunek | Copy |
| --- | --- |
| Trwa eksport | `Wait for the export to finish.` |
| Look, wybrano Image bez pliku | `Choose a local image to randomize the look.` |
| Motion jest wyłączony | `Turn motion on to randomize it.` |
| Motion, wybrano Image bez pliku | `Choose a local image to randomize motion.` |
| Pattern przy źródle Image | `Choose a generated pattern to randomize it.` |
| Points przy innym rendererze | `Choose Contour Particles to randomize points.` |
| Points, wybrano Image bez pliku | `Choose a local image to randomize points.` |
| Accents, wybrano Image bez pliku | `Choose a local image to randomize accents.` |
| Brak historii | `Nothing to undo yet.` |

Zmień nazwę stylu `Dense Pills` na `Rounded Dots`. Nowa nazwa opisuje wygląd bez wymagania znajomości technicznego terminu `pill`, a wewnętrzne ID i wartość `Mark: pill` mogą pozostać bez zmian dla kompatybilności.

## Why

- `Target` nazywa decyzję użytkownika, a wybrana opcja pokazuje stan kontrolki. RAG rozdziela nazwę kontrolki od jej stanu i zaleca grupowanie powiązanych ustawień, żeby ograniczyć powtórzenia.
- Dynamiczne `Randomize {target}` jest krótkie, konkretne i zaczyna się od czasownika. To odpowiada rekomendacji, by przyciski jasno mówiły, jaka akcja nastąpi.
- Helper opisuje zakres zmiany przed CTA. Użytkownik może ocenić skutek losowania zanim uruchomi akcję.
- Disabled copy podaje sposób odblokowania akcji. Sam stan wizualny nie wyjaśnia, czy problemem jest źródło, renderer, ruch czy trwający eksport.
- `Undo` pozostaje stale widoczne, więc użytkownik widzi odwracalność eksperymentu także przed pierwszym losowaniem.

## Watch out for

- Nie używaj jednego stałego helpera dla wszystkich targetów. Każdy target zmienia inny, ściśle ograniczony zestaw wartości.
- Look nie zmienia źródła, renderera, palety, ruchu ani ustawień eksportu. Kształt zmienia tylko dla Halftone.
- Motion zachowuje typ ruchu i czas pętli. Zmienia siłę, wariant, kierunek i częstotliwość.
- Pattern działa tylko dla źródeł generowanych. Seed i Pattern scale nie zmieniają zaimportowanego obrazu.
- Points działa tylko z Contour Particles. Zmienia położenie punktów i nieregularność, nie tworzy połączeń.
- Accents zmienia dwa kolory akcentowe, ich udział i rozkład. Nie zmienia koloru bazowego.
- Jeśli kilka warunków blokuje CTA jednocześnie, pokaż jeden komunikat według priorytetu: eksport, wymagany renderer lub ruch, brak obrazu.
- Nazwy kluczy DialKit, schema settings JSON oraz klucz localStorage pozostają bez zmian.

## Alternatives

`Randomize` bez nazwy targetu jest krótsze, ale słabiej potwierdza wybraną opcję. Rekomendowany wariant to dynamiczne `Randomize {target}`.

`Variation target` jest bardziej precyzyjne niż `Target`, ale wydłuża mały panel i powtarza kontekst całej sekcji. Rekomendowany wariant to `Target`.

## Next step

Po wdrożeniu sprawdź w teście przeglądarkowym wszystkie targety, kolejność komunikatów disabled, zmianę CTA po wyborze oraz przywracanie wcześniejszych wartości przez Undo.

## Assumptions

- Select i helper mają trwałe etykiety dostępne dla czytnika ekranu.
- Helper jest powiązany programowo z selectem lub CTA, a nie tylko umieszczony obok wizualnie.

---
Evidence used (RAG):
- [uxw_02] Strategic Writing for UX - p. 70 (score 0.59)
- [uxw_02] Strategic Writing for UX - p. 86 (score 0.40)
- [uxw_01] Microcopy: The Complete Guide - p. 143 (score 0.28)
- [uxw_06] Writing Is Designing - ch.12, seg.6 (score 0.48)

General knowledge (not in RAG): none


## Visual choices, 2026-09-06

Pattern and Renderer menus now pair each option with a small static preview and one short description. The selected description remains visible below the closed control. Labels keep their familiar names; descriptions explain visible output rather than implementation details. Descriptions wrap on narrow screens.

The catalogue in `src/app/choice-catalog.ts` is the single source for menu and gallery copy. Generator and renderer facts were checked against `src/raster/field.ts` and `src/raster/render.ts`. The Image option uses a neutral file illustration and explains local processing; no private photograph is used.

Evidence used (RAG):
- [uxw_01] Microcopy: The Complete Guide - p. 238 (score 0.59): clear option names with concise supporting explanations.
- [uxw_02] Strategic Writing for UX - p. 72 (score 0.49): scannable, distinguishable menu names.
- [uxw_04] Forms that Work - p. 95 (score 0.48): understandable dropdown options and ordering.

General knowledge (not in RAG): factual descriptions and preview settings are derived from this application's source code.
