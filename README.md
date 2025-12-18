# Drohnen-Missions-Mapper

Eine webbasierte Anwendung zur Visualisierung und Verwaltung von Drohnen-Missionen auf einer interaktiven Karte mit OpenStreetMap.

## 📋 Beschreibung

Der Drohnen-Missions-Mapper ist eine PHP-basierte Webanwendung zur Planung, Durchführung und Nachbereitung von Drohnen-Missionen. Die Anwendung ermöglicht die Erstellung von Missionsgebieten mit Raster-Grids, die Platzierung von Icons (Fahrzeuge, Personen, Drohnen, etc.), die Verfolgung von Drohnenpositionen und die Visualisierung von Missionsdaten auf einer interaktiven Karte.

## ✨ Features

### Mission Management
- **Mission-Erstellung**: Erstelle Missionen mit oder ohne Raster-Grid
- **Grid-Generierung**: Automatische Raster-Generierung für Rechteck- oder Ellipsen-Formen
- **Mission-Status**: Verwaltung von Mission-Status (pending, active, completed)
- **Mission-Sharing**: Token-basierte Freigabe von Missionen für externe Nutzer
- **Mission-Export**: Export von Missionsdaten als CSV mit Adressauflösung

### Karten-Funktionen
- **Interaktive Karte**: OpenStreetMap-Integration mit Leaflet.js
- **Mehrere Karten-Typen**: Standard, Gelände, Satellit
- **Icon-Platzierung**: Platzierung verschiedener Icon-Typen auf der Karte
  - 🚗 Fahrzeug
  - 👤 Person
  - 🚁 Drohne
  - 🔥 Feuer
  - 🚒 Feuerwehr
  - 🚑 RTW
  - 🚔 Polizei
  - 🚛 THW
  - 📍 POI (Point of Interest)
- **Bewegungsvisualisierung**: Anzeige von Bewegungswegen für Icons
- **Legende**: Dynamische Legende für Missionsbereiche

### Drohnen-Tracking
- **Live-Tracking**: Echtzeit-Verfolgung von Drohnenpositionen
- **Historische Daten**: Speicherung aller Drohnenpositionen in der Datenbank
- **Batteriestatus**: Anzeige des Batteriestatus für jede Drohne
- **Höhenanzeige**: Anzeige der Flughöhe

### Timeline (Zeitstrahl)
- **Historische Wiedergabe**: Zeitbasierte Wiedergabe von Missionsdaten
- **Live-Modus**: Echtzeit-Anzeige während aktiver Missionen
- **Zeitsteuerung**: Slider-basierte Navigation durch die Missionshistorie
- **Playback-Funktion**: Automatische Wiedergabe der Missionshistorie

### GPS-Sharing
- **Position teilen**: Teilen der eigenen GPS-Position mit anderen Nutzern
- **Kontinuierliches Tracking**: Automatisches Senden der Position in regelmäßigen Abständen
- **Icon-Auswahl**: Auswahl des Icon-Typs für die eigene Position

### Import/Export
- **KML-Import**: Import von KML-Dateien (z.B. von DJI Drohnen)
- **KML-Export**: Export von Missionsdaten als KML-Datei
- **CSV-Export**: Export von Positionsdaten mit Adressauflösung
- **Adress-Caching**: Intelligentes Caching von Adressdaten für bessere Performance

### Weitere Features
- **Done-Fields**: Markierung abgeschlossener Bereiche in der Mission
- **View-Only-Modus**: Ansichtsmodus für geteilte Missionen
- **Logging-System**: Umfassendes Logging-System mit konfigurierbaren Log-Levels
- **Update-Checker**: Automatische Prüfung auf verfügbare Updates
- **Responsive Design**: Funktioniert auf Desktop und mobilen Geräten
- **Sichere Authentifizierung**: Passwortgeschützt mit Token-basierter "Angemeldet bleiben"-Funktion

## 🚀 Installation

### Voraussetzungen

- PHP 7.4 oder höher
- SQLite3 (meist bereits in PHP enthalten)
- PHP Extensions:
  - PDO
  - PDO_SQLITE
  - libxml (für KML-Import)
- Webserver (Apache, Nginx, etc.)
- Internetverbindung für OpenStreetMap-Karten

### Installationsschritte

