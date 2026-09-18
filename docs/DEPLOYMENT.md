# Container, GitHub Package und Deployment

## Ziel

PlatzhirschQR wird als Docker-/OCI-Image gebaut und über GHCR auf dem Ubuntu-Server betrieben. Nginx terminiert HTTPS und leitet intern an den Next.js-Container weiter.

## Image

Registry:

```text
ghcr.io/intercroneworldorg/platzhirschqr
```

Der aktuelle Workflow veröffentlicht den jeweils gebauten Stand als:

```text
ghcr.io/intercroneworldorg/platzhirschqr:latest
```

Darum muss vor jedem Recreate zuerst gepullt werden:

```bash
docker compose pull platzhirschqr
docker compose up -d --force-recreate platzhirschqr
```

## GitHub Actions

Der Container-Workflow läuft bei Pushes auf `main` und `refactor/platzhirsch-core` sowie bei `v*`-Tags. Änderungen, die ausschließlich `docs/**` oder die Root-`README.md` betreffen, lösen keinen Container-Build aus. Dadurch entstehen weniger unnötige Workflow-Runs und ein reiner Dokumentations-Commit überschreibt nicht das `latest`-Image.

`concurrency` bleibt aktiv; ein älterer noch laufender Build desselben Branches wird bei einem neuen Push abgebrochen.

Die Aufbewahrungsdauer von GitHub-Actions-Logs und -Artefakten ist keine Einstellung in `package.yml`, sondern eine Repository-/Organisations-Einstellung unter **Settings → Actions → General → Artifact and log retention**. Für dieses private Entwicklungsrepository sind 14 Tage ein sinnvoller Zielwert. Die Änderung wirkt nur auf neu erzeugte Logs und Artefakte; bestehende Workflow-Runs müssen separat gelöscht werden, wenn die Actions-Liste aufgeräumt werden soll.

Der Workflow lädt aktuell keine klassischen `upload-artifact`-Artefakte hoch. Er veröffentlicht das Container-Image in GHCR und verwendet den GitHub-Actions-Cache für Docker Buildx.

## Dockerfile

Das Dockerfile verwendet einen mehrstufigen Build mit Node.js 22 und pnpm. Der Runner hört intern auf Port `3000` und ist im Produktions-Compose nicht direkt nach außen veröffentlicht.

## Produktions-Compose

Eine versionierte Vorlage liegt unter:

```text
deploy/docker-compose.yml
```

Die Anwendung und Nginx befinden sich im gemeinsamen Docker-Netz `web`. Nach außen werden nur `80` und `443` des Nginx-Containers veröffentlicht.

Die echte `.env.local`, Zertifikate und Let's-Encrypt-Daten bleiben ausschließlich auf dem Server und werden nicht in Git eingecheckt.

## Nginx

Eine versionierte Vorlage liegt unter:

```text
deploy/nginx/conf.d/platzhirsch.conf.example
```

Für Next.js werden mindestens diese Proxy-Header gesetzt:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto https;
```

Damit QR-Redirects hinter Docker/Nginx auf der öffentlichen Domain bleiben, ist insbesondere `X-Forwarded-Host` erforderlich.

## Bestell-WLAN / Venue-Nachweis

Für `DINEIN_ACCESS_MODE=wifi` setzt Nginx zusätzlich einen internen Header:

```nginx
proxy_set_header X-Platzhirsch-Venue $platzhirsch_venue_access;
```

`$platzhirsch_venue_access` wird über `geo $remote_addr` aus dem Netz des Bestell-WLANs erzeugt. Der Client darf diesen Header nicht selbst bestimmen; Nginx überschreibt ihn immer.

Damit Nginx die echte WLAN-Quelladresse sieht, muss `order.platzhirschzwettl.at` im Bestell-WLAN über lokales DNS / Split DNS direkt auf den lokalen Nginx-Server zeigen. Öffentliche Besucher gehen weiterhin über den normalen öffentlichen DNS-/Cloudflare-Weg und erhalten keine Venue-Freigabe.

Vor Aktivierung muss in der Nginx-Vorlage der Beispiel-CIDR durch den echten Bestell-WLAN-CIDR ersetzt werden.

Konfiguration prüfen und Nginx neu laden:

```bash
docker compose exec nginx nginx -t
docker compose restart nginx
```

## Runtime-Environment

Erforderlich sind insbesondere:

```env
MONGODB_URI=...
RESTAURANT_ID=platzhirsch
PUBLIC_APP_URL=http://localhost:3050
READY2ORDER_API_BASE=https://api.ready2order.com/v1
READY2ORDER_ACCOUNT_TOKEN=...
READY2ORDER_TRAINING_MODE=true
NEXTAUTH_URL=http://localhost:3050
NEXTAUTH_SECRET=...
DINEIN_QR_SECRET=...
DINEIN_ACCESS_MODE=development
SYNC_READY2ORDER_ON_STARTUP=true
```

`PUBLIC_APP_URL` und `NEXTAUTH_URL` dürfen im aktuellen Nginx-/Docker-Aufbau intern auf localhost zeigen. Stabile QR-Links und Redirects verwenden die vom Reverse Proxy gelieferten Host-/Proto-Informationen.

Für die Entwicklung bleibt:

```env
DINEIN_ACCESS_MODE=development
```

Sobald Bestell-WLAN, Split DNS und Nginx-`geo` fertig eingerichtet sind, wird auf dem Produktionsserver bewusst umgestellt auf:

```env
DINEIN_ACCESS_MODE=wifi
```

Während der Testphase bleibt außerdem:

```env
READY2ORDER_TRAINING_MODE=true
```

## Synchronisation beim Containerstart

Der Container synchronisiert standardmäßig ready2order-Produkte, App-Menü und Tische vor dem Start des Next.js-Servers.

```env
SYNC_READY2ORDER_ON_STARTUP=true
```

## Secrets und Dateien, die nicht ins Git gehören

Nicht versionieren:

- echte `.env.local`
- `READY2ORDER_ACCOUNT_TOKEN`
- `NEXTAUTH_SECRET`
- Zertifikate / private Keys
- `letsencrypt/`
- Datenbankpasswörter

Versionieren:

- Docker Compose Vorlage
- Nginx-Konfiguration ohne Secrets
- Deployment-Dokumentation
- Netzwerk-/Bestell-WLAN-Regeln ohne Zugangsdaten
