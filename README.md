# PlatzhirschQR

PlatzhirschQR ist die Bestellplattform für den Platzhirsch. Die Anwendung verbindet die Speisekarte aus ready2order mit zwei Bestellwegen:

1. **Im Lokal:** Bestellung über den QR-Code am Tisch.
2. **Online:** Bestellung von außerhalb zur Abholung.

Das Projekt basiert auf Next.js, React, MongoDB, NextAuth und SCSS. Die aktive Entwicklung findet derzeit im Branch `refactor/platzhirsch-core` statt.

## Aktueller Funktionsumfang

- Speisekarte und Produktdaten aus ready2order synchronisieren
- Tische aus ready2order synchronisieren
- stabile QR-Tokens für Tischbestellungen
- explizite Bestelltypen `DINE_IN` und `PICKUP` im Order-Modell; `DELIVERY` ist für später vorbereitet
- produktbezogene Freigabe je Bestellart über `availableOrderTypes`
- serverseitige Prüfung, ob ein Produkt für Tischservice bzw. Abholung freigegeben ist
- konfigurierbarer ready2order-Trainingsmodus für Entwicklungs- und Testbestellungen
- Online-Bestellung zur Abholung mit eingeschränktem Menü
- globale Produktsuche innerhalb des jeweils freigegebenen Bestellangebots
- Abholzeit anhand der aktuellen Auslastung schätzen
- automatische Annahme nur bei freiem `Abh1`–`Abh5` und höchstens 30 Minuten geschätzter Abholzeit
- Reserve über `Abh6`–`Abh10` mit manueller Bestätigung
- Abholbestellung bei vollständig belegten `Abh1`–`Abh10` sperren
- Preise im österreichischen Euro-Format anzeigen
- MongoDB als Applikationsdatenbank
- mehrstufiges Production-Dockerfile mit Next.js-Standalone-Runner
- ready2order-Synchronisation beim Containerstart
- GitHub Actions Workflow für Docker-/OCI-Packages in GHCR

Im Abholmenü ist `Burger` die Standardkategorie. `Abhofverkauf` ist dort eine virtuelle Oberkategorie für `Öl`, `Most` und `Wein`; die Kategorie `Weine` bleibt ausschließlich der Speisekarte im Lokal zugeordnet.

Die ready2order-Kategorie entscheidet nicht dauerhaft darüber, über welchen Bestellweg ein Produkt verkauft werden darf. Diese Zuordnung wird pro Produkt gespeichert, damit sie später im Admin-Bereich unabhängig für Tischservice, Abholung und Lieferung gepflegt werden kann.

Weitere technische Details befinden sich unter [`docs/`](docs/README.md). Container- und Package-Details stehen in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Voraussetzungen für lokale Entwicklung

Empfohlen:

- Linux / WSL / macOS
- Git
- nvm
- Zugriff auf die MongoDB
- ready2order Account Token für Synchronisationen

Die Projektversionen sind festgelegt auf:

- Node.js **22.22.3** (`.nvmrc`)
- pnpm **11.25.0** (`package.json` / Corepack)

## Lokale Installation

Repository klonen bzw. aktualisieren:

```bash
git clone https://github.com/InterCroneworldOrg/PlatzhirschQR.git
cd PlatzhirschQR
git checkout refactor/platzhirsch-core
git pull
```

Danach reicht normalerweise:

```bash
source ./setup.sh
```

Das Setup-Script lädt/aktiviert die korrekte Node-Version, aktiviert pnpm über Corepack, installiert die Abhängigkeiten, erstellt bei Bedarf `.env.local` aus `.env.example` und prüft die benötigten Environment-Variablen.

Anschließend:

```bash
pnpm dev
```

`pnpm dev` synchronisiert vor dem Start Produkte, Menüs und Tische aus ready2order und startet die Anwendung anschließend lokal auf Port `3050`.

Die Anwendung läuft lokal unter:

```text
http://localhost:3050
```

Ausführliche Hinweise und Fehlerbehebung: [`docs/LOCAL_DEVELOPMENT.md`](docs/LOCAL_DEVELOPMENT.md).

## Lokale Umgebungsvariablen

Echte Zugangsdaten gehören ausschließlich in `.env.local`. Diese Datei wird absichtlich **nicht** in Git eingecheckt.

Die versionierte Vorlage liegt in:

```text
.env.example
```

Aktuell erwartete Variablen:

```env
MONGODB_URI="mongodb://USER:PASSWORD@HOST:27017/qrorder?authSource=admin"
RESTAURANT_ID=platzhirsch
PUBLIC_APP_URL=http://localhost:3050

READY2ORDER_API_BASE=https://api.ready2order.com/v1
READY2ORDER_ACCOUNT_TOKEN=DEIN_TOKEN
READY2ORDER_TRAINING_MODE=true

NEXTAUTH_URL=http://localhost:3050
NEXTAUTH_SECRET=DEIN_SECRET

DINEIN_QR_SECRET=DEIN_LOKALES_SECRET
DINEIN_ACCESS_MODE=development

SYNC_READY2ORDER_ON_STARTUP=true
```

Für lokale Entwicklung und Tests soll `READY2ORDER_TRAINING_MODE=true` gesetzt sein. Der Bestell-Endpoint behandelt einen fehlenden Wert ebenfalls sicherheitshalber als Trainingsmodus. Erst für den echten Produktivbetrieb wird die Variable bewusst auf `false` gesetzt.

`SYNC_READY2ORDER_ON_STARTUP` wird vom Docker-Container verwendet. Standardmäßig werden Produkte, Menüs und Tische vor dem Start des Next.js-Servers synchronisiert.

Wichtig bei MongoDB:

```text
...:27017/qrorder?authSource=admin
```

`qrorder` ist die Datenbank mit den Platzhirsch-Daten. `authSource=admin` bezeichnet nur die Datenbank, gegen die sich der MongoDB-Benutzer authentifiziert.

`.env.test` darf nur Dummy-/Testwerte enthalten. `.env.example` darf ausschließlich Platzhalter enthalten.
