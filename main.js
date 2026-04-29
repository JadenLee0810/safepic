import { encryptImage, decryptImage } from './crypto.js';

/* ---------------- DOM ---------------- */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const overlay = document.getElementById('overlay');
const octx = overlay.getContext('2d');
const wrap = document.getElementById('canvas-wrap');
const stage = document.getElementById('canvas-stage');
const center = document.getElementById('center');
const textInput = document.getElementById('text-input');
const dropHint = document.getElementById('drop-hint');
const landing = document.getElementById('landing');
const app = document.getElementById('app');

/* ---------------- State -------------- */
let tool = 'draw';
let color = '#ff3355';
let brushSize = 6;
let fontSize = 28;

let drawing = false;
let lastX = 0, lastY = 0;

let dragStart = null;
let dragRect = null;

let textPos = null;

let adj = { brightness: 0, contrast: 0, saturation: 0, hue: 0 };
let workImage = null;
let zoom = 1;

// Cumulative adjustment totals since image was loaded — survives flatten.
let cumulativeAdj = { brightness: 0, contrast: 0, saturation: 0, hue: 0 };

// Snapshot taken right before the first filter is applied.
// Reset whenever the user does something that should "bake in" prior edits.
let preFiltersImage = null;

/* ---------------- History ------------ */
const MAX_HISTORY = 40;
const history = [];
let historyIndex = -1;

function pushHistory() {
  if (!workImage) return;
  history.splice(historyIndex + 1);
  const copy = new ImageData(new Uint8ClampedArray(workImage.data), workImage.width, workImage.height);
  history.push({
    image: copy,
    w: canvas.width,
    h: canvas.height,
    cumulative: { ...cumulativeAdj },
  });
  if (history.length > MAX_HISTORY) history.shift();
  historyIndex = history.length - 1;
}
function undo() { if (historyIndex > 0) { historyIndex--; restore(); } }
function redo() { if (historyIndex < history.length - 1) { historyIndex++; restore(); } }
function restore() {
  const s = history[historyIndex];
  setCanvasSize(s.w, s.h);
  workImage = new ImageData(new Uint8ClampedArray(s.image.data), s.image.width, s.image.height);
  cumulativeAdj = { ...s.cumulative };
  resetAdjSliders();
  render();
  updateAdjBadges();
}

/* ---------------- Canvas helpers ----- */
function setCanvasSize(w, h) {
  canvas.width = w; canvas.height = h;
  overlay.width = w; overlay.height = h;
  wrap.style.width = w + 'px';
  wrap.style.height = h + 'px';
  applyZoom();
}
function filterString() {
  const b = 1 + adj.brightness / 100;
  const c = 1 + adj.contrast   / 100;
  const s = 1 + adj.saturation / 100;
  return `brightness(${b}) contrast(${c}) saturate(${s}) hue-rotate(${adj.hue}deg)`;
}
function render() {
  if (!workImage) return;
  const tmp = document.createElement('canvas');
  tmp.width = workImage.width; tmp.height = workImage.height;
  tmp.getContext('2d').putImageData(workImage, 0, 0);
  ctx.save();
  ctx.filter = filterString();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}
function commitVisibleToWork() {
  workImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
}
function adjIsIdentity() {
  return adj.brightness === 0 && adj.contrast === 0 && adj.saturation === 0 && adj.hue === 0;
}
function flattenAdj() {
  if (adjIsIdentity()) return;
  // Bake the current slider values into the workImage AND add them to the cumulative total.
  for (const k of ['brightness','contrast','saturation','hue']) {
    cumulativeAdj[k] += adj[k];
  }
  commitVisibleToWork();
  resetAdjSliders();
  updateAdjBadges();
}
function resetAdjSliders() {
  adj = { brightness: 0, contrast: 0, saturation: 0, hue: 0 };
  for (const k of ['brightness','contrast','saturation','hue']) {
    document.getElementById(`adj-${k}`).value = 0;
    document.getElementById(`adj-${k}-val`).textContent = '0';
  }
}

/* ---------------- Adjustment badges -- */
function fmtSigned(n) {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : `${n}`;
}
function updateAdjBadges() {
  const map = { brightness: 'B', contrast: 'C', saturation: 'S', hue: 'H' };
  for (const [k, _] of Object.entries(map)) {
    // Live preview: cumulative + current uncommitted slider value
    const live = cumulativeAdj[k] + adj[k];
    const el = document.getElementById(`badge-${k}`);
    if (!el) continue;
    el.querySelector('em').textContent = fmtSigned(live);
    el.classList.toggle('nonzero', live !== 0);
  }
}

