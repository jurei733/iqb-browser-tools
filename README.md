# IQB-Werkzeuge im Browser · Version 0.2.2

Portierung der Arbeitsabläufe von **IQB-Kodieren 4.3.0.3** und **itc-ToolBox 3.3.0.2**. Die Anwendung läuft als statische Website mit lokaler Dateiverarbeitung; eine Windows-Installation ist nicht erforderlich.

## Direkt ausprobieren

In IQB-Kodieren **Beispiel öffnen** wählen. In der Toolbox stehen Originalvorlagen und synthetische Beispieldateien zum Download bereit. `public/examples/` enthält außerdem eine ausgefüllte Login-Tabelle, Antwort- und Log-CSV, Toolbox-JSON, Testheftgrößen, eine SQLite-Datenbank und einen Kodierjob mit Schablone.

Für einen vollständigen Probelauf:

1. Unter **Antwortdatenbank** die Beispieldatenbank öffnen, prüfen und eine Auswertung erzeugen.
2. Unter **Antworten & Auswertungen** Antworten.csv und Logs.csv gemeinsam einlesen; Unterformular- und Exportformat wählen.
3. Unter **Login-Handzettel (Word)** die ausgefüllte Beispieltabelle auswählen und die QR-Vorlage verwenden.
4. Den Schablonenjob in IQB-Kodieren öffnen, Schablone ziehen/drehen, Code vergeben und `.result` herunterladen.

Alle Beispiele sind erfunden. Die Adresse `testcenter.example.org` ist ein Platzhalter.

## Funktionen

| Anwendung / Bereich | Übertragenes Verhalten |
| --- | --- |
| Kodierjobs | ZIP, lose Dateien oder Ordner; aktuelle und historische XML-Varianten; Variablenpakete, getrennte Scanordner, Personenpräfixe und alternative Testhefte |
| Scanansicht | PNG, JPEG, BMP, GIF, WebP und erste TIFF-Seite; TIFF-, BMP-, PNG-, JPEG-JFIF- und EXIF-Auflösung; crop- und DPI-korrigierte Bereichsrahmen |
| Kodierschablonen | CT_VARIABLE-Bilder und lokale Testschablone.png; ausblenden, ziehen, drehen, zurücksetzen; Position je Variable lokal sichern |
| Kodieren | Codes einschließlich 0, Fall- und Jobkommentare, nächste offene Antwort, Fallliste, freie oder fortlaufende Navigation, Tastatursteuerung und atomare Sammelkodierung je Person |
| Ergebnisse | GZip-XML im ursprünglichen CodingResults-Format Version 5; Ergebnisse gemeinsam mit dem Job oder nachträglich laden; lokaler Fortschritt in IndexedDB |
| Codes | Vier ursprüngliche Spalten und Anzahlen, ursprüngliche Zeichenmengen, Ziehung ohne Wiederholung mit Web Crypto |
| Booklets | Originale benannte Excel-Zellen, Units, Blöcke, Nummerierung, Startcodes, Zeitbegrenzungen und Metadaten → Booklet-XML |
| Logins | Testpersonen, Reserve, Reviewer und Testleitung; getrennte Präfixe, Gruppen-IDs und gemeinsames Zufallssuffix; bearbeitete Xlsx und optionale Testtaker-XML je Gruppe oder insgesamt |
| Word-Handzettel | Beide Original-DOCX-Vorlagen und eigene Vorlagen mit Inhaltssteuerelementen; alle acht ursprünglichen Tags; QR-Codes, ein Dokument insgesamt oder je Gruppe; Tabellen und Dokumentstile bleiben erhalten |
| CSV | UTF-8, Windows-1252, UTF-16 LE; Komma, Semikolon oder Tabulator; gequotete und mehrzeilige Felder, leere Zellen und führende Nullen |
| Antworten / Logs | Alte 11-spaltige, 2019er und 2024er Testcenter-CSV sowie Toolbox-JSON und rohe JSON-Berichte; ursprüngliche Player-Antwortformate; Zusammenführen nach Personenidentität und jüngstem Antwortzeitpunkt |
| Auswertungen | Breite Excel-Tabellen Antworten/Status/Codes/Scores; Unterformulare als Zeilen, Spalten oder ohne Unterformulare; ursprüngliches CSV-Langformat; Sitzungsberichte als CSV/Xlsx; vollständiges JSON oder ZIP je Gruppe |
| Antwortdatenbank | SQLite im ursprünglichen Schema; Version 1 und 2 öffnen, neue Version-2-Dateien anlegen; CSV/JSON/Testcenter importieren; ergänzen oder importierte Testhefte ersetzen; Größen importieren; Integrität, Fremdschlüssel und Duplikate prüfen; Originaldatei und Auswertungen herunterladen |
| Datenbanksicherung | Aktuelle Arbeitskopie und vorherige geöffnete Datenbank lokal im Browser wiederherstellen; SQLite-Download zur unabhängigen Sicherung |
| Testcenter | Anmeldung einschließlich SHA-256-Challenge, Arbeitsbereiche und Gruppen; Antworten, Logs, rohe CSV und Reviews; Inhalte mit HTML-Index als ZIP; Testheftgrößen mit Ressourcenabhängigkeiten; direkte Übernahme in die lokale Datenbank |
| Verarbeitung | Kodierpakete, Datenimporte, SQLite und Auswertungen in einem Web Worker; erweiterte Aufträge abbrechen; Word-Erzeugung mit Fortschritt und Abbruch |
| Offline | Service Worker speichert Anwendung, Bibliotheken, WASM, Vorlagen und Beispiele. Nach dem ersten vollständigen Laden sind lokale Dateifunktionen offline nutzbar. Installationsmanifest mit 192-/512-Pixel-Icons |

