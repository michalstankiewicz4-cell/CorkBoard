# 📋 Tablica Korkowa
app online -> https://michalstankiewicz4-cell.github.io/CorkBoard/
<img width="1915" height="946" alt="image" src="https://github.com/user-attachments/assets/7d34b93c-0ec4-4d66-b5b5-9cc37e0e66da" />

Interaktywna tablica śledcza w stylu detektywistycznym — budowana w czystym JavaScript (ES modules), bez frameworków i narzędzi budowania. Otwórz `index.html` w przeglądarce i gotowe.

---

## Zawartość ekranu

```
┌─────────────────────────────────────────────────────────────┐
│  [?]                                           [📌] [🧵]    │
│  [📁]                  TABLICA KORKOWA         [👤] [❓]    │
│  [🗺]                                           [🏛️] ...    │
│                                                             │
│              karty · pinezki · nitki                        │
│                                                             │
│  [minimap]                                                  │
└─────────────────────────────────────────────────────────────┘
```

- **Lewy panel** — pomoc, plik, widok
- **Prawa karuzela** — narzędzia i typy kart
- **Minimap** — lewy dolny róg, podgląd całej tablicy

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

Menu **Widok** (lewy panel) układa karty automatycznie:

| Widok | Opis |
|---|---|
| **Podstawowy** | Swobodny układ, pozycje zapamiętane |
| **Partie** | Kolumny według przynależności partyjnej |
| **Czas** | Oś czasu według dat |
| **Ustawy** | Ustawa na górze, powiązane osoby pod spodem |
| **Sieć** | Algorytm sił — połączone karty przyciągają się, niepołączone odpychają |

Widok Sieć oblicza 120 iteracji asynchronicznie (nie blokuje UI).

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
| **Eksportuj JSON** | Pobiera plik `.json` z całą tablicą |
| **Importuj JSON** | Wczytuje tablicę z pliku `.json` |
| **Zapisz PNG** | Pobiera zrzut tablicy jako obraz |
| **Kopiuj URL** | Koduje tablicę w URL (schowek) — można udostępnić link |
| **Reset do przykładu** | Przywraca przykładowe dane demonstracyjne |
| **Wyczyść tablicę** | Usuwa wszystko |

Stan tablicy jest automatycznie zapisywany w `localStorage` przeglądarki.

---

## Skróty klawiszowe

| Skrót | Akcja |
|---|---|
| `Ctrl+Z` | Cofnij |
| `Ctrl+Y` | Ponów |
| `Delete` | Usuń zaznaczone karty |
| `Shift+Klik` | Zaznacz wiele kart |
| `Esc` | Anuluj wybór / zamknij filtr |

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
