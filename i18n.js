// i18n.js – internationalization: EN (default) and PL

const translations = {
  en: {
    // context menu
    'ctx.editCard':          'Edit card',
    'ctx.addPin':            'Add pin',
    'ctx.filterConnections': 'Filter connections',
    'ctx.deleteCard':        'Delete card',
    'ctx.deletePin':         'Delete pin',

    // modal titles
    'modal.person':  'Person',
    'modal.unknown': 'Unknown person',
    'modal.party':   'Party',
    'modal.law':     'Act',
    'modal.news':    'News',
    'modal.note':    'Note',
    'modal.date':    'Date',
    'modal.video':   'YouTube Video',

    // modal fields
    'field.name':        'Full name *',
    'field.role':        'Function / role',
    'field.party':       'Party',
    'field.partyColor':  'Party color',
    'field.emoji':       'Emoji (avatar)',
    'field.photo':       'Photo URL',
    'field.partyName':   'Party name *',
    'field.logo':        'Logo (emoji)',
    'field.color':       'Color (hex)',
    'field.desc':        'Description',
    'field.actTitle':    'Act title *',
    'field.date':        'Date',
    'field.source':      'Source',
    'field.headline':    'Headline *',
    'field.content':     'Content',
    'field.linkURL':     'Link URL',
    'field.accentColor': 'Accent color',
    'field.noteText':    'Note content',
    'field.noteColor':   'Color',
    'field.label':       'Label',
    'field.ytLink':      'YouTube link *',
    'field.title':       'Title (optional)',

    // buttons
    'btn.cancel':     'Cancel',
    'btn.save':       'Save',
    'btn.backToCards':'🎯 Back to cards',

    // alerts
    'alert.enterName':      'Enter a name',
    'alert.enterPartyName': 'Enter a party name',
    'alert.enterTitle':     'Enter a title',
    'alert.enterHeadline':  'Enter a headline',
    'alert.enterDate':      'Enter a date',
    'alert.enterYTLink':    'Enter a YouTube link',
    'alert.exportFailed':   'PNG export failed: ',
    'alert.invalidJSON':    'Invalid file format.',
    'alert.jsonParseError': 'JSON parse error.',
    'alert.noPNGData':      'This PNG does not contain board data.',
    'alert.noPNGHash':      'No state data in PNG metadata.',
    'alert.pngReadError':   'Error reading data from PNG.',
    'alert.html2canvasError': 'Failed to load html2canvas',

    // confirms
    'confirm.reset': 'Restore demo data?',
    'confirm.clear': 'Create a new board? Unsaved changes will be lost.',

    // toasts
    'toast.linkCopied': '📋 Link copied to clipboard!',
    'toast.copyManual': '🔗 Copy the link manually',
    'toast.linkPrompt': 'Board link:',

    // thread modal
    'thread.edit':        '✏️ Edit thread',
    'thread.label':       'Label (connection description)',
    'thread.placeholder': 'e.g. funds, voted for…',
    'thread.thickness':   'Thickness',
    'thread.thin':        'Thin',
    'thread.normal':      'Normal',
    'thread.thick':       'Thick',
    'thread.veryThick':   'Very thick',
    'thread.delete':      '🗑 Delete thread',

    // thread color picker
    'tcp.threadColor': 'Thread color',
    'tcp.stripeColor': 'Stripe color',
    'tcp.striped':     'striped',
    'tcp.thickness':   'Thickness',

    // note / date colors
    'color.r': 'Red',
    'color.g': 'Green',
    'color.b': 'Blue',
    'color.y': 'Yellow',
    'color.c': 'Cyan',
    'color.m': 'Pink',
    'color.w': 'White',

    // minimap toggle
    'minimap.hide': 'hide',
    'minimap.show': 'show',

    // left panel button labels
    'lp.file':     'File',
    'lp.view':     'View',
    'lp.options':  'Options',
    'lp.author':   'Author',
    'lp.help':     'Help',

    // Options modal
    'opt.title':       '⚙️ Options',
    'opt.performance': '⚡ Performance',
    'opt.language':    '🌐 Language',
    'opt.objects':     '🃏 Objects',
    'opt.interface':   '🖥 Interface',
    'opt.reset':       '↺ Reset to defaults',
    'opt.showAuthor':  'Show Author button',
    'opt.showView':    'Show View button',
    'opt.frame':       'Frame',
    'opt.frameRaised': 'Raised (wooden)',
    'opt.frameFlat':   'Flat',

    // file menu
    'file.newBoard':    '📄 New board',
    'file.openJSON':    '📂 Open JSON',
    'file.saveJSON':    '💾 Save JSON',
    'file.screenPNG':   '📸 Screen PNG',
    'file.restorePNG':  '🖼 Restore from PNG',
    'file.copyURL':     '🔗 Copy URL',
    'file.resetSample': '↺ Reset to example',

    // view menu
    'view.basic':    '📌 Basic',
    'view.parties':  '🏛️ Parties',
    'view.time':     '📅 Timeline',
    'view.laws':     '⚖️ Acts',
    'view.network':  '🕸️ Network',
    'tooltip.soon':  'Coming soon',

    // settings checkboxes
    'set.noThreadShadow': 'Disable thread shadows',
    'set.noCardShadow':   'Disable card shadows',
    'set.noDragShadow':   'No shadows while dragging',
    'set.noPanShadow':    'No shadows while panning',
    'set.ghostDrag':      'Ghost drag cards',
    'set.noMinimap':      'Disable minimap',
    'set.language':       'Language',

    // carousel labels
    'ci.pin':    'Pin',
    'ci.thread': 'Thread',
    'ci.person': 'Person',
    'ci.unknown':'Unknown',
    'ci.party':  'Party',
    'ci.law':    'Act',
    'ci.news':   'News',
    'ci.note':   'Note',
    'ci.date':   'Date',
    'ci.video':  'YT Video',

    // zoom bar
    'zoom.out':         'Zoom out',
    'zoom.in':          'Zoom in',
    'zoom.center':      'Center',
    'zoom.outTitle':    'Zoom out (scroll down)',
    'zoom.inTitle':     'Zoom in (scroll up)',
    'zoom.centerTitle': 'Reset view to origin (Ctrl+0)',

    // help panel
    'help.keyboard':      '⌨ Keyboard',
    'help.ctrlZ':         'Undo',
    'help.ctrlY':         'Redo',
    'help.delete':        'Delete selected',
    'help.shiftClick':    'Select multiple cards',
    'help.esc':           'Cancel selection',
    'help.mouse':         '🖱 Mouse',
    'help.click':         'Click',
    'help.clickDesc':     'Select card',
    'help.dblClick':      '2× click',
    'help.dblClickDesc':  'Edit card',
    'help.drag':          'Drag',
    'help.dragDesc':      'Move card',
    'help.shiftDrag':     'Shift+Drag',
    'help.shiftDragDesc': 'Move selected',
    'help.panDrag':       'Drag (empty)',
    'help.panDragDesc':   'Pan board',
    'help.scroll':        'Scroll',
    'help.scrollDesc':    'Zoom board',
    'help.rightClick':    'Right-click',
    'help.rightClickDesc':'Context menu',

    // author panel (paragraphs contain HTML)
    'author.title': '🌟 Enjoy what I do?',
    'author.p1':    'If my work inspired or genuinely helped you, you can support my further efforts:',
    'author.p2':    '☕ <strong>Quick support:</strong> Bank transfer or BLIK to phone number: <strong>+48 797 486 355</strong>',
    'author.p3':    '📱 <strong>Stay in touch:</strong> Facebook – <a href="https://facebook.com/MajkelMajkel" target="_blank" rel="noopener">facebook.com/MajkelMajkel</a>',
    'author.p4':    '<strong>Transfer details:</strong><br>Michał Stankiewicz<br>02-585 Warszawa<br>PKO BP<br>IBAN: PL55 1020 1097 0000 7902 0226 5353<br>Reference: "inspiration"',

    // card UI fallbacks (shown when user leaves field empty)
    'card.unknownDefault': 'Unknown person',
    'card.dateDefault':    'Date',
    'card.videoTitle':     'YouTube Video',
    'card.noYTLink':       'No YouTube link',

    // image card
    'modal.image':       'Image',
    'ci.image':          'Image',
    'field.imageFile':   'Upload file',
    'field.imageURL':    'Or image URL',
    'field.caption':     'Caption',
    'alert.noImage':     'Provide an image file or URL.',

    // import notes overlay
    'file.importNotes':  '📷 Import Notes',
    'in.title':          'Import Notes — select areas',
    'in.hint':           'Draw rectangles to select areas',
    'in.modeImage':      '🖼 Image',
    'in.modeOCR':        '🔤 OCR',
    'in.clearAll':       'Clear all',
    'in.addToBoard':     'Add to Board',
    'in.noSel':          'Draw rectangles on the image to select areas.',
    'in.recognizing':    'Recognizing…',
    'confirm.ocrPending': 'Some OCR is still running. Add items with text available so far?',
  },

  pl: {
    'ctx.editCard':          'Edytuj kartę',
    'ctx.addPin':            'Wbij pinezkę',
    'ctx.filterConnections': 'Filtruj powiązania',
    'ctx.deleteCard':        'Usuń kartę',
    'ctx.deletePin':         'Usuń pinezkę',

    'modal.person':  'Osoba',
    'modal.unknown': 'Nieznana osoba',
    'modal.party':   'Partia',
    'modal.law':     'Ustawa',
    'modal.news':    'News',
    'modal.note':    'Notatka',
    'modal.date':    'Data',
    'modal.video':   'Film YouTube',

    'field.name':        'Imię i nazwisko *',
    'field.role':        'Funkcja / rola',
    'field.party':       'Partia',
    'field.partyColor':  'Kolor partii',
    'field.emoji':       'Emoji (avatar)',
    'field.photo':       'URL zdjęcia',
    'field.partyName':   'Nazwa partii *',
    'field.logo':        'Logo (emoji)',
    'field.color':       'Kolor (hex)',
    'field.desc':        'Opis',
    'field.actTitle':    'Tytuł ustawy *',
    'field.date':        'Data',
    'field.source':      'Źródło',
    'field.headline':    'Nagłówek *',
    'field.content':     'Treść',
    'field.linkURL':     'Link URL',
    'field.accentColor': 'Kolor akcentu',
    'field.noteText':    'Treść notatki',
    'field.noteColor':   'Kolor',
    'field.label':       'Etykieta',
    'field.ytLink':      'Link YouTube *',
    'field.title':       'Tytuł (opcjonalny)',

    'btn.cancel':     'Anuluj',
    'btn.save':       'Zapisz',
    'btn.backToCards':'🎯 Wróć do kart',

    'alert.enterName':      'Podaj imię',
    'alert.enterPartyName': 'Podaj nazwę',
    'alert.enterTitle':     'Podaj tytuł',
    'alert.enterHeadline':  'Podaj nagłówek',
    'alert.enterDate':      'Podaj datę',
    'alert.enterYTLink':    'Podaj link YouTube',
    'alert.exportFailed':   'Eksport PNG nieudany: ',
    'alert.invalidJSON':    'Nieprawidłowy format pliku.',
    'alert.jsonParseError': 'Błąd parsowania JSON.',
    'alert.noPNGData':      'Ten plik PNG nie zawiera danych tablicy.',
    'alert.noPNGHash':      'Brak danych stanu w metadanych PNG.',
    'alert.pngReadError':   'Błąd odczytu danych z PNG.',
    'alert.html2canvasError': 'Nie można załadować html2canvas',

    'confirm.reset': 'Przywrócić przykładowe dane?',
    'confirm.clear': 'Utworzyć nową tablicę? Niezapisane zmiany zostaną utracone.',

    'toast.linkCopied': '📋 Link skopiowany do schowka!',
    'toast.copyManual': '🔗 Skopiuj link ręcznie',
    'toast.linkPrompt': 'Link do tablicy:',

    'thread.edit':        '✏️ Edytuj nitkę',
    'thread.label':       'Etykieta (opis połączenia)',
    'thread.placeholder': 'np. finansuje, głosował za…',
    'thread.thickness':   'Grubość',
    'thread.thin':        'Cienka',
    'thread.normal':      'Normalna',
    'thread.thick':       'Gruba',
    'thread.veryThick':   'Bardzo gruba',
    'thread.delete':      '🗑 Usuń nitkę',

    'tcp.threadColor': 'Kolor nitki',
    'tcp.stripeColor': 'Kolor paska',
    'tcp.striped':     'paskowana',
    'tcp.thickness':   'Grubość',

    'color.r': 'Czerwona',
    'color.g': 'Zielona',
    'color.b': 'Niebieska',
    'color.y': 'Żółta',
    'color.c': 'Cyjan',
    'color.m': 'Różowa',
    'color.w': 'Biała',

    'minimap.hide': 'ukryj',
    'minimap.show': 'pokaż',

    'lp.file':     'Plik',
    'lp.view':     'Widok',
    'lp.options':  'Opcje',
    'lp.author':   'Autor',
    'lp.help':     'Pomoc',

    // Okno Opcji
    'opt.title':       '⚙️ Opcje',
    'opt.performance': '⚡ Wydajność',
    'opt.language':    '🌐 Język',
    'opt.objects':     '🃏 Obiekty',
    'opt.interface':   '🖥 Interfejs',
    'opt.reset':       '↺ Przywróć domyślne',
    'opt.showAuthor':  'Pokaż przycisk Autor',
    'opt.showView':    'Pokaż przycisk Widok',
    'opt.frame':       'Ramka',
    'opt.frameRaised': 'Wypukła (drewniana)',
    'opt.frameFlat':   'Płaska',

    'file.newBoard':    '📄 Nowa tablica',
    'file.openJSON':    '📂 Otwórz JSON',
    'file.saveJSON':    '💾 Zapisz JSON',
    'file.screenPNG':   '📸 Screen PNG',
    'file.restorePNG':  '🖼 Restore from PNG',
    'file.copyURL':     '🔗 Kopiuj URL',
    'file.resetSample': '↺ Reset do przykładu',

    'view.basic':    '📌 Podstawowy',
    'view.parties':  '🏛️ Partie',
    'view.time':     '📅 Czas',
    'view.laws':     '⚖️ Ustawy',
    'view.network':  '🕸️ Sieć',
    'tooltip.soon':  'wkrótce dostępne',

    'set.noThreadShadow': 'Wyłącz cienie nitek',
    'set.noCardShadow':   'Wyłącz cienie kartek',
    'set.noDragShadow':   'Brak cieni przy przeciąganiu',
    'set.noPanShadow':    'Brak cieni przy panningu',
    'set.ghostDrag':      'Przeciągaj duchy kart',
    'set.noMinimap':      'Wyłącz minimapę',
    'set.language':       'Język',

    'ci.pin':    'Pinezka',
    'ci.thread': 'Nitka',
    'ci.person': 'Osoba',
    'ci.unknown':'Nieznana',
    'ci.party':  'Partia',
    'ci.law':    'Ustawa',
    'ci.news':   'News',
    'ci.note':   'Notatka',
    'ci.date':   'Data',
    'ci.video':  'Film YT',

    'zoom.out':         'Oddal',
    'zoom.in':          'Przybliż',
    'zoom.center':      'Centrum',
    'zoom.outTitle':    'Oddal (scroll w dół)',
    'zoom.inTitle':     'Przybliż (scroll w górę)',
    'zoom.centerTitle': 'Przywróć widok początkowy (Ctrl+0)',

    'help.keyboard':      '⌨ Klawiszologia',
    'help.ctrlZ':         'Cofnij',
    'help.ctrlY':         'Ponów',
    'help.delete':        'Usuń zaznaczone',
    'help.shiftClick':    'Zaznacz wiele kart',
    'help.esc':           'Anuluj wybór',
    'help.mouse':         '🖱 Myszologia',
    'help.click':         'Klik',
    'help.clickDesc':     'Zaznacz kartę',
    'help.dblClick':      '2× klik',
    'help.dblClickDesc':  'Edytuj kartę',
    'help.drag':          'Przeciągnij',
    'help.dragDesc':      'Przesuń kartę',
    'help.shiftDrag':     'Shift+Przeciągnij',
    'help.shiftDragDesc': 'Przesuń zaznaczone',
    'help.panDrag':       'Przeciągnij (puste)',
    'help.panDragDesc':   'Panning tablicy',
    'help.scroll':        'Scroll',
    'help.scrollDesc':    'Zoom tablicy',
    'help.rightClick':    'Prawy klik',
    'help.rightClickDesc':'Menu kontekstowe',

    'author.title': '🌟 Podoba Ci się to, co robię?',
    'author.p1':    'Jeśli moja praca była dla Ciebie inspiracją lub realną pomocą, możesz wesprzeć moje dalsze działania:',
    'author.p2':    '☕ <strong>Szybkie wsparcie:</strong> Przelew tradycyjny lub BLIK na numer telefonu: <strong>+48 797 486 355</strong>',
    'author.p3':    '📱 <strong>Bądźmy w kontakcie:</strong> Facebook – <a href="https://facebook.com/MajkelMajkel" target="_blank" rel="noopener">facebook.com/MajkelMajkel</a>',
    'author.p4':    '<strong>Dane do przelewu:</strong><br>Michał Stankiewicz<br>02-585 Warszawa<br>PKO BP<br>IBAN: PL55 1020 1097 0000 7902 0226 5353<br>Tytułem: „inspiracja"',

    'card.unknownDefault': 'Nieznana osoba',
    'card.dateDefault':    'Data',
    'card.videoTitle':     'Film YouTube',
    'card.noYTLink':       'Brak linku YouTube',

    'modal.image':       'Obrazek',
    'ci.image':          'Obrazek',
    'field.imageFile':   'Wgraj plik',
    'field.imageURL':    'Lub URL obrazka',
    'field.caption':     'Podpis',
    'alert.noImage':     'Podaj plik lub URL obrazka.',

    'file.importNotes':  '📷 Importuj notatki',
    'in.title':          'Importuj notatki — zaznacz obszary',
    'in.hint':           'Rysuj prostokąty aby wybrać obszary',
    'in.modeImage':      '🖼 Obrazek',
    'in.modeOCR':        '🔤 OCR',
    'in.clearAll':       'Wyczyść',
    'in.addToBoard':     'Dodaj do tablicy',
    'in.noSel':          'Rysuj prostokąty na obrazku aby wybrać obszary.',
    'in.recognizing':    'Rozpoznaję…',
    'confirm.ocrPending': 'OCR jeszcze trwa. Dodać elementy z dostępnym tekstem?',
  },
};

export function t(key) {
  const lang = window.appLang || 'en';
  return translations[lang]?.[key] ?? translations.en?.[key] ?? key;
}

export function setLang(lang) {
  window.appLang = lang;
  localStorage.setItem('corkboard_lang', lang);
}

export function initLang() {
  window.appLang = localStorage.getItem('corkboard_lang') || 'en';
}
