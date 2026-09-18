# Geschäftszeiten und zeitliche Verfügbarkeit

## Ebenen

Die zeitliche Verfügbarkeit ist bewusst in drei Ebenen getrennt:

1. **Bestellstatus** als manueller Sofort-Stopp.
2. **Allgemeine Öffnungs- und Speise-/Servicezeiten** auf Restaurant-Ebene.
3. **Kategoriezeiten** als zusätzliche Einschränkung einzelner Menübereiche, z. B. Pizza.

Produktbezogene Freigaben für `PICKUP` und `DINE_IN` bleiben davon getrennt und werden weiterhin über die Menü-Verfügbarkeit verwaltet.

## Bestellstatus

Im Restaurantprofil werden drei unabhängige Werte gespeichert:

- `orderPause.all`
- `orderPause.pickup`
- `orderPause.dineIn`

`all` hat immer Vorrang. Wird der Hauptschalter wieder aufgehoben, bleiben die zuvor gesetzten Einzelpausen erhalten.

Die Pausen werden beim tatsächlichen Bestellabschluss serverseitig in `POST /api/order/place` geprüft. Bereits bestehende Bestellungen werden dadurch nicht verändert.

## Öffnungs- und Servicezeiten

`openingHours` und `serviceHours` speichern für jeden Wochentag entweder `closed: true` oder ein bis zwei Zeitfenster. Dadurch sind geteilte Tageszeiten wie `09:00–13:00` und `17:00–00:00` möglich.

Die Admin-Seite **Geschäftszeiten** startet bei einem noch nicht konfigurierten Profil mit den aktuellen Platzhirsch-Zeiten:

- Montag/Dienstag: 09:00–13:00
- Mittwoch bis Samstag: 09:00–13:00 und 17:00–00:00
- Sonntag: geschlossen

Die Zeiten werden über `POST /api/admin/business-hours` gespeichert. Der Endpunkt ist admin- und restaurantgebunden und unterstützt Teilaktualisierungen, damit Pausenschalter unabhängig von noch nicht gespeicherten Zeitänderungen sofort geschrieben werden können.

## Kategoriezeiten

`categoryAvailability` speichert optionale Wochenpläne pro Kategorie. Fehlt für eine Kategorie ein eigener Plan, erbt sie automatisch die allgemeinen `serviceHours`.

Im Menü-Admin hat jede Kategorie einen Bereich **Zeiten bearbeiten** mit zwei Modi:

- **Allgemeine Servicezeiten**: kein eigener Kategorieplan.
- **Eigene Zeiten**: sieben Wochentage mit bis zu zwei Zeitfenstern pro Tag.

Beispiel Pizza:

- Mittwoch: 17:00–21:00
- Donnerstag bis Samstag: 11:30–13:00 und 17:00–21:00
- Montag, Dienstag und Sonntag: geschlossen

Gespeichert wird über `POST /api/admin/menu/category-hours`. Das Zurücksetzen auf die allgemeinen Servicezeiten sendet `schedule: null` und entfernt den Kategorie-Override.

## Effektive Verfügbarkeit

Die effektive Verfügbarkeit ist die Schnittmenge aus:

- manuellem Bestellstatus,
- allgemeiner Servicezeit,
- optionaler Kategoriezeit,
- Produktfreigabe für den jeweiligen Bestelltyp.

Die serverseitige Zeitprüfung verwendet `Europe/Vienna`; `00:00` wird als Ende des vorherigen Abendfensters behandelt.

Für `DINE_IN` wird beim Bestellabschluss gegen den aktuellen Zeitpunkt geprüft. Für `PICKUP` wird nicht der Zeitpunkt des Bestellabschlusses verwendet, sondern der vom Gast gewählte zukünftige Abholzeitpunkt.

## Abholzeit-Slots

Das Restaurantprofil enthält zusätzlich die Pickup-Konfiguration:

- `pickupPreparationMinutes` — Standard: 20 Minuten
- `pickupSlotMinutes` — Standard: 15 Minuten
- `pickupAdvanceDays` — Standard: 7 Tage

`POST /api/order/pickup-slots` erhält die Produkt-IDs des aktuellen Warenkorbs und erzeugt ausschließlich Slots, zu denen der gesamte Warenkorb verfügbar ist. Dafür werden die allgemeinen Servicezeiten und alle vorhandenen Kategoriezeiten der enthaltenen Produkte geschnitten.

Beispiel: Enthält der Warenkorb Pizza mit einer Kategoriezeit von 17:00–21:00, werden keine Abholzeiten außerhalb dieses Fensters angeboten, auch wenn die allgemeinen Servicezeiten länger gelten.

Die gewählte Zeit wird als `requestedPickupAt` an `POST /api/order/place` gesendet und dort nochmals vollständig geprüft. Dadurch kann ein manipuliertes oder veraltetes Frontend keine ungültige Abholzeit erzwingen.
