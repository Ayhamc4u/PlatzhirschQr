# ready2order-Integration

## Ziel

ready2order liefert die zentralen Produkt- und Tischdaten für PlatzhirschQR und ist zugleich das POS-Ziel für abgeschickte Bestellungen. Die Integration trennt den technischen POS-Spiegel bewusst von den für die Web-App aufbereiteten Daten.

## Datenfluss Produkte

```text
ready2order API
      ↓
sync-ready2order-products.js
      ↓
ready_products (Raw/POS-Spiegel)
      ↓
sync-ready2order-menu.js
      ↓
menus (App-Speisekarte)
      ↓
accounts.menus
```

### `ready_products`

Enthält den möglichst vollständigen ready2order-Produktdatensatz. Das Originalobjekt wird im Feld `data` gespeichert.

Wichtige Felder:

- `restaurantID`
- `ready2orderProductId`
- `data`
- `sourceUpdatedAt`
- `syncedAt`

Der Produktsync ruft ready2order mit `includeProductVariations=true` auf. Dadurch stehen verknüpfte Varianten im Raw-Datensatz unter `data.productvariation` zur Verfügung.

### `menus`

`sync-ready2order-menu.js` erzeugt daraus die für PlatzhirschQR benötigte Projektion, unter anderem:

- Name
- Beschreibung
- Kategorie
- Preis
- Steuer
- Bild
- Sold-out-/Hidden-Status
- ready2order Product ID
- ready2order Product Type
- ready2order Product Group
- `ready2orderVariations` mit Product-ID, Name und Preis
- `availableOrderTypes` für die Freigabe nach Bestellart

Anschließend werden die aktiven Menu-ObjectIds in `accounts.menus` des Restaurants eingetragen.

## Produktsynchronisation

```bash
node scripts/sync-ready2order-products.js
node scripts/sync-ready2order-menu.js
```

Der erste Schritt synchronisiert ready2order → `ready_products`.
Der zweite Schritt synchronisiert `ready_products` → `menus` und aktualisiert den Restaurant-Account.

Wenn `ready_products` bereits aktuell mit `includeProductVariations=true` synchronisiert wurde, genügt nach Einführung oder Änderung der Variantenprojektion:

```bash
node scripts/sync-ready2order-menu.js
```

Das Script protokolliert zusätzlich, wie viele Produkte Varianten besitzen.

## Varianten im Kundenfluss

Produkte mit Varianten zeigen bereits in der Speisekarte einen sichtbaren Hinweis `Extras & Varianten verfügbar`. Über den Info-Bereich kann der Gast vor dem Hinzufügen eine Vorschau auf die verfügbaren Optionen sehen. Die eigentliche Auswahl erfolgt im Warenkorb.

Im Warenkorb sind Varianten als Mehrfachauswahl umgesetzt. Dadurch können beispielsweise bei einer Pizza mehrere Extras gleichzeitig gewählt werden. Der Gast kann zusätzlich pro Artikel einen freien Kommentar/Sonderwunsch hinterlegen.

Die Auswahl wird nicht blind aus dem Browser übernommen: Beim Absenden prüft der Server jede Varianten-ID gegen die für dieses Menüprodukt synchronisierten `ready2orderVariations`. Name und Preis werden serverseitig aus dem Menüdatensatz übernommen. Doppelte Varianten-IDs werden entfernt. Kommentare werden auf 500 Zeichen begrenzt.

## Tische

```bash
node scripts/sync-ready2order-tables.js
```

Die Tischdaten werden in `tables` gespeichert und mit `accounts.tables` verknüpft.

Wichtige Felder:

- `restaurantID`
- `username` als interner Tisch-Identifier
- `ready2orderTableId`
- `ready2orderTableAreaId`
- `qrToken`
- `qrUrl`

Bestehende QR-Tokens werden bei erneuter Synchronisation wiederverwendet.

## Abholtische

ready2order-Tische mit Namen wie:

```text
Abh1
Abh2
...
```

werden aktuell als technische Kanäle für Online-Abholbestellungen verwendet. Die Web-App wählt einen geeigneten Abholtisch aus, ohne dass der Kunde einen QR-Code scannen muss.

Die Abholtische sind eine Integrationsbrücke zu ready2order. Fachlich speichert die Bestellung zusätzlich `orderType: PICKUP`.

