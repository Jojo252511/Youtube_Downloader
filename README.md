# Selbst gehosteter YouTube Downloader

Dies ist eine Web-Anwendung zum Herunterladen von YouTube-Videos oder deren Audiospuren. Sie besteht aus einem Node.js-Backend, das die eigentliche Arbeit erledigt, und einem Vue.js-Frontend, das eine moderne und benutzerfreundliche Weboberfläche bereitstellt.

## Funktionen

-   **Formatwahl:** Lade Videos als **MP4**-Datei oder extrahiere nur die Audiospur als **MP3**-Datei.
-   **Qualitätsauswahl:** Wähle bei MP4-Downloads aus einer Liste der verfügbaren Videoauflösungen (z.B. 1080p, 720p etc.).
-   **Moderne Oberfläche:** Ein übersichtliches, ansprechendes und responsives Design, das auf allen Geräten gut funktioniert.
-   **Echtzeit-Feedback:** Der Status des Downloads (Herunterladen, Konvertieren, Fertig) wird live in der Weboberfläche angezeigt.
-   **Direkter Download:** Nach Abschluss des Vorgangs wird ein direkter Download-Link zur fertigen Datei bereitgestellt.

---

## Projektstruktur

Das Projekt ist in zwei Hauptteile getrennt, um die Übersichtlichkeit zu wahren:

```
youtube-downloader/
├── backend/        # Der Server (Node.js, Express)
│   ├── downloads/  # Hier werden fertige Videos gespeichert
│   └── index.js    # Die Server-Logik
└── frontend/       # Die Web-Anwendung (Vue.js)
    └── src/        # Der Quellcode der Weboberfläche
```

---

## Voraussetzungen

Bevor du beginnst, stelle sicher, dass die folgende Software auf deinem System installiert ist:

