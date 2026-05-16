const CRLF = '\r\n';

function rfc2822Date(d) {
  return d.toUTCString().replace('GMT', '+0000');
}

function encodeHeaderUtf8(value) {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const b64 = base64FromString(value);
  return `=?utf-8?B?${b64}?=`;
}

function base64FromString(s) {
  const bytes = new TextEncoder().encode(s);
  return base64FromBytes(bytes);
}

function base64FromBytes(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function quotedPrintable(text) {
  // Replace all newlines with CRLF first, then encode
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, CRLF);
  const lines = normalized.split(CRLF);
  const encodedLines = lines.map(line => {
    let out = '';
    const bytes = new TextEncoder().encode(line);
    let lineLen = 0;
    for (const b of bytes) {
      let chunk;
      if (b === 0x3d || b < 0x20 || b > 0x7e) {
        chunk = '=' + b.toString(16).toUpperCase().padStart(2, '0');
      } else {
        chunk = String.fromCharCode(b);
      }
      if (lineLen + chunk.length > 75) {
        out += '=' + CRLF;
        lineLen = 0;
      }
      out += chunk;
      lineLen += chunk.length;
    }
    return out;
  });
  return encodedLines.join(CRLF);
}

function base64Wrapped(bytes, width = 76) {
  const b64 = base64FromBytes(bytes);
  const lines = [];
  for (let i = 0; i < b64.length; i += width) lines.push(b64.slice(i, i + width));
  return lines.join(CRLF);
}

function randomBoundary() {
  const r = Math.random().toString(36).slice(2);
  return `----=_MaKo_${Date.now().toString(36)}_${r}`;
}

export function buildEml({ subject, bodyLines, headers = {}, attachments = [], date = new Date() }) {
  const boundary = randomBoundary();
  const out = [];

  out.push('From: ');
  out.push('To: ');
  out.push(`Subject: ${encodeHeaderUtf8(subject)}`);
  out.push(`Date: ${rfc2822Date(date)}`);
  out.push('MIME-Version: 1.0');
  for (const [k, v] of Object.entries(headers)) out.push(`${k}: ${v}`);
  out.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  out.push('');

  out.push(`--${boundary}`);
  out.push('Content-Type: text/plain; charset=UTF-8');
  out.push('Content-Transfer-Encoding: quoted-printable');
  out.push('');
  out.push(quotedPrintable(bodyLines.join(CRLF)));

  for (const att of attachments) {
    out.push(`--${boundary}`);
    out.push(`Content-Type: ${att.contentType}; name="${att.name}"`);
    out.push('Content-Transfer-Encoding: base64');
    out.push(`Content-Disposition: attachment; filename="${att.name}"`);
    out.push('');
    out.push(base64Wrapped(att.bytes));
  }
  out.push(`--${boundary}--`);
  out.push('');

  return out.join(CRLF);
}
