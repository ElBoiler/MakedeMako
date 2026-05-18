const MAP = {
  MeLo: { Verbrauch: '9991000000771', Erzeugung: '9991000000789' },
  MaLo: { Verbrauch: '9991000000747', Erzeugung: '9991000000747' },
};

export const BEZEICHNUNG = {
  '9991000000747': 'Energiemenge SLP',
  '9991000000771': 'Energiemenge SLP Verbrauch MeLo',
  '9991000000789': 'Energiemenge SLP Erzeugung MeLo',
};

export function messprodukt(kind, richtung) {
  if (!MAP[kind]) throw new Error(`Unknown kind: ${kind}`);
  if (!MAP[kind][richtung]) throw new Error(`Unknown richtung: ${richtung}`);
  return MAP[kind][richtung];
}
