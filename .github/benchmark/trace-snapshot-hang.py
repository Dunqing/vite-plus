"""Run unchanged snapshots and collect process diagnostics for lingering app cases."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
import time

destination = Path(os.environ['VP_SNAP_ARTIFACTS_DIR']) / 'process-diagnostic'
destination.mkdir(parents=True, exist_ok=True)
test = subprocess.Popen(['bash', '-euo', 'pipefail', sys.argv[1]])
started = time.monotonic()
while test.poll() is None and time.monotonic() - started < 15:
    time.sleep(0.5)

tracer = None
trace_log = None
if test.poll() is None:
    rows = subprocess.check_output(['ps', '-eo', 'pid=,ppid=,stat=,etime=,wchan=,comm='], text=True)
    (destination / 'processes.txt').write_text(rows)
    processes = [line.split(None, 5) for line in rows.splitlines()]
    descendants = {test.pid}
    while True:
        expanded = descendants | {int(row[0]) for row in processes if int(row[1]) in descendants}
        if expanded == descendants:
            break
        descendants = expanded
    report = []
    targets = []
    for row in processes:
        pid = int(row[0])
        if pid not in descendants:
            continue
        data = dict(zip(['pid', 'parent', 'state', 'elapsed', 'wait_channel', 'command'], row))
        for name in ['cwd', 'exe']:
            try:
                data[name] = os.readlink(f'/proc/{pid}/{name}')
            except OSError as error:
                data[name] = str(error)
        report.append(data)
        if 'app_root_' in data['cwd']:
            targets.append(pid)
    (destination / 'descendants.json').write_text(json.dumps(report, indent=2)+'\n')
    print(f'Captured {len(report)} snapshot processes; {len(targets)} app_root processes remain after 15 seconds.', flush=True)
    if targets and shutil.which('strace'):
        trace_log = (destination / 'strace-status.txt').open('w')
        args = ['sudo', 'timeout', '15s', 'strace', '-f', '-tt', '-T',
                '-e', 'trace=connect,flock,fcntl,futex', '-o', str(destination / 'strace.txt')]
        for pid in targets:
            args.extend(['-p', str(pid)])
        tracer = subprocess.Popen(args, stdout=trace_log, stderr=subprocess.STDOUT)

result = test.wait()
if tracer is not None:
    tracer.wait()
if trace_log is not None:
    trace_log.close()
raise SystemExit(result)
