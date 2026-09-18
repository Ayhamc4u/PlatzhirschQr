# Tisch QR-Codes

## Ziel

Für jeden echten Gästetisch wird ein stabiler, nicht erratbarer QR-Token in MongoDB gespeichert. Aus diesem Token wird beim Abruf der Druckseite der Ziel-Link für den Tisch erzeugt und als QR-Code dargestellt.

Die QR-Grafik selbst wird nicht als PNG/Base64 in MongoDB gespeichert. Dadurch bleibt die Datenbank klein und derselbe Tisch-Token kann in beliebiger Druckgröße als SVG gerendert werden.

## Daten in MongoDB

Das Tischmodell enthält unter anderem:

- `restaurantID`
- `ready2orderTableId`
- `name`
- `username`
- `qrToken`
- `qrUrl`

`qrToken` wird beim ready2order-Tischsync einmal erzeugt und bei späteren Synchronisationen wiederverwendet. Der Token bleibt dadurch stabil, solange der Tisch bestehen bleibt.

`qrUrl` wird als stabiler relativer Pfad gespeichert:

```text
/q/{qrToken}
```

Damit hängt der gespeicherte Tisch nicht mehr von einer konkreten Domain ab.

## Stabile QR-Route

Physisch gedruckte QR-Codes verwenden ausschließlich die stabile Route:

```text
https://order.platzhirschzwettl.at/q/{qrToken}
```

Die Route `/q/[token]` löst den Token serverseitig gegen den synchronisierten Tisch auf und leitet anschließend intern auf die aktuelle Restaurant-Route weiter:

```text
/q/{token}
  -> Token in MongoDB prüfen
  -> Restaurant/Tisch auflösen
  -> /platzhirsch?table={token}
```

Der gedruckte QR-Code bleibt dadurch unverändert, auch wenn sich die interne Restaurant-URL später ändert. Nur die `/q/[token]`-Auflösung muss dann angepasst werden.

Ungültige oder nicht mehr existierende Tokens werden auf die Startseite zurückgeleitet.

## In-App QR-Scanner

Die Startseite verlinkt auf `/scan`. Der Browser-Scanner akzeptiert die stabilen Platzhirsch-Tischlinks im Format:

```text
/q/{32-stelliger-hex-token}
```

Der Scanner übernimmt nur den relativen Pfad und navigiert innerhalb der aktuell geöffneten Platzhirsch-Domain weiter. Damit funktionieren dieselben QR-Codes lokal und hinter Nginx/Docker, ohne interne Hostnamen oder Ports zu übernehmen.

Ältere Links im Format `/{restaurant}?table={token}` werden während der Übergangsphase weiterhin erkannt. Alte OrderWorder-Domainprüfungen sind entfernt.

## Domain hinter Nginx / Docker

Die QR-Druckseite verwendet nicht mehr `PUBLIC_APP_URL`, um die QR-Zieladresse zu bestimmen. Stattdessen wird die öffentlich aufgerufene Origin aus den Request-Headern ermittelt. Die im Dashboard eingebettete Tischübersicht verwendet entsprechend die aktuell im Browser geöffnete Origin.

Das ist wichtig für den aktuellen Betrieb:

```text
Browser
  -> https://order.platzhirschzwettl.at
  -> Nginx
  -> Docker / Next.js auf localhost bzw. internem Port
```

Dadurch darf `.env.local` für die lokale/container-interne Entwicklung weiterhin beispielsweise enthalten:

```env
PUBLIC_APP_URL=http://localhost:3050
```

Wenn die QR-Druckseite über

```text
https://order.platzhirschzwettl.at/dashboard/qr-codes
```

aufgerufen wird, werden trotzdem QR-Codes mit

```text
https://order.platzhirschzwettl.at/q/{token}
```

erzeugt.

Voraussetzung ist, dass Nginx die üblichen Proxy-Header korrekt weitergibt, insbesondere `Host` bzw. `X-Forwarded-Host` und `X-Forwarded-Proto`.

## Tisch-Synchronisation

Die Tokens werden von folgendem Script angelegt bzw. wiederverwendet:

```bash
node scripts/sync-ready2order-tables.js
```

Zusätzlich ist der Tisch-Sync Teil des gemeinsamen ready2order-Start-Syncs:

```bash
pnpm sync:ready2order
```

