# IQB-Werkzeuge im Browser · Version 0.4.5

Portierung der Arbeitsabläufe von **IQB-Kodieren 4.3.0.3** und **itc-ToolBox 3.3.0.2**. Die Anwendung läuft als statische Website mit lokaler Dateiverarbeitung; eine Windows-Installation ist nicht erforderlich.

## Windows-Zahlenverarbeitung 0.4.5 vom 04.11.2026

Die beiden früheren 32-Bit-Textabweichungen sind behoben. Das 32-Bit-Profil bildet die **x87-Rechenschritte mit 64-Bit-Signifikand, Skalierung durch Multiplikation/Division, Rundung auf eine BCD-Ganzzahl und anschließende G15/G17-Rundung** nach. Der Algorithmus stammt aus dem offiziellen MIT-lizenzierten CoreCLR-Quellcode; [Quellstand, Dateiprüfsumme und Lizenz](docs/windows-x87-provenance.json) sind festgehalten. Es gibt keine Nachschlagetabelle für einzelne Zahlenwerte.

Beide Profile bestehen nun **1214/1214 direkte Vergleiche mit den unveränderten Windows-Originalen** auf einem Windows-x64-Runner: **1049 reguläre Ausgaben** prüfen Feldwerte, Typen und Listenreihenfolge; **165 weitere Fälle** prüfen die ERROR-Antwort bzw. Ausnahme. Identische Fehlermeldungen oder GUI-Dialoge sind damit nicht nachgewiesen. Hinzu kommen **13 API-Fälle je Architektur**, **22 bidirektionale Kodierergebnisse** und **zwei Ablehnungen unzulässiger XML-Steuerzeichen**.

Ein separater, deterministischer Korpus mit **8373 Zahlen-Schreibweisen je Architektur** prüft die zugrunde liegende CLR-/JSON-Zahlenkonvertierung: eingelesene IEEE-754-Bits und G15, G17, R. Er enthält feste Binärwerte, Nachbarwerte von Zehnerpotenzen, Subnormalzahlen, Unter-/Überläufe und Nachbarn früherer Gegenbeispiele. Diese Diagnostik ist zusätzlich zum direkten Toolbox-Konverterkorpus ausgewiesen. Die Erzeugung verwendet plattformstabile Dezimal-Konvertierung; ein fester SHA-256-Test bindet die Eingaben über Windows, Linux, macOS und Browser-Engines.

Unter **Importverhalten** bzw. **Antwortkonvertierung** stehen beide Windows-Profile ausdrücklich zur Wahl. Sie bilden unterschiedliche Originalprozesse ab und können untereinander andere Zahlentexte liefern. Der erweiterte Standardmodus unterscheidet sich weiterhin in **177 der 401 regulären Fälle des älteren Korpus** vom Original. Für Originalwerte ist ein Windows-Profil erforderlich.

Die Windows-CI lädt Originale ausschließlich von den dokumentierten IQB-Adressen und prüft jede Datei gegen `PROVENANCE.json`. Der Workflow benötigt den offiziellen Downloadserver und hat ausschließlich Lesezugriff auf das Repository. Er bewahrt synthetische Rohbelege als Artefakte; Originalprogramme werden nicht eingecheckt. **Es gibt keine zugelassenen bekannten Abweichungen mehr: Jeder fehlgeschlagene strikte Vergleich lässt die CI fehlschlagen.**

```sh
pnpm test:reference
node scripts/compare-native-windows.mjs tests/fixtures/windows-native/reference.json strict-windows.json --require-numeric-probes
```