1.  **[Node.js](https://nodejs.org/) (Version 14 oder neuer):** Die Laufzeitumgebung für JavaScript. Die Installation beinhaltet `npm`, den Node.js-Paketmanager.
2.  **[FFmpeg](https://ffmpeg.org/download.html):** Ein unverzichtbares Werkzeug zur Verarbeitung von Video- und Audiodateien. Es wird für das Zusammenfügen von Video/Audio und die Konvertierung zu MP3 benötigt.

    * **Überprüfung der Installation:** Öffne ein Terminal und gib `ffmpeg -version` ein. Wenn du eine Versionsnummer siehst, ist alles korrekt eingerichtet. Andernfalls musst du es installieren und sicherstellen, dass es über die Kommandozeile deines Systems erreichbar ist (im `PATH` eingetragen).

---

## Einrichtung (Setup)

Die Einrichtung muss für beide Teile des Projekts (Backend und Frontend) separat durchgeführt werden.

### 1. Backend einrichten

Öffne ein Terminal und navigiere in den `backend`-Ordner:

```bash
cd pfad/zum/projekt/backend
```

Installiere alle notwendigen Pakete mit `npm`:

```bash
npm install
```

### 2. Frontend einrichten

Öffne ein **neues** Terminal und navigiere in den `frontend`-Ordner:

```bash
cd pfad/zum/projekt/frontend
```

Installiere auch hier alle notwendigen Pakete:

```bash
npm install
```

---

## Anwendung starten

Um die Anwendung zu nutzen, müssen sowohl der Backend-Server als auch der Frontend-Entwicklungsserver laufen. Du benötigst dafür **zwei geöffnete Terminals**.

#### Terminal 1: Backend starten

```bash
# Gehe in den backend-Ordner
cd pfad/zum/projekt/backend

# Starte den Server
node index.js
```

Die Konsole sollte die Meldung `Backend-Server läuft auf http://localhost:3000 und ist im Netzwerk erreichbar.` anzeigen. Lass dieses Terminalfenster geöffnet.

#### Terminal 2: Frontend starten

```bash
# Gehe in den frontend-Ordner
cd pfad/zum/projekt/frontend

# Starte den Vue-Entwicklungsserver
npm run serve
```

Die Konsole zeigt dir nun an, unter welcher Adresse die Weboberfläche erreichbar ist.

---

## Nutzung

### Lokal (auf demselben Computer)

1.  Öffne deinen Webbrowser und rufe die `Local`-Adresse auf, die dir das Frontend-Terminal anzeigt (z. B. `http://localhost:8080`).
2.  Folge den Schritten im nächsten Abschnitt.

### Im Netzwerk (von anderen Geräten)

1.  **Finde die lokale IP-Adresse** des Computers, auf dem das Backend und Frontend laufen (z.B. `192.168.1.15`).
2.  **Öffne den Browser** auf einem anderen Gerät (z.B. deinem Smartphone), das sich im **selben WLAN/Netzwerk** befindet.
3.  Gib die **Netzwerk-URL** aus dem Frontend-Terminal ein (z.B. `http://192.168.1.15:8080`).

**Wichtiger Hinweis:** Wenn die Verbindung fehlschlägt, blockiert möglicherweise die **Firewall** auf dem Host-Computer die eingehenden Verbindungen für die Ports `3000` und `8080`.

### Download-Vorgang

1.  **URL einfügen:** Gib den Link zu einem YouTube-Video in das Eingabefeld ein. Die Anwendung lädt automatisch die verfügbaren Formate.
2.  **Format wählen:** Wähle zwischen **MP4 (Video)** und **MP3 (Audio)**.
3.  **Qualität wählen:** Falls du `MP4` gewählt hast, erscheint eine Auswahlliste. Wähle die gewünschte Videoqualität. Die höchste Qualität ist automatisch vorausgewählt.
4.  **Download starten:** Klicke auf den Button "Download starten".
5.  **Verfolgen & Herunterladen:** Verfolge den Live-Status des Downloads. Sobald der Vorgang abgeschlossen ist, erscheint ein Link, um die fertige Datei herunterzuladen.

---

## Rechtliche Hinweise: 

### Erlaubt ist:

**Privater Gebrauch:**  
Das Herunterladen von Videos für den eigenen Gebrauch, z.B. zum Anschauen auf einem anderen Gerät. 

**Eigenkopien:**  
Der §53 UrhG erlaubt Eigenkopien für die private Nutzung, also auch das Herunterladen von Musik von YouTube. 

**Verwendung von Downloads in eigenen Videos:**  
Das Wiederverwenden von heruntergeladenen Videos in eigenen Videos ist erlaubt, wenn dies nicht kommerziell geschieht und die Erlaubnis des Urhebers gegeben wurde. 

### Nicht erlaubt ist:

**Verbreitung ohne Erlaubnis:**  
Das Hochladen heruntergeladener Videos auf andere Plattformen oder das Teilen mit anderen Personen ohne Erlaubnis des Urhebers. 

**Kopierschutz umgehen:**  
Das Herunterladen von Videos, bei denen der Kopierschutz gebrochen wurde oder umgangen wird. 

**Kommerzielle Nutzung:**  
Das Verwenden von heruntergeladenen Videos für kommerzielle Zwecke, z.B. durch den Verkauf oder die Nutzung in Werbefilmen, ohne Erlaubnis. 

**Veröffentlichen von illegalen Videos:**  
Auch das Herunterladen und Teilen von Videos, die bei YouTube illegal hochgeladen wurden (z.B. wegen Urheberrechtsverletzungen oder Jugendschutzverstößen), ist verboten. 

### Zusammengefasst:
YouTube-Downloader sind legal, wenn sie für den privaten Gebrauch verwendet werden und die Quelle legal ist. Sie sind illegal, wenn sie für kommerzielle Zwecke, die Verbreitung ohne Erlaubnis oder das Umgehen von Kopierschutzmaßnahmen eingesetzt werden. 

---

## Roadmap

1. ~~Künstler und Thumbnail~~

2. ~~Downloadverlauf bei mehreren Downloads hintereinander~~

3. ~~TypeScript-Umstieg~~
   
4. Wechseln zu YouTube.js[https://github.com/LuanRT/YouTube.js] als Datenlieferant

5. Playlist-Downloads

6. Werbe-Webseite
