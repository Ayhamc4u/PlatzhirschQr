# Menü und Kategorien

## Kategorien

Die Kundenansicht verwendet bewusst eine kuratierte Liste von Kategorien und nicht automatisch alle Kategorien aus ready2order bzw. dem Restaurantprofil.

Aktuelle Reihenfolge für die Tischbestellung:

```text
Frühstück
Burger
Pizza
Snacks
Salate
Nachspeisen
Alkoholfreie Getränke
Kaffee & Tee
Biere
Spritzer
Longdrinks
Spirituosen
Flaschen
Weine
Sekt & Champagner
Gutscheine
```

`Würste` wurde in ready2order in `Snacks` umbenannt. Die frühere Kategorie `Toast` wird nicht mehr separat dargestellt; entsprechende Produkte gehören zu `Snacks`.

Die technischen IDs entsprechen den Slugs in `menus.category`, zum Beispiel `burger`, `snacks`, `alkoholfreie-getraenke` und `sekt-champagner`.

## Auswahlverhalten

Es ist immer genau **eine Kategorie gleichzeitig** aktiv, solange keine Suche läuft.

- Beim ersten Laden ist `Burger` vorausgewählt.
- Klick auf eine Kategorie: nur Produkte dieser Kategorie anzeigen.
- Klick auf eine andere Kategorie: vorherige Auswahl ersetzen.
- Ein erneuter Klick auf die aktive Kategorie hebt den Filter nicht auf.
- Die URL verwendet nur einen einzelnen `category`-Wert.
- Ein ungültiger Kategorieparameter fällt auf `Burger` zurück.
- Beim Wechseln zwischen Kategorien bleibt der Warenkorb erhalten.

Der aktive Kategoriebutton verwendet `Glutgold` (`#D9A441`) mit `Platzhirsch Schwarz` (`#11100E`) für den Text.

## Globale Suche

`Menü durchsuchen` ist bewusst unabhängig von der aktuell ausgewählten Kategorie.

Sobald ein Suchbegriff vorhanden ist, werden Name, Beschreibung und Kategorie über das gesamte für den aktuellen Bestellweg freigegebene Produktangebot durchsucht. Der Gast muss daher nicht mehr nacheinander Burger, Pizza, Snacks usw. öffnen.

Dabei bleibt die fachliche Freigabe erhalten:

- Tischservice durchsucht nur Produkte, die für `DINE_IN` freigegeben sind.
- Abholung durchsucht nur Produkte, die für `PICKUP` freigegeben sind.
- global versteckte Produkte erscheinen nicht.

Die Suche darf also niemals dazu führen, dass ein für den aktuellen Bestellweg gesperrtes Produkt sichtbar oder bestellbar wird.

Beim Löschen der Suche greift wieder die zuvor ausgewählte Kategorie; ohne gültige Auswahl ist `Burger` der Standard.

## Abholung

Die öffentliche Abholung zeigt bewusst nur den online bestellbaren Ausschnitt der Speisekarte. In diesem Modus werden ausschließlich folgende Kategoriebuttons angeboten:

```text
Burger
Pizza
Snacks
Salate
Nachspeisen
Abhofverkauf
```

`Abhofverkauf` ist **keine ready2order-Produktkategorie**, sondern eine virtuelle Oberkategorie der Abholansicht. Sie fasst ausschließlich Produkte aus `Öl`, `Most` und `Wein` zusammen. Technisch werden dafür die Slugs `oel`, `most` und `wein` verwendet.

Wichtig: `Weine` (`weine`) ist eine eigene Kategorie für die Weine im Lokal und gehört **nicht** zum Abhofverkauf. `Wein` (`wein`) im Singular bezeichnet die Wein-Produkte des Abhofverkaufs.

Die einzelnen Unterkategorien `Öl`, `Most` und `Wein` werden im Abholmodus nicht als eigene Buttons dargestellt. Ein Klick auf `Abhofverkauf` zeigt die Produkte aller drei Gruppen gemeinsam.

Die endgültige Berechtigung eines Produkts wird nicht mehr allein aus seiner Kategorie abgeleitet, sondern über `availableOrderTypes` gespeichert und beim Absenden serverseitig kontrolliert. Siehe `PRODUCT_AVAILABILITY.md`.

## Kategorie-Navigation

Die Kategorien sind als kompakte rechteckige Buttons umgesetzt.

- niedrige Buttonhöhe
- kleine Radien statt Pillenform
- keine horizontale Scrollleiste
- auf Mobil drei kompakte Spalten, auf sehr schmalen Geräten zwei
- aktive Kategorie wird mit Glutgold hervorgehoben
- lange Namen dürfen umbrechen
- sichtbarer Tastatur-Fokus über `:focus-visible`

