import { html, raw, mount, fmtQ, fmtN, fmtPct, fmtHoras, fmtFecha, toast, abrirDialogo, confirmar, descargar, csv } from '../ui.js';
import { num, cuentaComoVenta } from '../calc.js';
import { uid } from '../store.js';
import { ESTADOS, hoyISO } from '../defaults.js';

const ICONO = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h3" /></svg>');
let pestana = 'ventas';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMes = k => { const [y, m] = k.split('-'); return `${MESES[+m - 1]} ${y}`; };

function agrupar(items) {
  const g = new Map();
  for (const it of [...items].sort((a, b) => b.fecha.localeCompare(a.fecha))) {
    const k = it.fecha.slice(0, 7);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(it);
  }
  return [...g.entries()];
}

function detalleVenta(v) {
  const margen = v.precio - v.costos.total;
  return html`
    <form method="dialog">
      <h2>${v.producto}</h2>
      <p class="dlg-detalle">${v.cliente || 'Sin cliente'}${v.canal ? `, ${v.canal}` : ''}, ${fmtFecha(v.fecha)}</p>
      <dl class="lista-dl">
        <dt>Precio cobrado</dt><dd><b>${fmtQ(v.precio)}</b></dd>
        <dt>Precio sugerido</dt><dd>${fmtQ(v.sugerido)}</dd>
        <dt>Material</dt><dd>${fmtQ(v.costos.material)}</dd>
        <dt>Máquina (${fmtHoras(v.horas)})</dt><dd>${fmtQ(v.costos.maquina - v.costos.luz)}</dd>
        <dt>Luz a pagar en casa (${fmtN(v.costos.kwh, 2)} kWh)</dt><dd>${fmtQ(v.costos.luz)}</dd>
        <dt>Acabado</dt><dd>${fmtQ(v.costos.post)}</dd>
        <dt>Diseño${v.tarifaNombre ? ` (${v.tarifaNombre})` : ''}</dt><dd>${fmtQ(v.costos.diseno)}</dd>
        <dt>Empaque</dt><dd>${fmtQ(v.costos.empaque)}</dd>
        <dt class="total">Ganancia del negocio</dt><dd class="total">${fmtQ(margen)} <small>${fmtPct(v.precio ? margen / v.precio : 0)}</small></dd>
        <dt>Te llevaste</dt><dd>${fmtQ(v.costos.post + v.costos.diseno + margen)}</dd>
        <dt>Q por hora-máquina</dt><dd>${fmtQ(v.horas ? v.precio / v.horas : 0)}</dd>
      </dl>
      ${v.materiales.length ? html`
        <ul class="mat-usados">${v.materiales.map(l => html`<li><span class="punto" data-c="${l.hex}"></span>${l.nombre}<b>${fmtN(l.gramos, 1)} g</b></li>`)}</ul>` : ''}
      ${v.nota ? html`<p class="ayuda">${v.nota}</p>` : ''}
      <div class="fila">
        <label class="campo"><span>Estado</span><select name="estado">
          ${ESTADOS.map(x => html`<option ${x === v.estado ? raw('selected') : ''}>${x}</option>`)}</select></label>
        <label class="campo"><span>Precio cobrado (Q)</span><input name="precio" value="${v.precio}" inputmode="decimal" autocomplete="off"></label>
      </div>
      <div class="dlg-extra"><button type="button" class="btn-link peligro" data-x="borrar">Borrar esta venta</button></div>
      <div class="dlg-acciones">
        <button class="btn" value="cancel" formnovalidate>Cerrar</button>
        <button class="btn btn-primario" value="ok">Guardar</button>
      </div>
    </form>`;
}