Das Training-Flag wird eingelesen. In der rekonstruierten Windows-Version steuert dieses Flag keinen eigenen Trainingsablauf. Die Browserfassung erfindet deshalb keine zusätzlichen Trainingsbewertungen.

### Tastatur

Pfeile links/rechts, Bild auf/ab und Enter: Fall wechseln. Pfeile oben/unten: Code wechseln. Strg/Cmd + Ziffer: dieselbe Person über alle Variablen kodieren, sofern der Code überall eindeutig ist. F3: kodierte Fälle, F4: Jobkommentar, Strg/Cmd+O: öffnen, Strg/Cmd+S: Ergebnisdownload, Plus/Minus: Zoom. Ziffern: eindeutigen passenden Code wählen. Punkt/Komma/Schrägstrich: Zoom auf 100 % zurücksetzen. Texteingaben behalten ihre normale Tastaturbedienung.

## Testcenter verbinden

Die Serveradresse und Administrationszugangsdaten in **Testcenter verbinden** eingeben. Zugangsdaten und AuthToken werden nur im Arbeitsspeicher gehalten und beim Trennen verworfen. Keine Zugangsdaten werden in URL, Local Storage oder Service-Worker-Cache gespeichert.

Bei verschiedenen Ursprüngen muss der Testcenter-Server CORS für den Ursprung dieser Anwendung erlauben, einschließlich GET/PUT/POST/OPTIONS und der Header `Content-Type` und `AuthToken`. Bei einer HTTPS-Anwendung muss auch das entfernte Testcenter HTTPS verwenden. Alternativ `dist/` auf einem geeigneten Ursprung zusammen mit der API bereitstellen. Eine Browseranwendung kann diese Serverfreigabe nicht selbst umgehen. Es gibt keinen Anmelde- oder Datenproxy.

Die Verbindung greift auf die `/api`-Routen der ursprünglichen Toolbox zu. Abweichende oder zukünftige Testcenter-APIs benötigen gegebenenfalls Anpassungen.

## Starten und bereitstellen

Node.js 22 oder neuer und pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm dev
pnpm build
```

`dist/` enthält die vollständige Website einschließlich Service Worker, Worker-JavaScript und SQLite-WASM. Auf einem statischen Webserver über HTTPS oder zum lokalen Test über localhost ausliefern; nicht direkt über `file://` öffnen. WASM sollte mit `application/wasm` ausgeliefert werden. `sw.js` darf vom Webserver nicht dauerhaft unverändert zwischengespeichert werden. Bei Bereitstellung unter einer Unteradresse müssen Vite-Basispfad, Vorlagen-/Beispielpfade sowie Manifest und Service-Worker-Scope angepasst werden; dieser Stand ist für den Ursprungspfad `/` gebaut.

Die private Sites-Veröffentlichung erfordert beim ersten Zugriff die Anmeldung des Eigentümers. Für die Verwendung durch weitere Personen ist eine passende Veröffentlichung oder eigene Bereitstellung nötig.

## Geprüft und verbleibende Nachweise