/* ---------------- Zoom --------------- */
function applyZoom() {
  wrap.style.transform = `scale(${zoom})`;
  stage.style.width = (canvas.width * zoom) + 'px';
  stage.style.height = (canvas.height * zoom) + 'px';
  const lvl = document.getElementById('zoom-level');
  if (lvl) lvl.textContent = Math.round(zoom * 100) + '%';
}
function setZoom(newZoom, anchorClientX, anchorClientY) {
  newZoom = Math.max(0.1, Math.min(8, newZoom));
  if (Math.abs(newZoom - zoom) < 0.001) return;
  let imgX = null, imgY = null;
  if (anchorClientX != null) {
    const r = stage.getBoundingClientRect();
    imgX = (anchorClientX - r.left) / zoom;
    imgY = (anchorClientY - r.top) / zoom;
  }
  zoom = newZoom;
  applyZoom();
  if (imgX != null) {
    const r = stage.getBoundingClientRect();
    const dx = r.left + imgX * zoom - anchorClientX;
    const dy = r.top + imgY * zoom - anchorClientY;
    center.scrollLeft += dx;
    center.scrollTop += dy;
  }
}
function fitZoom() {
  const r = center.getBoundingClientRect();
  const pad = 80;
  const fz = Math.min((r.width - pad) / canvas.width, (r.height - pad) / canvas.height, 1);
  setZoom(Math.max(fz, 0.1));
}

document.getElementById('zoom-in').addEventListener('click', () => setZoom(zoom * 1.25));
document.getElementById('zoom-out').addEventListener('click', () => setZoom(zoom / 1.25));
document.getElementById('zoom-level').addEventListener('click', () => setZoom(1));
document.getElementById('zoom-fit').addEventListener('click', fitZoom);

center.addEventListener('wheel', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  setZoom(zoom * factor, e.clientX, e.clientY);
}, { passive: false });

/* ---------------- Panel toggles ------ */
function applyPanelState(name, collapsed) {
  app.classList.toggle(name + '-collapsed', collapsed);
  try { localStorage.setItem('safepic-panel-' + name, collapsed ? '1' : '0'); } catch {}
}
const sidebarSaved = (() => { try { return localStorage.getItem('safepic-panel-sidebar') === '1'; } catch { return false; } })();
const rightSaved = (() => { try { return localStorage.getItem('safepic-panel-right') === '1'; } catch { return false; } })();
if (sidebarSaved) app.classList.add('sidebar-collapsed');
if (rightSaved) app.classList.add('right-collapsed');

document.getElementById('sidebar-toggle').addEventListener('click', () => {
  applyPanelState('sidebar', !app.classList.contains('sidebar-collapsed'));
});
document.getElementById('right-toggle').addEventListener('click', () => {
  applyPanelState('right', !app.classList.contains('right-collapsed'));
});

/* ---------------- Collapsible right-panel sections ------ */
const SECTION_STATE_KEY = 'safepic-section-collapsed';
function loadSectionState() {
  try { const raw = localStorage.getItem(SECTION_STATE_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function saveSectionState(state) {
  try { localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(state)); } catch {}
}
const savedSec = loadSectionState();
const sectionState = savedSec || {};
document.querySelectorAll('.panel-section').forEach(sec => {
  const id = sec.dataset.section;
  if (savedSec) sec.classList.toggle('collapsed', !!savedSec[id]);
  const head = sec.querySelector('.section-head');
  head.addEventListener('click', (e) => {
    // Don't collapse when clicking on the badges.
    if (e.target.closest('.adj-badges')) return;
    sec.classList.toggle('collapsed');
    sectionState[id] = sec.classList.contains('collapsed');
    saveSectionState(sectionState);
  });
});

/* ---------------- Theme -------------- */
function applyTheme(name) {
  document.body.dataset.theme = name;
  try { localStorage.setItem('safepic-theme', name); } catch {}
}
const savedTheme = (() => { try { return localStorage.getItem('safepic-theme'); } catch { return null; } })();
applyTheme(savedTheme || 'dark-gold');

const themeBtn = document.getElementById('btn-theme');
const themePopover = document.getElementById('theme-popover');
themeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  themePopover.classList.toggle('hidden');
});
document.querySelectorAll('.theme-option').forEach(opt => {
  opt.addEventListener('click', (e) => {
    e.stopPropagation();
    applyTheme(opt.dataset.theme);
    themePopover.classList.add('hidden');
  });
});
document.addEventListener('click', () => { themePopover.classList.add('hidden'); });

