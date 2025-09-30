#!/bin/bash
# Start-Skript für Linux und macOS

echo "INFO: Dieses Skript startet das Backend und das Frontend in separaten Fenstern."

# In den Frontend-Ordner wechseln und den Dev-Server in einem neuen Terminal starten
echo "Starte Frontend-Entwicklungsserver in einem neuen Terminal..."

# Prüft, welcher Terminal-Emulator verfügbar ist
if command -v gnome-terminal &> /dev/null; then
    gnome-terminal -- bash -c "echo '--- Frontend Server ---'; cd frontend && npm run serve; exec bash"
elif command -v konsole &> /dev/null; then
    konsole -e bash -c "echo '--- Frontend Server ---'; cd frontend && npm run serve; exec bash"
elif [[ "$OSTYPE" == "darwin"* ]]; then # Speziell für macOS
    osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'/frontend\" && npm run serve"'
else
    echo "WARNUNG: Konnte keinen bekannten Terminal-Emulator finden. Bitte starte das Frontend manuell in einem neuen Fenster mit 'cd frontend && npm run serve'."
fi

# Kurze Pause, damit das Frontend-Fenster zuerst erscheint
sleep 2

# In den Backend-Ordner wechseln und den Server im aktuellen Terminal starten
echo "Starte Backend-Server im aktuellen Terminal..."
cd backend
npm start