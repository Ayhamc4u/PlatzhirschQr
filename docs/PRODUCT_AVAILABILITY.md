# Produktverfügbarkeit nach Bestellart

## Ziel

Die Verfügbarkeit eines Produkts darf nicht dauerhaft aus seiner ready2order-Kategorie abgeleitet werden. Produkte derselben Kategorie können unterschiedliche Regeln haben.

Beispiele:

- ein Burger kann für Tischservice und Abholung verfügbar sein,
- ein Wein aus `Weine` kann nur im Lokal angeboten werden,
- `Wein` aus dem Abhofverkauf kann für Abholung freigegeben sein,
- eine saisonale Nacho Box kann zeitweise nur im Lokal oder gar nicht bestellbar sein,
- Mehlspeisen für Veranstaltungen können in ready2order vorhanden sein, ohne im normalen Online-Angebot zu erscheinen.

## Datenmodell

Jedes Menüprodukt besitzt in MongoDB das Feld:

```ts
availableOrderTypes: Array<"DINE_IN" | "PICKUP" | "DELIVERY">
```

Zusätzlich steuert `hidden`, ob das Produkt grundsätzlich sichtbar sein darf.

Beispiele:

```ts
hidden: false
availableOrderTypes: ["DINE_IN", "PICKUP"]
```

```ts
hidden: false
availableOrderTypes: ["DINE_IN"]
```

```ts
hidden: true
availableOrderTypes: []
```

`DELIVERY` ist bereits als möglicher Bestelltyp im Schema vorgesehen, wird derzeit aber noch nicht als Kundenflow angeboten.

## Admin-Oberfläche

Der Menüpunkt `Menü` im Dashboard bearbeitet diese Felder direkt. Sowohl Kategorien als auch einzelne Produkte haben drei Auswahlmöglichkeiten:

- `Inaktiv`: setzt `hidden = true` und entfernt die aktuellen Bestellarten,
- `Abholung`: aktiviert `PICKUP`,
- `Am Tisch`: aktiviert `DINE_IN`.

`Abholung` und `Am Tisch` können gleichzeitig aktiv sein. Wird bei einem aktiven Eintrag die letzte Bestellart deaktiviert, wechselt die Oberfläche automatisch auf `Inaktiv`. Wird `Inaktiv` wieder deaktiviert, wird als sicherer Standard zunächst `Am Tisch` aktiviert.

Die Produktauswahl ändert genau ein Produkt. Die Auswahl auf einer Kategorie schreibt denselben Zustand auf alle Produkte dieser Kategorie. Nach erfolgreichem Speichern wird der Admin-Datensatz neu geladen, damit Kategorie- und Produktanzeige denselben MongoDB-Stand zeigen.

## Admin-API

Die Schreibschnittstelle ist:

```text
POST /api/admin/menu/availability
```

Für ein einzelnes Produkt:

```json
{
  "itemId": "<menu-id>",
  "hidden": false,
  "availableOrderTypes": ["DINE_IN", "PICKUP"]
}
```

Für eine komplette Kategorie:

```json
{
  "category": "burger",
  "hidden": false,
  "availableOrderTypes": ["DINE_IN", "PICKUP"]
}
```

Es darf entweder `itemId` oder `category` gesetzt sein, nicht beides gleichzeitig. Die Route:

- verlangt eine gültige Admin-Session,
- bindet Schreibvorgänge an `session.username` und damit an das angemeldete Restaurant,
- validiert `hidden` und die erlaubten Bestelltypen,
- verlangt bei aktiven Einträgen mindestens eine Bestellart,
- kann ein einzelnes Produkt oder alle Produkte einer Kategorie aktualisieren.

Für `hidden = true` speichert die API bewusst `availableOrderTypes: []`.

Die ältere Route `POST /api/admin/menu/hidden` bleibt vorerst kompatibel vorhanden, ist nun aber ebenfalls auf Admin-Rolle und das angemeldete Restaurant begrenzt. Die neue Dashboard-Oberfläche verwendet ausschließlich `/api/admin/menu/availability`.

## ready2order-Synchronisation

`scripts/sync-ready2order-menu.js` setzt `availableOrderTypes` nur beim erstmaligen Anlegen eines Produkts bzw. einmalig bei alten Datensätzen, bei denen das Feld noch fehlt.

Aktuelle Initialwerte:

- grundsätzlich `DINE_IN`
- zusätzlich `PICKUP` für die derzeit freigegebenen Abholkategorien:
  - `burger`
  - `pizza`
  - `snacks`
  - `salate`
  - `nachspeisen`
  - `oel`
  - `most`
  - `wein`

Wichtig: `weine` gehört nicht zum Abhofverkauf und erhält dadurch nicht automatisch `PICKUP`.

Nach der Initialisierung überschreibt ein späterer ready2order-Sync das Feld bewusst **nicht**. Manuelle Admin-Auswahlen bleiben damit auch nach Produkt-, Preis-, Bild- oder Kategoriesynchronisation erhalten.

## Serverseitige Sicherheitsgrenze

`POST /api/order/place` bestimmt die Bestellart aus dem tatsächlichen Bestellkontext und prüft jedes Produkt unmittelbar vor der Übertragung an ready2order.

Ein Produkt wird nur akzeptiert, wenn:

```text
orderType ∈ menuItem.availableOrderTypes
```

Damit reicht es nicht, einen versteckten oder im Frontend nicht sichtbaren Artikel per manipuliertem Request zu senden.

Zusätzlich wird geprüft, dass das Produkt zum selben Restaurant gehört und nicht global als `hidden` markiert ist.

## Order-Modell

Neue Bestellungen speichern den Bestelltyp explizit:

```ts
orderType: "DINE_IN" | "PICKUP" | "DELIVERY"
```

Aktuell entstehen praktisch `DINE_IN` und `PICKUP`. Die technischen `Abh1` bis `Abh10` bleiben für ready2order weiterhin die Routing-Brücke für Pickup, sind aber nicht mehr die fachliche Definition des Bestelltyps.

## Saisonale und zeitabhängige Regeln

Für den aktuellen Stand reicht die manuelle Freigabe über `availableOrderTypes`.

Saisonale Automatik sollte später als zusätzliche Ebene ergänzt werden, zum Beispiel:

```ts
availabilityRules: {
  activeFrom?: Date;
  activeUntil?: Date;
}
```

Diese Zeitregeln sollen `availableOrderTypes` ergänzen, nicht ersetzen. So bleibt die grundlegende Zuordnung Tisch/Abholung/Lieferung stabil und kann zusätzlich zeitlich eingeschränkt werden.
