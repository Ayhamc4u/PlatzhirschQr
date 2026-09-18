# Online-Abholung

## Ziel

Kunden sollen Platzhirsch ohne QR-Code öffentlich öffnen und Essen zur Abholung bestellen können. Abholung darf auch im Voraus bestellt werden, solange der gewählte Abholzeitpunkt innerhalb der gültigen Service- und Kategoriezeiten liegt.

Technischer Pickup-Einstieg:

```text
/platzhirsch?pickup=1&tab=menu
```

## Kundendaten

Für die erste Abholbestellung werden Vorname, Nachname und Telefonnummer in einem kompakten Schritt abgefragt. Ist `Für das nächste Mal merken` oder der Newsletter aktiviert, ist zusätzlich eine gültige E-Mail-Adresse erforderlich.

Der Dialog endet mit `Weiter`. Nach erfolgreicher Anmeldung öffnet sich direkt `Deine Bestellung`.

## Warenkorb und Abholzeit

Im Pickup-Warenkorb erscheint unter der Produktauswahl der Bereich **Abholzeit**. Der Kunde wählt zuerst einen verfügbaren Tag und danach einen konkreten Zeit-Slot.

Die Slots werden serverseitig über

```text
POST /api/order/pickup-slots
```

erzeugt. Der Request enthält die Produkt-IDs des aktuellen Warenkorbs. Der Server berücksichtigt dabei:

- `orderPause.all` und `orderPause.pickup`
- allgemeine `serviceHours`
- optionale `categoryAvailability` aller Warenkorb-Produkte
- Produktfreigabe für `PICKUP`
- Vorlaufzeit
- Slot-Intervall
- maximale Vorausbestellzeit

Standardwerte im Restaurantprofil:

```text
pickupPreparationMinutes = 20
pickupSlotMinutes = 15
pickupAdvanceDays = 7
```

Es werden nur Zeiten angeboten, zu denen der **gesamte Warenkorb** verfügbar ist. Enthält der Warenkorb z. B. eine Pizza, deren Kategorie nur von 17:00 bis 21:00 verfügbar ist, werden keine Pickup-Slots außerhalb dieses Zeitfensters angeboten.

Die erste verfügbare Zeit wird als nächstmögliche Abholung vorausgewählt. Vor dem endgültigen Versand zeigt die Bestellübersicht die gewählte Abholzeit nochmals deutlich an.

## Serverseitige Prüfung

Die gewählte Zeit wird als `requestedPickupAt` an

```text
POST /api/order/place
```

gesendet. Der Server prüft sie dort erneut gegen dieselben Regeln. Ein veralteter Browserzustand oder ein manipuliertes Frontend kann damit keine ungültige Zeit erzwingen.

Für `DINE_IN` wird dagegen immer der aktuelle Zeitpunkt in `Europe/Vienna` gegen Service- und Kategoriezeiten geprüft.

Wenn das Absenden fehlschlägt, bleibt der Warenkorb erhalten. Der Kunde kann die Abholzeit korrigieren und erneut bestellen.

## Bestellabschluss

Der Ablauf ist:

```text
Kundendaten
→ Deine Bestellung
→ Mengen / Extras / Kommentare prüfen
→ Abholzeit wählen
→ Weiter
→ finale Bestellübersicht mit Abholzeit
→ Jetzt bestellen
```

Erst `Jetzt bestellen` löst die tatsächliche Bestellung aus.

## Speicherung

Pickup-Bestellungen speichern den fachlichen Bestelltyp `PICKUP` und zusätzlich den gewählten Zeitpunkt:

```text
requestedPickupAt
```

`estimatedReadyAt` entspricht bei einer geplanten Abholung diesem Zeitpunkt. Dadurch können UI, Bestellhistorie und ready2order-Kontaktzettel dieselbe Zeit verwenden.

## Kontaktzettel für ready2order

Für Pickup kann das technische 0-Euro-Produkt aus `READY2ORDER_CONTACT_PRODUCT_ID` mitgesendet werden. Für Platzhirsch ist dafür `ONLINE KONTAKTZETTEL` vorgesehen.

Der Kommentar enthält unter anderem:

```text
ABHOLUNG: Abh X
GEWÜNSCHT: HH:MM UHR
Vorname Nachname
Tel: +43 ...
Referenz: <request-id>
```

Die E-Mail-Adresse wird nicht gedruckt.

## Technische Abholtische

Für die ready2order-Integration werden weiterhin ausschließlich `Abh1` bis `Abh10` verwendet. `Abh1` bis `Abh5` sind die automatischen Plätze, `Abh6` bis `Abh10` die Reserveplätze.

Vorbestellungen dürfen die technischen Abholtische nicht stundenlang blockieren. Deshalb zählen geplante Pickup-Bestellungen für die aktuelle Belegung nur dann als operativ relevant, wenn ihre `requestedPickupAt` innerhalb des aktuellen 60-Minuten-Fensters liegt. Zukünftige Vorbestellungen außerhalb dieses Fensters bleiben gespeichert, belegen aber keinen aktuellen Abholplatz in der Kapazitätsberechnung.

Alte Pickup-Bestellungen ohne geplante Abholzeit verwenden weiterhin die bisherige 60-Minuten-Regel auf Basis von `updatedAt`/`createdAt`.

## Automatische und manuelle Annahme

Die bestehende Regel bleibt erhalten:

```text
Abh1-Abh5 frei
UND geschätzter Abstand bis zur Abholung <= 30 Minuten
→ automatisch annehmen
```

Weiter entfernte Vorbestellungen oder Bestellungen auf Reserveplätzen benötigen weiterhin eine manuelle Bestätigung. Das verhindert, dass lange im Voraus bestellte Abholungen automatisch als unmittelbar abholbereit behandelt werden.

## Produktverfügbarkeit

Jedes Produkt wird beim Bestellabschluss gegen `availableOrderTypes` geprüft. Zusätzlich wird die Kategorie des Produkts gegen den gewählten Pickup-Zeitpunkt geprüft. Produktfreigabe und Zeitfreigabe sind damit zwei getrennte Regeln.

## Zeitzone

Alle fachlichen Zeitprüfungen verwenden:

```text
Europe/Vienna
```

Die Geschäftszeiten behandeln `00:00` als Ende des vorherigen Abendfensters.

## Weiterführend

Siehe auch:

- `BUSINESS_HOURS.md`
- `PRODUCT_AVAILABILITY.md`
- `CUSTOMER_ACCOUNTS.md`