1. **Repository klonen oder herunterladen**
   ```bash
   git clone https://github.com/denni95112/drone-mission-mapper.git
   cd drone-mission-mapper
   ```

2. **Webserver konfigurieren**
   - Richte einen virtuellen Host ein, der auf das Projektverzeichnis zeigt
   - Stelle sicher, dass PHP aktiviert ist
   - Für Apache: Stelle sicher, dass `mod_rewrite` aktiviert ist (optional, für .htaccess)

3. **Erstkonfiguration**
   - Öffne die Anwendung im Browser
   - Du wirst automatisch zum Setup weitergeleitet
   - Fülle das Setup-Formular aus:
     - Anwendungsname
     - Passwort
     - Datenbankpfad (optional, Standard: `db/mission-mapper-database.sqlite`)
     - Standard-Kartenposition (Breitengrad, Längengrad, Zoom-Level)
     - Zeitzone

4. **Berechtigungen setzen**
   - Stelle sicher, dass das Webserver-Benutzerkonto Schreibrechte auf folgende Verzeichnisse hat:
     - `db/` (für die Datenbank)
     - `config/` (für die Konfigurationsdatei)
     - `logs/` (für Log-Dateien, wird automatisch erstellt)
     - `tmp/exports/` (für Export-Dateien, wird automatisch erstellt)
     - `uploads/logos/` (für Logo-Uploads, wird automatisch erstellt)
   - Erstelle das Export-Verzeichnis manuell:
     ```bash
     mkdir -p tmp/exports
     chmod 755 tmp/exports
     ```

5. **Performance-Optimierungen (Empfohlen)**
   
   **Apache-Konfiguration:**
   - Aktiviere die folgenden Apache-Module für optimale Performance:
     ```bash
     sudo a2enmod deflate    # Gzip-Kompression
     sudo a2enmod expires    # Cache-Header
     sudo a2enmod headers    # Cache-Control Header
     sudo systemctl restart apache2
     ```
   - Überprüfe, ob die Module aktiviert sind:
     ```bash
     apache2ctl -M | grep -E "deflate|expires|headers"
     ```
   
   **Nginx-Konfiguration (Alternative):**
   - Füge folgende Konfiguration zu deinem Server-Block hinzu:
     ```nginx
     # Gzip-Kompression
     gzip on;
     gzip_types text/html text/plain text/css text/javascript application/javascript application/json;
     
     # Cache für statische Assets
     location ~* \.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff|woff2|ttf|otf)$ {
         expires 1y;
         add_header Cache-Control "public, immutable";
     }
     
     # Kein Cache für PHP-Dateien
     location ~ \.php$ {
         add_header Cache-Control "no-cache, must-revalidate";
     }
     ```
   
   **Datenbank-Indizes überprüfen:**
   - Die Indizes werden automatisch erstellt, können aber manuell überprüft werden:
     ```sql
     SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';
     ```
   - Erwartete Indizes:
     - `idx_missions_created_at_status`
     - `idx_drone_positions_mission_recorded`
     - `idx_map_icons_mission_type`
     - `idx_map_icon_positions_mission_recorded`
   
   **Gzip-Kompression testen:**
   ```bash
   curl -H "Accept-Encoding: gzip" -I http://your-domain.com/css/styles.css
   ```
   - Sollte `Content-Encoding: gzip` in der Antwort zeigen
   
   **Cache-Funktionalität überprüfen:**
   - **Config-Cache**: Lade eine Seite mehrmals - die Config-Datei sollte nur einmal pro Änderung gelesen werden
   - **Mission-Cache**: Lade dieselbe Mission mehrmals - erste Ladung aus Datenbank, weitere aus Cache
   - **API-Cache**: Rufe `/api/drones.php` mehrmals auf - erste Anfrage generiert Daten, weitere (innerhalb 3 Sekunden) aus Cache
   - **Client-Cache**: Öffne Browser DevTools → Network-Tab - API-Aufrufe sollten gecacht werden
   
   **Performance-Monitoring:**
   - Verwende Browser DevTools zur Überprüfung:
     - **Network-Tab**: Statische Assets sollten "from cache" zeigen, Antworten sollten komprimiert sein
     - **Performance-Tab**: Messung der Seitenladezeit sollte Verbesserungen zeigen

## 📁 Projektstruktur

