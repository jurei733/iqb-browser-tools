#!/bin/zsh
set -eu
demo_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
task_dir="$(cd -- "$demo_dir/../../../.." && pwd)"
export LIMA_HOME="$task_dir/work/lima"
runtime_dir="$task_dir/work/testcenter-local"
for demo_pid in $(/usr/sbin/lsof -iTCP:5190 -sTCP:LISTEN -t 2>/dev/null); do
  if ps -p "$demo_pid" -o command= | grep -Fq "$demo_dir/serve-app.py"; then kill "$demo_pid"; fi
done
"$task_dir/work/testcenter-runtime/lima/bin/limactl" stop iqb-tc
print 'Demo angehalten. Container, Demodaten und Browserstand bleiben erhalten.'