Die aktuelle Referenz liegt in `tests/fixtures/windows-native/reference.json`; Basis- und zusätzliche Zahlenkorpora in `scripts/windows-native-corpus.mjs` und `scripts/windows-numeric-probes.mjs`. Die [Live-Nachweisseite](https://iqb-browser-tools-jr-20261103.iqb-e-v-8867.chatgpt.site/equivalence.html) enthält den tatsächlichen Prüfumfang. Die sechs alten ARM/x86-VM-Grenzfälle bleiben als historische Rohbelege erhalten; daraus wird keine allgemeine Windows-x86-Abweichung abgeleitet.

Am **04.11.2026** wurden die erreichbaren IQB-Inventare erneut gelesen. Sie zeigen Pilot- und Simulationsbestände; empirische oder anonymisierte Studiendaten stehen weiterhin nicht für diesen Vergleich zur Verfügung. [Prüfumfang der Datenverfügbarkeit](tests/results/study-data-availability-20261104.json). **Vollständige Gleichheit sämtlicher realer Dateien und Sonderfälle ist weiterhin nicht bewiesen.**

## Historischer Windows-Abgleich 0.4.2 vom 03.11.2026

**Vollständige Gleichheit für alle Funktionen, realen Dateien und Sonderfälle ist weiterhin nicht nachgewiesen.** Der neue [live lesbare Nachweis](https://iqb-browser-tools-jr-20261103.iqb-e-v-8867.chatgpt.site/equivalence.html) legt den tatsächlichen Umfang offen. Der bisherige Konvertervergleich hatte einige Antwortwerte vor dem Vergleich angepasst; daraus konnte keine identische Ausgabe abgeleitet werden. `compare-windows-converters.mjs` prüft jetzt den ausdrücklich gewählten Windows-Modus ohne Wertanpassungen und ohne Sortieren der Ergebnislisten.

Der zusätzliche, mit unveränderten Windows-Assemblies neu erfasste Korpus enthält **547 unterschiedliche Eingaben**. 58 doppelte Eingaben eines ersten Laufs mit 605 Fällen wurden entfernt. Im Windows-Modus stimmen **401 reguläre Ausgaben** in Feldwerten, Typen und Listenreihenfolge überein. Bei **146 Fehlerfällen** stimmt die Fehlererkennung und die Unterscheidung zwischen ERROR-Antwort und Ausnahme überein; .NET-Ausnahmetypen, Meldungstexte und GUI-Darstellung sind damit nicht identisch nachgewiesen. **Sieben zusätzliche API-Konvertierungen** stimmen nach der ausdrücklich beschriebenen Feldzuordnung überein. Der erweiterte Standardmodus unterscheidet sich in **177 der 401 regulären Fälle** vom Original; er erhält unter anderem Zeilenumbrüche und standardisierte Zahlenwerte.

Behoben wurden fehlende Originalkonvertierung im Windows-Modus, deutsche .NET-Zahlen- und Datumsdarstellung, Nullwerte, ursprüngliche JSON-Einrückung und CRLF-Behandlung, Int32-Konvertierung, wiederholte Unterformulare und die Weitergabe des Modus bei rohen API-JSON-Dateien, CSV, Datenbankimport und Testcenter-Abrufen. Unter **Antworten und Logs auswerten → Importverhalten** bzw. **Testcenter → Antwortkonvertierung** lässt sich der Modus ausdrücklich wählen.

Die 38 bisherigen nativen Referenzoperationen wurden am 03.11.2026 frisch ausgeführt; die Original-Assemblies und Eingaben sind über SHA-256 gebunden. Die 31 Dateivergleiche bestehen auch gegen diese neuen Ausgaben. Es wurden keine produktiven oder anonymisierten Studiendateien bereitgestellt. Dieser Korpus ersetzt keine Abnahme aller realen Arbeitsbestände, jeder GUI-Interaktion, beliebiger Dateigrößen oder sämtlicher Netzwerkfehler.

```sh
pnpm test:differential  # 401 strikte Wertevergleiche, 146 Fehlerkategorien, 7 API-Fälle
pnpm test:reference     # zusätzlich 15 strikte ältere Konverterfälle und 31 Dateivergleiche
```

Native Erfassung: `tests/fixtures/windows-differential/native-converters.json`; deterministische Eingaben: `scripts/converter-corpus.mjs`; Windows-Lauf: `scripts/Run-Windows-ConverterCorpus.ps1`; neuer 38-Operationen-Nachweis: `tests/results/equivalence-fresh-reference-20261103.json`. Der Browser-Harness führt denselben 547-Fälle-Korpus und die sieben API-Fälle aus. Fehlerkategorien werden ausdrücklich nicht als identische Fehlermeldungen gezählt.

## Historischer ARM-Grenzvergleich vom 03.11.2026 (0.4.3)

Weitere **118 verschiedene Eingaben** wurden mit derselben unveränderten Toolbox-Assembly in zwei Windows-Prüfprozessen erfasst. **113 reguläre Ausgaben und fünf Fehlerentscheidungen** stimmen im Browser mit dem **64-Bit-Profil (AMD64, de-DE, Zeitzone Berlin)** überein. Zum 32-Bit-Prozess stimmen **112 von 118 Fällen** überein. Die Originalassembly selbst liefert in diesen beiden Prozessen sechs unterschiedliche Zahlenausgaben. Diese sechs Fälle werden ausdrücklich als verbleibende Unterschiede zum 32-Bit-Lauf ausgewiesen. Eine bestimmte Ursache oder Übertragbarkeit auf andere Rechner ist damit nicht bewiesen.

Behoben wurden verlorene JSON-Zahltypen und Zahlen-Schreibweisen, Exponentialdarstellung, Datumsangaben mit Offset, ungültige Datumsangaben, numerische Variablenreihenfolge und die Validierung von `responsesGiven`. Für JSON-Typen und Originalreihenfolge wird der AST von [Microsofts jsonc-parser](https://github.com/microsoft/node-jsonc-parser) verwendet. Der Windows-Modus benennt sein 64-Bit-Profil jetzt ausdrücklich; für Datums-Offsets gilt `Europe/Berlin`.

Für IQB-Kodieren bestehen **22 zusätzliche Ergebnisdateien in beide Richtungen**: Windows schreibt → Browser liest sowie aktueller Browserexport → originaler Windows-Reader. **Zwei weitere Fälle** werden auf beiden Seiten wegen unzulässiger XML-Steuerzeichen abgewiesen; identische Fehlermeldungen werden nicht behauptet. Korrigiert wurden Tab/LF/CR in XML-Attributen und das Lesen reiner XML-Leerraum-Kommentare. Die XML-Daten aktueller Exporte werden an die in Windows gelesenen Exporte gebunden; GZip-Header und Einrückung sind kein Gleichheitskriterium.

Reproduzierbarer Bericht: [docs/windows-edge-comparison.json](docs/windows-edge-comparison.json); Rohbelege: `tests/fixtures/windows-edge/`; Läufe: `scripts/Run-Windows-ConverterCorpus.ps1` und `scripts/Run-Windows-CodingCorpus.ps1`. `pnpm test:reference` führt den erweiterten Vergleich zusätzlich aus. Node- und Browserprüfungen vergleichen den erweiterten Korpus. Die neuen Nachweise sind weiterhin synthetisch. Auch die über die IQB-Anbindung zugänglichen Arbeitsbereiche sind Pilot- oder Simulationsbereiche und liefern keinen empirischen Studiennachweis.

## Optional lokal: Konto, direktes Speichern und echte Dateipfade

Der lokale Starter gleicht die drei Browsergrenzen aus. Die Oberfläche bleibt dieselbe Browseranwendung; ein kleiner Node.js-Prozess vermittelt die ausdrücklich verbundenen Dateizugriffe. Er benötigt **Node.js 22 oder neuer**, keine Windows-Installation und keine zusätzlichen npm-Pakete. Er läuft auf `127.0.0.1` und stellt keine Dateien im Netzwerk bereit. Die gehostete Website verbindet sich nicht mit diesem Dienst.

Im Repository zuerst `pnpm build` ausführen. Im entpackten Release-ZIP ist `dist/` bereits enthalten. Dann starten:

```sh
node scripts/local-app.mjs --open
```

Die Adresse ist standardmäßig `http://127.0.0.1:4175`. Unter **Arbeitsordner & Konto** einen absoluten Ordnerpfad eintragen und verbinden. Mit „Diesen Ordner beim nächsten Start wiederverwenden“ wird ausschließlich dieser Pfad in `~/.iqb-browser-tools/local.json` gespeichert. „Gespeicherten Ordner vergessen“ entfernt diese Einstellung; Arbeitsdateien bleiben erhalten. Alternativ kann der Ordner beim Start mit `--workspace "/absoluter/Arbeitsordner"` angegeben werden. Für einen anderen Port `--port 4176` verwenden. Strg+C beendet den Starter.

- **Konto:** Unter Windows wird `whoami.exe` für das aktuelle Anmeldekonto verwendet. In der Kontoinfo steht `DOMÄNE\Benutzer`; als Kodierer wird wie im Original `ADFactory.GetMyName()` nur der Benutzerteil vorgeschlagen. Auf macOS/Linux wird das Betriebssystemkonto vorgeschlagen. Ein bereits gewählter Kodierername bleibt erhalten; **Arbeitsplatzkonto übernehmen** setzt den Vorschlag erneut.
- **Ergebnisdateien:** **Lokalen Arbeitsordner öffnen** lädt Kodierjobs und Ergebnisse. Danach werden Änderungen automatisch und atomar im Ordner gespeichert, auch in Firefox und WebKit. Eine vorhandene, eindeutig zugeordnete `.result`-Datei behält ihren Pfad; sonst wird `<Jobname>.result` verwendet. Mehrdeutige Ergebnisdateien werden abgewiesen. Der Speicherstatus bestätigt erst einen abgeschlossenen Schreibvorgang. **Arbeitsordner frisch einlesen** übernimmt externe Änderungen an Jobs und Ergebnissen.
- **Toolbox-Dateipfade:** **Aus Arbeitsordner wählen** verwendet echte Pfade im verbundenen Ordner. Gemerkte Eingabedateien der wiederherstellbaren Toolbox-Formulare werden nach einem Neustart frisch vom Dateisystem gelesen. Fehlende Dateien oder ein anderer verbundener Ordner führen zu einer Meldung und leeren die betroffene Dateiauswahl; alte Browserkopien werden dann nicht unbemerkt verarbeitet. Änderungen während einer geöffneten Sitzung werden durch erneute Dateiauswahl oder Neuladen übernommen. Normale Browser-Dateiauswahlen bleiben Bytekopien.

Der Starter prüft gleichen Ursprung, Host und einen sitzungsbezogenen API-Schlüssel; er liest nur unterstützte Eingabedateitypen und schreibt ausschließlich Ergebnisdateien. Symbolische Verknüpfungen werden ausgeschlossen. Automatisches Überschreiben betrifft Kodierergebnisse; Toolbox-Exporte bleiben ausdrücklich ausgelöste Downloads. Die Funktion ist für einen Arbeitsplatzbenutzer vorgesehen, nicht als gemeinsam zugänglicher Server oder als Authentifizierungsdienst für mehrere Personen.

## SQLite mit Coding-Box austauschen

Unter **Antwortdatenbank** lassen sich nun auch vollständige SQLite-Arbeitsbereichssicherungen aus Coding-Box öffnen. **Als Browser-Tools-SQLite** und **Als Coding-Box-SQLite** verbinden die Formate. Native Sicherungen behalten sämtliche enthaltenen Tabellen einschließlich Dateien, Jobs und Kodierständen v1/v2/v3. Die sichtbare Kodierversion ist auswählbar. Eine unveränderte Browser-Arbeitskopie kann die ursprüngliche native Datei bytegenau zurückgeben.

Geänderte v3-Kodierungen können ausdrücklich über die Checkbox übernommen werden; v1/v2 und die Jobs bleiben erhalten, Vorher-/Nachher-Werte werden protokolliert. Änderungen an Rohantworten, Personen oder Logs werden getrennt von einer bestehenden Kodierhistorie importiert. Neu angelegte Browser-Datenbanken können einen nativen Antwortdatengraphen erzeugen; dazu werden keine Aufgaben oder früheren Bewertungen erfunden.

Für den Rückimport in eine laufende Coding-Box ist der ergänzte MCP-/Backend-Import in einen leeren Bereich erforderlich. Der gemeinsame MCP-Server bietet dafür `coding_import_sqlite`. Die statische Browseranwendung erhält keine Administrationszugangsdaten. Nullable Kodierungen verwenden eine lokale Browser-Schemaerweiterung v3; v1/v2 bleiben lesbar, ältere Windows-Programme unterstützen diese v3-Erweiterung nicht.

## Funktionsmatrix: Browserstand und native Referenz 04.11.2026

Der [filterbare Funktionsbericht](docs/function-audit.html) und seine [maschinenlesbaren Ergebnisse](docs/function-audit.json) erfassen **110 Funktionspunkte**. Das [Originalinventar](docs/original-inventory.json) hält 130 Quelldateien, 36 XAML-Oberflächen und 151 Controls mit Herkunft und Prüfsummen fest. Alle 23 aktiven Haupteinstiege der Windows-Toolbox sind einer Matrixzeile zugeordnet. Die [Matrixdefinition](docs/function-matrix.json) trennt direkte Windows-Vergleiche, Browser-/Modultests, beabsichtigte Unterschiede, Lücken und reine Browser-Erweiterungen. Das Inventar ist eine Prüfgrundlage und kein Nachweis aller internen Codepfade.

Der aktuelle Stand besteht **112 Modultests**, **15 Windows-Konvertervergleiche** und **31 Windows-Datei-/Verhaltensvergleiche**. Die unveränderten Originale wurden am 31.10.2026 und am 03.11.2026 mit je 38 nativen Prüfoperationen ausgeführt. Eingabe- und Assembly-Prüfsummen sind gespeichert. Sämtliche BMP-QR-Bilder beider Original-Wordvorlagen stimmen Byte für Byte überein; DOCX-/XLSX-ZIP-Metadaten werden bei Inhaltsvergleichen nicht als Nutzdaten behandelt.

Für Version 0.4.5 prüfen Chromium, Firefox und WebKit in [GitHub Actions](https://github.com/jurei733/iqb-browser-tools/actions/runs/41799081653) jeweils **18 Ablaufprüfungen mit 51 enthaltenen Kompatibilitätsprüfungen**. Dazu kommen 112 Modultests unter Node 22/24, je sechs Startertests unter Windows/macOS/Linux und der direkte native Windows-Vergleich. Alle Vergleiche sind strikt; Quellprüfsummen, Job- und Artefaktbelege stehen in `tests/results/function-audit-ci-20261104-x87.json`.

Lokal auf macOS werden Chromium und WebKit ebenfalls mit je 18 Abläufen und 51 Kompatibilitätsprüfungen geprüft. Firefox wird über die Linux-CI geprüft; WebKit ist kein Test der installierten Safari-App. Ein produktiver IQB-Domänenarbeitsplatz wurde nicht geprüft. Historische Belege aus Version 0.4.4 bleiben in `tests/results/function-audit-ci-20261103-native.json` erhalten.

Neu abgeschlossen sind Scanverschiebung durch Ziehen, physikalischer WPF-Zoom, gemeinsame Schablonenposition und Umschalt-Drehung, Endanimation, F1/Programm-Info, vollständiger Meldungsexport als Text, abbrechbare Vorbereitung und ursprüngliche Dialog-Voreinstellungen. Arbeitsstände, Eingabedateien und Optionen lassen sich nach einem Neustart öffnen. Zugangsdaten können ausdrücklich lokal gemerkt und wieder gelöscht werden.

Für historische Unterschiede stehen auswählbare **Windows-Modi** bereit: Booklet-Beschreibung aus der Titelspalte, Word-Paragraphen mit ursprünglichen Links und BMP-QR, ursprüngliche Antwort-/Sitzungs-CSV, die historische JSON-Identitätslogik, Überspringen gleicher Datenbank-Endzeitstempel und der Abbruch des Ergebnisexports nach einer leeren Person. Die erweiterten Varianten bleiben erhalten. Windows-Modi können historische Auslassungen reproduzieren und sind entsprechend beschriftet.

**Zusätzlich zu den oben beschriebenen Konvertierungs- und Nachweisgrenzen bleiben in der reinen Onlinefassung drei Plattformabweichungen:** automatische Windows-Domänenidentität (K-11), automatischer Dateiersatz in jedem Browser (K-35) und dauerhafte echte Dateipfade (T-61). Chromium kann nach Freigabe einen Arbeitsordner direkt lesen und Ergebnisse dort speichern. Ohne lokalen Starter nutzen Safari/Firefox lokale Browserkopien und Downloads; externe Dateiänderungen erfordern eine neue Auswahl. Eine uneingeschränkte 1:1-Gleichheit wird daher nicht behauptet. Die Prüfungen verwenden synthetische Daten; sie decken nicht jede Kombination realer Arbeitsbestände ab.

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
| Scanansicht | PNG, JPEG, BMP, GIF, WebP und erste TIFF-Seite; Ziehen zum Verschieben und physikalischer Zoom; TIFF-, BMP-, PNG-, JPEG-JFIF- und EXIF-Auflösung; crop- und DPI-korrigierte Bereichsrahmen |
| Kodierschablonen | CT_VARIABLE-Bilder und lokale Testschablone.png; ausblenden, ziehen, drehen, zurücksetzen; gemeinsame Position behalten und Drehwinkel beim Fallwechsel zurücksetzen |
| Kodieren | Codes einschließlich 0, Fall- und Jobkommentare, nächste offene Antwort, Fallliste, freie oder fortlaufende Navigation, Tastatursteuerung und atomare Sammelkodierung je Person |
| Ergebnisse | GZip-XML im ursprünglichen CodingResults-Format Version 5; Ergebnisse gemeinsam mit dem Job oder nachträglich laden; lokaler Fortschritt in IndexedDB |
| Codes | Vier ursprüngliche Spalten und Anzahlen, ursprüngliche Zeichenmengen, Ziehung ohne Wiederholung mit Web Crypto |
| Booklets | Originale benannte Excel-Zellen, Units, Blöcke, Nummerierung, Startcodes, Zeitbegrenzungen und Metadaten → Booklet-XML |
| Logins | Testpersonen, Reserve, Reviewer und Testleitung; getrennte Präfixe, Gruppen-IDs und gemeinsames Zufallssuffix; bearbeitete Xlsx und optionale Testtaker-XML je Gruppe oder insgesamt |
| Word-Handzettel | Beide Original-DOCX-Vorlagen und eigene Vorlagen mit Inhaltssteuerelementen; alle acht ursprünglichen Tags; QR-Codes, ein Dokument insgesamt oder je Gruppe; Original-Paragraphen/BMP-QR oder zusätzlich Tabellen erhaltender Modus mit PNG-QR |
| CSV | UTF-8, Windows-1252, UTF-16 LE; Komma, Semikolon oder Tabulator; gequotete und mehrzeilige Felder, leere Zellen und führende Nullen |
| Antworten / Logs | Alte 11-spaltige, 2019er und 2024er Testcenter-CSV sowie Toolbox-JSON und rohe JSON-Berichte; ursprüngliche Player-Antwortformate; Zusammenführen nach Personenidentität und jüngstem Antwortzeitpunkt |
| Auswertungen | Breite Excel-Tabellen Antworten/Status/Codes/Scores; Unterformulare als Zeilen, Spalten oder ohne Unterformulare; ursprüngliches CSV-Langformat; Sitzungsberichte als CSV/Xlsx; vollständiges JSON oder ZIP je Gruppe |
| Antwortdatenbank | SQLite im ursprünglichen Schema; Version 1 und 2 öffnen, neue Version-2-Dateien anlegen; CSV/JSON/Testcenter importieren; ergänzen oder importierte Testhefte ersetzen; Größen importieren; Integrität, Fremdschlüssel und Duplikate prüfen; Originaldatei und Auswertungen herunterladen |
| Datenbanksicherung | Aktuelle Arbeitskopie und vorherige geöffnete Datenbank lokal im Browser wiederherstellen; SQLite-Download zur unabhängigen Sicherung |
| Testcenter | Anmeldung einschließlich SHA-256-Challenge, Arbeitsbereiche und Gruppen; Antworten, Logs, rohe CSV und Reviews; Inhalte mit HTML-Index als ZIP; Testheftgrößen mit Ressourcenabhängigkeiten; direkte Übernahme in die lokale Datenbank |
| Verarbeitung | Kodierpakete, Datenimporte, SQLite und Auswertungen in einem Web Worker; Codes-/Booklet-/Login-Aufträge und erweiterte Aufträge abbrechen; vollständiges Meldungsprotokoll als Text; Word-Erzeugung mit Fortschritt und Abbruch |
| Offline | Service Worker speichert Anwendung, Bibliotheken, WASM, Vorlagen und Beispiele. Nach dem ersten vollständigen Laden sind lokale Dateifunktionen offline nutzbar. Installationsmanifest mit 192-/512-Pixel-Icons |

Das Training-Flag wird eingelesen. In der rekonstruierten Windows-Version steuert dieses Flag keinen eigenen Trainingsablauf. Die Browserfassung erfindet deshalb keine zusätzlichen Trainingsbewertungen.

### Tastatur

Pfeile links/rechts, Bild auf/ab und Enter: Fall wechseln. Pfeile oben/unten: Code wechseln. Strg/Cmd + Ziffer: dieselbe Person über alle Variablen kodieren, sofern der Code überall eindeutig ist. F1: Programm-Info, F3: kodierte Fälle, F4: Jobkommentar, Strg/Cmd+O: öffnen, Strg/Cmd+S: Ergebnisdownload, Plus/Minus: Zoom. Ziffern: eindeutigen passenden Code wählen. Punkt/Komma/Schrägstrich: Zoom auf 100 % zurücksetzen. Texteingaben behalten ihre normale Tastaturbedienung.

## Testcenter verbinden

Die Serveradresse und Administrationszugangsdaten in **Testcenter verbinden** eingeben. Ohne Auswahl von „Zugangsdaten in diesem Browser merken“ bleibt das Kennwort im Arbeitsspeicher. Mit dieser Auswahl werden Server, Benutzername und Kennwort lokal in IndexedDB gespeichert und lassen sich über „Gespeicherten Zugang löschen“ entfernen. Der AuthToken wird beim Trennen verworfen und nicht dauerhaft gespeichert. Die Abmeldung beendet die Administrationssitzung zusätzlich auf dem Server; ein Fehler beim serverseitigen Abmelden wird angezeigt. Zugangsdaten werden weder in URL noch in Service-Worker-Cache geschrieben.

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

Neue private Sites-Instanz: [IQB-Werkzeuge im Browser](https://iqb-browser-tools-jr-20261103.iqb-e-v-8867.chatgpt.site). Sie ersetzt die frühere, nicht mehr aktualisierbare Instanz. Die Projektkennung und das statische Build-Verzeichnis sind in `.openai/hosting.json` versioniert. Aktualisierungen verwenden diese Kennung; Zugriffs- und Git-Zugangsschlüssel werden nicht im Repository gespeichert. Die neue Instanz bleibt nur für ihren Eigentümer zugänglich. Für andere Personen `dist/` auf einem geeigneten Webserver bereitstellen oder die Freigabe ausdrücklich ändern.

## Automatische Prüfungen mit GitHub Actions

Der Workflow [Tests and build](https://github.com/jurei733/iqb-browser-tools/actions/workflows/ci.yml) läuft bei jedem Push auf allen Branches, bei Pull Requests und bei manuellem Start. Zusätzlich prüfen Ubuntu, macOS und Windows die lokale Konto- und Dateianbindung ohne Browser. Auf Ubuntu prüfen Node.js 22 und 24 jeweils `pnpm install --frozen-lockfile`, `pnpm test` und `pnpm build`. Die pnpm-Version stammt aus `package.json`; der Paketcache beschleunigt weitere Läufe. Die verwendeten Actions sind auf vollständige Commit-Prüfsummen festgelegt.

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