- **47 automatisierte Prüfungen**: Original-Xlsx und beide Original-DOCX-Vorlagen, historische und aktuelle Kodierjobs, Ergebnisdateien, CSV-Varianten, Antwortkonverter, Zusammenführung, Unterformular-Exporte, mehrfache Sitzungen, Reviews, SQLite-Rundlauf einschließlich Version 1 / eigener Statuswerte / Transaktionsabbruch sowie Testcenter-Verträge mit nachgebildeten Serverantworten.
- **Praktisch im integrierten Chromium-Browser auf macOS geprüft**: Jobimport im Worker, Code/Kommentar, Fallliste, Schablone ziehen und drehen, SQLite öffnen und prüfen, Excel erzeugen und herunterladen, QR-DOCX erzeugen und herunterladen, Antwort-/Log-CSV gemeinsam importieren. Tatsächlich heruntergeladene Xlsx und DOCX wurden zusätzlich strukturell geprüft.
- **43 Browserprüfungen je Browser**: Chromium 147, Safari 27.0.1 (WebKit) und Firefox 158.0 (Gecko) auf macOS. Originalvorlagen, unveränderte Windows-Xlsx-Exporte, Bildformate und EXIF-Ausrichtungen, echte Module-Worker, SQLite/WASM, IndexedDB, sämtliche Antwort-Exportformate, Word mit QR-Codes und Web-Crypto/fetch. Berichte unter `tests/results/`.
- **Native Browseroberflächen in 0.2.1**: Safari und Firefox: Beispieljob öffnen, Code 0 und Kommentar erfassen, Ergebnis- und Codes-Xlsx-Download; gespeicherte Kodierung nach Neuladen wiederherstellen. Firefox zusätzlich SQLite-Datei öffnen, prüfen, auswerten und offline wiederherstellen. Safari ebenfalls offline neu laden und Kodierkommentar in der Fallliste wiederfinden.
- **Testcenter-Bedienung gegen lokalen Testserver geprüft**: Anmeldung, Arbeitsbereich, Ergebnisgruppe, Antwort-/Log-Abruf bis zur Excel-Datei, Review-Export und Trennen. Die Challenge- und Content-Abläufe sind zusätzlich durch automatisierte Vertragstests abgedeckt.
- **Offline geprüft**: lokalen Webserver abgeschaltet, Anwendung neu geladen und gespeicherte SQLite-Datenbank einschließlich WASM-Engine wiederhergestellt.
- **Noch nicht praktisch nachgewiesen**: echte/anonymisierte Originaljobs, Verbindung zu einem echten Testcenter, Mobilgeräte, Linux-Systeme und Browser unter Windows und die Betriebssysteminstallation als PWA. Diese Daten beziehungsweise Zugänge standen nicht zur Verfügung.

Browserprüfungen lassen sich mit `node scripts/build-browser-tests.mjs ./work/browser-tests` bauen. Das ausgegebene Verzeichnis über einen lokalen Webserver ausliefern und `/tests/browser.html` in einem echten Browser öffnen. Die Prüfseite wird nicht in die normale Anwendung aufgenommen.

Die Arbeitsabläufe sind implementiert; eine vollständige Gleichwertigkeit für jeden historischen Datenbestand ist damit noch nicht belegt. Der Speicher des Geräts begrenzt Datenmengen. Kodier-ZIP-Dateien sind auf 300 MB entpackte Daten begrenzt, einzelne Scans auf 80 Millionen Pixel; TIFF verwendet wie das Original die erste Seite. Für große Bestände Jobs aufteilen und SQLite-/Ergebnisdateien regelmäßig extern sichern. Private Fenster, das Löschen von Browserdaten und Speicherbereinigung können lokale Stände und Offline-Dateien entfernen.

## Vergleich mit ausgeführten Windows-Originalen

Am **23.10.2026** wurden die unveränderten Originalassemblies in einer lokalen **Windows-11-ARM64-VM, Build 26300.9457**, mit **.NET Framework (CLR 4.0.30319.42000, Release 533509)** aus einem x86-PowerShell-Prüfprogramm ausgeführt. Die Originalfunktionen wurden per Reflection aufgerufen, einschließlich WPF-Bilddekoder, originaler SQLite-Bibliothek und vollständiger Excel-/Word-Erzeugung. Der Prüfcode übernimmt ausschließlich die SQLite-Providerdeklaration aus der Originalkonfiguration in seinen eigenen Prozess. Die Originalassemblies werden nicht verändert oder neu kompiliert.

