# upstream_vite_override

A global Vite override replaces CLI/API/Vitest Vite, while postinstall pack keeps its matching internal core. Repeat with a local file dependency and a different public CLI entry.

## `vp install`


## `node check-api.mjs`

```
API exports and bundled Vitest use upstream Vite; pack uses the matching internal core
```

## `vpt stat-file packed/entry.mjs --assert file`

```
packed/entry.mjs: file
```

## `vpt stat-file packed/entry.d.mts --assert file`

```
packed/entry.d.mts: file
```

## `node node_modules/vite-plus/bin/vp build`

```
✓ 4 modules transformed.
computing gzip size...
dist/index.html                <size> kB │ gzip: <size> kB
dist/assets/index-<hash>.js  <size> kB │ gzip: <size> kB

✓ built in <duration>
```

## `node node_modules/vite-plus/bin/vp dev`

```

  VITE <version>  ready in <duration>

  ➜  Local:   http://127.0.0.1:<port>/
  ➜  press h + enter to show help
Upstream Vite dev served HTTP 200
```

## `node node_modules/vite-plus/bin/vp preview`

```
  ➜  Local:   http://127.0.0.1:<port>/
  ➜  press h + enter to show help
Upstream Vite preview served HTTP 200
```

## `node node_modules/vite-plus/bin/vp test run`

```

 RUN  <version> <workspace>

 ✓ override.test.ts (1 test) <duration>
   ✓ uses the replacement Vite through public API exports <duration>

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  <time>
   Duration  <duration> (<timing>)
```

## `node use-local-vite.mjs`


## `EXPECT_INTERNAL_CONFIG=1 node node_modules/vite-plus/bin/vp install`


## `LOCAL_VITE=1 node check-api.mjs`

```
API exports and bundled Vitest use upstream Vite; pack uses the matching internal core
```

## `node node_modules/vite-plus/bin/vp build`

```
Local upstream Vite CLI entry
✓ 4 modules transformed.
computing gzip size...
dist/index.html                <size> kB │ gzip: <size> kB
dist/assets/index-<hash>.js  <size> kB │ gzip: <size> kB

✓ built in <duration>
```

## `node node_modules/vite-plus/bin/vp dev`

```
Local upstream Vite CLI entry

  VITE <version>  ready in <duration>

  ➜  Local:   http://127.0.0.1:<port>/
  ➜  press h + enter to show help
Upstream Vite dev served HTTP 200
```

## `node node_modules/vite-plus/bin/vp preview`

```
Local upstream Vite CLI entry
  ➜  Local:   http://127.0.0.1:<port>/
  ➜  press h + enter to show help
Upstream Vite preview served HTTP 200
```

## `LOCAL_VITE=1 node node_modules/vite-plus/bin/vp test run`

```

 RUN  <version> <workspace>

 ✓ override.test.ts (1 test) <duration>
   ✓ uses the replacement Vite through public API exports <duration>

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  <time>
   Duration  <duration> (<timing>)
```

## `node check-core-guard.mjs local`

```
Pack and Vite commands still reject a mismatched internal core
```
