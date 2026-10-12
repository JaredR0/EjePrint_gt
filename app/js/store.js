// Capa de datos. Todo vive en el teléfono (localStorage); nada sale a internet.
// Si algún día querés cambiar a IndexedDB o a una nube, solo se toca este archivo.

import { SCHEMA, defaultState, defaultSettings, hoyISO, MATERIALES, ESTADOS } from './defaults.js';

const KEY = 'ejeprint.taller.datos';
const MAX_IMPORT = 5 * 1024 * 1024; // 5 MB

let state = null;

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// ---------- saneadores: todo lo que entra a los datos pasa por aquí ----------
const S = (v, max = 120) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max).trim();
const N = (v, d = 0, min = -1e9, max = 1e9) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const B = v => v === true;
const FECHA = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : hoyISO());
const HEX = v => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : '#888888');
const ID = v => S(v, 64) || uid();
const ARR = v => (Array.isArray(v) ? v : []);

function lista(v, fn, max = 5000) { return ARR(v).slice(0, max).map(fn).filter(Boolean); }

const impresora = o => o && ({
  id: ID(o.id), nombre: S(o.nombre) || 'Impresora',
  precio: N(o.precio, 0, 0), vida: N(o.vida, 4000, 1), mantAnual: N(o.mantAnual, 0, 0),
  horasAnio: N(o.horasAnio, 1200, 1), kwh: N(o.kwh, 0.15, 0, 10)
});

const filamento = o => {
  if (!o) return null;
  const pesoNeto = N(o.pesoNeto, 1000, 1, 100000);
  return {
    id: ID(o.id), marca: S(o.marca, 60), material: MATERIALES.includes(o.material) ? o.material : S(o.material, 30) || 'PLA',
    color: S(o.color, 40) || 'Sin nombre', hex: HEX(o.hex), costo: N(o.costo, 0, 0),
    pesoNeto, restante: N(o.restante, pesoNeto, 0, pesoNeto), fecha: FECHA(o.fecha), archivado: B(o.archivado)
  };
};

const linea = o => o && ({
  filamentoId: S(o.filamentoId, 64), nombre: S(o.nombre, 80), hex: HEX(o.hex),
  gramos: N(o.gramos, 0, 0), costoG: N(o.costoG, 0, 0)
});

const venta = o => {
  if (!o) return null;
  const c = o.costos || {};
  return {
    id: ID(o.id), fecha: FECHA(o.fecha), cliente: S(o.cliente, 80), canal: S(o.canal, 40),
    producto: S(o.producto, 120) || 'Trabajo sin nombre', impresoraId: S(o.impresoraId, 64), impresoraNombre: S(o.impresoraNombre, 80),
    horas: N(o.horas, 0, 0), piezas: Math.round(N(o.piezas, 1, 1, 100000)),
    materiales: lista(o.materiales, linea, 20),
    postMin: N(o.postMin, 0, 0), disenoH: N(o.disenoH, 0, 0),
    tarifaNombre: S(o.tarifaNombre, 40), tarifaValor: N(o.tarifaValor, 0, 0),
    multNombre: S(o.multNombre, 60), multValor: N(o.multValor, 1, 0),
    costos: {
      material: N(c.material), maquina: N(c.maquina), post: N(c.post), diseno: N(c.diseno),
      empaque: N(c.empaque), total: N(c.total), dep: N(c.dep),
      luz: c.luz === undefined ? null : N(c.luz, 0, 0), kwh: N(c.kwh, 0, 0)
    },
    sugerido: N(o.sugerido, 0, 0), precio: N(o.precio, 0, 0),
    estado: ESTADOS.includes(o.estado) ? o.estado : 'Entregado',
    descontado: B(o.descontado), nota: S(o.nota, 300)
  };
};

const gasto = o => o && ({
  id: ID(o.id), fecha: FECHA(o.fecha), categoria: S(o.categoria, 40) || 'Otro',
  descripcion: S(o.descripcion, 160), monto: N(o.monto, 0, 0)
});

const itemValor = o => o && ({ id: ID(o.id), nombre: S(o.nombre, 60) || 'Sin nombre', valor: N(o.valor, 0, 0) });
const itemPct = o => o && ({ id: ID(o.id), nombre: S(o.nombre, 60) || 'Sin nombre', pct: N(o.pct, 0, 0, 1) });

const conLuz = l => (l.includes('Luz') ? l : ['Luz', ...l]);