- **15/15 Antwortkonverter-Vergleiche bestanden**, einschließlich großer Ganzzahlen, Unterformularnummern, Boolescher Werte und dokumentierter Korrekturen.
- **20/20 Datei-/Funktionsvergleiche bestanden**: Ergebnisdateien und SQLite in beide Richtungen, Joboptionen/Fallzuordnung/Bereichsrahmen, physische Bildproportionen für PNG/JPEG/BMP/TIFF, drei breite Excel-Varianten, CSV-Xlsx, Reviews, Testtaker- und Booklet-XML, beide originalen Word-Vorlagen sowie Codeanzahlen/Zeichenmengen/Eindeutigkeit.
- Verglichen werden Inhalte und Struktur. Weggelassene und leere Excel-Zellen sowie das optionale leere Testlet-Label sind gleichwertig; ZIP-Zeitstempel, Formatierung und zufällige Beziehungs-IDs werden nicht als Inhaltsunterschied gewertet. Booklet-Beschreibungen behalten die ausdrücklich dokumentierte Korrektur der ursprünglichen Titelspalten-Verwechslung.
- **Windows-Oberflächen zusätzlich geöffnet**: IQB-Kodieren mit dem synthetischen Job, vier Fällen, zwei Seiten und Code 0; itc-ToolBox mit ihren Hauptbereichen. Dies ist ein Bedienungsstichprobentest; die Datei- und Exportvergleiche rufen die originalen Backendfunktionen auf.
- Unveränderte Windows-Ausgaben dienen zusätzlich als kleine Xlsx-Testdateien unter `tests/fixtures/`. Rohbericht mit SHA-256-Hashes und Vergleichsberichte stehen in `tests/results/original-windows.json` und `tests/results/compare-original-windows-*.json`.

Der Referenzdatensatz wird als separates `iqb-windows-referenz.zip` bereitgestellt. Nach dem Entpacken enthalten `inputs/` die identischen Eingaben samt Originalprogrammen und `windows-results/` die tatsächlichen Ausgaben. Mit installierten Projektabhängigkeiten im Quellcodeordner:

```sh
node scripts/compare-windows-converters.mjs /pfad/windows-results/original-windows.json /pfad/konverter-vergleich.json
node scripts/compare-windows-files.mjs /pfad/windows-results /pfad/datei-vergleich.json /pfad/inputs
```

`scripts/Run-Windows-Reference.ps1` wiederholt die Originalaufrufe unter x86-Windows-PowerShell mit dem Eingabeordner als `-Root`. Dabei entstehen die Ausgaben unter `inputs/windows-results/`; die Originalprogramme bleiben unverändert.

Die früheren 15 Originalkonverter-Aufrufe unter macOS/.NET 10 bleiben separat dokumentiert. Die Nachweise verwenden synthetische Daten und die Originalvorlagen; sie belegen keine vollständige Gleichwertigkeit für alle historischen Bestände oder einen produktiven Testcenter-Zugang.

## Referenzkorrekturen in 0.2.2

- Joboptionen wie `showScore=" True "` werden wie im Original mit umgebenden Leerzeichen gelesen. Ungültige Wahrheitswerte lösen eine verständliche Fehlermeldung aus.
- Der alte Abi-Konverter normalisiert positive 32-Bit-Unterformularnummern (`01` → `1`), behält bei doppelter Variable den ersten Wert und behandelt Nummern außerhalb dieses Bereichs als normalen Variablennamen.
- Boolesche Antwortwerte verwenden in Standard-, Dan-, Simple- und Schlüssel/Wert-Konvertern die originale Schreibweise `True` / `False`.
- Große ganze Antwortwerte wie `9007199254740993` bleiben beim Einlesen aus JSON, CSV und API sowie nach Worker-Übertragung, SQLite- und Excel-Export exakt erhalten. JavaScript-Zahlen werden erst nach der Prüfung auf sichere Ganzzahldarstellung verwendet.
- Numerische API-Kennungen werden vor dem Zusammenführen in Text umgewandelt. Große Login-Kennungen bleiben exakt; der Code `0` bleibt von einem fehlenden Code unterscheidbar.
- Scan und Kodierschablone verwenden das physische Seitenverhältnis aus horizontaler und vertikaler Auflösung. Unterschiedliche DPI-Werte verzerren damit die Darstellung nicht mehr; Bereichsrahmen behalten ihre Pixelkoordinaten.
- BMP-Auflösung und rationale TIFF-DPI-Werte werden korrekt gelesen, statt die Darstellung stillschweigend auf 96 DPI zurückzusetzen.
- Gültige Xlsx-Dateien aus dem ursprünglichen Open-XML-Exporter mit Namespace-Präfixen werden beim Import unterstützt. Eine Dekodierkopie wird anhand der XML-Namensräume normalisiert.
- Bewusste Unterschiede beim Referenzvergleich: Dezimaltexte bleiben unabhängig von der Systemsprache im JSON-Format, Nullwerte erhalten durchgängig `#null#`, Antwort-Zeilenumbrüche bleiben erhalten und komplexe Antwortwerte verwenden kompakte JSON-Schreibweise.

