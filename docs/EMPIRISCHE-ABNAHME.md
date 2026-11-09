# Abnahme mit Dateien aus tatsächlichen Arbeitsabläufen

Status zum Release 0.4.8: **ausstehend – keine empirischen Studiendateien verfügbar**. Die abgeschlossenen synthetischen Piloten werden nicht als empirische Abnahme gezählt. Die Freigabe gilt für die dokumentierten geprüften Abläufe.

## Ablauf beim ersten tatsächlichen Einsatz

1. Eine freigegebene, anonymisierte Kopie eines repräsentativen Kodierjobs und eines Toolbox-Arbeitsauftrags bereitstellen. Eingaben unverändert sichern und ihre SHA-256-Prüfsummen festhalten. Originaldaten außerhalb des öffentlichen Repositorys aufbewahren.
2. Beide Anwendungen mit denselben Eingaben ausführen. Originalversion, Prozessarchitektur, Browser, Anwendungsversion und gewähltes Windows-Profil notieren. Für Zufallsziehungen die fachlichen Regeln vergleichen; neue Zufallswerte sind keine Abweichung.
3. Kodieren: Job öffnen, vorhandene Ergebnisse fortsetzen, Code 0 und weitere Codes, Fall-/Jobkommentar, Navigation, Speichern, Schließen, Wiederöffnen und Ergebnisexport prüfen. Zahl der Fälle, Personen-/Variablenkennungen, Codes und Kommentare vergleichen. Tatsächliche Bearbeitungszeiten getrennt behandeln.
4. Toolbox: den tatsächlich benötigten Import-, Vorbereitungs- und Exportauftrag einschließlich relevanter Optionen durchspielen. Bei SQLite fachliche Tabellen, Schlüssel und Werte vergleichen; bei Excel alle genutzten Blätter, Zellwerte, Typen und Reihenfolgen. Container-Zeitstempel und ZIP-Metadaten getrennt ausweisen. Bei CSV/XML vereinbarte Kodierung und Zeilenumbrüche mitprüfen.
5. Eingaben, Optionen, erwartete und tatsächliche Ausgabe eines Fehlers auf einen kleinen reproduzierbaren Fall reduzieren. Einen Regressionstest hinzufügen, den Fehler korrigieren und den vollständigen betroffenen Ablauf mit beiden Anwendungen erneut ausführen.
6. Ergebnis je Arbeitsauftrag als bestanden, abweichend oder nicht prüfbar dokumentieren. Eine Erweiterung der Freigabe nennt den neuen Datensatz- und Funktionsumfang; sie behauptet keine universelle Gleichheit aller möglichen Dateien.

## Protokollvorlage je Arbeitsauftrag

| Feld | Eintrag |
| --- | --- |
| Datum / anonyme Fallkennung | |
| Anwendung und Arbeitsauftrag | |
| Eingabedateien: anonymisierte Namen und SHA-256 | |
| Herkunft und Freigabe der anonymisierten Kopien | |
| Windows-Original: Version und x86/x64 | |
| Browser / Betriebssystem / Browserfassung / Release-Commit | |
| Windows-Profil und sämtliche relevanten Optionen | |
| Schritte einschließlich Speichern und Wiederöffnen | |
| Erwartete Ausgabe / Original-Ausgabe-Prüfsummen | |
| Browser-Ausgabe-Prüfsummen | |
| Vergleich: Felder, Zellen, Tabellen, Reihenfolge oder Bytes | |
| Ausgenommene Zeit-/Zufalls-/Container-Metadaten | |
| Ergebnis: bestanden / abweichend / nicht prüfbar | |
| Reproduktion, Regressionstest und Korrektur-Commit | |
| Abnahme durch / verbleibende Einschränkungen | |

Im öffentlichen Fehlerbericht zunächst anonymisierte Kennungen, Optionen und beobachtete Unterschiede beschreiben. Rohdateien erst nach bestätigter Freigabe veröffentlichen. Dateihashes allein beweisen keine fachliche Übereinstimmung; maßgeblich ist der dokumentierte Inhaltsvergleich.