```
drone-mission-mapper/
├── api/                         # API-Endpunkte
│   ├── check_update.php         # Update-Prüfung
│   ├── drones.php               # Drohnen-Daten API
│   ├── export_positions.php     # Positions-Export
│   ├── kml.php                  # KML Import/Export
│   ├── log.php                  # Logging API
│   ├── log_icon.php             # Icon-Logging API
│   ├── map_icons.php            # Icon-Verwaltung API
│   └── mission.php               # Mission-Verwaltung API
├── config/                      # Konfigurationsdateien
│   ├── config.php               # Hauptkonfiguration (wird beim Setup erstellt)
│   └── config.php.example       # Beispielkonfiguration
├── css/                         # Stylesheets
│   ├── about.css
│   ├── delete_missions.css
│   ├── login.css
│   ├── map.css
│   ├── navigation.css
│   ├── settings.css
│   ├── setup.css
│   ├── styles.css
│   ├── view_logs.css
│   ├── view_mission.css
│   └── view_missions.css
├── includes/                    # PHP-Includes
│   ├── cache.php                # Caching-System
│   ├── error_reporting.php      # Fehlerbehandlung
│   ├── footer.php               # Footer-Komponente
│   ├── header.php               # Header-Komponente
│   ├── security_headers.php     # Sicherheits-Header
│   └── utils.php                # Utility-Funktionen
├── js/                          # JavaScript-Dateien
│   ├── cache.js                 # Client-seitiges Caching
│   ├── delete_missions.js
│   ├── map-init.js              # Map-Initialisierung
│   ├── map-utils.js             # Map-Utilities
│   ├── map.js                   # Map-Modul-Loader
│   ├── modules/                 # JavaScript-Module
│   │   ├── drone-tracker.js     # Drohnen-Tracking
│   │   ├── export-positions.js  # Positions-Export
│   │   ├── kml-manager.js        # KML-Verwaltung
│   │   ├── map-type-manager.js   # Karten-Typ-Verwaltung
│   │   ├── mission-manager.js    # Mission-Verwaltung
│   │   ├── mission-selection-manager.js
│   │   ├── share-manager.js      # Sharing-Funktionen
│   │   ├── sidebar-manager.js    # Sidebar-Verwaltung
│   │   ├── update-checker.js     # Update-Prüfung
│   │   ├── view-only-mission-manager.js
│   │   └── zeitstrahl-manager.js # Timeline-Verwaltung
│   ├── utils/
│   │   └── logger.js             # Logging-Utility
│   ├── view_logs.js
│   ├── view_mission.js
│   ├── view-mission-init.js
│   └── view_missions.js
├── db/                          # Datenbankverzeichnis (wird automatisch erstellt)
├── logs/                        # Log-Dateien (wird automatisch erstellt)
├── tmp/                         # Temporäre Dateien
│   └── exports/                 # Export-Dateien
├── uploads/                     # Upload-Verzeichnis
│   └── logos/                   # Logo-Uploads
├── api/                         # API-Endpunkte
├── auth.php                     # Authentifizierung
├── index.php                    # Login-Seite
├── logout.php                   # Logout-Funktion
├── map.php                      # Haupt-Karten-Seite
├── setup.php                    # Erstkonfiguration
├── setup_database.php           # Datenbankinitialisierung
├── settings.php                 # Einstellungen
├── view_mission.php             # Mission-Ansicht (View-Only)
├── view_missions.php            # Missions-Übersicht
├── view_logs.php                # Log-Ansicht
├── delete_missions.php          # Mission-Löschung
├── about.php                    # Über-Seite
├── version.php                  # Versionsinformationen
├── LICENSE                      # MIT-Lizenz
└── README.md                    # Diese Datei
```

## 🔧 Konfiguration

Die Konfiguration erfolgt über `config/config.php`, die beim ersten Setup erstellt wird. Folgende Einstellungen sind möglich:

- `navigation_title`: Titel der Anwendung
- `token_name`: Cookie-Name für die Authentifizierung
- `database_path`: Pfad zur SQLite-Datenbank
- `map_default_lat`: Standard-Breitengrad (Latitude)
- `map_default_lng`: Standard-Längengrad (Longitude)
- `map_default_zoom`: Standard-Zoom-Level (1-18)
- `timezone`: Zeitzone für Datums-/Zeitanzeige
- `logo_path`: (Optional) Pfad zum Logo
- `debugMode`: Debug-Modus aktivieren/deaktivieren
- `use_uav_bos_api`: UAV-BOS API aktivieren/deaktivieren
- `log_level`: Log-Level (debug, info, warning, error)

