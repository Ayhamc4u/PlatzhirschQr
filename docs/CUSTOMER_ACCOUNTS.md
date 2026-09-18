# Kundenkonten und Stammkunden

## Ziel

Kundenkonten sind vollständig vom Bestellvorgang getrennt. Gäste können weiterhin ohne Kundenkonto bestellen. Wer ein Konto möchte, kann es unabhängig davon nur mit seiner E-Mail-Adresse anlegen und später freiwillig persönliche Daten ergänzen.

Die Kundenidentität bleibt von Admin- und Mitarbeiterberechtigungen getrennt. Technisch nutzt die Anwendung weiterhin NextAuth/JWT als gemeinsame Auth-Basis, aber Customer- und Admin-Flows haben unterschiedliche Rechte und Sicherheitsanforderungen.

## Aktuelle Ausbaustufe

Die aktuelle Ausbaustufe umfasst:

- Guest-/Bestellflow weiterhin ohne verpflichtendes Kundenkonto
- eigenständige Kontoanlage per E-Mail-Adresse
- E-Mail-Aktivierungslink als Besitznachweis
- automatische Customer-Session nach erfolgreicher Aktivierung
- optionaler Vorname, Nachname und Telefonnummer im Kundenkonto
- optionales Passwort für den späteren direkten Login
- Passwort-Login nach bestätigter E-Mail-Adresse
- Browser-/Passwortmanager-Autofill für E-Mail und Passwort
- Einmalcode-Login als Fallback
- Customer-Session mit 90 Tagen Maximalalter
- getrenntes Newsletter-Opt-in
- Bestellhistorie unter `/{restaurant}/account`
- editierbare Kontaktdaten und Newsletter-Einstellung
- explizite Abmeldefunktion
- Login-/Account-Einstieg direkt auf Startseite und Bestellheader
- Bestellart und aktueller Tisch-/Abholkontext werden beim Bestellen separat von der dauerhaften Customer-Session übermittelt
- ein Wechsel des Bestellkontexts darf die Customer-Session nicht automatisch abmelden

## Konto anlegen

Der öffentliche Einstieg ist:

```text
/platzhirsch/account/login
```

Dort gibt es zwei klar getrennte Wege:

```text
Bereits Kunde
→ E-Mail + Passwort
→ anmelden
```

und:

```text
Noch kein Konto
→ "Jetzt Konto anlegen"
→ E-Mail-Adresse eingeben
→ Aktivierungslink per E-Mail
→ Link öffnen
→ E-Mail-Adresse bestätigt
→ Konto wird angelegt und direkt angemeldet
→ Danke-Seite
→ Mein Konto oder Speisekarte
```

Für die Kontoanlage sind zunächst weder Name noch Telefonnummer noch Passwort erforderlich. Die E-Mail-Adresse ist die bestätigte Identität des Kontos.

Der Aktivierungslink ist 30 Minuten gültig und basiert auf einem zufälligen Einmal-Token. In MongoDB wird nur dessen SHA-256-Hash gespeichert. Der Token kann nur einmal verwendet werden.

## Mein Konto

Nach der Aktivierung landet der Kunde über `/{restaurant}/account` in seinem Kundenbereich. Dort können freiwillig ergänzt werden:

- Vorname
- Nachname
- Telefonnummer
- Newsletter-Wunsch

Die bestätigte E-Mail-Adresse wird angezeigt, aber nicht direkt ohne erneute Verifikation geändert.

Zusätzlich kann der Kunde optional ein Passwort festlegen. Erst danach ist der normale Login mit E-Mail + Passwort möglich. Ohne Passwort bleibt der Einmalcode-Login als Fallback verfügbar.

Passwörter werden ausschließlich als bcrypt-Hash gespeichert. Das Passwortformular verwendet die Browser-Standards `autocomplete="username"` und `autocomplete="new-password"`, damit Browser und Passwortmanager ein starkes Passwort vorschlagen und speichern können.

## Login

Der reguläre Login für Kunden mit gesetztem Passwort ist:

```text
E-Mail-Adresse
→ Passwort
→ Customer-Session
→ /{restaurant}/account
```

Das Loginformular ist als echtes HTML-Formular aufgebaut und verwendet `name="username"`, `autocomplete="username"`, `name="password"` und `autocomplete="current-password"`. Dadurch können Browser und Passwortmanager Zugangsdaten speichern, automatisch ausfüllen und bei Bedarf synchronisieren.

Als Fallback bleibt der E-Mail-Einmalcode verfügbar:

