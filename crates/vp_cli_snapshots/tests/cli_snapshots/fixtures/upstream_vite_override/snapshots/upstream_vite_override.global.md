# upstream_vite_override

A global Vite override replaces CLI/API/Vitest Vite, while postinstall pack uses its private bundled runtime. Repeat with a local file dependency and a different public CLI entry.

## `vp install`


## `node check-api.mjs`

```
API exports and bundled Vitest use upstream Vite; pack uses its private bundled runtime
```

## `node check-vite-identity-guard.mjs`

```
Upstream Vite rejected without the opt-in before dev/build/preview
Partial Vite override rejected before dev/build/preview
Separate Vite copies with the same version rejected before dev/build/preview
```

## `vpt stat-file packed/entry.mjs --assert file`

```
packed/entry.mjs: file
```

## `vpt stat-file packed/entry.d.mts --assert file`

```
packed/entry.d.mts: file
```

## `vpt stat-file packed/style.css --assert file`

```
packed/style.css: file
```

## `vp build`

```
VITE+ - The Unified Toolchain for the Web

✓ 5 modules transformed.
computing gzip size...
dist/index.html                 <size> kB │ gzip: <size> kB
dist/assets/index-<hash>.css  <size> kB │ gzip: <size> kB
dist/assets/index-<hash>.js   <size> kB │ gzip: <size> kB

✓ built in <duration>
```

## `vp dev`

```

  VITE <version>  ready in <duration>

  ➜  Local:   http://127.0.0.1:<port>/
  ➜  press h + enter to show help
Upstream Vite dev served HTTP 200
```

## `vp preview`

```
VITE+ - The Unified Toolchain for the Web

  ➜  Local:   http://127.0.0.1:<port>/
  ➜  press h + enter to show help
Upstream Vite preview served HTTP 200
```

## `vp test run`

```
VITE+ - The Unified Toolchain for the Web

 RUN  <version> <workspace>

 ✓ override.test.ts (1 test) <duration>
   ✓ uses the replacement Vite through public API exports <duration>

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  <time>
   Duration  <duration> (<timing>)
```

## `node use-local-vite.mjs`


## `EXPECT_PROJECT_CONFIG=1 vp install`


## `LOCAL_VITE=1 node check-api.mjs`

```
API exports and bundled Vitest use upstream Vite; pack uses its private bundled runtime
```

## `node check-vite-identity-guard.mjs`

```
Upstream Vite rejected without the opt-in before dev/build/preview
Partial Vite override rejected before dev/build/preview
Separate Vite copies with the same version rejected before dev/build/preview
```

## `vp build`

```
VITE+ - The Unified Toolchain for the Web

Local upstream Vite CLI entry
✓ 5 modules transformed.
computing gzip size...
dist/index.html                 <size> kB │ gzip: <size> kB
dist/assets/index-<hash>.css  <size> kB │ gzip: <size> kB
dist/assets/index-<hash>.js   <size> kB │ gzip: <size> kB

✓ built in <duration>
```

## `vp dev`

```
VITE+ - The Unified Toolchain for the Web

Local upstream Vite CLI entry

  VITE <version>  ready in <duration>

  ➜  Local:   http://127.0.0.1:<port>/
  ➜  press h + enter to show help
Upstream Vite dev served HTTP 200
```

## `vp preview`

```
VITE+ - The Unified Toolchain for the Web

Local upstream Vite CLI entry
  ➜  Local:   http://127.0.0.1:<port>/
  ➜  press h + enter to show help
Upstream Vite preview served HTTP 200
```

## `LOCAL_VITE=1 vp test run`

```
VITE+ - The Unified Toolchain for the Web

 RUN  <version> <workspace>

 ✓ override.test.ts (1 test) <duration>
   ✓ uses the replacement Vite through public API exports <duration>

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  <time>
   Duration  <duration> (<timing>)
```
