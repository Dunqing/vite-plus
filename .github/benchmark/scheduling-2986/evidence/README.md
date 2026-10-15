These measurements compare PR #2986 at `1d3c541a3e16157d48852e86ce0fd09838e872d2` with `main` at `0b304d1f7f868481ac57dee570e9202d4c68e20e`.
The benchmark source is `b6b74e86cfde3c2846f0210411e0d3f7d210b316`. Both variants use identical product source, two shared browser-port fixes, tool versions, runner labels, and six pinned install repositories.
The scope is the `CI` workflow with six install repositories enabled. Other workflows and the unchanged optional Socket Firewall jobs are excluded.

Elapsed time starts with `detect-changes` and ends when `done` completes. It includes downstream queues and setup. The table has one complete cold pair and one complete warm pair. Neither pair shows a total CI improvement.

| Cache |                                                                         Main |                                                                           PR |         Change |
| ----- | ---------------------------------------------------------------------------: | ---------------------------------------------------------------------------: | -------------: |
| Cold  | [11m11s](https://github.com/voidzero-dev/vite-plus/actions/runs/38691149859) | [12m03s](https://github.com/voidzero-dev/vite-plus/actions/runs/38689942310) | 🔴 ↑52s (7.7%) |
| Warm  |  [6m53s](https://github.com/voidzero-dev/vite-plus/actions/runs/38695646217) |  [7m33s](https://github.com/voidzero-dev/vite-plus/actions/runs/38694781467) | 🔴 ↑40s (9.7%) |

| Warm job or phase        |  Main |    PR |            Change |
| ------------------------ | ----: | ----: | ----------------: |
| Linux CLI archive        | 1m16s |    9s | 🟢 ↓1m07s (88.2%) |
| macOS CLI archive        | 1m27s |   27s | 🟢 ↓1m00s (69.0%) |
| Windows unit archive     | 1m10s |    9s | 🟢 ↓1m01s (87.1%) |
| Windows snapshot archive | 1m10s |    8s | 🟢 ↓1m02s (88.6%) |
| Six install repositories | 2m34s | 1m34s | 🟢 ↓1m00s (39.0%) |

Main builds both Windows archives in one job; its duration appears in both archive rows. Job durations exclude queue time. The install phase includes delays between its jobs.

| Cache | Runner time on main | Runner time on PR |           Change |
| ----- | ------------------: | ----------------: | ---------------: |
| Cold  |              84m30s |            89m14s | 🔴 ↑4m44s (5.6%) |
| Warm  |              59m23s |            60m44s | 🔴 ↑1m21s (2.3%) |

Archive reuse shortens the warm producer jobs. It does not shorten snapshot execution. The warm completion path has 34 seconds of scheduling gaps on main and 3m31s on the PR. These samples do not establish a repeatable total CI gain. `completion-chain.md` separates execution and dependency-to-start gaps on each observed completion path. It is not a prediction of runtime without queues.

Cold means the Cargo, pnpm, Windows SDK, native binary, and test archive caches are bypassed. Runner images and tool caches remain uncontrolled.
The Zig action disables its build cache but still uses compiler installations and a compiler-download cache. The latter adds about 14 seconds to the baseline musl E2E job. That job finishes before the completion path in both measured cold runs.
Warm runs require exact hits and do not save the controlled caches. `cache-audit.json` records restored keys. `required-cache-identities.json` records the initial union of 24 required entries. Main requires 14 distinct entries; the PR requires 17. Seven are shared. `cache-identity-audit.json` records the required entries before and after each successful warm run.

The first cold baseline, run `38688707872`, overlaps regular PR CI. It is retained as calibration data and excluded from the table. This decision precedes the candidate cold result. The reported cold pair and first warm pair run PR then main. Runs `38692296238`, `38693461887`, and `38701334265` prepare caches and supply no measured timing result.

A second warm baseline attempt, run `38696490098`, fails in `command_owner_pnpm10` with an npm cache `EBUSY`/`EEXIST` error on Windows. A complete replacement baseline, run `38697851965`, passes in 24m22s, with 19m16s of scheduling gaps on its completion path. It remains unpaired.
Six PR-side cache entries disappear before or during its paired candidate attempt, run `38700704392`, and exact-hit checks reject that run. Preparation run `38701334265` rebuilds missing entries. Its final preflight then finds six of the seven original shared entries missing. No further candidate run is dispatched, and there is no second warm timing result. `cache-reprime.json` records this preflight. API snapshots prove cache disappearance; capacity eviction is an inference from cache pressure, not an audited deletion cause.

`coverage-audit.json` compares passed-test counts on all platforms and hashes of the Windows test-name lists. All measured runs use three snapshot shards per platform. `added-cache-footprint.json` records about 130 MiB for four test archives and 2.1 GiB for five new Cargo entries from preparation. This is not a prediction of steady-state net cache growth.
The redundant benchmark cache entries removed before measurements are recorded separately. `benchmark-cache-cleanup.json` records removal of all remaining cache entries under the benchmark branch after the audit. Main and production PR cache entries are not manually removed by this task.

Each numbered JSON file contains GitHub job and step timestamps. Download a run's logs with `gh api repos/voidzero-dev/vite-plus/actions/runs/<id>/logs > <id>-logs.zip` in this directory. Run `analyze.py`, `audit.py`, `coverage.py`, `report.py`, and `completion-chain.py` to reproduce the tables and log checks. `analyze.py` requires PyYAML and reads the measured workflows from the recorded Git commit. The cache identity report contains historical API snapshots filtered to required entries; those snapshots cannot be fetched again after deletion.

Main advanced to `a590ae04c97c30039a88f1e04100d344c0c36f70` during measurement. The comparison stays pinned to the recorded base and PR head.
