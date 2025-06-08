Mein privater YouTube Downloader
Dies ist eine Web-Anwendung zum Herunterladen von YouTube-Videos in der bestmöglichen Qualität. Sie besteht aus einem Node.js-Backend, das die eigentliche Arbeit erledigt, und einem Vue.js-Frontend, das eine benutzerfreundliche Weboberfläche bereitstellt.

## Funktionen
Einfache Weboberfläche: YouTube-URL einfügen und den Download starten.

Höchste Qualität: Lädt Videos in der bestmöglichen Auflösung (1080p, 4K etc.) herunter, indem Video- und Audio-Spuren separat geladen und zusammengefügt werden.

Echtzeit-Feedback: Der Status des Downloads (Herunterladen, Zusammenfügen, Fertig) wird live in der Weboberfläche angezeigt.

Direkter Download: Nach Abschluss des Vorgangs wird ein direkter Download-Link zur fertigen Videodatei bereitgestellt.

## Projektstruktur
Das Projekt ist in zwei Hauptteile getrennt, um die Übersichtlichkeit zu wahren:

youtube-downloader/
├── backend/        # Der Server (Node.js, Express)  
│   ├── downloads/  # Hier werden fertige Videos gespeichert  
│   └── index.js    # Die Server-Logik  
└── frontend/       # Die Web-Anwendung (Vue.js)  
    └── src/        # Der Quellcode der Weboberfläche  

## Voraussetzungen
Bevor du beginnst, stelle sicher, dass die folgende Software auf deinem System installiert ist:

Node.js (Version 14 oder neuer): Die Laufzeitumgebung für JavaScript. Die Installation beinhaltet npm, den Node.js-Paketmanager.

FFmpeg: Ein unverzichtbares Werkzeug zur Verarbeitung von Video- und Audiodateien. Es wird benötigt, um die getrennt heruntergeladenen Video- und Audio-Streams zusammenzufügen.

Überprüfung der Installation: Öffne ein Terminal und gib ffmpeg -version ein. Wenn du eine Versionsnummer siehst, ist alles korrekt eingerichtet. Andernfalls musst du es installieren und sicherstellen, dass es über die Kommandozeile deines Systems erreichbar ist (im PATH eingetragen).

## Einrichtung (Setup)
Die Einrichtung muss für beide Teile des Projekts (Backend und Frontend) separat durchgeführt werden.

### 1. Backend einrichten
Öffne ein Terminal und navigiere in den backend-Ordner:
```
cd pfad/zum/projekt/backend
```
Installiere alle notwendigen Pakete mit npm:
```
npm install
```
### 2. Frontend einrichten
Öffne ein neues Terminal und navigiere in den frontend-Ordner:
```
cd pfad/zum/projekt/frontend
```
Installiere auch hier alle notwendigen Pakete:
```
npm install
```
## Anwendung starten
Um die Anwendung zu nutzen, müssen sowohl der Backend-Server als auch der Frontend-Entwicklungsserver laufen. Du benötigst dafür zwei geöffnete Terminals.

Terminal 1: Backend starten

Gehe in den backend-Ordner
```
cd pfad/zum/projekt/backend
```
Starte den Server
```
node index.js
```
Die Konsole sollte die Meldung Backend-Server läuft auf http://localhost:3000 anzeigen. Lass dieses Terminalfenster geöffnet.

Terminal 2: Frontend starten

Gehe in den frontend-Ordner
```
cd pfad/zum/projekt/frontend
```
Starte den Vue-Entwicklungsserver
```
npm run serve
```
Die Konsole zeigt dir nun an, unter welcher Adresse die Weboberfläche erreichbar ist, normalerweise http://localhost:8080.

## Nutzung
Öffne deinen Webbrowser und rufe die Adresse auf, die dir das Frontend-Terminal anzeigt (z. B. http://localhost:8080).

Du siehst nun die Weboberfläche des Downloaders.

Füge den vollständigen Link zu einem YouTube-Video in das Eingabefeld ein.

Klicke auf den "Download"-Button.

Verfolge den Status unterhalb des Eingabefeldes. Der Prozess kann je nach Videolänge und Internetgeschwindigkeit einige Zeit dauern.

Sobald der Vorgang abgeschlossen ist, erscheint die Meldung "Download abgeschlossen!" und ein klickbarer Link, über den du das fertige Video auf deinen Computer herunterladen kannst.

Die fertigen Videodateien findest du außerdem im Ordner backend/downloads/.