/* ---------------- Landing screen ---- */
function hideLanding() { landing.classList.add('hidden'); }

document.getElementById('land-open').addEventListener('click', () => { hideLanding(); openFile(); });
document.getElementById('land-open-enc').addEventListener('click', () => { hideLanding(); openEncrypted(); });
document.getElementById('land-new').addEventListener('click', () => { hideLanding(); blankStart(); });

/* ---------------- Load / blank ------- */
async function loadFromBuffer(buf, mime) {
  const blob = new Blob([buf], { type: mime || 'image/png' });
  const url = URL.createObjectURL(blob);
  const img = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = url;
  });
  setCanvasSize(img.naturalWidth, img.naturalHeight);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  commitVisibleToWork();
  URL.revokeObjectURL(url);
  resetAdjSliders();
  cumulativeAdj = { brightness: 0, contrast: 0, saturation: 0, hue: 0 };
  preFiltersImage = null;
  history.length = 0; historyIndex = -1;
  pushHistory();
  dropHint.style.display = 'none';
  render();
  updateAdjBadges();
  setTimeout(fitZoom, 0);
}
function blankStart() {
  setCanvasSize(800, 600);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  commitVisibleToWork();
  cumulativeAdj = { brightness: 0, contrast: 0, saturation: 0, hue: 0 };
  preFiltersImage = null;
  pushHistory();
  zoom = 1;
  applyZoom();
  dropHint.style.display = 'none';
  updateAdjBadges();
}

/* ---------------- Tools -------------- */
function getCoords(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}
function onDown(e) {
  const { x, y } = getCoords(e);
  if (tool === 'draw' || tool === 'erase') {
    flattenAdj();
    bakeFiltersIntoBaseline();
    drawing = true; lastX = x; lastY = y;
    stroke(x, y, x, y);
  } else if (tool === 'fill') {
    flattenAdj();
    bakeFiltersIntoBaseline();
    floodFill(Math.floor(x), Math.floor(y));
    commitVisibleToWork();
    pushHistory();
  } else if (tool === 'crop' || tool === 'redact') {
    dragStart = { x, y }; dragRect = null;
  } else if (tool === 'text') {
    flattenAdj();
    bakeFiltersIntoBaseline();
    openTextInput(x, y);
  }
}
function onMove(e) {
  const { x, y } = getCoords(e);
  if (drawing) {
    stroke(lastX, lastY, x, y);
    lastX = x; lastY = y;
  } else if ((tool === 'crop' || tool === 'redact') && dragStart) {
    const x1 = Math.max(0, Math.min(canvas.width,  Math.min(dragStart.x, x)));
    const y1 = Math.max(0, Math.min(canvas.height, Math.min(dragStart.y, y)));
    const x2 = Math.max(0, Math.min(canvas.width,  Math.max(dragStart.x, x)));
    const y2 = Math.max(0, Math.min(canvas.height, Math.max(dragStart.y, y)));
    dragRect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    drawOverlay();
  }
}
function onUp() {
  if (drawing) {
    drawing = false;
    commitVisibleToWork();
    pushHistory();
  } else if ((tool === 'crop' || tool === 'redact') && dragRect && dragRect.w >= 2 && dragRect.h >= 2) {
    if (tool === 'crop') {
      applyCrop(dragRect);
    } else {
      applyRedact(dragRect);
    }
    dragRect = null; dragStart = null; drawOverlay();
  } else {
    dragStart = null;
  }
}
function stroke(x1, y1, x2, y2) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = brushSize;
  if (tool === 'erase') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
  }
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}
function drawOverlay() {
  octx.clearRect(0, 0, overlay.width, overlay.height);
  if (!dragRect) return;
  octx.save();
  if (tool === 'crop') {
    octx.fillStyle = 'rgba(0,0,0,0.4)';
    octx.fillRect(0, 0, overlay.width, overlay.height);
    octx.clearRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h);
    octx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent') || '#f0c350';
    octx.setLineDash([6, 4]);
    octx.strokeRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h);
  } else if (tool === 'redact') {
    octx.fillStyle = 'rgba(0,0,0,0.85)';
    octx.fillRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h);
    octx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent') || '#f0c350';
    octx.setLineDash([4, 3]);
    octx.strokeRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h);
  }
  octx.restore();
}

