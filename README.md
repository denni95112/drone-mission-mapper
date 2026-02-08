# Drone Mission Mapper

Eine webbasierte Anwendung zur Visualisierung und Verwaltung von Drohnen-Missionen auf einer interaktiven Karte mit OpenStreetMap. Entwickelt mit PHP und SQLite, konzipiert für BOS und Drohnenbetreiber.

📖 **Ausführliche Anleitung**: [Wiki](https://github.com/denni95112/drone-mission-mapper/wiki)

---

## ✨ Funktionen

- 🗺️ **Karte & Missionen** – Missionen mit Raster-Grid erstellen, starten und verwalten (Rechteck/Ellipse)
- 📍 **Icon-Platzierung** – Fahrzeuge, Personen, Drohnen, POIs etc. auf der Karte platzieren (im Live-Modus)
- ⏱️ **Zeitstrahl** – Live-Modus und Historienmodus mit Playback, Bereiche als erledigt markieren (Strg+Klick)
- 📤 **Teilen & Export** – Mission teilen (View-Only), KML Import/Export, CSV-Export mit Adressauflösung
- 📡 **GPS-Sharing** – Eigene Position teilen, kontinuierliches Tracking
- 🔐 **Authentifizierung** – Passwort + Token-basierte „Angemeldet bleiben“-Funktion
- 🗄️ **Datenbank-Migrationen** – Updates über die Weboberfläche

---

## 📸 Screenshots

<p float="left">
   <!-- Screenshots können hier eingefügt werden -->
</p>

---

## 🚀 Schnellstart

### Anforderungen

- PHP 7.4+
- SQLite3-Erweiterung
- PHP-Erweiterungen: PDO, PDO_SQLITE, libxml (für KML)
- Webserver (Apache, Nginx oder IIS)
- Internetverbindung für OpenStreetMap-Karten

### Installation

1. Repository klonen und ins Projektverzeichnis wechseln:
   ```bash
   git clone https://github.com/denni95112/drone-mission-mapper.git
   cd drone-mission-mapper
   ```

2. Webserver auf das Projektverzeichnis zeigen; PHP mit SQLite3 aktivieren.

3. Berechtigungen setzen (Linux/Unix):
   ```bash
   chmod -R 755 .
   chmod -R 777 config/ db/ logs/ tmp/ uploads/ 2>/dev/null || true
   mkdir -p tmp/exports && chmod -R 755 tmp
   ```

4. Im Browser die Anwendung aufrufen – Sie werden zum Setup weitergeleitet. Die [Einrichtung](https://github.com/denni95112/drone-mission-mapper/wiki/Einrichtung) durchführen (Anwendungsname, Passwort, Datenbankpfad, Kartenposition, Zeitzone).

---

## 📖 Verwendung & Dokumentation

Die ausführliche Bedienungsanleitung mit allen Funktionen findet sich im **[Wiki](https://github.com/denni95112/drone-mission-mapper/wiki)**:

| Thema | Wiki-Seite |
|-------|------------|
| Einstieg | [Einrichtung](https://github.com/denni95112/drone-mission-mapper/wiki/Einrichtung), [Anmeldung (Login)](https://github.com/denni95112/drone-mission-mapper/wiki/Anmeldung-Login) |
| Karte & Missionen | [Karte und Missionen](https://github.com/denni95112/drone-mission-mapper/wiki/Karte-und-Missionen), [Mission erstellen](https://github.com/denni95112/drone-mission-mapper/wiki/Mission-erstellen), [Mission starten](https://github.com/denni95112/drone-mission-mapper/wiki/Mission-starten) |
| Icons & Raster | [Icons platzieren](https://github.com/denni95112/drone-mission-mapper/wiki/Icons-platzieren), [Bereiche markieren](https://github.com/denni95112/drone-mission-mapper/wiki/Bereiche-markieren) |
| Zeitstrahl | [Zeitstrahl (Live und Historie)](https://github.com/denni95112/drone-mission-mapper/wiki/Zeitstrahl) |
| Teilen & Export | [Mission teilen](https://github.com/denni95112/drone-mission-mapper/wiki/Mission-teilen), [View-Only-Modus](https://github.com/denni95112/drone-mission-mapper/wiki/View-Only-Modus), [KML Import/Export](https://github.com/denni95112/drone-mission-mapper/wiki/KML-Import-Export), [CSV-Export](https://github.com/denni95112/drone-mission-mapper/wiki/Export-CSV) |
| Verwaltung | [Einstellungen](https://github.com/denni95112/drone-mission-mapper/wiki/Einstellungen), [Datenbank-Update](https://github.com/denni95112/drone-mission-mapper/wiki/Datenbank-Update), [Updates](https://github.com/denni95112/drone-mission-mapper/wiki/Updates) |
| Sonstiges | [Changelog](https://github.com/denni95112/drone-mission-mapper/wiki/Changelog), [Über](https://github.com/denni95112/drone-mission-mapper/wiki/Über) |

---

## 🔒 Sicherheit

- SQL-Injection-Schutz (Prepared Statements)
- CSRF-Schutz für alle Formulare
- Sichere Passwort-Hashierung (bcrypt/argon2)
- Token-basierte „Angemeldet bleiben“-Funktion mit sicheren Cookies
- HTTP-Sicherheitsheader (X-Frame-Options, X-Content-Type-Options, etc.)
- Input-Validierung

---

## 👨‍💻 Für Entwickler

### API-Endpunkte

| Endpunkt | Funktion |
|----------|----------|
| `/api/mission.php` | Mission-Verwaltung (erstellen, starten, auflisten, etc.) |
| `/api/map_icons.php` | Icon-Verwaltung (Platzierung, Positionen) |
| `/api/kml.php` | KML Import/Export |
| `/api/export_positions.php` | Positions-Export (CSV mit Adressauflösung) |
| `/api/log.php` | Logging API |
| `/api/log_icon.php` | Icon-Logging API |
| `/api/check_update.php` | Update-Prüfung |
| `/api/migrations.php` | Datenbank-Migrationen |

API-Requests erfordern Authentifizierung; Formulare nutzen CSRF-Token.

### Datenbank-Migrationen

Migrationen liegen in `migrations/`. Ausführen über die [Datenbank-Update](https://github.com/denni95112/drone-mission-mapper/wiki/Datenbank-Update)-Seite oder `migrations.php`.

### Projektstruktur

```
├── api/          # REST-API-Endpunkte
├── config/       # Konfiguration
├── includes/     # Auth, Cache, Utils, Security, etc.
├── migrations/   # DB-Migrationen
├── css/          # Stylesheets
├── js/           # Frontend (Map, Zeitstrahl, Module)
├── updater/      # Update-System
├── index.php     # Login
├── map.php       # Haupt-Karten-Seite
├── setup.php     # Ersteinrichtung
├── settings.php  # Einstellungen
├── view_missions.php / view_mission.php / view_logs.php
└── delete_missions.php / about.php / changelog.php
```

---

## ℹ️ Weitere Informationen

- **Verwandte Projekte**: [Drohnen-Einsatztagebuch](https://github.com/denni95112/drohnen-einsatztagebuch), [Drohnen-Flug-und-Dienstbuch](https://github.com/denni95112/drohnen-flug-und-dienstbuch)
- **Lizenz**: MIT – siehe [LICENSE](LICENSE)
- **Autor**: [Dennis Bögner](https://github.com/denni95112) (@denni95112) – Teil von [Open Drone Tools](https://open-drone-tools.de)
