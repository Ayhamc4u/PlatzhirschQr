# Platzhirsch Corporate Identity

## Grundfarben

Die Kundenoberfläche verwendet drei zentrale Markenfarben:

- Platzhirsch Schwarz: `#11100E`
- Warmweiß: `#F4F0E8`
- Glutgold: `#D9A441`

Glutgold dient als gezielter Akzent für primäre Aktionen, aktive Auswahl und wichtige Statusinformationen. Auf Glutgold wird immer dunkle Schrift (`#11100E`) verwendet.

## Light und Dark Mode

Die Anwendung unterstützt ausschließlich zwei explizite Farbschemata: **Hell** und **Dunkel**. Es gibt keinen System-Modus und keine automatische Umschaltung anhand von `prefers-color-scheme`.

Die Auswahl wird im Browser unter `platzhirsch-theme` gespeichert und gilt global für Homepage, Speisekarte, Konto, Dialoge und weitere Oberflächen. Ohne gespeicherte Auswahl startet die Anwendung im Dark Mode.

Im Admin-Bereich gibt es dafür den eigenen Hauptmenüpunkt **Design**. Er zeigt die drei Platzhirsch-Grundfarben sowie die vollständigen Light- und Dark-Paletten. Der Modus kann dort direkt zwischen Hell und Dunkel umgeschaltet werden; die Auswahl verwendet dieselbe globale Theme-Einstellung wie die restliche Anwendung. Die Palette bleibt vorerst als definierter Platzhirsch-Theme-Satz fest und wird nicht frei pro Farbe editiert.

### Light Mode

- Seitenhintergrund: `#F4F0E8`
- Karten / Panels: `#FFFDF8`
- erhöhte Flächen: `#F0EBE1`
- Primärtext: `#171511`
- Sekundärtext: `#6E675D`
- dezenter Text: `#8E867A`
- Rahmen: `#D8D0C3`
- starker Rahmen: `#BEB4A5`
- Gold: `#D9A441`
- Gold Hover: `#C89336`
- Gold Active: `#B9842C`
- Fehler: `#B33A32`
- Erfolg: `#4F7A52`
- Info: `#3F6F8F`

### Dark Mode

- Seitenhintergrund: `#11100E`
- Karten / Panels: `#1B1A17`
- erhöhte Flächen: `#24221E`
- Primärtext: `#F4F0E8`
- Sekundärtext: `#B9B2A7`
- dezenter Text: `#8D877F`
- Rahmen: `#37332D`
- starker Rahmen: `#4B463E`
- Gold: `#D9A441`
- Gold Hover: `#E2AF4D`
- Gold Active: `#C89336`
- Fehler: `#E06B62`
- Erfolg: `#79A77C`
- Info: `#6EA0C0`

Komponenten verwenden semantische CSS-Variablen wie `--surface-page`, `--surface-card`, `--text-primary`, `--text-secondary`, `--border-subtle` und `--brand-gold`. Direkte Hell-/Dunkel-Hardcodes in einzelnen Komponenten sollen vermieden werden.

## Typografie

- Überschriften und markante Labels: **Antonio**
- Fließtext und normale UI-Texte: **Didact Gothic**

Die Schriften werden zentral über `next/font/google` geladen und als CSS-Variablen `--font-heading` und `--font-body` bereitgestellt.

## Speisekarte

Die Speisekarte folgt dem global gewählten Farbschema. Im Dark Mode wird die vom Platzhirsch bereitgestellte Schiefer-/Steintextur mit dunkler Überlagerung verwendet. Im Light Mode wird bewusst eine ruhige warme Fläche ohne dunkle Textur verwendet, damit das Farbschema eindeutig hell bleibt.

Gestaltungsregeln:

- aktive Kategorie und primäre Aktionen: Glutgold mit dunkler Schrift
- Karten, Header, Suchfeld und Footer verwenden ausschließlich semantische Theme-Flächen
- Primär- und Sekundärtexte folgen den jeweiligen Theme-Textfarben
- Produktkarten unterscheiden sich klar vom Seitenhintergrund
- Glutgold bleibt in beiden Modi der gemeinsame Markenakzent

Die Hintergrunddatei `public/backgrounds/hintergrund.svg` ist Bestandteil des Dark-Mode-Menüs.

## Startseite

Die Startseite verwendet keine internen ready2order-/Tischbezeichnungen wie `Abh1` bis `Abh10`. Für Gäste wird nur die fachliche Logik erklärt:

- bis zu fünf Abholbestellungen können automatisch bestätigt werden
- bei höherer Auslastung wird die Bestellung manuell geprüft
- aktuelle Wartezeit und voraussichtliche Fertigstellung werden live angezeigt

Interne technische Tischzuordnungen bleiben ausschließlich Backend-/Admin-Informationen.

## Logos

Die Platzhirsch-Logos sind Bestandteil der CI. Beim Einsatz ist auf ausreichenden Kontrast zu achten:

- helle/weiße Variante auf dunklen Flächen
- schwarze Variante auf hellen Flächen
- Glutgold als Akzent und nicht als großflächiger Ersatz für das Logo
