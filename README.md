# IQB-Werkzeuge im Browser — Arbeitsstand 0.1

Browserportierung von **IQB-Kodieren 4.3.0.3** und Teilen der **itc-ToolBox 3.3.0.2**.
Dieser Stand ist ein erster funktionsfähiger Ausschnitt, kein vollständiger Ersatz der Windows-Anwendungen.

## Starten und bauen

Voraussetzung: Node.js 22 oder neuer und pnpm 11.25.0.

```sh
pnpm install
pnpm test
pnpm dev
pnpm build
```

`dist/` enthält anschließend eine statische Website. Ein Webserver muss die Dateien aus diesem Verzeichnis ausliefern. Es gibt keine notwendige Serverlogik und keine Verbindung zu einem IQB-Server für die bisher implementierten Funktionen. Die Dateien nicht direkt per `file://` öffnen.

## Umgesetzt

| Bereich | Verhalten |
| --- | --- |
| IQB-Kodieren | ZIP-Pakete oder XML mit zugehörigen Bilddateien öffnen; Jobauswahl; Scans; PNG/JPG/BMP/GIF/WebP und erste TIFF-Seite; Variablen, Codes und Kommentare; Fallnavigation und Tastaturbedienung |
| Ergebnisdateien | GZip-komprimiertes `CodingResults`-XML, Version 5; `id`, `coder`, `label`, `tp`, `v`, `tm`, `c`, Fallkommentar und `globalcomment`; vorhandene Ergebnisse fortsetzen |
| Speicherung | Kodierfortschritt in IndexedDB auf dem jeweiligen Gerät; nach erneutem Laden des Jobs wiederherstellen; zusätzlich `.result` herunterladen |
| Codes-Xlsx | Gleiche Zeichenmengen, vier Längen und Anzahlen wie im Original; Ziehung ohne Wiederholung und mit Web Crypto statt VB-Zufallszahlen |
| Booklet-XML | Originale benannte Excel-Zellen; Units, Blöcke, Nummerierung, Startcodes, Zeitbegrenzung und Metadaten |
| Logins | Originale Excel-Vorlage; Testpersonen, Reservelogins, Reviewer und Testleitung; eine XML oder eine je Gruppe; bearbeitete Excel-Datei als Download |
| CSV → Xlsx | UTF-8, Windows-1252 oder UTF-16 LE; Komma, Semikolon oder Tabulator; führende Nullen, leere Felder, Umlaute und mehrzeilige Felder |
| Toolbox-JSON | Antworten im Langformat; Personen-/Gruppenkennungen, Testheft, Unit, Alias und Status; CSV- und Xlsx-Ausgabe |

Die Oberfläche ist für unterschiedliche Bildschirmbreiten angelegt. Praktisch geprüft wurde bisher der integrierte Chromium-Browser auf macOS. Firefox, Safari, Mobilgeräte und Installation als PWA sind noch nicht praktisch geprüft. Das Manifest allein stellt keine Offline-Funktion bereit.

## Noch offen für eine vollständige Portierung

- Historische Job-XML-Sonderformen vollständig abdecken, insbesondere Variablenpakete und Personenpräfixe. Ein Teil älterer Variablen-Kodierungen wird gelesen, ist aber nicht vollständig kompatibel.
- Verschiebbare Kodierschablonen und Training. Importierte Schablonen werden in diesem Stand nicht dargestellt; solche Jobs werden deshalb ausdrücklich zurückgewiesen.
- Rahmenpositionen auf weiteren Scanvarianten prüfen. TIFF-DPI und PNG-pHYs/JPEG-JFIF-Auflösung werden berücksichtigt; JPEG-EXIF-DPI und historische Formate sind noch offen.
- Login-Handzettel mit den ursprünglichen DOCX-Vorlagen und QR-Codes.
- Testcenter-Anbindung, Downloads von Content, Reviews, Antworten und Logs. Browserzugriffe erfordern eine geeignete CORS-Konfiguration oder einen gezielt eingerichteten Serverdienst.
- SQLite-Antwortdatenbank, Importe, Datenverwaltung und sämtliche erweiterten Auswertungsoptionen der Windows-Toolbox.
- Antwortexport in der ursprünglichen breiten Excel-Struktur; bisher wird bewusst eine eigene, beschriftete Langtabelle erzeugt.
- Streaming/Worker für große Studien. ZIP-Importe sind momentan auf 300 MB entpackte Daten begrenzt und laufen im Hauptthread.
- Vollständige Gegenprüfung gegen Windows-Ausgaben. Es stehen keine echten oder anonymisierten Originaljobs zur Verfügung.