/* ---------------- Pre-filter snapshot -- */
function bakeFiltersIntoBaseline() {
  // Called when the user does any non-filter destructive action.
  // Forces the next filter to use the current image as its undo baseline,
  // so that "Clear all filters" only reverts the new filter chain, not the drawings.
  preFiltersImage = null;
}

/* ---------------- Flood fill --------- */
function floodFill(sx, sy) {
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = id.data, w = id.width, h = id.height;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const idx = (sy * w + sx) * 4;
  const target = [d[idx], d[idx+1], d[idx+2], d[idx+3]];
  const rgb = hexToRgb(color);
  const fill = [rgb.r, rgb.g, rgb.b, 255];
  if (pxEq(target, fill, 0)) return;
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = (y * w + x) * 4;
    if (!pxEq([d[i], d[i+1], d[i+2], d[i+3]], target, 16)) continue;
    d[i] = fill[0]; d[i+1] = fill[1]; d[i+2] = fill[2]; d[i+3] = 255;
    stack.push([x+1, y]); stack.push([x-1, y]);
    stack.push([x, y+1]); stack.push([x, y-1]);
  }
  ctx.putImageData(id, 0, 0);
}
function pxEq(a, b, tol) {
  return Math.abs(a[0]-b[0]) <= tol && Math.abs(a[1]-b[1]) <= tol &&
         Math.abs(a[2]-b[2]) <= tol && Math.abs(a[3]-b[3]) <= tol;
}
function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0;
  return { r: (n>>16)&255, g: (n>>8)&255, b: n&255 };
}

/* ---------------- Text tool ---------- */
function openTextInput(x, y) {
  textPos = { x, y };
  textInput.style.display = 'block';
  textInput.style.left = x + 'px';
  textInput.style.top  = (y - fontSize) + 'px';
  textInput.style.color = color;
  textInput.style.fontSize = fontSize + 'px';
  textInput.value = '';
  setTimeout(() => textInput.focus(), 0);
}
function commitText() {
  const v = textInput.value;
  if (v && textPos) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(v, textPos.x, textPos.y);
    ctx.restore();
    commitVisibleToWork();
    pushHistory();
  }
  closeTextInput();
}
function closeTextInput() {
  textInput.style.display = 'none'; textInput.value = ''; textPos = null;
}
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { commitText(); e.preventDefault(); }
  else if (e.key === 'Escape') closeTextInput();
});
textInput.addEventListener('blur', () => {
  if (textInput.value) commitText(); else closeTextInput();
});

/* ---------------- Geometry ----------- */
function applyCrop(rect) {
  flattenAdj();
  bakeFiltersIntoBaseline();
  const sx = Math.round(rect.x), sy = Math.round(rect.y);
  const sw = Math.round(rect.w), sh = Math.round(rect.h);
  const cropped = ctx.getImageData(sx, sy, sw, sh);
  setCanvasSize(sw, sh);
  ctx.putImageData(cropped, 0, 0);
  commitVisibleToWork();
  pushHistory();
  render();
}
function applyRedact(rect) {
  flattenAdj();
  bakeFiltersIntoBaseline();
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(rect.x), Math.round(rect.y), Math.round(rect.w), Math.round(rect.h));
  ctx.restore();
  commitVisibleToWork();
  pushHistory();
  render();
}
function resizeCanvasTo(w, h) {
  flattenAdj();
  bakeFiltersIntoBaseline();
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  tmp.getContext('2d').putImageData(workImage, 0, 0);
  setCanvasSize(w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tmp, 0, 0, w, h);
  commitVisibleToWork();
  pushHistory();
  render();
}
function rotate90(cw) {
  flattenAdj();
  bakeFiltersIntoBaseline();
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  tmp.getContext('2d').putImageData(workImage, 0, 0);
  const nw = canvas.height, nh = canvas.width;
  setCanvasSize(nw, nh);
  ctx.save();
  ctx.translate(nw / 2, nh / 2);
  ctx.rotate(cw ? Math.PI / 2 : -Math.PI / 2);
  ctx.drawImage(tmp, -tmp.width / 2, -tmp.height / 2);
  ctx.restore();
  commitVisibleToWork();
  pushHistory();
  render();
}
function flip(horizontal) {
  flattenAdj();
  bakeFiltersIntoBaseline();
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  tmp.getContext('2d').putImageData(workImage, 0, 0);
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (horizontal) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  else            { ctx.translate(0, canvas.height); ctx.scale(1, -1); }
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
  commitVisibleToWork();
  pushHistory();
  render();
}

