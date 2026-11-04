# Testcenter-Daten gegen Windows vergleichen

Am 04.11.2026 wurde der vorhandene, über die Testcenter-Teilnehmer-API erzeugte Geometrie-Pilot erneut über die IQB-MCP-Anbindung exportiert. Es wurden keine Bewertungen eingereicht oder bestehende Studienbestände verändert. Die zehn Gruppen `MCP_SIM_A85A58E88AE4_G01` bis `_G10` enthalten 1.000 simulierte Personen, 1.000 Testhefte, 6.000 Unit-Datensätze, 9.000 Antwortwerte und 44.954 Logeinträge.

Die Daten stammen aus dem tatsächlichen Testcenter-Backend. Die Antwortinhalte und Verhaltensverläufe wurden simuliert. Sie sind keine empirischen Beobachtungen von Schülerinnen oder Schülern. Der aktuelle Gruppenstatus meldet `completion_verified=false`; aus gestarteten Testheften wird kein vollständiger Studienabschluss abgeleitet.

## Unveränderte Quellen

- Direkter Antwortenexport: Artefakt `72710180-6679-420a-b570-abeb1789edaf`, SHA-256 `cdeefd8d9e9806afd4455e2ba59e45efe78b721b02413070cc083cffd95aaa0a`.
- Rohdateien im Coding-Box-Export: Artefakt `8f06c8ea-d69b-4cdb-814a-4318a33f75d5`, ZIP-SHA-256 `e1b42020c89b9a621a849daefbd7ff0f0816b28a3014db5aa5e352d615b41147`.
- Ausschließlich dessen unveränderte `responses.csv` und `logs.csv` werden benutzt. Das bereits konvertierte JSON dieses ZIPs ist kein Windows-Referenzwert.
- Die Log-DTOs werden aus der CSV durch Auflösen der CSV-Zitate gebildet. Sie sind kein zusätzlich behaupteter Direktabruf einer Log-JSON-API.

`tests/fixtures/testcenter-study/input.json.gz` enthält die drei UTF-8-Originaltexte einschließlich BOM und CRLF sowie eine Base64-kodierte leere XLSX-Vorlage mit gültigem `sheets`-Element für den Originalexporter. `reference.json` bindet Archiv, Eingaben und native Ausgaben an SHA-256. Exportiert wurden keine Anmeldedateien oder Zugangsdaten.

## Ausgeführter Vergleich

Die Original-Toolbox und IQB-Common wurden unverändert per .NET-Reflection aufgerufen. Binary-Prüfsummen stehen in `PROVENANCE.json` und im Referenzbericht. Erfasst wurden beide Prozesse in einer Windows-11-ARM64-VM: x86 mit `processMachine=014c` sowie ein 64-Bit-.NET-Prozess mit `processMachine=0000`, jeweils `de-DE` und Zeitzone Berlin. Dies ist kein neuer Lauf auf physischer x64-Hardware.

1. Die originalen API- und CSV-Konverter erzeugen denselben vollständigen Datengraphen wie beide Browser-Windows-Profile. Der kanonische SHA-256 lautet `fbc12e1fec21a917f3233426e65c391d5ed93e6b861fe1cb6cddad616bebb5a9`. Nur Objekt-Schlüssel werden für diesen Hash sortiert; Listen und Werte bleiben unverändert.
2. Browser und Original schreiben in allen zehn fachlichen SQLite-Tabellen identische Feldwerte und Zeilenfolgen: 79.955 Zeilen. `db_info` und `sqlite_sequence` sind ausdrücklich ausgenommen. Dort unterscheiden sich Ersteller, Datum, landesspezifische Zählertexte, Statusverzeichnis und interne SQLite-Verwaltung. Die Dateien sind nicht bytegleich.
3. Die Browserfassung liest beide original erzeugten SQLite-Dateien als vollständigen Datengraphen zurück. Der originale `getPersonResponses`-Reader liefert dagegen nur eine eingeschränkte Antwortprojektion mit dem fest vorgegebenen Testheftnamen `XYZ`. Seine Ausgabe ist zwischen Browser- und Originaldatei gleich; sie wird nicht als Nachweis für den vollständigen Datenbestand verwendet.
4. Alle vier Excel-Blätter haben identische Namen, Reihenfolge, Abmessungen und Zelltexte: jeweils 1.001 Zeilen und zwölf Spalten, insgesamt 48.048 Zellen. Leere und nicht angelegte XML-Zellen werden als leerer Zelltext verglichen. Stile, XML-Präfixe und ZIP-Metadaten sind kein Vergleichskriterium.
5. 1.823 nicht leere `reason`-/`critique`-Werte werden als unbewertete Kommentare in eine CodingResults-Datei übertragen. Der originale IQB-Common-Archivleser liest diese Datei und schreibt sie wieder. Die Browserdekodierung beider Dateien liefert identische Felder und Reihenfolge. Es werden keine Codes oder Scores erfunden und keine manuellen Kodierungen eingereicht. Dies prüft den Archivtransport, nicht Scan-Arbeitsabläufe oder fachliche Bewertungsentscheidungen.

