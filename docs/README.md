# PlatzhirschQR – Entwicklerdokumentation

Dieser Ordner enthält die technische Dokumentation zu den einzelnen Bereichen von PlatzhirschQR.

## Dokumente

### [TARGET_ARCHITECTURE.md](TARGET_ARCHITECTURE.md)
Zielarchitektur der Plattform, Trennung zwischen Dine-in und öffentlicher Online-Bestellung sowie Deployment- und Sicherheitsprinzipien.

### [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
Einrichtung eines neuen Entwicklungsrechners mit Node.js, pnpm, `.env.local`, MongoDB und den wichtigsten Start-/Testbefehlen.

### [DEPLOYMENT.md](DEPLOYMENT.md)
Docker-/OCI-Build, GitHub Actions Package-Workflow, GHCR-Image, Runtime-Secrets, Start-Synchronisation und spätere Produktionsbereitstellung.

### [BRANDING.md](BRANDING.md)
Platzhirsch-Farben, Antonio/Didact-Gothic-Typografie, Schieferoptik der Speisekarte und Gestaltungsregeln für Startseite und Logos.

### [READY2ORDER.md](READY2ORDER.md)
ready2order-Integration, Synchronisationsskripte, Datenfluss von `ready_products` nach `menus` und Tisch-Synchronisation.

### [MENU.md](MENU.md)
Kuratierte Menü-Kategorien, Burger als Standardauswahl, Corporate-Farben und der eingeschränkte Abholfilter inklusive der virtuellen Oberkategorie `Abhofverkauf`.

### [PRODUCT_AVAILABILITY.md](PRODUCT_AVAILABILITY.md)
Produktbezogene Freigabe für `DINE_IN`, `PICKUP` und später `DELIVERY`, serverseitige Prüfung sowie Grundlage für die spätere Admin-Zuordnung und saisonale Regeln.

### [BUSINESS_HOURS.md](BUSINESS_HOURS.md)
Geschäftszeiten, allgemeine Speise-/Servicezeiten, Sofort-Pausen für Abholung und Tischservice sowie optionale Zeitpläne pro Menü-Kategorie.

### [PICKUP_ORDERING.md](PICKUP_ORDERING.md)
Online-Abholung, freigegebener Menüausschnitt, Abholzeit-Schätzung, Kapazitätsregeln, automatische/manuelle Annahme und Verwendung der `Abh...`-Tische.

### [CUSTOMER_ACCOUNTS.md](CUSTOMER_ACCOUNTS.md)
Dauerhafte Stammkundenkonten, 90-Tage-Session, Bestellhistorie, Newsletter-Einwilligung, spätere Loyalty-/Gutschein-Grundlage und Trennung vom Admin-Zugriff.

### [ADMIN_AUTH.md](ADMIN_AUTH.md)
Eigener Admin-Login, serverseitige progressive Sperren nach Fehlversuchen und die zusätzliche 12-Stunden-Grenze für den Dashboard-Zugriff.

### [DINE_IN_SECURITY.md](DINE_IN_SECURITY.md)
Aktueller QR-/Tischflow und das geplante Sicherheitsmodell für Bestellungen im Lokal.

### [QR_CODES.md](QR_CODES.md)
Stabile Tisch-QR-Tokens, A4-Drucklayout und Sicherheitsgrenzen der QR-Links. Die QR-Druckseite liegt im serverseitig geschützten Admin-Dashboard.

## Dokumentationsprinzip

Bei einer größeren funktionalen Änderung gilt:

1. Code ändern.
2. Betroffene Dokumentation aktualisieren.
3. Falls ein neuer Funktionsbereich entsteht, ein eigenes Dokument unter `docs/` anlegen.
4. Dieses Inhaltsverzeichnis ergänzen.
5. Nur die wichtigsten Informationen zusätzlich in der Root-`README.md` halten.

Damit soll ein neuer Entwickler zuerst die Root-README lesen und anschließend über diesen Index gezielt in die einzelnen Bereiche einsteigen können.
