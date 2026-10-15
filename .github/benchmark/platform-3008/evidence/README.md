# PR #3008 CI comparison

`analysis.json` contains observed elapsed times, job times, start times, and fixed-duration scheduling estimates. `state.json` links each run to its variant, cache condition, and sample. `method.json` defines the scope and controls.

The numbered JSON files contain the GitHub Actions job and step timestamps. Run `python3 analyze.py` from this directory to reproduce the calculations. The fixed-duration estimates omit runner queues and are separate from observed run times.

`cache-audit.json` contains cache keys extracted from the completed job logs. Every warm run uses the same 14 immutable entries recorded in `shared-cache-identities.json`. Cold runs restore no CI caches. All measured runs disable cache saving.

`warm-linux1-fixture-comparison.json` compares the first warm pair's Linux shard 1 timing artifacts. The serial npm migration took about 110 seconds longer inside the migrate command, and other cases waited about 111 seconds longer at the test gate.

The production PR changes only `.github/workflows/ci.yml`. Product source, toolchain pins, runner labels, test commands, and three snapshot shards remain identical to the frozen base.