In diesem Vergleich wurde kein weiterer Produktfehler gefunden. Die erste native Excel-Probe hatte eine ungültige leere Testvorlage ohne `sheets`-Element verwendet. Mit der gültigen Vorlage liefen anschließend beide vollständigen Windows-Prüfläufe erfolgreich; eine Produktänderung war dafür nicht erforderlich.

## Wiederholen

```sh
pnpm install --frozen-lockfile
pnpm test:study
pnpm test:study -- work/study-export
pnpm test:study -- work/pilot84-export pilot84
```

Der erste Befehl nach der Installation vergleicht den aktuellen Browsercode mit den erfassten Windows-Referenzwerten. Der zweite legt zusätzlich Rohdaten, Log-DTOs, SQLite, Excel, langes CSV, unbewertete Kommentar-Archivprobe und Vergleichsbericht ab. Das lange CSV ist ein zusätzlicher Browserexport; für diese Datei wird hier kein neuer Vergleich mit dem Original behauptet.

`tests/testcenter-study.test.js` führt dieselben 66 Prüfungen in der bestehenden Node-22/24-CI aus. Der Linux-Test führt die Original-Assemblies nicht erneut aus. Die separate Windows-CI führt inzwischen zusätzlich die Original-Assemblies für beide Kohorten in x86 und x64 auf einem Windows-x64-Runner erneut aus. `node scripts/native-study.mjs prepare work/native-studies`, `scripts/Run-Native-Study.ps1` und `node scripts/native-study.mjs compare work/native-studies` bilden diesen frischen Lauf ab. Der archivierte Bericht `tests/results/testcenter-native-20261104.json` enthält 144/144 erfolgreiche Vergleiche aus Lauf 41823004471. Die älteren ARM-VM-Belege oben bleiben unverändert als historische Referenz erhalten.

Für eine erneute Erfassung unter Windows:

1. Die unveränderten offiziellen Originalpakete entsprechend `PROVENANCE.json` in `<Originale>/itc-ToolBox` und `<Originale>/IQB-Kodieren` bereitstellen.
2. Die erzeugten Dateien aus `work/study-export` in einen neuen Windows-Testordner kopieren. Die Vorlage muss `blank-native.xlsx` heißen. Ebenso `Newtonsoft.Json.dll` aus der Toolbox und `itc-Toolbox.exe.config` als `study.exe.config` kopieren.
3. `scripts/TestcenterStudyReference.cs` mit dem Framework-4-Compiler und `/platform:x86` beziehungsweise `/platform:x64` kompilieren. Beispiel für den 64-Bit-Compiler:

```powershell
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /platform:x64 /out:C:\IQB\capture\study.exe /reference:C:\IQB\originals\itc-ToolBox\Newtonsoft.Json.dll C:\IQB\TestcenterStudyReference.cs
& C:\IQB\capture\study.exe C:\IQB\originals C:\IQB\capture
```

Je Architektur einen neuen Ordner verwenden: Der Helfer verweigert das Überschreiben einer bereits vorhandenen `native.sqlite`. `native-report.json` enthält Eingabe- und Original-Prüfsummen, Architektur, Kultur und Ergebnisse jeder Originaloperation. Native Ausgaben müssen erneut mit dem aktuellen Datengraphen, den SQL-Feldwerten und den Excel-Zellwerten verglichen werden; ein erfolgreicher Programmstart allein ist kein Gleichheitsnachweis.

