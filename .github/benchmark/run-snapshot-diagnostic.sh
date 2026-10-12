export VP_SNAP_SH_BIN="$(command -v sh)"
export VP_SNAP_BASH_BIN="$(command -v bash)"
export VP_SNAP_ZSH_BIN="$(command -v zsh)"
VP_SNAP_GLOBAL_VP="$HOME/.vite-plus/bin/vp" \
VP_SNAP_JS_RUNTIME_DIR="$HOME/.vite-plus/js_runtime" \
VP_SNAP_FISH_BIN="$(command -v fish)" \
VP_SNAP_NU_BIN="$(command -v nu)" \
./target/snapshot-tests/cli_snapshots --test-threads 8
