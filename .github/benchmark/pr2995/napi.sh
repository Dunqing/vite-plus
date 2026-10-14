set -euo pipefail
pnpm --filter=vite-plus build-native --target x86_64-pc-windows-msvc -x --skip-format
