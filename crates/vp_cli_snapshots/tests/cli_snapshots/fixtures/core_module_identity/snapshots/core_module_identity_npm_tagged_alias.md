# core_module_identity_npm_tagged_alias

## `vpt write-file package.json '{"name":"core-module-identity","private":true,"type":"module","packageManager":"npm@11.11.0","devDependencies":{"vite-plus":"latest","vite":"npm:@voidzero-dev/vite-plus-core@latest"}}
'`


## `vp install --ignore-scripts`


## `node check-tagged-alias.mjs`

```
vp dev validates the installed package behind the tagged npm alias
vp pack uses its private runtime with the tagged npm alias
```
