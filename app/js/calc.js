// Todos los cálculos del negocio. Son funciones puras: reciben datos y devuelven números.
// Si querés cambiar cómo se calcula un precio, este es el único lugar.

import { ESTADOS_SIN_VENTA, hoyISO } from './defaults.js';

export const num = (v, d = 0) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : d;
  const n = parseFloat(String(v ?? '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : d;
};

export function horaMaquina(imp, tarifaLuz) {
  if (!imp) return { dep: 0, mant: 0, luz: 0, total: 0 };
  const dep = imp.precio / Math.max(1, imp.vida);
  const mant = imp.mantAnual / Math.max(1, imp.horasAnio);
  const luz = imp.kwh * tarifaLuz;
  return { dep, mant, luz, total: dep + mant + luz };
}

export const costoGramo = f => (f ? f.costo / Math.max(1, f.pesoNeto) : 0);

// Precio sugerido a partir de los datos del laminador (borrador del cotizador).
export function cotizar(b, st) {
  const s = st.settings;
  const imp = st.impresoras.find(i => i.id === b.impresoraId) || st.impresoras[0];
  const hm = horaMaquina(imp, s.tarifaLuz);
  const horas = Math.max(0, num(b.h)) + Math.max(0, num(b.m)) / 60;

  const lineas = (b.materiales || []).map(l => {
    const f = st.filamentos.find(x => x.id === l.filamentoId);
    return {
      filamentoId: f ? f.id : '',
      nombre: f ? `${f.material} ${f.color}` : 'Sin rollo asignado',
      hex: f ? f.hex : '#888888',
      gramos: Math.max(0, num(l.gramos)),
      costoG: f ? costoGramo(f) : s.costoGramoDefault,
      restante: f ? f.restante : null
    };
  }).filter(l => l.gramos > 0 || l.filamentoId);

  const gramos = lineas.reduce((a, l) => a + l.gramos, 0);
  const material = lineas.reduce((a, l) => a + l.gramos * l.costoG, 0) * s.factorFallos;
  const maquina = horas * hm.total;
  const luz = horas * hm.luz;                 // lo que hay que pagar en casa por la electricidad
  const kwh = horas * (imp ? imp.kwh : 0);
  const post = Math.max(0, num(b.postMin)) / 60 * s.postHora;
  const tarifa = s.tarifasDiseno.find(t => t.id === b.tarifaId) || s.tarifasDiseno[0] || { nombre: '', valor: 0 };
  const diseno = Math.max(0, num(b.disenoH)) * tarifa.valor;
  const empaque = Math.max(0, num(b.empaque));
  const mult = s.multiplicadores.find(m => m.id === b.multId) || s.multiplicadores[0] || { nombre: '', valor: 1 };

  const produccion = material + maquina + post + empaque;
  const total = produccion + diseno;
  const sugeridoExacto = produccion * mult.valor + (s.multDiseno ? diseno * mult.valor : diseno);
  const sugerido = total > 0 ? Math.ceil(sugeridoExacto / 5) * 5 : 0;
  const piezas = Math.max(1, Math.round(num(b.piezas, 1)));

  return { imp, hm, horas, lineas, gramos, material, maquina, luz, kwh, desgaste: maquina - luz, post, diseno, empaque,
    produccion, total, mult, tarifa, sugeridoExacto, sugerido, piezas, dep: horas * hm.dep };
}

// Qué pasa con un precio concreto.
export function evaluar(c, precio) {
  const margen = precio - c.total;
  return {
    precio, margen,
    margenPct: precio > 0 ? margen / precio : 0,
    qHora: c.horas > 0 ? precio / c.horas : 0,
    teLlevas: c.post + c.diseno + margen,          // tu tiempo + ganancia del negocio
    luz: c.luz,                                    // lo que pagás en casa por la electricidad
    reserva: c.material + c.desgaste + c.empaque,  // lo que queda para reponer y mantener
    porPieza: precio / Math.max(1, c.piezas)
  };
}

export const cuentaComoVenta = v => !ESTADOS_SIN_VENTA.includes(v.estado);

// ---------- periodos ----------
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function rangoPeriodo(p) {
  const h = new Date();
  if (p === 'mes') return { desde: iso(new Date(h.getFullYear(), h.getMonth(), 1)), hasta: hoyISO() };
  if (p === 'anterior') return { desde: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), hasta: iso(new Date(h.getFullYear(), h.getMonth(), 0)) };
  if (p === 'anio') return { desde: `${h.getFullYear()}-01-01`, hasta: hoyISO() };
  return { desde: null, hasta: null };
}

