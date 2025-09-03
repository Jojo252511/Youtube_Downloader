@echo off
TITLE YouTube Downloader - Starter

echo INFO: Dieses Skript startet das Backend und das Frontend in separaten Fenstern.

echo Starte Frontend-Entwicklungsserver in einem neuen Fenster...
cd frontend
START "Frontend Dev Server" cmd /k "npm run serve"
cd ..

echo.
echo Starte Backend-Server in diesem Fenster...
TITLE Backend Server
cd backend
call npm start