/* ---------------- Preset filters ----- */
function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
function applyPreset(name) {
  if (!workImage) return;
  flattenAdj();
  // Snapshot the current state just before we apply this filter, but only
  // if no filter chain is in progress yet (so that subsequent filters all
  // revert to the same pre-filter baseline when "Clear all filters" is hit).
  if (!preFiltersImage) {
    preFiltersImage = new ImageData(
      new Uint8ClampedArray(workImage.data),
      workImage.width,
      workImage.height,
    );
  }
  const id = new ImageData(new Uint8ClampedArray(workImage.data), workImage.width, workImage.height);
  const d = id.data;
  switch (name) {
    case 'grayscale':
      for (let i=0;i<d.length;i+=4) {
        const v = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
        d[i]=d[i+1]=d[i+2]=v;
      }
      break;
    case 'sepia':
      for (let i=0;i<d.length;i+=4) {
        const r=d[i], g=d[i+1], b=d[i+2];
        d[i]   = clamp(0.393*r + 0.769*g + 0.189*b);
        d[i+1] = clamp(0.349*r + 0.686*g + 0.168*b);
        d[i+2] = clamp(0.272*r + 0.534*g + 0.131*b);
      }
      break;
    case 'invert':
      for (let i=0;i<d.length;i+=4) { d[i]=255-d[i]; d[i+1]=255-d[i+1]; d[i+2]=255-d[i+2]; }
      break;
    case 'vivid':
      for (let i=0;i<d.length;i+=4) {
        const r=d[i], g=d[i+1], b=d[i+2], avg=(r+g+b)/3;
        d[i]   = clamp(avg + (r-avg)*1.6);
        d[i+1] = clamp(avg + (g-avg)*1.6);
        d[i+2] = clamp(avg + (b-avg)*1.6);
      }
      break;
    case 'cool':
      for (let i=0;i<d.length;i+=4) { d[i]=clamp(d[i]-15); d[i+2]=clamp(d[i+2]+25); }
      break;
    case 'warm':
      for (let i=0;i<d.length;i+=4) { d[i]=clamp(d[i]+25); d[i+1]=clamp(d[i+1]+10); d[i+2]=clamp(d[i+2]-15); }
      break;
    case 'fade':
      for (let i=0;i<d.length;i+=4) {
        d[i]   = clamp(d[i]  *0.85 + 40);
        d[i+1] = clamp(d[i+1]*0.85 + 40);
        d[i+2] = clamp(d[i+2]*0.85 + 40);
      }
      break;
    case 'grainy':
      for (let i=0;i<d.length;i+=4) {
        // Monochromatic grain: same offset added to R, G, B for film-like look.
        // Range ±28 gives a clearly visible but not destructive grain.
        const noise = (Math.random() - 0.5) * 56;
        d[i]   = clamp(d[i]   + noise);
        d[i+1] = clamp(d[i+1] + noise);
        d[i+2] = clamp(d[i+2] + noise);
      }
      break;
  }
  workImage = id;
  pushHistory();
  render();
}

function clearAllFilters() {
  if (!preFiltersImage) return;
  flattenAdj();
  // Restore canvas to the snapshot taken before any filters were applied this round.
  if (preFiltersImage.width !== canvas.width || preFiltersImage.height !== canvas.height) {
    setCanvasSize(preFiltersImage.width, preFiltersImage.height);
  }
  workImage = new ImageData(
    new Uint8ClampedArray(preFiltersImage.data),
    preFiltersImage.width,
    preFiltersImage.height,
  );
  preFiltersImage = null;
  pushHistory();
  render();
}

