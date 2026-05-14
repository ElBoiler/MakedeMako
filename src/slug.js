const FOLD = {
  ä: 'ae', ö: 'oe', ü: 'ue',
  Ä: 'ae', Ö: 'oe', Ü: 'ue',
  ß: 'ss',
};

export function slug(input) {
  const folded = String(input ?? '')
    .replace(/[äöüÄÖÜß]/g, ch => FOLD[ch])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return folded || 'untitled';
}