const enRango = (f, desde, hasta) => (!desde || f >= desde) && (!hasta || f <= hasta);

export function resumen(st, desde, hasta) {
  const ventas = st.ventas.filter(v => cuentaComoVenta(v) && enRango(v.fecha, desde, hasta));
  const gastos = st.gastos.filter(g => enRango(g.fecha, desde, hasta));
  const r = { n: ventas.length, ingreso: 0, costo: 0, margen: 0, diseno: 0, post: 0, material: 0,
    maquina: 0, empaque: 0, horas: 0, gramos: 0, dep: 0, luz: 0, kwh: 0, gastos: 0, porCanal: {} };
  for (const v of ventas) {
    r.ingreso += v.precio; r.costo += v.costos.total; r.margen += v.precio - v.costos.total;
    r.diseno += v.costos.diseno; r.post += v.costos.post; r.material += v.costos.material;
    r.maquina += v.costos.maquina; r.empaque += v.costos.empaque; r.horas += v.horas; r.dep += v.costos.dep;
    r.luz += v.costos.luz; r.kwh += v.costos.kwh;
    r.gramos += v.materiales.reduce((a, l) => a + l.gramos, 0);
    const k = v.canal || 'Sin canal';
    r.porCanal[k] = r.porCanal[k] || { ingreso: 0, n: 0 };
    r.porCanal[k].ingreso += v.precio; r.porCanal[k].n += 1;
  }
  for (const g of gastos) r.gastos += g.monto;
  r.qHora = r.horas > 0 ? r.ingreso / r.horas : 0;
  r.teLlevas = r.post + r.diseno + r.margen;
  r.flujo = r.ingreso - r.gastos;
  r.ticket = r.n ? r.ingreso / r.n : 0;
  r.margenPct = r.ingreso ? r.margen / r.ingreso : 0;
  return r;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function porMes(st, cuantos = 6) {
  const h = new Date();
  const out = [];
  for (let i = cuantos - 1; i >= 0; i--) {
    const d = new Date(h.getFullYear(), h.getMonth() - i, 1);
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const r = resumen(st, iso(d), iso(fin));
    out.push({ etiqueta: MESES[d.getMonth()], ingreso: r.ingreso, margen: r.margen });
  }
  return out;
}

// Luz que generaron las ventas contra lo que ya pagaste (gastos en la categoría Luz).
export const CATEGORIA_LUZ = 'Luz';
export function luzPendiente(st) {
  let generado = 0, kwh = 0, trabajos = 0, pagado = 0, ultimoPago = '';
  for (const v of st.ventas) if (cuentaComoVenta(v) && v.costos.luz > 0) { generado += v.costos.luz; kwh += v.costos.kwh; trabajos++; }
  for (const g of st.gastos) if (g.categoria === CATEGORIA_LUZ) { pagado += g.monto; if (g.fecha > ultimoPago) ultimoPago = g.fecha; }
  return { generado, pagado, pendiente: generado - pagado, kwh, trabajos, ultimoPago };
}

export const fijosTotal = s => s.fijos.reduce((a, f) => a + f.valor, 0);
export const puntoEquilibrio = s => fijosTotal(s) / Math.max(0.01, s.margenContrib);
export const saldoDeuda = s => Math.max(0, s.deuda.saldo - s.deuda.pagadas * s.deuda.cuota);
