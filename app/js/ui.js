// Herramientas de interfaz compartidas por todas las pantallas.
// html`` escapa automáticamente todo lo que se interpola: así ningún texto
// escrito por el usuario puede convertirse en código dentro de la app.

const RAW = Symbol('raw');
export const raw = s => ({ [RAW]: String(s ?? '') });
export const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function val(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(val).join('');
  if (typeof v === 'object' && v[RAW] != null) return v[RAW];
  return esc(v);
}

export function html(strings, ...vals) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < vals.length) out += val(vals[i]);
  }
  return raw(out);
}

// La política de seguridad prohíbe estilos en línea; los anchos y colores
// dinámicos viajan en data-w / data-c y se aplican aquí con JavaScript.
const HEX = /^#[0-9a-f]{6}$/i;
export function aplicarEstilos(root) {
  root.querySelectorAll('[data-w]').forEach(n => {
    const w = Math.max(0, Math.min(100, Number(n.dataset.w) || 0));
    n.style.setProperty('--w', w + '%');
  });
  root.querySelectorAll('[data-c]').forEach(n => {
    if (HEX.test(n.dataset.c)) n.style.setProperty('--c', n.dataset.c);
  });
}

export function mount(el, tpl) {
  el.innerHTML = tpl[RAW];
  aplicarEstilos(el);
}

// ---------- formatos ----------
export const fmtQ = (n, dec = 2) =>
  (n < 0 ? '−Q' : 'Q') + Math.abs(Number(n) || 0).toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtN = (n, dec = 0) =>
  (Number(n) || 0).toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtPct = n => (Number.isFinite(n) ? (n * 100).toFixed(1) : '0.0') + '%';
export function fmtHoras(h) {
  const t = Math.round((Number(h) || 0) * 60);
  const hh = Math.floor(t / 60), mm = t % 60;
  if (!hh) return `${mm} min`;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fmtFecha(isoStr) {
  const [y, m, d] = String(isoStr).split('-').map(Number);
  return y ? `${d} ${MES[m - 1]} ${y}` : '';
}
export const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);

// ---------- avisos ----------
let toastTimer;
export function toast(msg, accion) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  mount(t, html`<span>${msg}</span>${accion ? html`<button type="button">${accion.texto}</button>` : ''}`);
  if (accion) t.querySelector('button').addEventListener('click', () => { t.classList.remove('on'); accion.fn(); });
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), accion ? 6500 : 2600);
}

// ---------- diálogos ----------
// Abre un formulario en una hoja inferior. Resuelve con los datos del formulario o null si se cancela.
export function abrirDialogo(tpl, { setup, validar } = {}) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'dlg';
    mount(d, tpl);
    document.body.append(d);
    const form = d.querySelector('form');
    let datos = null;
    form.addEventListener('submit', e => {
      if (e.submitter?.value !== 'ok') return;
      const fd = new FormData(form);
      const error = validar?.(fd);
      if (error) {
        e.preventDefault();
        const box = d.querySelector('.dlg-error');
        if (box) { box.textContent = error; box.hidden = false; }
        return;
      }
      datos = fd;
    });
    d.addEventListener('close', () => { d.remove(); resolve(datos); });
    d.addEventListener('click', e => { if (e.target === d) d.close(); }); // tocar afuera cierra
    setup?.(d);
    d.showModal();
  });
}

export async function confirmar(mensaje, { ok = 'Confirmar', peligro = false, detalle = '' } = {}) {
  const fd = await abrirDialogo(html`
    <form method="dialog">
      <h2>${mensaje}</h2>
      ${detalle ? html`<p class="dlg-detalle">${detalle}</p>` : ''}
      <div class="dlg-acciones">
        <button class="btn" value="cancel" formnovalidate>Cancelar</button>
        <button class="btn ${peligro ? 'btn-peligro' : 'btn-primario'}" value="ok">${ok}</button>
      </div>
    </form>`);
  return !!fd;
}

export function descargar(nombre, contenido, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function csv(filas) {
  const celda = v => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s; // evita fórmulas maliciosas al abrir en Excel
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '\ufeff' + filas.map(f => f.map(celda).join(',')).join('\n');
}

export function debounce(fn, ms = 300) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Barra de capas: muestra de qué está hecho un precio, capa por capa.
export function estrato(partes, total) {
  const vis = partes.filter(p => p.valor > 0.005);
  if (!vis.length || total <= 0) return html`<div class="estrato vacio"></div>`;
  return html`
    <div class="estrato" role="img" aria-label="Composición del precio">
      ${vis.map(p => html`<span class="capa ${p.clase}" data-w="${(p.valor / total) * 100}"></span>`)}
    </div>
    <ul class="estrato-ley">
      ${vis.map(p => html`<li><i class="capa ${p.clase}"></i>${p.nombre}<b>${fmtQ(p.valor)}</b></li>`)}
    </ul>`;
}
