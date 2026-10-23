#!/bin/zsh
set -eu
demo_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
task_dir="$(cd -- "$demo_dir/../../../.." && pwd)"
export LIMA_HOME="$task_dir/work/lima"
lima_bin="$task_dir/work/testcenter-runtime/lima/bin/limactl"
runtime_dir="$task_dir/work/testcenter-local"
"$lima_bin" start --tty=false iqb-tc
"$lima_bin" shell iqb-tc -- docker compose -f "$runtime_dir/compose.yaml" up -d
print 'Testcenter: http://127.0.0.1:5188 — super / user123'
print 'Browserfassung: http://127.0.0.1:5190'
if curl -fsSI http://127.0.0.1:5190/ 2>/dev/null | grep -q 'X-IQB-Local-Demo: 1'; then
  print 'Lokale Browserfassung läuft bereits.'
  exit 0
elif /usr/sbin/lsof -iTCP:5190 -sTCP:LISTEN -t >/dev/null 2>&1; then
  print -u2 'Port 5190 ist durch einen anderen Prozess belegt.'
  exit 1
fi
print 'Dieses Terminalfenster für die Browserfassung geöffnet lassen. Zum vollständigen Anhalten stop-local.command ausführen.'
exec python3 "$demo_dir/serve-app.py"
