import { slug } from './slug.js';

function isoDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function downloadBundle({
  files,
  anschlussnutzer,
  today = new Date(),
  chrome = globalThis.chrome,
  URL = globalThis.URL,
  Blob: BlobImpl = globalThis.Blob,
}) {
  const folder = `MaKo/${isoDate(today)}_${slug(anschlussnutzer)}/`;
  for (const file of files) {
    const blob = new BlobImpl([file.bytes], { type: file.mime });
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url,
      filename: folder + file.name,
      conflictAction: 'uniquify',
      saveAs: false,
    });
  }
}