/* ---------------- AI bg removal ------ */
let bgRemoveFn = null;
async function removeBg() {
  if (!workImage) return;
  showLoading('Loading model… (first run only)');
  try {
    if (!bgRemoveFn) {
      const mod = await import('@imgly/background-removal');
      bgRemoveFn = mod.removeBackground || mod.default;
    }
    showLoading('Removing background…');
    flattenAdj();
    bakeFiltersIntoBaseline();
    const inBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const outBlob = await bgRemoveFn(inBlob, { output: { format: 'image/png' } });
    const buf = new Uint8Array(await outBlob.arrayBuffer());
    await loadFromBufferKeepCumulative(buf, 'image/png');
  } catch (e) {
    console.error(e);
    alert('Background removal failed: ' + (e.message || e));
  } finally {
    hideLoading();
  }
}
async function loadFromBufferKeepCumulative(buf, mime) {
  // Replace the canvas content but keep the cumulative adjustment counter.
  const blob = new Blob([buf], { type: mime || 'image/png' });
  const url = URL.createObjectURL(blob);
  const img = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = url;
  });
  setCanvasSize(img.naturalWidth, img.naturalHeight);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  commitVisibleToWork();
  URL.revokeObjectURL(url);
  resetAdjSliders();
  preFiltersImage = null;
  pushHistory();
  render();
  updateAdjBadges();
  setTimeout(fitZoom, 0);
}
function showLoading(t) { document.getElementById('loading-text').textContent = t || 'Working…'; document.getElementById('loading').classList.add('on'); }
function hideLoading() { document.getElementById('loading').classList.remove('on'); }

/* ---------------- File I/O ----------- */
function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.onchange = () => resolve(inp.files[0] || null);
    inp.click();
  });
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function guessMime(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp' }[ext] || 'image/png';
}

async function openFile() {
  const f = await pickFile('image/png,image/jpeg,image/gif,image/webp');
  if (!f) return;
  const buf = new Uint8Array(await f.arrayBuffer());
  await loadFromBuffer(buf, f.type || guessMime(f.name));
}
async function openEncrypted() {
  const f = await pickFile('.enc');
  if (!f) return;
  const pw = await promptPassword('Password for encrypted file');
  if (pw == null) return;
  showLoading('Decrypting…');
  try {
    const buf = new Uint8Array(await f.arrayBuffer());
    const plain = await decryptImage(buf, pw);
    hideLoading();
    await loadFromBuffer(plain);
  } catch (e) {
    hideLoading();
    alert('Could not decrypt: ' + e.message);
  }
}

async function saveFile() {
  if (!workImage) return;
  flattenAdj(); render();
  const choice = await promptSave();
  if (!choice) return;
  const mime = choice.format === 'jpg' ? 'image/jpeg' : 'image/png';
  const quality = choice.format === 'jpg' ? 0.92 : undefined;
  const blob = await new Promise(r => canvas.toBlob(r, mime, quality));
  downloadBlob(blob, `${choice.name}.${choice.format}`);
}
async function saveEncrypted() {
  if (!workImage) return;
  const pw = await promptPassword('Set a password for this .enc file');
  if (pw == null) return;
  flattenAdj(); render();
  showLoading('Encrypting…');
  try {
    const pngBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const png = new Uint8Array(await pngBlob.arrayBuffer());
    const encrypted = await encryptImage(png, pw);
    downloadBlob(new Blob([encrypted], { type: 'application/octet-stream' }), 'safepic-encrypted.enc');
  } catch (e) {
    alert('Encryption failed: ' + e.message);
  } finally {
    hideLoading();
  }
}