## Menü-Header

Die frühere große Überschrift `Menü Kategorien` im sticky Header wurde entfernt. Sie hat gegenüber der Kategorienavigation und der Suche keinen zusätzlichen Informationswert geboten und auf kleineren Ansichten unnötig Platz belegt.

Der Header konzentriert sich jetzt auf:

- Rückkehr zur Startseite
- globale Menüsuche
- bei Tischbestellungen den lesbaren aktuellen Tisch
- je nach Zustand Bestell-/Warenkorbaktionen

Der QR-Token wird weiterhin nicht angezeigt.

## Mengenwahl

Produkte können ausgewählt und Mengen verändert werden, sobald ein gültiger Bestellkontext vorhanden ist.

- Bei Menge `0` wird ein großer `+`-Button angezeigt.
- Danach wird daraus `− 1 +`.
- Beim Wechseln zwischen Kategorien bleibt der Warenkorb erhalten.
- Auf Mobilgeräten sind die Bedienelemente mindestens 44 px hoch.

## Speisenkarten

### Desktop / Tablet

- Kartenraster mit automatisch passender Spaltenzahl
- Produktbild oben, wenn vorhanden
- Name und kurze Beschreibung darunter
- Preis unten links
- Mengensteuerung unten rechts

### Mobil

Unter etwa 750 px wechseln die Karten in ein Listenlayout:

```text
[ Bild ]  Produktname
          kurze Beschreibung
          12,50 €      − 1 +
```

Produkte ohne Bild nutzen denselben Aufbau ohne leere Bildfläche.

## Leere Such- und Filterergebnisse

Wenn Suche oder Kategorie keine sichtbaren Produkte liefern, erscheint ein klarer Empty-State. Bei einer erfolglosen Suche kann der Gast direkt zur Standardkategorie `Burger` zurückkehren.

## Mobiler Warenkorb

Sobald mindestens ein Artikel ausgewählt ist und ein gültiger Bestellkontext besteht, erscheint auf Mobilgeräten eine dauerhaft erreichbare Aktionsleiste.

Sie ist kein Overlay über dem Menü, sondern ein eigener fester Bereich unter dem scrollbaren Menü und zeigt Artikelanzahl, Warenkorbwert und `Bestellung prüfen →`.

## Warenkorb / Checkout

Der Gast-Checkout ist auf Auswahl, Artikelanzahl, Gesamtpreis und eine finale Hauptaktion reduziert.

Finale Aktionen:

- `Bestellung absenden`
- `Abholbestellung absenden`
- bei bereits bestehender Bestellung: `Zur Bestellung hinzufügen`

Eine Online-Zahlung ist aktuell nicht Teil dieses Flows. Die UI darf deshalb noch nicht mit `Bezahlen` oder `Zur Kasse` beschriftet werden.

## Menü-Footer

Am Ende der Menüansicht gibt es einen schlanken Platzhirsch-Footer mit Adresse, Telefon, E-Mail, Öffnungszeiten sowie Links zu Webseite und Tischreservierung.

## Mobile-UI-Prinzipien

- kein notwendiges horizontales Scrollen
- kompakte Kategorienavigation
- große Touch-Ziele
- möglichst wenige modale Zwischenschritte
- Produktinformationen direkt sichtbar
- Warenkorb bleibt beim Kategorienwechsel erhalten
- Preis immer klar sichtbar
- wichtige Bestellaktionen mit einer Hand erreichbar

## Admin-Menü

Der Dashboard-Menüpunkt `Menü` orientiert sich visuell an der Kundenansicht. Kategorien werden oben als kompakte Karten dargestellt; die frühere Überschrift `Menu Categories` entfällt. Ein Klick auf eine Kategorie filtert die darunter angezeigten Produkte. Die Produktüberschrift lautet `Unser Menü`.

Auch die Produktkarten folgen dem Kundenlayout: Produktbild, Name, Beschreibung und Preis verwenden denselben grundsätzlichen Aufbau wie im öffentlichen Menü. Anstelle der Mengensteuerung zeigt der Admin-Bereich drei Verfügbarkeitsoptionen:

- `Inaktiv` – Produkt bzw. Kategorie soll vollständig unsichtbar sein,
- `Abholung` – für Pickup freigeben,
- `Am Tisch` – für Dine-in freigeben.

Die Optionen sind in der aktuellen Ausbaustufe bewusst nur eine Frontend-Vorschau. Änderungen wirken nur lokal in der geöffneten Seite und werden noch nicht gespeichert. Die persistente Kategorie-/Produktlogik und die Admin-API werden im nächsten Schritt ergänzt.
