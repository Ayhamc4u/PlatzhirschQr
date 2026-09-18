# Lokale Entwicklungsumgebung

## Ziel

Ein neuer Rechner soll PlatzhirschQR mit möglichst wenigen Schritten reproduzierbar starten können.

## Versionen

- Node.js: `22.22.3`
- pnpm: `12.3.4`
- Entwicklungsport: `3050`

Die Node-Version ist in `.nvmrc` hinterlegt. Die pnpm-Version ist zusätzlich über `packageManager` in `package.json` festgelegt.

## Empfohlener Setup-Weg

Repository klonen bzw. aktualisieren:

```bash
git clone https://github.com/InterCroneworldOrg/PlatzhirschQR.git
cd PlatzhirschQR
git checkout refactor/platzhirsch-core
git pull
```

Danach das lokale Setup laden:

```bash
source ./setup.sh
```

`setup.sh` übernimmt:

- vorhandenes `nvm` laden
- Node.js `22.22.3` installieren/aktivieren
- Node.js `22.22.3` als `nvm`-Default setzen
- `nvm` dauerhaft in `~/.bashrc` aktivieren
- die `nvm`-Default-Version in neuen Bash-Terminals automatisch aktivieren
- Corepack aktivieren
- pnpm `12.3.4` aktivieren
- Abhängigkeiten mit `pnpm install --frozen-lockfile` installieren
- `.env.local` aus `.env.example` erstellen, falls die Datei fehlt
- benötigte Environment-Variablen auf Vorhandensein prüfen

Das Setup ist für Installation/Änderungen gedacht. Im normalen Alltag ist danach nur noch nötig:

```bash
pnpm dev
```

Wenn das Script stattdessen so gestartet wird:

```bash
bash setup.sh
```

läuft die Installation ebenfalls. Da ein Kindprozess die Umgebung des bereits offenen Parent-Terminals nicht ändern kann, kann danach einmal nötig sein:

```bash
source ~/.bashrc
```

## Warum `pnpm` manchmal scheinbar verschwindet

pnpm wird für dieses Projekt über Corepack innerhalb der mit `nvm` aktivierten Node-Version bereitgestellt. Wenn ein neues Terminal `nvm` nur lädt, aber keine Node-Version aktiviert, liegt auch der zugehörige Corepack-/pnpm-Pfad nicht im `PATH`.

Das Setup-Script ergänzt deshalb automatisch folgende Bash-Konfiguration:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
command -v nvm >/dev/null 2>&1 && nvm use default --silent >/dev/null 2>&1
```

Zusätzlich wird beim Setup ausgeführt:

```bash
nvm alias default 22.22.3
```

Damit aktiviert ein neu geöffnetes Bash-Terminal automatisch Node.js `22.22.3`. Weil Corepack/pnpm in genau dieser Node-Installation aktiviert wurde, stehen danach auch `node`, `corepack` und `pnpm` direkt zur Verfügung.

## Falls nvm noch nicht installiert ist

`setup.sh` installiert nvm absichtlich nicht ungefragt über ein Remote-Script. Wenn nvm fehlt, zuerst nvm installieren und anschließend erneut ausführen:

```bash
source ~/.bashrc
source ./setup.sh
```

## Environment-Dateien

`.env.example` ist die versionierte Vorlage ohne echte Secrets.

Beim ersten Setup wird daraus automatisch erstellt:

```text
.env.local
```

`.env.local` wird nicht über Git verteilt und muss echte lokale Zugangsdaten enthalten.

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
```

Für lokale Entwicklung bleibt `READY2ORDER_TRAINING_MODE=true`. Der Order-Endpoint behandelt einen fehlenden Wert ebenfalls als Trainingsmodus, damit ein vergessenes Environment-Feld nicht versehentlich Live-Bestellungen erzeugt. Für Produktion muss `READY2ORDER_TRAINING_MODE=false` bewusst gesetzt werden.

Keine echten Secrets committen.

## MongoDB

Die Anwendung soll die Datenbank `qrorder` verwenden:

```text
mongodb://USER:PASSWORD@HOST:27017/qrorder?authSource=admin
```

`authSource=admin` ist die Authentifizierungsdatenbank und ersetzt nicht `/qrorder`.

## Start

Nach erfolgreichem Setup:

```bash
pnpm dev
```

Danach:

```text
http://localhost:3050
```

### Entwicklungsserver beenden

`Ctrl+C` beendet `pnpm dev` absichtlich. Ein Exit-Code `130` bedeutet unter Linux lediglich, dass der laufende Prozess per `SIGINT` (`Ctrl+C`) beendet wurde. Das ist kein Anwendungsfehler.

Wenn VS Code danach meldet:

```text
The terminal process "/bin/bash" terminated with exit code: 130
```

wurde sehr wahrscheinlich nicht ein dauerhaft geöffnetes interaktives Terminal, sondern ein als Prozess/Task gestartetes Terminal beendet. Für die normale Entwicklung ein echtes integriertes Terminal öffnen (`Terminal` → `New Terminal` bzw. `Ctrl+``) und dort ausführen:

```bash
pnpm dev
```

Nach `Ctrl+C` sollte in einem interaktiven Terminal wieder der normale Shell-Prompt erscheinen. Falls das Terminal selbst geschlossen wurde, einfach ein neues Terminal öffnen; nach einmaligem aktuellem `source ./setup.sh` muss das komplette Setup nicht erneut ausgeführt werden.

## ready2order-Verbindung testen

```bash
node scripts/test-ready2order.js
```

Bei Erfolg sollte der API-Test HTTP Status `200` liefern.

## Native Build-Scripts

Falls pnpm meldet, dass native Build-Scripts blockiert wurden:

```bash
pnpm approve-builds
```

Benötigte Pakete freigeben, insbesondere `bcrypt`, `sharp`, `@parcel/watcher` und gegebenenfalls `es5-ext`.

## Typische Probleme

### `pnpm: command not found`

Nach dem aktuellen Setup sollte das in neuen Bash-Terminals nicht mehr auftreten. Falls doch, zuerst prüfen:

```bash
command -v nvm
node -v
nvm current
nvm alias default
pnpm -v
```

Für das aktuelle Terminal kann die Umgebung so repariert werden:

```bash
source ~/.nvm/nvm.sh
nvm use default
corepack enable
corepack prepare pnpm@12.3.4 --activate
hash -r
pnpm -v
```

Nicht `pnpm` oder Node über `apt` installieren. Das Projekt verwendet die festgelegten Versionen über nvm und Corepack.

### Falsche Node-Version

```bash
nvm use default
```

### MongoDB verbindet sich mit `test`

Prüfen, ob `/qrorder` tatsächlich Bestandteil von `MONGODB_URI` ist.

### `ENOTFOUND` bei MongoDB

Hostname/IP in `.env.local` prüfen. Maskierte Beispielwerte dürfen nicht versehentlich übernommen werden.

### Neue Git-Änderungen fehlen

```bash
git checkout refactor/platzhirsch-core
git pull
```