/* ---------------- Modals ------------- */
function promptPassword(title) {
  return new Promise((resolve) => {
    const m = document.getElementById('password-modal');
    document.getElementById('password-title').textContent = title;
    const inp = document.getElementById('password-input');
    const err = document.getElementById('password-err');
    const ok = document.getElementById('password-ok');
    const cancel = document.getElementById('password-cancel');
    inp.value = ''; err.classList.add('hidden');
    m.classList.remove('hidden');
    setTimeout(() => inp.focus(), 0);
    const done = (v) => { m.classList.add('hidden'); ok.onclick = cancel.onclick = inp.onkeydown = null; resolve(v); };
    ok.onclick = () => { if (inp.value) done(inp.value); };
    cancel.onclick = () => done(null);
    inp.onkeydown = (e) => { if (e.key === 'Enter') ok.onclick(); else if (e.key === 'Escape') cancel.onclick(); };
  });
}
function promptResize() {
  return new Promise((resolve) => {
    const m = document.getElementById('resize-modal');
    const w = document.getElementById('resize-w');
    const h = document.getElementById('resize-h');
    const ok = document.getElementById('resize-ok');
    const cancel = document.getElementById('resize-cancel');
    w.value = canvas.width; h.value = canvas.height;
    m.classList.remove('hidden');
    const done = (v) => { m.classList.add('hidden'); ok.onclick = cancel.onclick = null; resolve(v); };
    ok.onclick = () => {
      const nw = parseInt(w.value), nh = parseInt(h.value);
      if (!nw || !nh || nw < 1 || nh < 1) return;
      done({ w: nw, h: nh });
    };
    cancel.onclick = () => done(null);
  });
}
function promptSave() {
  return new Promise((resolve) => {
    const m = document.getElementById('save-modal');
    const nameInp = document.getElementById('save-name');
    let format = 'png';
    document.querySelectorAll('.save-fmt-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.format === 'png');
      b.onclick = () => {
        format = b.dataset.format;
        document.querySelectorAll('.save-fmt-btn').forEach(x =>
          x.classList.toggle('active', x === b));
      };
    });
    m.classList.remove('hidden');
    const ok = document.getElementById('save-ok');
    const cancel = document.getElementById('save-cancel');
    const done = (v) => { m.classList.add('hidden'); ok.onclick = cancel.onclick = null; resolve(v); };
    ok.onclick = () => done({ format, name: nameInp.value || 'safepic-export' });
    cancel.onclick = () => done(null);
  });
}

/* ---------------- Compress & Save ---- */
let compressFormat = 'jpg';
let compressQuality = 0.85;
let compressDebounce = null;
let pngBaselineSize = 0;
let lastCompressBlob = null;

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

async function openCompressModal() {
  if (!workImage) return;
  flattenAdj(); render();

  compressFormat = 'jpg';
  compressQuality = 0.85;
  document.querySelectorAll('.format-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.format === 'jpg'));
  document.getElementById('quality-slider').value = 85;
  document.getElementById('quality-val').textContent = '85';
  document.getElementById('quality-row').classList.remove('disabled');
  document.getElementById('size-estimate').textContent = '—';
  document.getElementById('size-compare').textContent = 'Calculating…';
  document.getElementById('compress-name').value = 'safepic-compressed';

  document.getElementById('compress-modal').classList.remove('hidden');

  const pngBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  pngBaselineSize = pngBlob.size;
  updateCompressEstimate();
}

function updateCompressEstimate() {
  if (compressDebounce) clearTimeout(compressDebounce);
  compressDebounce = setTimeout(async () => {
    const mime = `image/${compressFormat === 'jpg' ? 'jpeg' : compressFormat}`;
    const q = compressFormat === 'png' ? undefined : compressQuality;
    const blob = await new Promise(r => canvas.toBlob(r, mime, q));
    lastCompressBlob = blob;
    document.getElementById('size-estimate').textContent = fmtBytes(blob.size);

    if (compressFormat === 'png') {
      document.getElementById('size-compare').textContent = 'PNG is lossless';
    } else if (pngBaselineSize > 0) {
      const pct = Math.round((1 - blob.size / pngBaselineSize) * 100);
      const ref = `lossless PNG (${fmtBytes(pngBaselineSize)})`;
      document.getElementById('size-compare').textContent =
        pct >= 0 ? `${pct}% smaller than ${ref}` : `${-pct}% larger than ${ref}`;
    }
  }, 120);
}

document.querySelectorAll('.format-btn').forEach(b => {
  b.addEventListener('click', () => {
    compressFormat = b.dataset.format;
    document.querySelectorAll('.format-btn').forEach(x =>
      x.classList.toggle('active', x === b));
    document.getElementById('quality-row').classList
      .toggle('disabled', compressFormat === 'png');
    updateCompressEstimate();
  });
});

document.getElementById('quality-slider').addEventListener('input', e => {
  compressQuality = +e.target.value / 100;
  document.getElementById('quality-val').textContent = e.target.value;
  updateCompressEstimate();
});

document.getElementById('compress-cancel').addEventListener('click', () => {
  document.getElementById('compress-modal').classList.add('hidden');
});

document.getElementById('compress-ok').addEventListener('click', async () => {
  if (!lastCompressBlob) return;
  const name = document.getElementById('compress-name').value || 'safepic-compressed';
  downloadBlob(lastCompressBlob, `${name}.${compressFormat}`);
  document.getElementById('compress-modal').classList.add('hidden');
});

document.getElementById('btn-compress').addEventListener('click', openCompressModal);

/* ---------------- Wire up ------------ */
function setTool(name) {
  tool = name;
  document.querySelectorAll('#sidebar .tool').forEach(b => b.classList.toggle('active', b.dataset.tool === name));
  dragRect = null; dragStart = null; drawOverlay();
  closeTextInput();
}
document.querySelectorAll('#sidebar .tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

document.getElementById('opt-color').addEventListener('input', e => {
  color = e.target.value;
  syncColorPresets();
});

function syncColorPresets() {
  document.querySelectorAll('.color-presets .swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color.toLowerCase() === color.toLowerCase());
  });
}
document.querySelectorAll('.color-presets .swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    color = sw.dataset.color;
    document.getElementById('opt-color').value = color;
    syncColorPresets();
  });
});
syncColorPresets();
document.getElementById('opt-size').addEventListener('input', e => { brushSize = +e.target.value; document.getElementById('opt-size-val').textContent = e.target.value; });
document.getElementById('opt-font').addEventListener('input', e => { fontSize = +e.target.value; document.getElementById('opt-font-val').textContent = e.target.value; });

