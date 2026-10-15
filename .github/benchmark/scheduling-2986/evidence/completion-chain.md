This table follows the last completed dependency at each step back from `done`. It describes the observed completion path; it is not a prediction of CI time without queues. Gaps include runner allocation and scheduling after dependencies finish.

| Cache  | Variant | Run                                                                               | Elapsed | Job execution on path | Gaps on path | Last job before gate                                    |
| ------ | ------- | --------------------------------------------------------------------------------- | ------: | --------------------: | -----------: | ------------------------------------------------------- |
| cold 1 | after   | [38689942310](https://github.com/voidzero-dev/vite-plus/actions/runs/38689942310) |  12m03s |                11m34s |        0m29s | CLI snapshot test (aarch64-apple-darwin, shard 1/3)     |
| cold 2 | before  | [38691149859](https://github.com/voidzero-dev/vite-plus/actions/runs/38691149859) |  11m11s |                11m04s |        0m07s | CLI snapshot test (x86_64-unknown-linux-gnu, shard 1/3) |
| warm 1 | after   | [38694781467](https://github.com/voidzero-dev/vite-plus/actions/runs/38694781467) |   7m33s |                 4m02s |        3m31s | CLI snapshot test (aarch64-apple-darwin, shard 2/3)     |
| warm 1 | before  | [38695646217](https://github.com/voidzero-dev/vite-plus/actions/runs/38695646217) |   6m53s |                 6m19s |        0m34s | CLI snapshot test (x86_64-unknown-linux-gnu, shard 2/3) |
| warm 2 | before  | [38697851965](https://github.com/voidzero-dev/vite-plus/actions/runs/38697851965) |  24m22s |                 5m06s |       19m16s | CLI snapshot test (aarch64-apple-darwin, shard 3/3)     |

The full job paths and timestamps are in `analysis.json`.