```text
E-Mail-Adresse
→ 6-stelligen Einmalcode anfordern
→ Code eingeben
→ Customer-Session
```

Ein Code ist 10 Minuten gültig, nur einmal verwendbar und wird nur gehasht gespeichert.

Der Login ist bewusst früh sichtbar:

- Startseite: `Anmelden` / `Mein Konto`
- Hauptaktionen der Startseite
- Bestellheader: `Anmelden` / `Mein Konto`

## Bestellen ohne Konto

Die Kontoanlage ist keine Voraussetzung für eine Bestellung. Gäste können weiterhin über den bestehenden Checkout bestellen, ohne vorher einen Stammkundenaccount anzulegen.

Kundenkonto und Bestellkontext sind getrennt. Eine dauerhafte Customer-Session speichert nicht den jeweils aktuellen Tisch. Beim tatsächlichen Bestellvorgang werden `orderType` und der aktuelle Bestellkontext separat übertragen:

```text
PICKUP
→ kein Tisch aus der Customer-Session erforderlich
→ Backend wählt intern einen freien Abh1–Abh10-Platz
```

```text
DINE_IN
→ aktueller QR-/Tischkontext wird mit der Bestellung übermittelt
→ Backend validiert den Tisch und den Vor-Ort-Zugang
```

Eine interne Abholplatz-Zuweisung oder ein Wechsel des Bestellkontexts darf die Customer-Session nicht abmelden oder verändern. Ein Logout erfolgt nur noch durch die ausdrückliche Abmeldefunktion des Kunden.

## Google Login

Google Login kann später als zusätzlicher Customer-Login ergänzt werden. Der bestehende Account bleibt dabei die fachliche Kundenidentität; ein Google-Konto würde über die bestätigte E-Mail-Adresse bzw. eine eigene Provider-ID damit verknüpft. Vor einer Umsetzung müssen Google OAuth Client-ID/Secret, Redirect-URLs und Regeln für bereits bestehende E-Mail-/Passwortkonten festgelegt werden.

## Newsletter

Newsletter und Kundenkonto sind zwei getrennte Entscheidungen. Ein Newsletter-Haken setzt den Status zunächst auf `PENDING`. Der eigentliche Newsletter-Double-Opt-in folgt separat. Abmeldung setzt den Status auf `UNSUBSCRIBED` und speichert `unsubscribedAt`.

## Session und Abmelden

Customer-JWTs sind aktuell auf 90 Tage ausgelegt. Im Kundenkonto gibt es eine explizite Schaltfläche `Abmelden`. Für das Admin-Dashboard wird unabhängig davon weiterhin ein serverseitiges Zugriffsfenster von maximal 12 Stunden erzwungen.

## E-Mail-Versand über World4You

Transaktionale Kundenmails werden über:

```text
noreply@platzhirschzwettl.at
```

versendet.

Die Environment-Konfiguration lautet:

```env
EMAIL_SMTP_HOST=smtp.world4you.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USER=noreply@platzhirschzwettl.at
EMAIL_SMTP_PASSWORD=REPLACE_ME
AUTH_EMAIL_FROM="Platzhirsch Zwettl <noreply@platzhirschzwettl.at>"
```

Port 587 verwendet STARTTLS. Deshalb ist `EMAIL_SMTP_SECURE=false`. Das echte Passwort darf niemals committed werden.

## Bestellhistorie

Bestehende Orders sind über `customer` mit der Kundenidentität verknüpft. Neue Orders speichern zusätzlich einen `customerSnapshot`, damit spätere Profiländerungen historische Bestellungen nicht verändern. Die Account-Seite zeigt bis zu 30 aktuelle Bestellungen inklusive Datum, Bestellart, Status, Gesamtbetrag und Produkten.

## Loyalty und Gutscheine

Die Bestellhistorie bleibt die fachliche Wahrheit. Später geplante Modelle:

```text
CustomerStats
LoyaltyTransaction
Voucher
```

## Admin und Dashboard

Das komplette `/dashboard` ist serverseitig auf `role === "admin"` geschützt. Customer-Sessions erhalten keinen Dashboard-Zugriff.

## Nächste Schritte

- eingeloggte Kundendaten im Checkout automatisch vorausfüllen
- Passwort-zurücksetzen per E-Mail-Link
- Google Login als optionalen Provider evaluieren
- Double-Opt-in-Mail für Newsletter
- `Noch einmal bestellen` aus der History
- `CustomerStats` aus Orders ableiten
- Gutschein-/Loyalty-Ledger ergänzen
- Admin-Login mit 2FA weiter härten
