import { html, raw, mount, fmtQ, fmtN, fmtPct, fmtHoras, pct, estrato } from '../ui.js';
import { resumen, porMes, rangoPeriodo, fijosTotal, puntoEquilibrio, saldoDeuda } from '../calc.js';

const ICONO = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>');

const PERIODOS = [
  { id: 'mes', nombre: 'Este mes' },
  { id: 'anterior', nombre: 'Mes pasado' },
  { id: 'anio', nombre: 'Este año' },
  { id: 'todo', nombre: 'Todo' }
];
let periodo = 'mes';

function barrasMeses(datos) {
  const W = 320, H = 150, pad = 22, base = H - pad;
  const max = Math.max(1, ...datos.map(d => d.ingreso));
  const col = (W - 8) / datos.length;
  const bw = Math.min(18, col * 0.3);
  return html`
    <svg class="grafica" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas y ganancia de los últimos meses">
      <line x1="0" y1="${base}" x2="${W}" y2="${base}" class="g-base" />
      ${datos.map((d, i) => {
        const x = 4 + i * col + col / 2;
        const hi = (d.ingreso / max) * (base - 8);
        const hg = (Math.max(0, d.margen) / max) * (base - 8);
        return html`
          <rect x="${x - bw - 1}" y="${base - hi}" width="${bw}" height="${hi}" rx="2" class="g-ing" />
          <rect x="${x + 1}" y="${base - hg}" width="${bw}" height="${hg}" rx="2" class="g-gan" />
          <text x="${x}" y="${H - 6}" text-anchor="middle" class="g-txt">${d.etiqueta}</text>`;
      })}
    </svg>
    <p class="leyenda"><i class="sw g-ing"></i>Ventas <i class="sw g-gan"></i>Ganancia</p>`;
}

function progreso(titulo, actual, meta, fmt, nota) {
  const p = pct(actual, meta);
  return html`
    <div class="prog">
      <div class="prog-cab"><span>${titulo}</span><b>${fmt(actual)} <small>de ${fmt(meta)}</small></b></div>
      <div class="prog-barra ${p >= 100 ? 'lleno' : ''}"><span data-w="${p}"></span></div>
      ${nota ? html`<p class="ayuda">${nota}</p>` : ''}
    </div>`;
}

