# 📋 CorkBoard

Created by vibecoding · [Live demo](https://michalstankiewicz4-cell.github.io/CorkBoard/) · v1.6.0

<img width="1278" height="798" alt="image" src="https://github.com/user-attachments/assets/9afd58d5-bd36-4f1d-8f8f-2b6db8cedc37" />

An interactive detective-style investigation board built with vanilla JavaScript (ES modules) — no frameworks, no build tools. Open `index.html` in a browser and you're ready to go.

---

## Screen layout

```
┌─────────────────────────────────────────────────────────────┐
│  [📁]                                          [📌] [🧵]    │
│  [🗺]               CORKBOARD                  [👤] [❓]    │
│  [⚙️]                                           [🏛️] ...    │
│  [🌟]                                                        │
│  [?]               cards · pins · threads                   │
│                                                             │
│  [minimap]                                                  │
└─────────────────────────────────────────────────────────────┘
```

- **Left panel** — file, view, settings, author, help (with background matching the top bar)
- **Right carousel** — tools and card types (with scroll arrows when needed)
- **Top bar** — zoom out / center / zoom in
- **Minimap** — bottom-left corner, overview of the entire board; **click to jump to any location**

---

## Cards

Each card represents an element of the investigation. Available types:

| Card | Description |
|---|---|
| **Person** | Name, role, party, photo or emoji |
| **Unknown** | Unknown person with a question mark |
| **Party** | Political group with logo and color |
| **Act** | Legal act with date and description |
| **News** | Press article with source and link |
| **Note** | Colored sticky note with free text |
| **Date** | Event with a date on a colored background |
| **YouTube** | Embedded YouTube video player |
| **Image** | Photo or graphic file (PNG, JPEG, etc.) pinned to the board |

### Adding cards

- **Drag** an icon from the right carousel onto the board
- **Click** an icon in the carousel — opens a form, card lands in the center
- After dropping, the card editor opens immediately

### Editing and deleting

- **Double-click** a card — opens the edit form
- **Right-click** a card — context menu (edit / pin / filter / delete)

---

## Pins and threads

### Pin

1. Click the **Pin** button in the right carousel — a color picker appears
2. Choose a color and click — the tool becomes active
3. Click a card — the pin appears at the center of the card
4. Each card can have **only one** pin

Available colors: red, blue, green, yellow, orange, purple, white, black, dark red, gold.

### Thread

1. Click the **Thread** button in the right carousel — a settings panel opens:
   - **Color 1** — main thread color
   - **Color 2 + striped** — striped thread with two colors
   - **Thickness** — 1× / 2× / 3× / 4×
2. Drag from one pin to another — a curve appears with an optional label
3. **Click a thread** — edit its label or delete it

Threads and pins always render **above cards** (z-index).

---

## Board navigation

| Action | Effect |
|---|---|
| Drag empty space (LMB) | Pan the view |
| Scroll | Zoom in / out |
| Right-click | Context menu |
| `Ctrl+0` | Reset view to origin |
| **Click on minimap** | Centers the view on the clicked location |

---

## Multi-select

- **Shift + click** a card — adds it to the selection (blue outline)
- **Shift + click** again — deselects
- The first Shift+click automatically pulls in the currently selected (yellow) card
- **Drag** any selected card — moves all selected cards at once
- **Delete** — removes all selected cards in one action
- Click on empty space — clears the selection

---

## Filter connections

Right-click → **Filter connections** — the board shows only that card and everything connected to it by threads. Click again or press **Esc** to return to the full view.

---

## Auto views

> **Coming soon** — the view options are visible in the menu but currently disabled.

| View | Description |
|---|---|
| **Basic** | Free layout, positions remembered |
| **Parties** | Columns by party membership |
| **Timeline** | Timeline sorted by dates |
| **Acts** | Act at the top, related people below |
| **Network** | Force-directed — connected cards attract, unconnected repel |

---

## Settings (performance)

The **Settings** panel (left panel, ⚙️) lets you tune rendering for slower machines:

| Option | Effect |
|---|---|
| Disable thread shadows | Removes drop shadows from threads |
| Disable card shadows | Removes drop shadows from cards |
| No shadows while dragging | Hides shadows only during drag |
| No shadows while panning | Hides shadows only during pan |
| Ghost drag | Shows a ghost outline instead of a solid card while dragging |
| Disable minimap | Hides the minimap entirely |

Settings are saved in `localStorage` and persist between sessions.

---

## Undo / Redo

| Shortcut | Action |
|---|---|
| `Ctrl+Z` | Undo last operation |
| `Ctrl+Y` | Redo |

History stores up to 50 steps. Every change (add, delete, move card, pin, thread) is recorded.

---

## File — save and load

**File** menu (left panel):

| Option | Description |
|---|---|
| **New board** | Clears the board (with confirmation) |
| **Export JSON** | Downloads a `.json` file of the entire board |
| **Import JSON** | Loads a board from a `.json` file |
| **Save PNG** | Downloads a screenshot of the board as an image |
| **Restore from PNG** | Restores board state from a previously exported PNG |
| **Copy URL** | Encodes the board in a URL (clipboard) — shareable link |
| **Import Notes** | Opens an image and lets you select areas to extract as cards (see below) |
| **Reset to example** | Restores the built-in demo data |

Board state is automatically saved to the browser's `localStorage`.

---

## Import Notes (OCR)

**File → 📷 Import Notes** opens a full-screen image viewer where you can select areas with the mouse:

1. Click **Import Notes** and choose any image file (PNG, JPEG, etc.)
2. Draw rectangles over the areas you want to extract
3. For each selection, choose a mode:
   - **🖼 Image** — crops the area and adds it to the board as an Image card
   - **🔤 OCR** — recognizes the text in that area (using Tesseract.js, EN+PL) and adds it as a Note card
4. Click **Add to Board** — all extractions land in a row at the center of the board, ready to reposition

> OCR requires an internet connection on first use to download the language model (~20 MB, then cached in the browser).

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+0` | Reset view |
| `Delete` | Delete selected cards |
| `Shift+Click` | Multi-select cards |
| `Esc` | Cancel selection / close filter / close menus |

---

## File structure

```
corkboard/
├── index.html       # HTML structure, left panel, carousel, bootstrap script
├── style.css        # all styles
├── app.js           # main logic: events, state, undo/redo, tools, modals
├── cards.js         # card rendering, colors, pin SVGs
├── threads.js       # SVG thread drawing (bezier, stripes, labels)
├── views.js         # view algorithms (parties, timeline, law, force-directed)
├── minimap.js       # board thumbnail in the bottom-left corner
├── export.js        # JSON/PNG/URL hash export and import
├── storage.js       # localStorage read/write
└── data-sample.js   # built-in demo data
```

---

## Roadmap

### Planned features

- 🎨 **SVG Paint and charts** — in-board drawing card with editable SVG objects (shapes, freehand, parametric curves: sinusoids, parabolas)
- 📊 **Table card** — paste or OCR a table, display it as a formatted card
- 🖌️ **Classic mini paint** — pixel/raster drawing card
- 🔊 **Sound player card** — attach and play audio files directly on the board
- 🎞️ **Animated GIF card** — display animated GIFs as board objects

### Other ideas

- 📱 E-paper displays – ready
- 🃏 Card creator — custom card templates
- 🎨 Theme / board appearance switcher
- 🗺 Auto views (parties, timeline, network, acts)
- 🧭 Navigation (breadcrumbs, view history)
- ⚙️ Simple / Pro mode toggle
- 🔌 External app integrations
- 🤖 Maybe AI integration 😅
- 📱 Android ready

---

## Running locally

No dependencies, no build steps.

```bash
# Option 1 – open directly
open index.html

# Option 2 – local server (needed for ES modules in some browsers)
npx serve .
# or
python -m http.server 8080
```

Requires a browser with ES module support (Chrome 61+, Firefox 60+, Safari 11+, Edge 79+).

---

---

# 📋 Tablica Korkowa

Stworzona metodą vibecoding · [Demo online](https://michalstankiewicz4-cell.github.io/CorkBoard/) · v1.6.0

Interaktywna tablica śledcza w stylu detektywistycznym — budowana w czystym JavaScript (ES modules), bez frameworków i narzędzi budowania. Otwórz `index.html` w przeglądarce i gotowe.

---

## Zawartość ekranu

```
┌─────────────────────────────────────────────────────────────┐
│  [📁]                                          [📌] [🧵]    │
│  [🗺]              TABLICA KORKOWA             [👤] [❓]    │
│  [⚙️]                                           [🏛️] ...    │
│  [🌟]                                                        │
│  [?]           karty · pinezki · nitki                      │
│                                                             │
│  [minimap]                                                  │
└─────────────────────────────────────────────────────────────┘
```

- **Lewy panel** — plik, widok, ustawienia, autor, pomoc (z tłem jak górny pasek)
- **Prawa karuzela** — narzędzia i typy kart (ze strzałkami przewijania gdy trzeba)
- **Górny pasek** — oddalanie / centrum / przybliżanie
- **Minimap** — lewy dolny róg, podgląd całej tablicy; **kliknij aby skoczyć do dowolnego miejsca**

---

## Karty

Każda karta reprezentuje element śledztwa. Dostępne typy:

| Karta | Opis |
|---|---|
| **Osoba** | Imię, rola, partia, zdjęcie lub emoji |
| **Nieznana** | Nieznana osoba ze znakiem zapytania |
| **Partia** | Ugrupowanie polityczne z logo i kolorem |
| **Ustawa** | Akt prawny z datą i opisem |
| **News** | Artykuł prasowy ze źródłem i linkiem |
| **Notatka** | Kolorowa karteczka z dowolnym tekstem |
| **Data** | Zdarzenie z datą na kolorowym tle |
| **Film YT** | Odtwarzacz wideo YouTube osadzony na karcie |
| **Obrazek** | Zdjęcie lub plik graficzny (PNG, JPEG itp.) przypięty do tablicy |

### Dodawanie kart

- **Przeciągnij** ikonę z prawej karuzeli na tablicę
- **Kliknij** ikonę w karuzeli — otwiera formularz, karta trafia na środek
- Po upuszczeniu od razu otwiera się edytor karty

### Edycja i usuwanie

- **Dwuklik** na kartę — otwiera formularz edycji
- **Prawy klik** na kartę — menu kontekstowe (edytuj / wbij pinezkę / filtruj / usuń)

---

## Pinezki i nitki

### Pinezka

1. Kliknij przycisk **Pinezka** w prawej karuzeli — otwiera się wybór koloru
2. Wybierz kolor i kliknij — narzędzie jest aktywne
3. Kliknij kartę — pinezka pojawia się pośrodku karty
4. Każda karta może mieć **tylko jedną** pinezkę

Dostępne kolory: czerwony, niebieski, zielony, żółty, pomarańczowy, fioletowy, biały, czarny, ciemnoczerwony, złoty.

### Nitka

1. Kliknij przycisk **Nitka** w prawej karuzeli — otwiera się panel ustawień:
   - **Kolor 1** — główny kolor nitki
   - **Kolor 2 + paskowana** — nitka prążkowana z dwóch kolorów
   - **Grubość** — 1× / 2× / 3× / 4×
2. Przeciągnij od jednej pinezki do drugiej — powstaje łuk z podpisem (opcjonalnie)
3. **Kliknij nitkę** — możliwość edycji etykiety lub usunięcia

Nitki i pinezki zawsze renderują się **ponad kartami** (z-index).

---

## Nawigacja po tablicy

| Akcja | Efekt |
|---|---|
| Przeciągnij puste miejsce (LPM) | Przesuń widok (panning) |
| Scroll | Zoom in / out |
| Prawy klik | Menu kontekstowe |
| `Ctrl+0` | Resetuj widok do punktu startowego |
| **Kliknięcie na minimapę** | Wyśrodkowuje widok na klikniętym miejscu |

---

## Zaznaczanie wielu kart

- **Shift + klik** na kartę — dodaje do zaznaczenia (niebieska obwódka)
- **Shift + klik** ponownie — odznacza
- Pierwsze Shift+klik automatycznie wciąga aktualnie wybraną (żółtą) kartę
- **Przeciągnij** dowolną zaznaczoną kartę — przesuwa wszystkie naraz
- **Delete** — usuwa wszystkie zaznaczone karty jednym ruchem
- Klik na puste miejsce — czyści zaznaczenie

---

## Filtrowanie powiązań

Prawy klik → **Filtruj powiązania** — tablica pokazuje tylko kartę i wszystko co jest z nią połączone nitkami. Ponowny klik lub **Esc** wraca do pełnego widoku.

---

## Widoki automatyczne

> **Wkrótce dostępne** — opcje widoku są widoczne w menu, ale na razie nieaktywne.

| Widok | Opis |
|---|---|
| **Podstawowy** | Swobodny układ, pozycje zapamiętane |
| **Partie** | Kolumny według przynależności partyjnej |
| **Czas** | Oś czasu według dat |
| **Ustawy** | Ustawa na górze, powiązane osoby pod spodem |
| **Sieć** | Algorytm sił — połączone karty przyciągają się, niepołączone odpychają |

---

## Ustawienia (wydajność)

Panel **Ustawienia** (lewy panel, ⚙️) pozwala dostroić renderowanie na słabszych komputerach:

| Opcja | Efekt |
|---|---|
| Wyłącz cienie nitek | Usuwa cienie pod nitkami |
| Wyłącz cienie kartek | Usuwa cienie pod kartkami |
| Brak cieni przy przeciąganiu | Ukrywa cienie tylko podczas przeciągania |
| Brak cieni przy panningu | Ukrywa cienie tylko podczas przesuwania widoku |
| Przeciągaj duchy kart | Pokazuje tylko obrys karty podczas przeciągania |
| Wyłącz minimapę | Całkowicie ukrywa minimapę |

Ustawienia są zapisywane w `localStorage` i zachowywane między sesjami.

---

## Cofnij / Ponów

| Skrót | Akcja |
|---|---|
| `Ctrl+Z` | Cofnij ostatnią operację |
| `Ctrl+Y` | Ponów |

Historia przechowuje do 50 kroków. Każda zmiana (dodanie, usunięcie, przesunięcie karty, pinezki, nitki) jest zapisywana.

---

## Plik — zapis i odczyt

Menu **Plik** (lewy panel):

| Opcja | Opis |
|---|---|
| **Nowa tablica** | Czyści tablicę (z potwierdzeniem) |
| **Eksportuj JSON** | Pobiera plik `.json` z całą tablicą |
| **Importuj JSON** | Wczytuje tablicę z pliku `.json` |
| **Zapisz PNG** | Pobiera zrzut tablicy jako obraz |
| **Przywróć z PNG** | Odtwarza stan tablicy z wcześniej wyeksportowanego PNG |
| **Kopiuj URL** | Koduje tablicę w URL (schowek) — można udostępnić link |
| **Importuj notatki** | Otwiera obraz i pozwala zaznaczać obszary do wyodrębnienia jako karty (patrz niżej) |
| **Reset do przykładu** | Przywraca przykładowe dane demonstracyjne |

Stan tablicy jest automatycznie zapisywany w `localStorage` przeglądarki.

---

## Importuj notatki (OCR)

**Plik → 📷 Importuj notatki** otwiera przeglądarkę obrazów na pełnym ekranie, gdzie zaznaczasz obszary myszą:

1. Kliknij **Importuj notatki** i wybierz dowolny plik graficzny (PNG, JPEG itp.)
2. Rysuj prostokąty na obszarach, które chcesz wyodrębnić
3. Dla każdego zaznaczenia wybierz tryb:
   - **🖼 Obrazek** — wycina obszar i dodaje go na tablicę jako kartę-obrazek
   - **🔤 OCR** — rozpoznaje tekst w obszarze (Tesseract.js, EN+PL) i dodaje jako żółtą karteczkę-notatkę
4. Kliknij **Dodaj do tablicy** — wszystkie wyodrębnione elementy trafiają w rząd na środku tablicy, gotowe do przesunięcia

> OCR wymaga połączenia z internetem przy pierwszym użyciu, aby pobrać model językowy (~20 MB, potem cache w przeglądarce).

---

## Skróty klawiszowe

| Skrót | Akcja |
|---|---|
| `Ctrl+Z` | Cofnij |
| `Ctrl+Y` | Ponów |
| `Ctrl+0` | Resetuj widok |
| `Delete` | Usuń zaznaczone karty |
| `Shift+Klik` | Zaznacz wiele kart |
| `Esc` | Anuluj wybór / zamknij filtr / zamknij menu |

---

## Struktura plików

```
corkboard/
├── index.html       # struktura HTML, lewy panel, karuzela, skrypt bootstrap
├── style.css        # wszystkie style
├── app.js           # główna logika: eventy, stan, undo/redo, narzędzia, modale
├── cards.js         # renderowanie kart, kolory, SVG pinezek
├── threads.js       # rysowanie nitek SVG (bezier, paski, etykiety)
├── views.js         # algorytmy widoków (partie, czas, prawo, force-directed)
├── minimap.js       # miniaturka tablicy w lewym dolnym rogu
├── export.js        # eksport/import JSON, PNG, URL hash
├── storage.js       # zapis/odczyt localStorage
└── data-sample.js   # przykładowe dane demonstracyjne
```

---

## W przygotowaniu

### Planowane funkcje

- 🎨 **SVG Paint i wykresy** — karta do rysowania z edytowalnymi obiektami SVG (kształty, odręczne, krzywe parametryczne: sinusoidy, parabole)
- 📊 **Karta Tabela** — wklej lub zaimportuj przez OCR tabelę i wyświetl ją jako kartę
- 🖌️ **Klasyczny mini paint** — karta do rysowania pikselowego/rastrowego
- 🔊 **Odtwarzacz dźwięku** — karta do odtwarzania plików audio bezpośrednio na tablicy
- 🎞️ **Animowany GIF** — karta wyświetlająca animowane GIF-y jako obiekty na tablicy

### Inne pomysły

- 📱 E-paper displays – ready
- 🃏 Kreator kartek — własne szablony kart do przyczepienia na tablicy
- 🎨 Zmiana stylu / wyglądu tablicy
- 🗺 Widoki automatyczne (partie, czas, sieć, ustawy)
- 🧭 Nawigacja (breadcrumbs, historia widoków)
- ⚙️ Przełącznik Simple / Pro
- 🔌 Integracja z programami zewnętrznymi
- 🤖 A być może integracja z AI 😅
- 📱 Android ready

---

## Uruchomienie

Żadnych dependencji, żadnych kroków budowania.

```bash
# Opcja 1 – otwórz bezpośrednio
open index.html

# Opcja 2 – lokalny serwer (potrzebny dla ES modules w niektórych przeglądarkach)
npx serve .
# lub
python -m http.server 8080
```

Wymaga przeglądarki z obsługą ES modules (Chrome 61+, Firefox 60+, Safari 11+, Edge 79+).
