# IQB-Werkzeuge im Browser · Version 0.3.0

Portierung der Arbeitsabläufe von **IQB-Kodieren 4.3.0.3** und **itc-ToolBox 3.3.0.2**. Die Anwendung läuft als statische Website mit lokaler Dateiverarbeitung; eine Windows-Installation ist nicht erforderlich.

## SQLite mit Coding-Box austauschen

Unter **Antwortdatenbank** lassen sich nun auch vollständige SQLite-Arbeitsbereichssicherungen aus Coding-Box öffnen. **Als Browser-Tools-SQLite** und **Als Coding-Box-SQLite** verbinden die Formate. Native Sicherungen behalten sämtliche enthaltenen Tabellen einschließlich Dateien, Jobs und Kodierständen v1/v2/v3. Die sichtbare Kodierversion ist auswählbar. Eine unveränderte Browser-Arbeitskopie kann die ursprüngliche native Datei bytegenau zurückgeben.

Geänderte v3-Kodierungen können ausdrücklich über die Checkbox übernommen werden; v1/v2 und die Jobs bleiben erhalten, Vorher-/Nachher-Werte werden protokolliert. Änderungen an Rohantworten, Personen oder Logs werden getrennt von einer bestehenden Kodierhistorie importiert. Neu angelegte Browser-Datenbanken können einen nativen Antwortdatengraphen erzeugen; dazu werden keine Aufgaben oder früheren Bewertungen erfunden.

Für den Rückimport in eine laufende Coding-Box ist der ergänzte MCP-/Backend-Import in einen leeren Bereich erforderlich. Der gemeinsame MCP-Server bietet dafür `coding_import_sqlite`. Die statische Browseranwendung erhält keine Administrationszugangsdaten. Nullable Kodierungen verwenden eine lokale Browser-Schemaerweiterung v3; v1/v2 bleiben lesbar, ältere Windows-Programme unterstützen diese v3-Erweiterung nicht.

## Funktionsmatrix und erneuter Referenzlauf am 31.10.2026

Der [filterbare Funktionsbericht](docs/function-audit.html) und seine [maschinenlesbaren Ergebnisse](docs/function-audit.json) erfassen **110 Funktionspunkte**. Das [Originalinventar](docs/original-inventory.json) hält 130 Quelldateien, 36 XAML-Oberflächen und 151 Controls mit Herkunft und Prüfsummen fest. Alle 23 aktiven Haupteinstiege der Windows-Toolbox sind einer Matrixzeile zugeordnet. Die [Matrixdefinition](docs/function-matrix.json) trennt direkte Windows-Vergleiche, Browser-/Modultests, beabsichtigte Unterschiede, Lücken und reine Browser-Erweiterungen. Das Inventar ist eine Prüfgrundlage und kein Nachweis aller internen Codepfade.

