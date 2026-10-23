# Lokale Testcenter-Demo

Auf dem eingerichteten Mac laufen Testcenter 19.0.1, PostgreSQL 18.4 und Redis 8 in der eigenen Lima-VM `iqb-tc`. Der Zugriff ist an Loopback gebunden. Es gibt keine echten Testpersonen.

| Anwendung | Adresse | Anmeldung |
| --- | --- | --- |
| Browserfassung | http://127.0.0.1:5190 | In der Toolbox „Testcenter verbinden“ öffnen |
| Testcenter | http://127.0.0.1:5188 | Administrator `super`, Kennwort `user123` |
| Testpersonen | dieselbe Testcenter-Adresse | `001` oder `002`, Kennwort `demo123` |

Arbeitsbereich: **Sample Workspace**. Ergebnisgruppen: **Demo A – Umlaute** und **Demo B – zweiter Import**. Zwei Personen, zwei Testhefte, vier Units mit Original-ID/Alias, 28 Antworten, sechs Testheft-Logs, zwölf Unit-Logs und zwei Sitzungen.

Die Kennwörter sind ausschließlich für diese lokale Demo gedacht. Die vorhandene private HTTPS-Website kann beim Zugriff auf einen lokalen HTTP-Server durch Browserregeln blockiert werden. Die lokale Browserfassung und das lokale Testcenter verwenden daher beide HTTP auf Loopback; die API erlaubt nur die ausdrücklich eingetragenen Ursprünge.

## Starten und anhalten auf diesem Mac

`start-local.command` und `stop-local.command` liegen in diesem Verzeichnis. Sie verwenden die bereits eingerichtete VM unter `work/lima`, behalten alle Daten und verändern keine andere VM. Die Startdatei benötigt das gebaute `dist/`, Python 3 und curl; die mitgelieferte Installation ist bereits vorbereitet. Die Browserfassung läuft im geöffneten Terminalfenster als eigener statischer Server, ohne API-Proxy. Das Fenster während der Nutzung geöffnet lassen. Die Stoppdatei beendet nur diesen Server und hält die Demo-VM an. Es wird kein automatischer Start bei der Anmeldung eingerichtet.

Die VM hat zwei CPUs, 2 GiB RAM und eine dünn belegte 20-GiB-Platte. Backend und Webserver laufen nativ auf ARM. Das Backend wurde mit dem unveränderten offiziellen Dockerfile und den gesperrten Composer-Abhängigkeiten gebaut. Die Frontend-Dateien stammen bytegleich aus dem offiziellen Release-Image und werden von nativem nginx ausgeliefert. Broadcaster und Datei-Server verwenden die offiziellen x86-Images über QEMU. Der Anmeldeschutz bleibt für `admin login person` aktiv.

Die Laufzeitdateien und Volumes liegen außerhalb dieses Quellcodepakets. Die Startdateien sind auf die bestehende Ordnerstruktur `we/outputs/iqb-browser` und `we/work/…` abgestimmt. Die übrigen Dateien ermöglichen eine neue Installation mit Docker.

## Neue Installation mit Docker

Für Intel/AMD mit laufendem Docker und Compose:

```sh
docker compose -f demo/testcenter/compose.yaml up -d db cache-server
docker compose -f demo/testcenter/compose.yaml run --rm --entrypoint /initialize_only.sh backend
docker compose -f demo/testcenter/compose.yaml up -d
TESTCENTER_URL=http://127.0.0.1:8088 node demo/testcenter/seed.mjs
```

Der Docker-Port ist 8088. Auf dem eingerichteten Mac leitet Lima ihn auf Host-Port 5188 weiter. `seed.mjs` legt Antworten und Logs über die echten Testcenter-Schnittstellen an. Wenn die Demo-Gruppen bereits Antworten enthalten, bleibt der Bestand unverändert.

Auf ARM zuerst die nativen Images bauen und danach bei jedem Compose-Aufruf zusätzlich `-f demo/testcenter/compose.arm64.yaml` angeben:

```sh
git clone --depth 1 --branch 19.0.1 https://github.com/iqb-berlin/testcenter.git testcenter-upstream
docker build --target prod -f testcenter-upstream/backend/Dockerfile -t local/testcenter-backend:19.0.1-arm64 testcenter-upstream
docker build -f demo/testcenter/Frontend.arm64.Dockerfile -t local/testcenter-frontend:19.0.1-arm64 demo/testcenter
```

Für die beiden übrigen x86-Dienste braucht Docker eine amd64-Emulation. In der vorhandenen Ubuntu-VM wurden `qemu-user` und `qemu-user-binfmt` aus dem offiziellen Paketarchiv installiert. Das emulierte PHP-Release-Image stürzte mit aktivem Opcode-Cache ab; deshalb verwendet die fertige Demo das native Backend ohne Änderungen am PHP-Quellcode oder an seinem Cache.

## Integrationstest wiederholen

Im Projektordner nach Installation der Node-Abhängigkeiten:

```sh
node scripts/build-testcenter-tests.mjs ./work/testcenter-tests
python3 demo/testcenter/serve-tests.py ./work/testcenter-tests ./work/testcenter-results
```

Dann http://127.0.0.1:5191/tests/testcenter.html öffnen, gegebenenfalls die Testcenter-Adresse anpassen und **Integrationslauf starten** anklicken. Die Prüfseite ruft die Produktionsmodule und den echten Module-Worker auf. Der lokale Prüfserver speichert Berichte und die tatsächlichen SQLite-/Excel-/CSV-/ZIP-Ausgaben. Diese Seite wird nicht in `dist/` veröffentlicht. Keine Sitzungsschlüssel gelangen in Berichte oder Dateien.

Die 18 Prüfungen bestehen jeweils in Chromium, Safari und Firefox auf macOS. `demo-reports.json` enthält ausschließlich die synthetischen Antworten und Logs der echten API für einen schnellen Regressionstest ohne laufendes Testcenter. `seed-manifest.json` dokumentiert den angelegten Bestand. Die ursprünglichen Beispielinhalte bleiben in der Instanz erhalten.

## Quelle

Offizieller Quellcode: https://github.com/iqb-berlin/testcenter/releases/tag/19.0.1, Commit `d93ba401e35d21a671cb70c56a89bea6cc0b6563`. Die offiziellen Release-Images sind in `compose.yaml` durch SHA-256-Digests festgelegt. Lokales ARM-Backend: PHP 8.3.36, unverändertes offizielles Produktions-Dockerfile. Es wurden keine Testcenter-Anwendungsdateien geändert.