## Bewusste Korrekturen gegenüber dem rekonstruierten Original

- Kodierte Fälle hinter einer vollständig leeren Person werden mit exportiert.
- Zusammenführen erhält jüngere Antworten und alle Logs; Identitäten werden als Tupel statt durch kollisionsanfälliges Aneinanderhängen verglichen. Originale Unit-ID und Alias bleiben getrennt.
- CSV-Import in die Datenbank berücksichtigt auch Logs. Wiederholte Importe sind idempotent. Datenbankänderungen werden in Transaktionen geschrieben.
- Mehrere Sitzungen werden tatsächlich ausgegeben. Mit `MS` bezeichnete Werte sind Millisekunden, Ladegeschwindigkeit ist Mbit/s. Datumstexte sind ausdrücklich ISO-UTC.
- CSV-Zitate und XML-Sonderzeichen werden maskiert. Kennungen und Antworttabellen bleiben Textwerte. Bei Variablenkollisionen in einer breiten Tabelle gewinnt der jüngste Zeitstempel.
- Booklet-Beschreibungen verwenden die Beschreibungsspalte. Word-Tabellen bleiben erhalten; QR-Bilder sind portable PNG-Dateien.
- Zufallsfolgen müssen nicht mit Windows übereinstimmen. Gruppen-IDs nutzen wie die ursprüngliche Loginerzeugung Großbuchstaben, ein gemeinsames Suffix und bei Bedarf eine laufende Ergänzung.
- Der Kodierername wird eingegeben; Windows Active Directory wird nicht vorausgesetzt. TLS-Zertifikatprüfungen werden nicht abgeschaltet.

## Browserkorrekturen in 0.2.1

- Safari und Firefox wenden EXIF-Drehung und Spiegelung trotz `imageOrientation: none` an. Die Dekodierkopie neutralisiert jetzt die Orientierung bei JPEG/WebP; bei PNG wird der optionale eXIf-Block aus dieser Kopie entfernt. Bildkoordinaten, Bereichsrahmen und Schablonen bleiben zusammenhängend. Originaldatei und DPI bleiben unverändert.
- Wenn `createImageBitmap` einen grundsätzlich unterstützten Bildtyp zurückweist, wird der HTML-Image-Dekoder verwendet.
- Safari kann bei Namenskollisionen `.result-2` statt `.result` herunterladen. Solche Namen werden nun importiert. Neue Ergebnisdateien erhalten einen Zeitstempel; die Kodier-Dateiauswahl akzeptiert auch historische Safari-Dateinamen.

## Quellen

- Toolbox: https://github.com/iqb-berlin/itc-toolbox, Commit `7c45553ca246104a59043d6f4194caf5a4b6c039`.
- Originalprogramme: https://www2.iqb.hu-berlin.de/it/.
- ClickOnce-Pakete am 22.10.2026 heruntergeladen; Dateien und SHA256-Prüfsummen in `PROVENANCE.json`, Manifest-Dateihashes beim Download geprüft.
- IQB-Kodieren, IQB-Scans und IQB-Common mit ILSpyCmd 11.1.0.9782 statisch in lesbares C# und XAML zurückgewonnen. Unveränderte Originalfunktionen und vollständige Exportabläufe wurden unter Windows / .NET Framework ausgeführt; die Browserkorrekturen und Nachweise sind oben beschrieben. Rekonstruierter Code wurde nicht als Windows-Projekt kompiliert.
- Lizenz: `LICENSE`. Diese Browserfassung verwendet keine KI-API und benötigt keinen API-Schlüssel.