Der aktuelle Stand besteht **66 Node-Tests**, **15 Windows-Konvertervergleiche**, **21 Windows-Datei-/Verhaltensvergleiche** und **46 Prüfungen je nativem Chromium 156 und Safari 27.0.1 auf macOS**. Die unveränderten Windows-Originale wurden erneut ausgeführt; Eingabe- und Assembly-Prüfsummen sind gespeichert. Für den Rückweg nach Windows wurden `.result` und SQLite aus dem aktuellen Browsercode frisch erzeugt. Firefox konnte in diesem Audit wegen Zeitüberschreitungen der nativen Computersteuerung nicht erneut bedient werden; seine älteren Nachweise bleiben getrennt. Der [GitHub-Lauf](https://github.com/jurei733/iqb-browser-tools/actions/runs/41142968607) besteht zusätzlich **8/8 Testsuiten mit 46/46 Kompatibilitätsprüfungen je Chromium, Firefox und WebKit**. Diese Linux-Läufe sind getrennt vom nativen Safari-/Chromium-Nachweis gespeichert. Die Artefakt-Uploads sind weiterhin durch die GitHub-Speicherquote blockiert; die Ergebnisse sind über Logs und Job-Zusammenfassungen belegt.

Beim Vergleich korrigiert: fortlaufende Navigation ist jetzt der Standard, vollständig kodierte Jobs öffnen am letzten Fall, die Fallliste lässt sich nach Originalspalten sortieren und zeigt nach Sortierung weiterhin die richtige Fallnummer. Die Jobauswahl nennt den jeweiligen Fortschritt. Ohne ausgewähltes Excel-Ausgabeblatt erscheint ein Fehler statt einer leeren Arbeitsmappe.

**Vollständige Gleichwertigkeit ist weiterhin nicht belegt.** Insbesondere fehlen das Verschieben der Scanansicht durch Ziehen und ein vollständiger Textdownload der Verarbeitungsmeldungen. Weitere Teilnachweise und bewusste Unterschiede, darunter Zoom, Voreinstellungen, Hilfethemen, Dateisicherung und die SQLite-Erweiterung v3, stehen mit eigenem Prüfauftrag im Bericht. Es wurden ausschließlich synthetische Daten verwendet.

```sh
pnpm test:reference   # aktuelle Module gegen gespeicherte echte Windows-Ausgaben
pnpm audit:functions  # Node- und Referenztests; Bericht unter work/function-audit/
```

Die Windows-Vergleiche laufen zusätzlich in beiden Node-CI-Jobs. Sie starten in GitHub Actions keine Windows-VM. `scripts/prepare-reference-inputs.mjs` bereitet aktuelle Rückwegdateien für einen neuen Windows-Lauf vor; `scripts/Run-Windows-Reference.ps1` führt die unveränderten Originalassemblies in einer separaten Windows-Umgebung aus. Die kleinen Referenzdateien unter `tests/fixtures/windows-reference/` enthalten ausschließlich synthetische Ein- und Ausgaben, keine ausführbaren Originalprogramme.

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

Die Serveradresse und Administrationszugangsdaten in **Testcenter verbinden** eingeben. Zugangsdaten und AuthToken werden nur im Arbeitsspeicher gehalten und beim Trennen verworfen. Die Abmeldung beendet die Administrationssitzung zusätzlich auf dem Server; ein Fehler beim serverseitigen Abmelden wird angezeigt. Keine Zugangsdaten werden in URL, Local Storage oder Service-Worker-Cache gespeichert.

Bei verschiedenen Ursprüngen muss der Testcenter-Server CORS für den Ursprung dieser Anwendung erlauben, einschließlich GET/PUT/POST/DELETE/OPTIONS und der Header `Content-Type` und `AuthToken`. Bei einer HTTPS-Anwendung muss auch das entfernte Testcenter HTTPS verwenden. Alternativ `dist/` auf einem geeigneten Ursprung zusammen mit der API bereitstellen. Eine Browseranwendung kann diese Serverfreigabe nicht selbst umgehen. Es gibt keinen Anmelde- oder Datenproxy.

Die Verbindung greift auf die `/api`-Routen der ursprünglichen Toolbox zu. Abweichende oder zukünftige Testcenter-APIs benötigen gegebenenfalls Anpassungen.

## Starten und bereitstellen

Repository: [jurei733/iqb-browser-tools](https://github.com/jurei733/iqb-browser-tools). Dies ist eine eigenständige Browser-Portierung; Originalquellen, Versionen und Vergleichsnachweise stehen unten und in `PROVENANCE.json`.

Das private Repository mit einem dafür berechtigten GitHub-Konto klonen:

```sh
git clone https://github.com/jurei733/iqb-browser-tools.git
cd iqb-browser-tools
```

Node.js 22 oder neuer und pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm dev
pnpm build
```

`dist/` enthält die vollständige Website einschließlich Service Worker, Worker-JavaScript und SQLite-WASM. Auf einem statischen Webserver über HTTPS oder zum lokalen Test über localhost ausliefern; nicht direkt über `file://` öffnen. WASM sollte mit `application/wasm` ausgeliefert werden. `sw.js` darf vom Webserver nicht dauerhaft unverändert zwischengespeichert werden. Bei Bereitstellung unter einer Unteradresse müssen Vite-Basispfad, Vorlagen-/Beispielpfade sowie Manifest und Service-Worker-Scope angepasst werden; dieser Stand ist für den Ursprungspfad `/` gebaut.

Das Repository enthält den Quellcode und richtet keine öffentliche Website ein. Die bisherige private Sites-Veröffentlichung ist davon unabhängig. Für andere Personen `dist/` auf einem geeigneten Webserver bereitstellen.

## Automatische Prüfungen mit GitHub Actions

Der Workflow [Tests and build](https://github.com/jurei733/iqb-browser-tools/actions/workflows/ci.yml) läuft bei jedem Push auf allen Branches, bei Pull Requests und bei manuellem Start. Auf Ubuntu prüfen Node.js 22 und 24 jeweils `pnpm install --frozen-lockfile`, `pnpm test` und `pnpm build`. Die pnpm-Version stammt aus `package.json`; der Paketcache beschleunigt weitere Läufe. Die verwendeten Actions sind auf vollständige Commit-Prüfsummen festgelegt.

Zusätzlich laufen drei unabhängige Playwright-Jobs mit Chromium, Firefox und WebKit auf Linux. Jeder Browser führt die vorhandenen Kompatibilitätsprüfungen und sieben Arbeitsabläufe der gebauten Produktionsoberfläche aus: Kodieren und Ergebnisdownload, Schablonen, Logins und QR-Word, CSV mit Fehlerfällen, Codes und Booklets, Antworten/SQLite samt Offline-Wiederherstellung sowie Testcenter-Gruppenauswahl und Bereichswechsel. Die Testcenter-API wird in diesen Oberflächentests mit synthetischen Antworten nachgebildet. Die separat beschriebenen Windows- und echten Testcenter-Prüfläufe werden in ihrer jeweiligen Testumgebung wiederholt. Playwright-WebKit ersetzt keinen zusätzlichen Test mit Safari auf Apple-Geräten.

Der Lauf zeigt Ergebnisse und Fehler direkt in der Job-Zusammenfassung und im Protokoll. Zusätzlich werden HTML-/JSON-Berichte und die erzeugten synthetischen Dateien pro Browser für 14 Tage als Actions-Artefakte hochgeladen; bei Fehlern kommen Screenshots und Traces hinzu. Wenn GitHub den Upload etwa wegen einer vollen Speicherquote ablehnt, meldet der Workflow dies als Warnung. Der Status der eigentlichen Tests bleibt verbindlich; fehlgeschlagene Prüfungen werden nicht durch automatische Wiederholungen verdeckt.

Lokal mit installierten Projektabhängigkeiten:

```sh
pnpm exec playwright install chromium firefox webkit
pnpm test:browser
# Oder nur ein Browser:
pnpm test:browser --project=firefox
```

Der Befehl baut Anwendung und Prüfseite frisch und startet dafür eigene lokale Webserver auf `127.0.0.1:4173` und `127.0.0.1:4174`. Auf Linux installiert `pnpm exec playwright install --with-deps` bei Bedarf auch Systembibliotheken. Die Prüfseiten und Testberichte gelangen nicht in `dist/`.

## Geprüft und verbleibende Nachweise

- **51 automatisierte Prüfungen**: Original-Xlsx und beide Original-DOCX-Vorlagen, historische und aktuelle Kodierjobs, Ergebnisdateien, CSV-Varianten, Antwortkonverter, Zusammenführung, Unterformular-Exporte, mehrfache Sitzungen, Reviews, SQLite-Rundlauf einschließlich Version 1 / eigener Statuswerte / Transaktionsabbruch sowie Testcenter-Verträge mit nachgebildeten Serverantworten.
- **Praktisch im integrierten Chromium-Browser auf macOS geprüft**: Jobimport im Worker, Code/Kommentar, Fallliste, Schablone ziehen und drehen, SQLite öffnen und prüfen, Excel erzeugen und herunterladen, QR-DOCX erzeugen und herunterladen, Antwort-/Log-CSV gemeinsam importieren. Tatsächlich heruntergeladene Xlsx und DOCX wurden zusätzlich strukturell geprüft.
- **43 Browserprüfungen je Browser**: Chromium 147, Safari 27.0.1 (WebKit) und Firefox 158.0 (Gecko) auf macOS. Originalvorlagen, unveränderte Windows-Xlsx-Exporte, Bildformate und EXIF-Ausrichtungen, echte Module-Worker, SQLite/WASM, IndexedDB, sämtliche Antwort-Exportformate, Word mit QR-Codes und Web-Crypto/fetch. Berichte unter `tests/results/`.
- **Native Browseroberflächen in 0.2.1**: Safari und Firefox: Beispieljob öffnen, Code 0 und Kommentar erfassen, Ergebnis- und Codes-Xlsx-Download; gespeicherte Kodierung nach Neuladen wiederherstellen. Firefox zusätzlich SQLite-Datei öffnen, prüfen, auswerten und offline wiederherstellen. Safari ebenfalls offline neu laden und Kodierkommentar in der Fallliste wiederfinden.
- **Früherer Test mit nachgebildetem Server**: Anmeldung, Arbeitsbereich, Ergebnisgruppe, Antwort-/Log-Abruf bis zur Excel-Datei, Review-Export und Trennen. Die Challenge- und Content-Abläufe sind zusätzlich durch automatisierte Vertragstests abgedeckt.
- **Offline geprüft**: lokalen Webserver abgeschaltet, Anwendung neu geladen und gespeicherte SQLite-Datenbank einschließlich WASM-Engine wiederhergestellt.
- **Noch nicht praktisch nachgewiesen**: echte/anonymisierte Originaljobs, produktive Testcenter-Daten, Mobilgeräte, Linux-Systeme und Browser unter Windows und die Betriebssysteminstallation als PWA. Diese Daten beziehungsweise Zugänge standen nicht zur Verfügung.

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

## Pilotabläufe und Bedienungskorrekturen in 0.2.4

Ein kleiner technischer Pilot am 23.10.2026 spielt typische Aufträge mit synthetischen Dateien durch. Es haben keine externen Testpersonen teilgenommen. Die manuell beobachteten Probleme wurden in wiederholbare Prüfungen der tatsächlichen Oberfläche übernommen.

- Toolbox-Bereiche behalten ausgewählte Dateien, Eingaben, Optionen und noch nicht heruntergeladene Ausgaben beim Wechsel innerhalb desselben Tabs. Die Inhalte bleiben ausschließlich im Arbeitsspeicher; nach Neuladen müssen Dateien erneut gewählt werden. Nicht abgesendete Kennwörter werden beim Verlassen des Testcenter-Bereichs geleert.
- Offene Dialoge sperren die Kodier-Tastenkürzel. Pfeiltasten und Ziffern können dadurch keine Fälle oder Codes hinter dem Dialog verändern.
- Neue Dateien und geänderte Einstellungen entfernen alte Ausgaben. Ein fehlgeschlagener Lauf zeigt dadurch keinen Download des vorherigen erfolgreichen Laufs an.
- „Alle Gruppen“ folgt der tatsächlichen Auswahl, zeigt bei Teilauswahl einen Zwischenzustand und nennt die Anzahl ausgewählter Gruppen. Ein Einzelgruppen-Export wird gegen die echten Testcenter-Daten geprüft.
- Während einer Verarbeitung bleiben Bereichswechsel gesperrt. Der Abbruch bleibt bedienbar und erhält die zuvor gesicherte SQLite-Arbeitskopie. Beim Zurückkehren zur Datenbank werden die Zähler aktualisiert, falls ein Testcenter-Import den Bestand ergänzt hat.
- Die Challenge-Suche verarbeitet höchstens 64 Hash-Prüfungen gleichzeitig. Algorithmus, Signatur und Suchgrenze bleiben gleich; Abbruch und inklusive Randwerte sind geprüft.

**17/17 UI-Prüfungen je Chromium 147, Safari 27.0.1 und Firefox 158.0 bestanden.** Der Prüflauf umfasst 17 Schritte: Kodieren und Original-Ergebnisdatei, Dialog-/Tastaturbedienung, Modulwechsel, Logins/Testtaker-XML, Word mit QR-Codes, CSV mit führenden Nullen und mehrzeiligen Feldern, fehlerhafte Eingaben, Booklets, Antworten/Logs, SQLite samt ungültiger Datei und Wiederverwendung, Abbruch sowie echtes Testcenter mit Einzelgruppen-Export, Import und Abmeldung. Die kombinierte SQLite-Datei enthält fünf synthetische Personen und 34 Antworten. Die Testcenter-Läufe werden je Browser nacheinander ausgeführt, damit Anmeldungen desselben Demo-Administrators nicht gegeneinander arbeiten.

Mit installierten Abhängigkeiten und laufendem lokalen Testcenter:

```sh
node scripts/build-pilot-tests.mjs ./work/pilot-tests
python3 scripts/serve-pilot.py ./work/pilot-tests ./work/pilot-results
```

Dann `http://127.0.0.1:5191/tests/pilot.html` im gewünschten Browser öffnen und „Arbeitsaufträge durchspielen“ anklicken. Die Prüfseite und der Dateisammler werden nicht veröffentlicht. SQLite, Excel, Word und Ergebnisdateien entstehen durch die Produktionsoberfläche; die Prüfseite sammelt die erzeugten Downloads für die Inhaltskontrolle. Die JSON-Berichte stehen zusätzlich unter `tests/results/pilot-*.json`.

## Echter Testcenter-Integrationslauf in 0.2.3

Am 23.10.2026 wurde das unveränderte offizielle Testcenter **19.0.1** lokal mit PostgreSQL und Redis eingerichtet. Zwei synthetische Gruppen mit zwei Personen, vier Units und 28 Antworten wurden über die echten Testpersonen- und Test-APIs angelegt. Der Anmeldeschutz für Administratoren, Logins und Personen blieb aktiv.

- **18/18 Integrationsprüfungen je Browser**: Chrome/Chromium 147, Safari 27.0.1 und Firefox 158.0 unter macOS. Anmeldung mit Challenge, Arbeitsbereich, Gruppenfilter, Antworten/Logs, Original-CSV, Dateien/Abhängigkeiten, Worker, SQLite-Import/Wiederimport/Rundlauf, Excel direkt und aus SQLite, Sitzungsexport, Inhalte-ZIP sowie ungültige und widerrufene Sitzungsschlüssel.
- Die SQLite-Datei enthält zwei Personen, zwei Testhefte, vier Units, 28 Antworten, sechs Testheft-Logs, zwölf Unit-Logs und zwei Sitzungen. Eine unabhängige Python/SQLite-Prüfung bestätigt Integrität und Fremdschlüssel. Excel enthält die vier Tabellen Antworten, Status, Codes und Scores mit denselben Werten wie der direkte Export.
- Behoben: Aktuelle Testcenter-Logs werden als JSON-Zeichenketten dekodiert. Umlaute, Anführungszeichen, Backslashes und Zeilenumbrüche bleiben dadurch lesbar und exakt erhalten. Historische CSV-Zitate bleiben unterstützt.
- Behoben: „Verbindung trennen“ ruft `DELETE /session` auf und verarbeitet die leere HTTP-205-Antwort. Anschließend ist der alte Schlüssel auf dem Server ungültig. Lokale Zugangsdaten werden auch bei einem Netzwerkfehler gelöscht.
- **Normale Release-Oberfläche zusätzlich geprüft**: reale Anmeldung, beide Gruppen, direkter Excel-Download, Übernahme in die Browserdatenbank, sichtbare Zähler (2/28/4), fehlerfreie Datenbankprüfung, SQLite-Download, Excel aus SQLite und erfolgreiche Abmeldung. Beide Excel-Dateien und die SQLite-Datei wurden in der nativen Downloadliste als abgeschlossen angezeigt.
- Ein fehlgeschlagener ZIP-Test beruhte auf falscher Groß-/Kleinschreibung im Test: Testcenter normalisiert Dateinamen. Jetzt wird gegen die tatsächlich vom Server gemeldeten Namen geprüft; alle Originaldateien sind enthalten.

Reproduzierbare Einrichtung und Prüflauf: [demo/testcenter/README.md](demo/testcenter/README.md). Die Prüfseiten werden nicht mit der Anwendung veröffentlicht. Berichte stehen unter `tests/results/testcenter-*.json`. Der Vorher-Bericht hält die gefundenen Fehler fest. Dies ersetzt keinen Test mit produktiven Schul-/Studienbeständen.

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