## Abgeschlossener zusätzlicher Pilot mit 84 Personen

Nach ausdrücklicher Freigabe und Reparatur der Formularweiterleitung wurde Job `187fe223-2be4-4a81-815d-116c47982173` regulär über die IQB-MCP-Anbindung gestartet und erfolgreich abgeschlossen. Gruppe `MCP_SIM_1574B8D03210` enthält 84 gesperrte simulierte Sitzungen, zwölf davon vorzeitig beendet, 504 Unit-Datensätze, 756 Antworten und 3.672 Logs. Sieben Verhaltensprofile sind mit je zwölf Personen vertreten: normal, rapid, answer_changes, navigation, pause_resume, dropout und distracted. Dies sind Teilnehmer-API-Simulationen, keine menschliche Browser-/Playerbedienung.

Die Studio-Quellrevision und die unabhängige Coding-Box-Prüfung stehen in `tests/fixtures/testcenter-pilot84/source.json`. Codes, Scores und Status aller 756 Variablen wurden bestätigt: 518 CODING_COMPLETE, 137 CODING_INCOMPLETE, 72 NOT_REACHED und 29 DISPLAYED; Gesamtscore 294. 137 Freitextbewertungen bleiben offen. Keine manuelle Bewertung wurde erfunden oder eingereicht. Das separate Coding-Box-v1-CSV enthält die automatischen Wertungen; die API-basierten Browser-SQLite-/Excel-Dateien enthalten die rohen Testcenter-Antworten und übernehmen diese Wertungen nicht stillschweigend.

Die unveränderten API-Exporte und CSV-Rohtexte liegen komprimiert in `tests/fixtures/testcenter-pilot84/input.json.gz`; Herkunft und Prüfsummen stehen nebenan. Anders als bei der älteren Kohorte wurden die Log-DTOs hier direkt exportiert. Zugangsdaten und Testtaker-Pakete werden weder eingecheckt noch in das Nachweispaket aufgenommen.

Der frische native x86-/x64-Lauf bestätigt vollständige API- und CSV-Datengraphen, zehn fachliche SQLite-Tabellen mit 6.613 Zeilen, vier Excel-Blätter mit zusammen 4.080 Zelltexten und 137 unbewertete Archivkommentare. Beide Profile liefern dieselben Hashes für diese Pilotdaten. `tests/fixtures/testcenter-pilot84/reference.json` bindet diese Originalausgaben; die zusätzliche Node-Prüfung umfasst 66 Vergleiche. Der echte Browser-Worker prüft API, CSV, SQLite und Excel in Chromium, Firefox und WebKit.

### Gefundener CSV-Unterschied

Der Originalparser zerlegt physische Zeilen zunächst an `";`, bei falscher Spaltenzahl an `;`. Bei 24 Logs mit einer bestimmten Anführungszeichen-/Semikolonfolge liefert er null; die Originaloberfläche überspringt diese Zeilen. Unser erster nativer Prüfharness hatte null fälschlich als Ausnahme behandelt. Er bildet nun das tatsächliche Überspringen ab und protokolliert dessen Anzahl. Die Produktkorrektur reproduziert das Verhalten ausschließlich in den ausdrücklich gewählten Windows-Profilen und zeigt eine Warnung an. Der Standardmodus und der API-Import behalten alle 3.672 Logs; Windows-CSV enthält 3.648. Die unveränderten Antwortwerte bleiben erhalten.

API-Graph SHA-256: `e47d9006068e8feb2501d9ebbe6fda2198006e719efa41aa2cba5e4aa47504cb`. Windows-CSV-Graph SHA-256: `9abec62391db813fce3723ff4ac771394e3648cf40b33d8c2e3766ab3b9ec2b8`. Die getrennten Erwartungen sind wichtig: Eine Gleichsetzung von API und CSV würde hier das Verhalten des Originals verdecken.

## Offener Umfang

Empirische Studienbestände, sämtliche Dateien, Sonderfälle, menschliche Interaktionen und fachliche Bewertungen bleiben außerhalb dieses Vergleichs. Die gezeigte Gleichheit gilt ausschließlich für die beschriebenen Daten und Operationen in den ausdrücklich gewählten Windows-Profilen.