## Kompatibilitätsentscheidungen

- Ergebnisdateien heißen `.result`, sind aber **GZip und kein ZIP-Archiv**. Das wurde aus `IQB-Common.ZipXDocProvider` rekonstruiert.
- Kodierte Fälle hinter einem noch offenen Fall werden ebenfalls exportiert. Die rekonstruierte Windows-Implementierung beendet die Ausgabe bei der ersten vollständig leeren Person; die Browserfassung vermeidet diesen Datenverlust.
- Die Gruppenerzeugung und Kennwortauswahl übernehmen die Aufgabe und die Dateistruktur, nicht die genaue Zufallsfolge des Originals. Automatisch erzeugte Gruppen-IDs verwenden eine einfache, nachvollziehbare laufende Nummer. Vorhandene eindeutige Gruppen-IDs bleiben erhalten. Doppelte IDs werden zurückgewiesen.
- Das Beschreibungsfeld von Booklets wird aus `bookletsCol.Description` übernommen. Der vorhandene VB-Code liest hierfür irrtümlich die Titelspalte.
- CSV/Xlsx-Ausgaben speichern importierte Werte als Text, damit Kennungen wie `001` nicht in Zahlen umgewandelt werden.
- Kommentare und XML-Sonderzeichen werden erhalten und beim Schreiben maskiert. Fremde Job-IDs, doppelte Ergebnisfälle und unbekannte Codes werden zurückgewiesen.
- Die Browserfassung nutzt keine automatische Identifikation über Windows Active Directory. Der Kodierername wird eingegeben.

## Quellen und Nachweise

- Toolbox: <https://github.com/iqb-berlin/itc-toolbox>, Commit `7c45553ca246104a59043d6f4194caf5a4b6c039`.
- Originalprogramme: <https://www2.iqb.hu-berlin.de/it/>.
- Beide ClickOnce-Pakete wurden am 22.10.2026 heruntergeladen. Nutzdateigrößen und SHA256-Prüfsummen stehen in `PROVENANCE.json`. Die vom jeweiligen Manifest enthaltenen Dateihashes wurden beim Download geprüft.
- IQB-Kodieren sowie IQB-Scans und IQB-Common wurden mit ILSpyCmd 11.1.0.9782 statisch in lesbares C# und XAML zurückgewonnen. Die Windows-Programme wurden dabei nicht ausgeführt. Rekonstruierter Code ist kein Originalquellcode und wurde nicht als Projekt kompiliert.
- `tests/compatibility.test.js`: neun automatisierte Prüfungen einschließlich der mitgelieferten Originalvorlagen und synthetischer Jobs/Ergebnisse. Browserprüfung: Beispieljob, Codierung mit 0 und 1, Kommentar mit Sonderzeichen, Fortschritt, Ergebnisdownload, Codes-Xlsx.

Ursprüngliche IQB-Lizenz: siehe `LICENSE`. Die Browserfassung enthält keine KI-API und benötigt keinen API-Schlüssel. Datenverarbeitung und Fortschrittsspeicherung erfolgen lokal im Browser; kein Dateiinhalt wird durch diesen Anwendungscode hochgeladen.
