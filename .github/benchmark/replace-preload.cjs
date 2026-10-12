// Diagnostic only: isolate the injected DLL without rebuilding the host binding.
const fs = require('node:fs');
const path = require('node:path');
const bytes = fs.readFileSync(
  path.join(
    process.env.RUNNER_TEMP,
    'known-good/packages/cli/binding/vite-plus.win32-x64-msvc.node',
  ),
);
let preload;
for (let offset = bytes.indexOf('MZ', 1); offset >= 0; offset = bytes.indexOf('MZ', offset + 1)) {
  if (offset + 64 > bytes.length) continue;
  const pe = bytes.readUInt32LE(offset + 60);
  if (pe > 4096 || !bytes.subarray(offset + pe, offset + pe + 4).equals(Buffer.from('PE\0\0')))
    continue;
  const coff = offset + pe + 4;
  const count = bytes.readUInt16LE(coff + 2);
  const sections = coff + 20 + bytes.readUInt16LE(coff + 16);
  let length = 0;
  for (let i = 0; i < count; i++) {
    const section = sections + i * 40;
    length = Math.max(length, bytes.readUInt32LE(section + 16) + bytes.readUInt32LE(section + 20));
  }
  const dll = bytes.subarray(offset, offset + length);
  if (
    dll.includes(Buffer.from('DllMain\0')) &&
    !dll.includes(Buffer.from('napi_register_module_v1\0'))
  ) {
    if (preload) throw new Error('More than one preload DLL found');
    preload = dll;
  }
}
if (!preload) throw new Error('Known-good preload DLL not found');
let count = 0;
for (const base of new Set([
  process.env.TEMP,
  process.env.TMP,
  'C:/Windows/SystemTemp',
  'C:/Windows/Temp',
])) {
  if (!base) continue;
  const directory = path.join(base, 'fspy');
  if (!fs.existsSync(directory)) continue;
  for (const name of fs.readdirSync(directory)) {
    if (!/^fspy_preload_.*\.dll$/.test(name)) continue;
    const filename = path.join(directory, name);
    console.log(
      'Replace materialized preload:',
      filename,
      fs.statSync(filename).size,
      '->',
      preload.length,
    );
    fs.writeFileSync(filename, preload);
    count++;
  }
}
if (!count) throw new Error('No materialized preload DLL found');
console.log('Replaced preload DLLs:', count);
