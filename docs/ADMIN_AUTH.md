# Admin-Authentifizierung

## Ziel

Der Admin-Bereich verwendet eine eigene Login-Oberfläche und bleibt technisch von Kundenkonten getrennt. Die bestehende Account-/Passwort-Authentifizierung bleibt erhalten; der Schutz gegen wiederholte Passwortversuche wird serverseitig im Account gespeichert.

## Einstieg

Admin-Login:

```text
/admin/login
```

Geschützter Bereich:

```text
/dashboard
```

Beim Aufruf von `/dashboard` ohne gültige Admin-Session erfolgt die Weiterleitung auf `/admin/login`.

## Zugangsdaten

Der NextAuth-Credentials-Provider `restaurant` akzeptiert für Admins:

- Benutzername oder E-Mail-Adresse
- Passwort

Nach erfolgreicher Prüfung erhält die Session `role = admin`.

Die Login-Seite verwendet die Standard-Autofill-Felder `username` und `current-password`, damit Browser und Passwortmanager korrekt funktionieren.

## Fehlversuche und Sperren

Die Schutzlogik läuft serverseitig und kann daher nicht durch einen direkten Aufruf der NextAuth-Route umgangen werden.

Für einen bestehenden Admin-Account gelten folgende Regeln:

```text
3 falsche Passwortversuche innerhalb von 10 Minuten
→ temporäre Sperre
```

Die Sperrdauer steigt bei wiederholten Sperren progressiv:

```text
1. Sperre:  10 Minuten
2. Sperre:  30 Minuten
3. Sperre:  60 Minuten
4. Sperre: 120 Minuten
5.+ Sperre: 240 Minuten
```

Nach einer erfolgreichen Admin-Anmeldung werden Fehlversuche, Sperrstatus und Sperrstufe wieder auf null gesetzt.

Gespeicherte Felder am Account:

```text
failedLoginAttempts
lastFailedLoginAt
loginLockedUntil
loginLockLevel
```

Die Fehlversuchsserie zählt nur innerhalb eines 10-Minuten-Fensters. Ein einzelner alter Fehlversuch führt daher nicht irgendwann zusammen mit späteren Versuchen zu einer Sperre.

## Admin-Session

NextAuth verwendet weiterhin die gemeinsame JWT-Infrastruktur. Der Dashboard-Zugriff hat zusätzlich eine eigene maximale Admin-Zugriffszeit von 12 Stunden ab `authIssuedAt`.

Nach Ablauf wird auf `/logout` weitergeleitet und eine neue Admin-Anmeldung ist erforderlich.

## Abgrenzung

Die progressive Sperrlogik gilt derzeit für den Admin-Zweig des Providers `restaurant`. Kitchen-Logins werden dadurch nicht verändert. Kunden verwenden weiterhin ihre eigenen Provider und Account-Flows.

## Spätere Erweiterungen

Sinnvolle nächste Sicherheitsstufen sind:

- MFA für Admins
- Audit-Log für erfolgreiche und fehlgeschlagene Admin-Anmeldungen
- zusätzliche IP-basierte Drosselung vor der Account-Prüfung
- Admin-Passwort-Reset mit zeitlich begrenztem Token