export default {
  id: 'panel',
  titulo: 'Panel',
  icono: ICONO,

  render(el, ctx) {
    const st = ctx.state;
    const s = st.settings;
    const { desde, hasta } = rangoPeriodo(periodo);
    const r = resumen(st, desde, hasta);
    const mesR = resumen(st, rangoPeriodo('mes').desde, rangoPeriodo('mes').hasta);
    const pe = puntoEquilibrio(s);
    const cuota = s.deuda.cuota || (s.fijos.find(f => f.id === 'cuota')?.valor ?? 0);
    const saldo = saldoDeuda(s);
    const restantes = s.deuda.cuota > 0 ? Math.ceil(saldo / s.deuda.cuota) : 0;
    const canales = Object.entries(r.porCanal).sort((a, b) => b[1].ingreso - a[1].ingreso);
    const maxCanal = Math.max(1, ...canales.map(c => c[1].ingreso));
    const nombrePeriodo = PERIODOS.find(p => p.id === periodo).nombre.toLowerCase();

    mount(el, html`
      <div class="chips chips-scroll" role="tablist" aria-label="Periodo">
        ${PERIODOS.map(p => html`<button type="button" class="chip-btn ${p.id === periodo ? 'on' : ''}" data-p="${p.id}" role="tab" aria-selected="${p.id === periodo}">${p.nombre}</button>`)}
      </div>

      ${r.n === 0 ? html`
        <section class="vacio">
          <p class="vacio-titulo">Sin ventas ${nombrePeriodo === 'todo' ? 'todavía' : nombrePeriodo}</p>
          <p>Cotizá un trabajo y registralo como venta: acá vas a ver cuánto ganás, cuánto te cuesta el material y si la máquina se está pagando sola.</p>
          <a class="btn btn-primario" href="#/cotizar">Ir a cotizar</a>
        </section>` : html`
        <section class="heroe">
          <p class="res-etq">Ganancia del negocio</p>
          <p class="res-num ${r.margen < 0 ? 'neg' : ''}">${fmtQ(r.margen, 0)}</p>
          <p class="res-sub">de ${fmtQ(r.ingreso, 0)} vendidos en ${r.n} ${r.n === 1 ? 'venta' : 'ventas'}, margen ${fmtPct(r.margenPct)}</p>
          ${estrato([
            { nombre: 'Material', valor: r.material, clase: 'c-mat' },
            { nombre: 'Máquina', valor: r.maquina, clase: 'c-maq' },
            { nombre: 'Tu tiempo', valor: r.post + r.diseno, clase: 'c-tiempo' },
            { nombre: 'Empaque', valor: r.empaque, clase: 'c-emp' },
            { nombre: 'Ganancia', valor: Math.max(0, r.margen), clase: 'c-gan' }
          ], r.ingreso)}
        </section>

        <section class="kpis">
          <div class="kpi"><span>Te llevás</span><b>${fmtQ(r.teLlevas, 0)}</b><small>tu tiempo más la ganancia</small></div>
          <div class="kpi"><span>Por diseño</span><b>${fmtQ(r.diseno, 0)}</b><small>horas de CAD cobradas</small></div>
          <div class="kpi"><span>Material</span><b>${fmtQ(r.material, 0)}</b><small>${fmtN(r.gramos / 1000, 2)} kg usados</small></div>
          <div class="kpi"><span>Máquina</span><b>${fmtHoras(r.horas)}</b><small>de impresión facturada</small></div>
          <div class="kpi ${r.qHora >= s.metaQHora ? 'ok' : 'flojo'}"><span>Q por hora-máquina</span><b>${fmtQ(r.qHora)}</b><small>tu meta: ${fmtQ(s.metaQHora, 0)}</small></div>
          <div class="kpi"><span>Ticket promedio</span><b>${fmtQ(r.ticket, 0)}</b><small>por venta</small></div>
          <div class="kpi"><span>Gastos pagados</span><b>${fmtQ(r.gastos, 0)}</b><small>en el periodo</small></div>
          <div class="kpi ${r.flujo < 0 ? 'neg' : ''}"><span>Flujo de caja</span><b>${fmtQ(r.flujo, 0)}</b><small>ventas menos gastos</small></div>
        </section>`}

      <section class="bloque">
        <h2 class="bloque-t">Este mes</h2>
        ${progreso('Punto de equilibrio', mesR.ingreso, pe, n => fmtQ(n, 0),
          mesR.ingreso >= pe ? 'Ya cubriste tus costos fijos del mes.' : `Te faltan ${fmtQ(pe - mesR.ingreso, 0)} en ventas para no perder.`)}
        ${progreso('Horas facturadas', mesR.horas, s.metaHoras, n => fmtN(n, 1) + ' h',
          'Por debajo de esta meta, la impresora se paga con tu bolsillo.')}
        ${progreso('Lo que la máquina recupera para sí misma', mesR.dep, cuota, n => fmtQ(n, 0),
          mesR.dep >= cuota ? 'La máquina ya se pagó sola este mes.' : 'Depreciación cobrada en tus precios, contra la cuota del mes.')}
      </section>

      <section class="bloque">
        <h2 class="bloque-t">Últimos 6 meses</h2>
        ${barrasMeses(porMes(st, 6))}
      </section>

      ${canales.length ? html`
        <section class="bloque">
          <h2 class="bloque-t">De dónde vienen tus clientes</h2>
          <ul class="canales">
            ${canales.map(([nombre, d]) => html`
              <li><div class="canal-cab"><span>${nombre}</span><b>${fmtQ(d.ingreso, 0)} <small>${d.n} ${d.n === 1 ? 'venta' : 'ventas'}</small></b></div>
              <div class="prog-barra"><span data-w="${(d.ingreso / maxCanal) * 100}"></span></div></li>`)}
          </ul>
        </section>` : ''}

      ${r.ingreso > 0 ? html`
        <section class="bloque">
          <h2 class="bloque-t">Cómo repartir lo vendido</h2>
          <dl class="lista-dl">
            ${s.reparto.map(x => html`<dt>${x.nombre} <small>${fmtPct(x.pct)}</small></dt><dd>${fmtQ(r.ingreso * x.pct)}</dd>`)}
          </dl>
        </section>` : ''}

      <section class="bloque">
        <h2 class="bloque-t">Deuda de la impresora</h2>
        ${progreso('Pagado', s.deuda.saldo - saldo, s.deuda.saldo, n => fmtQ(n, 0),
          saldo > 0 ? `Quedan ${fmtQ(saldo, 0)} en ${restantes} ${restantes === 1 ? 'cuota' : 'cuotas'}. Actualizá las cuotas pagadas en Ajustes.` : 'La impresora ya está pagada.')}
        <p class="ayuda">Costos fijos al mes: ${fmtQ(fijosTotal(s), 0)}.</p>
      </section>
    `);

    el.addEventListener('click', e => {
      const p = e.target.closest('[data-p]')?.dataset.p;
      if (p && p !== periodo) { periodo = p; ctx.rerender(); }
    });
  }
};