## 🔐 Sicherheit

- **Passwort-Hashing**: Passwörter werden mit bcrypt/argon2 gehasht
- **Session-basierte Authentifizierung**: Sichere Session-Verwaltung
- **Token-basierte "Angemeldet bleiben"-Funktion**: Sichere Token-Verwaltung
- **Sichere Cookie-Einstellungen**: HttpOnly, Secure Flags
- **Prepared Statements**: Alle Datenbankabfragen verwenden Prepared Statements
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **CSRF-Schutz**: CSRF-Token für alle Formulare
- **Input-Validierung**: Umfassende Validierung aller Benutzereingaben

## 📖 Verwendung

### Login

1. Öffne die Anwendung im Browser
2. Gib das während des Setups festgelegte Passwort ein
3. Klicke auf "Einloggen"
4. Optional: Aktiviere "Angemeldet bleiben" für 30 Tage

### Mission erstellen

1. Wähle eine Form (Rechteck oder Ellipse)
2. Zeichne das Missionsgebiet auf der Karte
3. Konfiguriere Raster-Parameter (Feldgröße, Anzahl der Bereiche)
4. Gib eine Missions-ID ein
5. Klicke auf "Raster generieren"

### Mission starten

1. Wähle eine Mission aus der Missionsliste
2. Klicke auf "Mission starten"
3. Die Mission wird aktiv und Drohnen-Tracking beginnt

### Icons platzieren

1. Wähle einen Icon-Typ aus der Sidebar
2. Klicke auf die Karte, um ein Icon zu platzieren
3. Optional: Gib einen Label-Text ein

### GPS-Position teilen

1. Öffne eine Mission im View-Only-Modus
2. Gib deinen Namen ein
3. Wähle einen Icon-Typ
4. Klicke auf "GPS einmal senden" oder "GPS alle 30 Sek. senden"

### Timeline verwenden

1. Öffne eine Mission mit Positionsdaten
2. Klicke auf den Timeline-Button
3. Verwende den Slider, um durch die Zeit zu navigieren
4. Verwende die Playback-Funktion für automatische Wiedergabe

### KML importieren/exportieren

1. **Export**: Wähle eine Mission und klicke auf "KML exportieren"
2. **Import**: Wähle eine Mission und klicke auf "KML importieren", dann wähle eine KML-Datei

### Positionsdaten exportieren

1. Gehe zur Missions-Übersicht
2. Klicke auf "Export" bei der gewünschten Mission
3. Warte, bis die Adressauflösung abgeschlossen ist
4. Die CSV-Datei wird automatisch heruntergeladen

## 🛠️ Technische Details

- **Backend**: PHP 7.4+
- **Datenbank**: SQLite3 mit WAL-Modus für bessere Performance
- **Karten**: OpenStreetMap mit Leaflet.js
- **Frontend**: Vanilla JavaScript (ES6+), CSS3
- **Caching**: Mehrstufiges Caching-System (In-Memory, File-based)
- **API**: RESTful API-Endpunkte für alle Funktionen
- **Logging**: Datei-basiertes Logging-System

## 📝 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert - siehe [LICENSE](LICENSE) Datei für Details.

## 👤 Autor

**Dennis Bögner**

- GitHub: [@denni95112](https://github.com/denni95112)
- Repository: [drone-mission-mapper](https://github.com/denni95112/drone-mission-mapper)

## 🤝 Beitragen

Beiträge sind willkommen! Bitte erstelle ein Issue oder einen Pull Request auf GitHub.

## ⚠️ Bekannte Einschränkungen

- Die Anwendung benötigt JavaScript für die vollständige Funktionalität
- Internetverbindung erforderlich für OpenStreetMap-Karten
- Adressauflösung verwendet Nominatim (Rate-Limits beachten)
- KML-Import unterstützt derzeit nur Wegpunkte (keine Flugwege)

## 🐛 Fehler melden

Bitte melde Fehler über die [GitHub Issues](https://github.com/denni95112/drone-mission-mapper/issues).

## 📧 Kontakt

Bei Fragen oder Anregungen kannst du ein Issue auf GitHub erstellen.