function settings(raw) {
  const d = defaultSettings();
  const s = raw && typeof raw === 'object' ? raw : {};
  const listaNoVacia = (v, fn, def) => { const l = lista(v, fn, 50); return l.length ? l : def; };
  return {
    tarifaLuz: N(s.tarifaLuz, d.tarifaLuz, 0, 100),
    factorFallos: N(s.factorFallos, d.factorFallos, 1, 3),
    costoGramoDefault: N(s.costoGramoDefault, d.costoGramoDefault, 0, 100),
    postHora: N(s.postHora, d.postHora, 0),
    empaque: N(s.empaque, d.empaque, 0),
    multDiseno: s.multDiseno === undefined ? d.multDiseno : B(s.multDiseno),
    metaQHora: N(s.metaQHora, d.metaQHora, 0),
    tarifasDiseno: listaNoVacia(s.tarifasDiseno, itemValor, d.tarifasDiseno),
    multiplicadores: listaNoVacia(s.multiplicadores, itemValor, d.multiplicadores),
    metaHoras: N(s.metaHoras, d.metaHoras, 0),
    margenContrib: N(s.margenContrib, d.margenContrib, 0.01, 1),
    fijos: lista(s.fijos ?? d.fijos, itemValor, 50),
    reparto: listaNoVacia(s.reparto, itemPct, d.reparto),
    deuda: {
      saldo: N(s.deuda?.saldo, d.deuda.saldo, 0), cuota: N(s.deuda?.cuota, d.deuda.cuota, 0),
      pagadas: Math.round(N(s.deuda?.pagadas, d.deuda.pagadas, 0, 1000))
    },
    canales: listaNoVacia(s.canales, v => S(v, 40) || null, d.canales),
    categoriasGasto: conLuz(listaNoVacia(s.categoriasGasto, v => S(v, 40) || null, d.categoriasGasto)),
    impresoraActiva: S(s.impresoraActiva, 64) || d.impresoraActiva,
    ultimoRespaldo: S(s.ultimoRespaldo, 40)
  };
}

// Valida y completa cualquier objeto de datos (propio o importado).
// Aquí se agregan las migraciones cuando cambie SCHEMA.
export function normalizar(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const impresoras = lista(raw.impresoras, impresora, 20);
  const st = {
    schema: SCHEMA,
    onboarded: B(raw.onboarded),
    settings: settings(raw.settings),
    impresoras: impresoras.length ? impresoras : base.impresoras,
    filamentos: lista(raw.filamentos, filamento, 500),
    ventas: lista(raw.ventas, venta, 20000),
    gastos: lista(raw.gastos, gasto, 20000),
    borrador: raw.borrador && typeof raw.borrador === 'object' ? raw.borrador : null
  };
  if (!st.impresoras.some(i => i.id === st.settings.impresoraActiva)) st.settings.impresoraActiva = st.impresoras[0].id;
  // Ventas guardadas antes de separar la luz: se estima con la máquina y la tarifa actuales.
  for (const v of st.ventas) if (v.costos.luz === null) {
    const imp = st.impresoras.find(i => i.id === v.impresoraId) || st.impresoras[0];
    v.costos.kwh = v.horas * imp.kwh;
    v.costos.luz = v.costos.kwh * st.settings.tarifaLuz;
  }
  return st;
}

// ---------- API pública ----------
export function load() {
  let raw = null;
  try {
    const txt = localStorage.getItem(KEY);
    if (txt) raw = JSON.parse(txt);
  } catch {
    // Si el dato está dañado, se guarda aparte para no perderlo y se arranca limpio.
    try { localStorage.setItem(KEY + '.danado.' + Date.now(), localStorage.getItem(KEY) || ''); } catch { /* sin espacio */ }
  }
  state = raw ? normalizar(raw) : defaultState();
  return state;
}

export const get = () => state;

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // casi siempre: memoria llena
  }
}

export function update(fn) { fn(state); return save(); }

export function replace(nuevo) { state = normalizar(nuevo); return save(); }

export function exportar() {
  state.settings.ultimoRespaldo = new Date().toISOString();
  save();
  return JSON.stringify({ app: 'EJEPRINT Taller', exportado: state.settings.ultimoRespaldo, ...state }, null, 2);
}

export function importar(texto) {
  if (texto.length > MAX_IMPORT) throw new Error('El archivo es demasiado grande para ser un respaldo.');
  let o;
  try { o = JSON.parse(texto); } catch { throw new Error('El archivo no es un respaldo válido (no se pudo leer).'); }
  if (!o || typeof o !== 'object' || !Array.isArray(o.ventas) || !o.settings) {
    throw new Error('El archivo no es un respaldo de EJEPRINT Taller.');
  }
  o.onboarded = true;
  o.settings.ultimoRespaldo = typeof o.exportado === 'string' ? o.exportado : new Date().toISOString();
  if (!replace(o)) throw new Error('No hay espacio suficiente en el teléfono para guardar el respaldo.');
}

export function borrarTodo() {
  localStorage.removeItem(KEY);
  state = defaultState();
}

// Pide al navegador que no borre los datos si el teléfono se queda sin espacio.
export async function pedirPersistencia() {
  try {
    if (navigator.storage?.persisted && await navigator.storage.persisted()) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* no soportado */ }
  return false;
}