export default {
  id: 'registro',
  titulo: 'Registro',
  icono: ICONO,

  render(el, ctx) {
    const st = ctx.state;
    const ventas = agrupar(st.ventas);
    const gastos = agrupar(st.gastos);

    mount(el, html`
      <div class="segmento" role="tablist">
        <button type="button" role="tab" class="${pestana === 'ventas' ? 'on' : ''}" aria-selected="${pestana === 'ventas'}" data-tab="ventas">Ventas <small>${st.ventas.length}</small></button>
        <button type="button" role="tab" class="${pestana === 'gastos' ? 'on' : ''}" aria-selected="${pestana === 'gastos'}" data-tab="gastos">Gastos <small>${st.gastos.length}</small></button>
      </div>

      ${pestana === 'ventas' ? html`
        ${ventas.length ? ventas.map(([mes, items]) => {
          const tot = items.filter(cuentaComoVenta).reduce((a, v) => a + v.precio, 0);
          return html`
            <h2 class="mes-t">${nombreMes(mes)} <small>${fmtQ(tot, 0)}</small></h2>
            <ul class="registros">${items.map(v => {
              const margen = v.precio - v.costos.total;
              return html`
                <li><button type="button" class="reg" data-venta="${v.id}">
                  <span class="reg-izq"><b>${v.producto}</b><small>${v.cliente || 'Sin cliente'}, ${fmtFecha(v.fecha)}</small></span>
                  <span class="reg-der"><b>${fmtQ(v.precio, 0)}</b><small class="${margen < 0 ? 'neg' : ''}">gana ${fmtQ(margen, 0)}</small></span>
                  <span class="estado est-${v.estado.toLowerCase()}">${v.estado}</span>
                </button></li>`;
            })}</ul>`;
        }) : html`<section class="vacio"><p class="vacio-titulo">Sin ventas registradas</p><p>Las ventas que registres desde Cotizar aparecen aquí, ordenadas por mes.</p></section>`}
        <button type="button" class="btn btn-ancho" data-a="csv-ventas" ${st.ventas.length ? '' : raw('disabled')}>Exportar ventas a Excel (CSV)</button>
      ` : html`
        <button type="button" class="btn btn-primario btn-ancho" data-a="nuevo-gasto">Anotar un gasto</button>
        ${gastos.length ? gastos.map(([mes, items]) => html`
          <h2 class="mes-t">${nombreMes(mes)} <small>${fmtQ(items.reduce((a, g) => a + g.monto, 0), 0)}</small></h2>
          <ul class="registros">${items.map(g => html`
            <li><div class="reg">
              <span class="reg-izq"><b>${g.descripcion || g.categoria}</b><small>${g.categoria}, ${fmtFecha(g.fecha)}</small></span>
              <span class="reg-der"><b>${fmtQ(g.monto, 0)}</b></span>
              <button type="button" class="btn-x" data-borrar-gasto="${g.id}" aria-label="Borrar gasto">×</button>
            </div></li>`)}</ul>`) : html`
          <section class="vacio"><p class="vacio-titulo">Sin gastos anotados</p><p>Anotá filamento, cuotas, repuestos y envíos el mismo día que los pagás. Así el flujo de caja del panel es real.</p></section>`}
        <button type="button" class="btn btn-ancho" data-a="csv-gastos" ${st.gastos.length ? '' : raw('disabled')}>Exportar gastos a Excel (CSV)</button>
      `}
    `);

    el.addEventListener('click', async e => {
      const t = e.target.closest('[data-tab],[data-a],[data-venta],[data-borrar-gasto]');
      if (!t) return;

      if (t.dataset.tab) { pestana = t.dataset.tab; ctx.rerender(); return; }

      if (t.dataset.venta) {
        const v = st.ventas.find(x => x.id === t.dataset.venta);
        if (!v) return;
        let borrar = false;
        const fd = await abrirDialogo(detalleVenta(v), {
          setup: d => d.querySelector('[data-x="borrar"]').addEventListener('click', () => { borrar = true; d.close(); })
        });
        if (borrar) {
          const devolver = v.descontado && v.materiales.some(l => st.filamentos.some(f => f.id === l.filamentoId));
          const ok = await confirmar('¿Borrar esta venta?', { ok: 'Borrar', peligro: true,
            detalle: devolver ? 'Los gramos que se habían descontado vuelven a sus rollos.' : 'No se puede deshacer.' });
          if (!ok) return;
          ctx.update(s => {
            if (devolver) for (const l of v.materiales) {
              const f = s.filamentos.find(x => x.id === l.filamentoId);
              if (f) f.restante = Math.min(f.pesoNeto, f.restante + l.gramos);
            }
            s.ventas = s.ventas.filter(x => x.id !== v.id);
          });
          toast('Venta borrada.'); ctx.rerender(); return;
        }
        if (fd) {
          ctx.update(() => { v.estado = ESTADOS.includes(fd.get('estado')) ? fd.get('estado') : v.estado; v.precio = Math.max(0, num(fd.get('precio'), v.precio)); });
          toast('Venta actualizada.'); ctx.rerender();
        }
        return;
      }

      if (t.dataset.borrarGasto) {
        if (await confirmar('¿Borrar este gasto?', { ok: 'Borrar', peligro: true })) {
          ctx.update(s => { s.gastos = s.gastos.filter(g => g.id !== t.dataset.borrarGasto); });
          toast('Gasto borrado.'); ctx.rerender();
        }
        return;
      }

      const a = t.dataset.a;
      if (a === 'nuevo-gasto') {
        const fd = await abrirDialogo(html`
          <form method="dialog">
            <h2>Anotar un gasto</h2>
            <div class="fila">
              <label class="campo"><span>Monto (Q)</span><input name="monto" inputmode="decimal" required autocomplete="off"></label>
              <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${hoyISO()}" required></label>
            </div>
            <label class="campo"><span>Categoría</span><select name="categoria">${st.settings.categoriasGasto.map(c => html`<option>${c}</option>`)}</select></label>
            <label class="campo"><span>Descripción</span><input name="descripcion" maxlength="160" autocomplete="off" placeholder="Opcional"></label>
            <p class="dlg-error" hidden></p>
            <div class="dlg-acciones">
              <button class="btn" value="cancel" formnovalidate>Cancelar</button>
              <button class="btn btn-primario" value="ok">Anotar</button>
            </div>
          </form>`, { validar: d => (num(d.get('monto'), 0) > 0 ? null : 'Poné un monto mayor que cero.') });
        if (!fd) return;
        ctx.update(s => s.gastos.push({ id: uid(), fecha: fd.get('fecha'), categoria: fd.get('categoria'), descripcion: fd.get('descripcion'), monto: num(fd.get('monto')) }));
        toast('Gasto anotado.'); ctx.rerender();
      }

      if (a === 'csv-ventas') {
        const filas = [['Fecha', 'Cliente', 'Canal', 'Trabajo', 'Estado', 'Gramos', 'Horas', 'Material', 'Máquina', 'Luz', 'kWh', 'Acabado', 'Diseño', 'Empaque', 'Costo total', 'Sugerido', 'Precio', 'Ganancia', 'Q por hora']];
        for (const v of [...st.ventas].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
          const g = v.materiales.reduce((a, l) => a + l.gramos, 0);
          filas.push([v.fecha, v.cliente, v.canal, v.producto, v.estado, g.toFixed(1), v.horas.toFixed(2),
            v.costos.material.toFixed(2), (v.costos.maquina - v.costos.luz).toFixed(2), v.costos.luz.toFixed(2), v.costos.kwh.toFixed(3), v.costos.post.toFixed(2), v.costos.diseno.toFixed(2),
            v.costos.empaque.toFixed(2), v.costos.total.toFixed(2), v.sugerido.toFixed(2), v.precio.toFixed(2),
            (v.precio - v.costos.total).toFixed(2), (v.horas ? v.precio / v.horas : 0).toFixed(2)]);
        }
        descargar(`ejeprint-ventas-${hoyISO()}.csv`, csv(filas), 'text/csv;charset=utf-8');
      }
      if (a === 'csv-gastos') {
        const filas = [['Fecha', 'Categoría', 'Descripción', 'Monto']];
        for (const g of [...st.gastos].sort((a, b) => a.fecha.localeCompare(b.fecha))) filas.push([g.fecha, g.categoria, g.descripcion, g.monto.toFixed(2)]);
        descargar(`ejeprint-gastos-${hoyISO()}.csv`, csv(filas), 'text/csv;charset=utf-8');
      }
    });
  }
};
