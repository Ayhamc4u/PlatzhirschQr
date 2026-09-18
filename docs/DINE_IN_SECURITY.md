# Dine-in / QR-Sicherheit

## Ziel

Ein Gast im Lokal soll über den QR-Code seines Tisches bestellen können. Gleichzeitig darf ein fotografierter oder weitergeleiteter QR-Code nicht ausreichen, um von außerhalb des Restaurants Bestellungen auf einen Tisch auszulösen.

## Aktueller Stand

Die synchronisierten Tische besitzen unter anderem:

- internen `username`
- `ready2orderTableId`
- stabilen `qrToken`
- stabilen `qrUrl` unter `/q/{token}`

Der Restaurant-Flow löst den `qrToken` auf den internen Tisch-Identifier auf.

## Bestell-WLAN als Vor-Ort-Nachweis

Für den produktiven Dine-in-Betrieb ist das dedizierte **Platzhirsch Bestell-WLAN** die primäre Sicherheitsgrenze.

```text
stabiler Tisch-QR
        +
Anfrage kommt nachweislich aus dem Bestell-WLAN
        =
Dine-in-Zugang erlaubt
```

Die Anwendung prüft dabei **nicht selbst eine vom Browser gelieferte IP-Adresse**. Stattdessen setzt der vorgeschaltete Nginx-Proxy einen internen Header:

```text
X-Platzhirsch-Venue: 1
```

Dieser Header wird von Nginx selbst gesetzt und überschreibt einen eventuell vom Client mitgesendeten Wert. Der Next.js-Container ist nicht direkt nach außen veröffentlicht und vertraut deshalb auf diesen internen Proxy-Nachweis.

## Netzwerkaufbau

Damit Nginx einen Gast im Bestell-WLAN von einem öffentlichen Besucher unterscheiden kann, soll das Bestell-WLAN die öffentliche Domain per **lokalem DNS / Split DNS** direkt auf den lokalen Nginx-Server auflösen:

```text
Bestell-WLAN
  → order.platzhirschzwettl.at
  → lokales DNS
  → Nginx im Lokal
  → X-Platzhirsch-Venue: 1
  → Next.js
```

Öffentliche Besucher gehen weiterhin über den öffentlichen DNS-/Cloudflare-Weg und erhalten den Venue-Header nicht.

Wenn das Bestell-WLAN ebenfalls über Cloudflare auf die öffentliche Adresse zugreift, sieht Nginx nur die Cloudflare-Verbindung und kann das lokale WLAN nicht zuverlässig erkennen. Deshalb ist Split DNS Teil des Zielaufbaus.

## DINEIN_ACCESS_MODE

Die Anwendung unterstützt aktuell zwei Modi:

```env
DINEIN_ACCESS_MODE=development
```

- lokale Entwicklung / Testphase
- Venue-Prüfung wird übersprungen

```env
DINEIN_ACCESS_MODE=wifi
```

- produktiver Dine-in-Schutz
- `/q/{token}` funktioniert nur mit gültigem Bestell-WLAN-Nachweis
- `POST /api/order/place` prüft bei `DINE_IN` erneut den Bestell-WLAN-Nachweis
- `PICKUP` bleibt öffentlich und wird nicht durch die WLAN-Prüfung blockiert

Die Prüfung beim Order-POST ist die eigentliche Sicherheitsgrenze. Selbst wenn jemand eine bereits geöffnete Tischseite zuhause noch im Browser hat, kann ohne aktuellen Bestell-WLAN-Nachweis keine weitere Dine-in-Bestellung an ready2order gesendet werden.

## Warum der QR-Code allein nicht genügt

Ein statischer QR-Code kann fotografiert oder weitergeleitet werden. Deshalb bleibt der QR stabil, dient aber nur zur Identifikation des Tisches. Die aktuelle Vor-Ort-Berechtigung kommt separat aus dem Bestell-WLAN.

## Nginx-Konfiguration

Im Repository liegt eine Vorlage unter:

```text
deploy/nginx/conf.d/platzhirsch.conf.example
```

Darin wird der Bestell-WLAN-CIDR über `geo` auf einen internen Wert abgebildet. Der Beispiel-CIDR ist absichtlich nicht aktiv nutzbar und muss vor Aktivierung durch das echte Bestell-WLAN-Netz ersetzt werden.

## Trennung zur Online-Abholung

Online-Abholung ist bewusst öffentlich und benötigt keine Venue-Freigabe.

```text
DINE_IN → Tisch + QR + aktueller Bestell-WLAN-Nachweis
PICKUP  → öffentlich erreichbar, kein Bestell-WLAN erforderlich
```

## Spätere Erweiterungen

Auf dieser Basis können später zusätzlich eingebaut werden:

- rotierende Tisch-/Entry-Sessions
- Tischbelegt-/Tischfrei-Status
- kurzlebige Venue-Sessions oder Presence-Heartbeats
- automatisches Invalidieren beim Schließen eines Tisches
- ein separater Fallback für Gäste ohne Bestell-WLAN

Diese Erweiterungen ändern die stabilen gedruckten QR-Codes nicht.