## Bestellungen an ready2order

`POST /api/order/place` überträgt eine abgeschickte Bestellung vor dem lokalen Speichern an:

```text
POST /v1/orders
```

Die Übertragung verwendet unter anderem:

- `table_id` aus `tables.ready2orderTableId`
- `product_id` aus `menus.ready2orderProductId`
- `item_quantity` als String
- `item_price` aus `menus.price`
- `item_vatRate` aus `menus.taxPercent`
- optional `item_comment`
- optional `item_variations`
- `price_base: gross`
- `training_mode` aus `READY2ORDER_TRAINING_MODE`

Beispiel im Trainingsmodus:

```json
{
  "table_id": 1234,
  "price_base": "gross",
  "training_mode": true,
  "items": [
    {
      "product_id": 4321,
      "item_quantity": "1",
      "item_price": "12.50",
      "item_vatRate": "20",
      "item_comment": "ohne Zwiebel",
      "item_variations": [
        {
          "product_id": 9876,
          "variation_name": "Extra Käse",
          "variation_price": 1.5
        }
      ]
    }
  ]
}
```

## Trainingsmodus

Für Entwicklung und Tests wird gesetzt:

```env
READY2ORDER_TRAINING_MODE=true
```

Der Order-Endpoint behandelt einen fehlenden Wert ebenfalls als `true`. Dadurch erzeugt eine unvollständige lokale Konfiguration nicht versehentlich Live-Bestellungen.

Erst für den Produktivbetrieb wird bewusst gesetzt:

```env
READY2ORDER_TRAINING_MODE=false
```

Die verwendete Einstellung wird zusätzlich in MongoDB pro lokaler Bestellung als `ready2orderTrainingMode` gespeichert. Eine aktive lokale Bestellung wird nicht mit einer Bestellung aus dem jeweils anderen Modus vermischt; bei einem Wechsel zwischen Training und Live wird ein neuer lokaler Order-Datensatz begonnen.

Ob und auf welchem Drucker ein Trainingsauftrag ausgegeben wird, bleibt von der ready2order-Druck-/Druckprofilkonfiguration abhängig. Für Tests sollte daher zunächst ein einzelner kontrollierter Auftrag verwendet werden.

Die lokale MongoDB-Order wird erst erstellt oder erweitert, nachdem ready2order die API-Anfrage erfolgreich beantwortet hat. Dadurch zeigt die Web-App keine erfolgreiche Bestellung an, wenn ready2order den Auftrag abgelehnt hat.

Zur Nachvollziehbarkeit speichert die lokale Order zusätzlich:

- `ready2orderTableId`
- `ready2orderOrderIds`
- `ready2orderSubmittedAt`
- `ready2orderTrainingMode`
- pro Order-Artikel `selectedVariations`
- pro Order-Artikel optional `comment`

Fehlt bei einem Tisch oder Produkt die ready2order-ID, wird die Bestellung vor dem API-Aufruf abgebrochen. Ungültige Preis-, Steuer-, Varianten- oder Produktfreigabedaten werden ebenfalls vor dem API-Aufruf abgewiesen. ready2order-HTTP-Fehler werden als Fehler an den Gast zurückgegeben und serverseitig mit Request-ID, Payload, Status und API-Antwort protokolliert; der Account-Token wird dabei nicht ausgegeben.

## Test

```bash
node scripts/test-ready2order.js
```

Verwendete Environment-Variablen:

```text
MONGODB_URI
RESTAURANT_ID
READY2ORDER_API_BASE
READY2ORDER_ACCOUNT_TOKEN
READY2ORDER_TRAINING_MODE
PUBLIC_APP_URL
```

Für einen Bestelltest über die Web-App soll lokal `READY2ORDER_TRAINING_MODE=true` gesetzt sein. Danach kann gezielt ein Produkt mit Varianten und Kommentar bestellt und der Server-Log auf `trainingMode: true` kontrolliert werden.

## Noch offen

Nach der Trainingsmodus-Verifikation folgen insbesondere Order-Lifecycle (`active` → `complete/cancel`), Synchronisation von Stornos/Abschlüssen und die spätere Produktionskonfiguration mit ausdrücklich deaktiviertem Trainingsmodus.