['brightness','contrast','saturation','hue'].forEach(k => {
  const el = document.getElementById(`adj-${k}`);
  const val = document.getElementById(`adj-${k}-val`);
  el.addEventListener('input', () => {
    adj[k] = +el.value; val.textContent = el.value; render();
    updateAdjBadges();
  });
});

document.getElementById('btn-flatten').addEventListener('click', () => {
  if (!workImage) return;
  if (adjIsIdentity()) return;
  flattenAdj();
  pushHistory();
  render();
});
document.getElementById('btn-reset-adj').addEventListener('click', () => {
  resetAdjSliders();
  render();
  updateAdjBadges();
});

document.querySelectorAll('.filters button[data-filter]').forEach(b =>
  b.addEventListener('click', () => applyPreset(b.dataset.filter)));

document.getElementById('btn-clear-filters').addEventListener('click', clearAllFilters);

document.getElementById('btn-remove-bg').addEventListener('click', removeBg);
document.getElementById('btn-clear').addEventListener('click', () => {
  flattenAdj();
  bakeFiltersIntoBaseline();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  commitVisibleToWork(); pushHistory();
});

document.getElementById('btn-open').addEventListener('click', () => { hideLanding(); openFile(); });
document.getElementById('btn-open-enc').addEventListener('click', () => { hideLanding(); openEncrypted(); });
document.getElementById('btn-save').addEventListener('click', saveFile);
document.getElementById('btn-save-enc').addEventListener('click', saveEncrypted);

document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);
document.getElementById('btn-rot-l').addEventListener('click', () => rotate90(false));
document.getElementById('btn-rot-r').addEventListener('click', () => rotate90(true));
document.getElementById('btn-flip-h').addEventListener('click', () => flip(true));
document.getElementById('btn-flip-v').addEventListener('click', () => flip(false));
document.getElementById('btn-resize').addEventListener('click', async () => {
  const r = await promptResize();
  if (r) resizeCanvasTo(r.w, r.h);
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { undo(); e.preventDefault(); }
  else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { redo(); e.preventDefault(); }
  else if (mod && (e.key === '=' || e.key === '+')) { setZoom(zoom * 1.25); e.preventDefault(); }
  else if (mod && e.key === '-') { setZoom(zoom / 1.25); e.preventDefault(); }
  else if (mod && e.key === '0') { setZoom(1); e.preventDefault(); }
});

canvas.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', (e) => {
  if (drawing || ((tool === 'crop' || tool === 'redact') && dragStart)) onMove(e);
});
window.addEventListener('mouseup', onUp);

window.addEventListener('dragover', e => { e.preventDefault(); });
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  hideLanding();
  const f = e.dataTransfer.files[0];
  if (!f) return;
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (ext === 'enc') {
    const pw = await promptPassword('Password for encrypted file');
    if (pw == null) return;
    showLoading('Decrypting…');
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const plain = await decryptImage(buf, pw);
      hideLoading();
      await loadFromBuffer(plain);
    } catch (err) {
      hideLoading();
      alert('Could not decrypt: ' + err.message);
    }
  } else if (['png','jpg','jpeg','gif','webp'].includes(ext)) {
    const buf = new Uint8Array(await f.arrayBuffer());
    await loadFromBuffer(buf, f.type || guessMime(f.name));
  }
});

// Initial UI sync
updateAdjBadges();