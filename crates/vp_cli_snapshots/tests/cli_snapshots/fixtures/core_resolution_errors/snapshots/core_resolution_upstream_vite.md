# core_resolution_upstream_vite

## `vpt write-file node_modules/vite/package.json '{"name":"vite","version":"8.2.2"}
'`


## `vp dev`

**Exit code:** 1

```
error: Failed to resolve vite command: GenericFailure, Expected @voidzero-dev/vite-plus-core@<version>, but found vite@8.2.2 at <workspace>/node_modules/vite/package.json. Run `vp migrate` to align the Vite alias, then run `vp install`.
```

## `vp pack --no-config index.ts`

```
ℹ entry: index.ts
ℹ Build start
ℹ dist/index.mjs  <size> kB │ gzip: <size> kB
ℹ 1 files, total: <size> kB
✔ Build complete in <duration>
```