`pnpm dev` führt diesen Gesamt-Sync vor dem Start der Next.js-Anwendung automatisch aus. Damit erhalten auch neu in ready2order angelegte Tische beim nächsten Entwicklungsstart automatisch ihren QR-Token.

Der Sync importiert die ready2order-Tische und verknüpft sie mit dem Restaurant-Account. Bestehende Tokens werden wiederverwendet. Der gespeicherte `qrUrl`-Wert wird auf den stabilen relativen `/q/{token}`-Pfad normalisiert.

## QR-Druck und Admin-Bereich

Die QR-Übersicht ist im Admin-Dashboard als eigener Sidebar-Punkt **Tische** erreichbar:

```text
/dashboard?tab=tables
```

Dort werden alle druckbaren Gästetische mit ihren QR-Codes angezeigt. Die technischen Abholtische `Abh1` bis `Abh10` bleiben ausgeblendet.

Vor dem Drucken können einzelne Tische per Checkbox ausgewählt werden. Zusätzlich gibt es eine Tischsuche sowie Aktionen für `Alle auswählen` und `Auswahl löschen`. Der Browser-Druckdialog enthält ausschließlich die aktuell ausgewählten QR-Karten; nicht ausgewählte Tische sowie Dashboard-Navigation und Bedienelemente werden im Print-CSS ausgeblendet.

Die bestehende eigenständige Druckroute bleibt weiterhin verfügbar:

```text
/dashboard/qr-codes
```

Der Schutz liegt nicht nur im Frontend. Das komplette `/dashboard` wird serverseitig gegen `role === "admin"` geprüft. Customer- und nicht eingeloggte Sessions erhalten dadurch keinen Zugriff auf die QR-Ansichten.

Die QR-Ansicht:

- verwendet nur Tische mit vorhandenem `qrToken`,
- sortiert Tischbezeichnungen natürlich/numerisch,
- blendet die technischen Abholtische `Abh1` bis `Abh10` aus,
- erzeugt die QR-Grafiken als SVG,
- erzeugt ausschließlich stabile `/q/{token}`-Links,
- verwendet die öffentlich aufgerufene Domain statt einer fest eingebauten Environment-Domain,
- zeigt den Ziel-Link während der Kontrolle am Bildschirm,
- erlaubt die Auswahl einzelner Tische für den Druck.

## Tischanzeige auf der Bestellseite

Wird die Bestellseite über einen gültigen Tisch-QR-Link geöffnet, wird der Token gegen die synchronisierten Restaurant-Tische aufgelöst.

Der Gast sieht im sticky Header dauerhaft nur den lesbaren Tischname, zum Beispiel:

```text
Dein Tisch  Außen 1
```

Der QR-Token selbst wird nicht angezeigt. Der Tischhinweis bleibt beim Scrollen sichtbar, damit jederzeit klar ist, für welchen Tisch bestellt wird.

Die Anzeige gilt nur für Dine-in-Tische. Die technische Pickup-Tischzuordnung wird dem Gast nicht als Tisch angezeigt.

## Drucklayout

Das Print-CSS ist für A4 Hochformat ausgelegt. Pro Zeile werden zwei Tischkarten dargestellt. Jede Karte enthält:

- Platzhirsch Branding,
- QR-Code,
- Tischname,
- Hinweis `Scannen & bestellen`.

Die Bildschirm-Bedienelemente und Ziel-URLs werden beim Drucken ausgeblendet.

## QR-Rendering

Die Druckseite lädt die fest versionierte Browser-Library `qrcode-generator@2.0.4` und erstellt die QR-Codes lokal im Browser. Der Tisch-Link wird nicht an einen externen QR-Bilddienst geschickt.

Die QR-Codes werden mit Fehlerkorrekturstufe `M` erzeugt und als skalierbares SVG gerendert. Zum Laden der Library benötigt die Druckseite aktuell eine Internetverbindung.

## Sicherheitsgrenze

Der `qrToken` identifiziert den Tisch, ist aber langfristig nicht die einzige Berechtigung für eine Dine-in-Bestellung.

Das geplante Sicherheitsmodell bleibt:

```text
QR-Token
   +
Vor-Ort-/Venue-Session
   =
Dine-in-Berechtigung
```

Damit soll ein Foto eines Tisch-QR-Codes später nicht ausreichen, um von außerhalb des Lokals eine Tischbestellung abzugeben. Siehe auch `DINE_IN_SECURITY.md`.
