# Vendored libraries

Copied from `node_modules/` by `scripts/copy-vendor.mjs` (run `npm run copy-vendor`).

| File | npm package | Version source |
|---|---|---|
| `pizzip.js` | pizzip | `package.json` devDependency |
| `docxtemplater.js` | docxtemplater | `package.json` devDependency |
| `pdf-lib.min.js` | pdf-lib | `package.json` devDependency |
| `exceljs.min.js` | exceljs | `package.json` devDependency |

To update: bump the version in `package.json`, `npm install`, `npm run copy-vendor`, commit.
