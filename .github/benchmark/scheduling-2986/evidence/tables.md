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
