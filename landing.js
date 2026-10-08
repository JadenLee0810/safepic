// Landing page: live .enc demo. Uses the same crypto.js as the editor.
import { encryptImage, decryptImage } from './crypto.js';

const $ = (id) => document.getElementById(id);
const out = $('demo-out');
const runBtn = $('demo-run');

// Byte layout of a PQIE v1 file (see crypto.js). Lengths of the three
// variable-size blobs are read from the file itself.
function layout(f) {
  const v = new DataView(f.buffer, f.byteOffset, f.byteLength);
  let o = 0;
  const segs = [];
  const add = (group, n) => { segs.push({ group, start: o, len: n }); o += n; };
  add('head', 4 + 1 + (f[4] >= 2 ? 3 : 0) + 16); // magic, version, [scrypt params], salt
  add('key', 12 + 16);                 // wrap iv + tag
  const skLen = v.getUint32(o, true);
  add('key', 4 + skLen);               // length + wrapped secret key
  const ctLen = v.getUint32(o, true);
  add('kem', 4 + ctLen);               // length + ML-KEM ciphertext
  add('img', 12 + 16);                 // data iv + tag
  const dLen = v.getUint32(o, true);
  add('img', 4 + dLen);                // length + encrypted image
  return segs;
}

const GROUPS = {
  head: 'Header, scrypt settings and salt',
  key: 'Password-locked ML-KEM private key',
  kem: 'ML-KEM-768 ciphertext',
  img: 'AES-256-GCM encrypted image',
};

// A small sample "photo" drawn on a canvas and exported as PNG bytes.
async function sampleImage() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, '#f2b45a'); grad.addColorStop(1, '#3b5ba5');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(22, 22, 9, 0, Math.PI * 2); g.fill();
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

let sample = null;
let encrypted = null;

const fmt = (n) => n.toLocaleString('en-US');

function render(file, ms) {
  const segs = layout(file);
  const totals = {};
  for (const s of segs) totals[s.group] = (totals[s.group] || 0) + s.len;

  $('demo-size').textContent = `sample.enc · ${fmt(file.length)} bytes (image was ${fmt(sample.length)})`;
  $('demo-time').textContent = `encrypted in ${Math.round(ms)} ms`;

  $('demo-bar').innerHTML = Object.keys(GROUPS)
    .map((k) => `<div style="flex:${totals[k]};background:var(--seg-${k})" title="${GROUPS[k]}"></div>`).join('');
  $('demo-legend').innerHTML = Object.keys(GROUPS)
    .map((k) => `<li><i style="background:var(--seg-${k})"></i>${GROUPS[k]}<b>${fmt(totals[k])} B</b></li>`).join('');

  // Hex dump of the first 96 bytes, colored by segment.
  const groupAt = (i) => segs.find((s) => i >= s.start && i < s.start + s.len)?.group;
  const rows = [];
  for (let r = 0; r < 96; r += 16) {
    let line = `<span style="color:var(--text-faint)">${r.toString(16).padStart(4, '0')}</span>  `;
    for (let i = r; i < r + 16; i++) {
      line += `<span style="color:var(--seg-${groupAt(i)})">${file[i].toString(16).padStart(2, '0')}</span>${i % 16 === 7 ? '  ' : ' '}`;
    }
    rows.push(line);
  }
  rows.push(`<span style="color:var(--text-faint)">… ${fmt(file.length - 96)} more bytes</span>`);
  $('demo-hex').innerHTML = rows.join('\n');
}

runBtn.addEventListener('click', async () => {
  const pass = $('demo-pass').value;
  if (!pass) { $('demo-pass').focus(); return; }
  runBtn.disabled = true;
  runBtn.textContent = 'Encrypting…';
  try {
    sample ??= await sampleImage();
    const t0 = performance.now();
    encrypted = await encryptImage(sample, pass);
    render(encrypted, performance.now() - t0);
    out.hidden = false;
    $('demo-result').textContent = '';
    $('demo-result').className = 'lp-demo-result';
    $('demo-pass2').value = '';
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = 'Encrypt again';
  }
});

$('demo-dec').addEventListener('click', async () => {
  if (!encrypted) return;
  const res = $('demo-result');
  try {
    const t0 = performance.now();
    const plain = await decryptImage(encrypted, $('demo-pass2').value);
    const same = plain.length === sample.length && plain.every((b, i) => b === sample[i]);
    res.className = 'lp-demo-result ok';
    res.textContent = same
      ? `Decrypted in ${Math.round(performance.now() - t0)} ms. All ${fmt(plain.length)} bytes match the original image.`
      : 'Decrypted, but the bytes differ from the original.';
  } catch (e) {
    res.className = 'lp-demo-result err';
    res.textContent = e.message === 'Incorrect password'
      ? 'Wrong password. Without it, the private key stays locked and the image cannot be recovered.'
      : `Could not decrypt: ${e.message}`;
  }
});
