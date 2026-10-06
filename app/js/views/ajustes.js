import { html, raw, mount, fmtQ, fmtN, fmtPct, toast, confirmar, descargar } from '../ui.js';
import { horaMaquina, fijosTotal, puntoEquilibrio, saldoDeuda, num } from '../calc.js';
import { uid, exportar, importar, borrarTodo, pedirPersistencia } from '../store.js';
import { VERSION, hoyISO } from '../defaults.js';

const ICONO = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>');
const abiertos = new Set(['maquinas']);

// ---------- lectura y escritura por ruta, p. ej. "settings.multiplicadores.2.valor" ----------
function getPath(o, path) { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
function setPath(o, path, v) {
  const ks = path.split('.'); const last = ks.pop();
  const parent = ks.reduce((a, k) => a[k], o);
  if (parent && Object.prototype.hasOwnProperty.call(parent, last)) parent[last] = v;
}
function leer(input) {
  const t = input.dataset.type;
  if (t === 'bool') return input.checked;
  if (t === 'num') return Math.max(0, num(input.value, 0));
  if (t === 'pct') return Math.max(0, Math.min(1, num(input.value, 0) / 100));
  if (t === 'fallos') return 1 + Math.max(0, Math.min(200, num(input.value, 0))) / 100;
  if (t === 'lineas') return input.value.split('\n').map(x => x.trim().slice(0, 40)).filter(Boolean).slice(0, 30);
  return input.value.trim().slice(0, 80);
}
function mostrar(st, path, t) {
  const v = getPath(st, path);
  if (t === 'pct') return +(v * 100).toFixed(2);
  if (t === 'fallos') return +((v - 1) * 100).toFixed(2);
  if (t === 'lineas') return (v || []).join('\n');
  return v ?? '';
}

// Campo enlazado: se guarda solo al salir del campo.
function campo(st, path, etiqueta, { t = 'num', ayuda = '', sufijo = '', modo = 'decimal' } = {}) {
  if (t === 'bool') return html`
    <label class="check"><input type="checkbox" data-path="${path}" data-type="bool" ${getPath(st, path) ? raw('checked') : ''}><span>${etiqueta}</span></label>
    ${ayuda ? html`<p class="ayuda">${ayuda}</p>` : ''}`;
  if (t === 'lineas') return html`
    <label class="campo"><span>${etiqueta}</span><textarea data-path="${path}" data-type="lineas" rows="5">${mostrar(st, path, t)}</textarea></label>
    ${ayuda ? html`<p class="ayuda">${ayuda}</p>` : ''}`;
  return html`
    <label class="campo"><span>${etiqueta}</span>
      <div class="${sufijo ? 'con-sufijo' : ''}"><input data-path="${path}" data-type="${t}" value="${mostrar(st, path, t)}"
        inputmode="${t === 'txt' ? 'text' : modo}" autocomplete="off" maxlength="80">${sufijo ? html`<b>${sufijo}</b>` : ''}</div>
    </label>${ayuda ? html`<p class="ayuda">${ayuda}</p>` : ''}`;
}

function seccion(id, titulo, contenido) {
  return html`<details class="ajuste" data-sec="${id}" ${abiertos.has(id) ? raw('open') : ''}><summary>${titulo}</summary><div class="ajuste-cuerpo">${contenido}</div></details>`;
}

function listaValores(st, path, { etiquetaValor, t = 'num', sufijo = '', min = 1 }) {
  const items = getPath(st, path);
  return html`
    <ul class="lista-edit">
      ${items.map((it, i) => html`
        <li>
          <input data-path="${path}.${i}.nombre" data-type="txt" value="${it.nombre}" aria-label="Nombre" maxlength="60">
          <div class="con-sufijo"><input data-path="${path}.${i}.${t === 'pct' ? 'pct' : 'valor'}" data-type="${t}" value="${t === 'pct' ? +(it.pct * 100).toFixed(2) : it.valor}" inputmode="decimal" aria-label="${etiquetaValor}"><b>${sufijo}</b></div>
          ${items.length > min ? html`<button type="button" class="btn-x" data-a="del" data-list="${path}" data-i="${i}" aria-label="Quitar">×</button>` : html`<span></span>`}
        </li>`)}
    </ul>
    <button type="button" class="btn-link" data-a="add" data-list="${path}" data-kind="${t}">Agregar</button>`;
}

export default {
  id: 'ajustes',
  titulo: 'Ajustes',
  icono: ICONO,

  render(el, ctx) {
    const st = ctx.state;
    const s = st.settings;

    mount(el, html`
      ${seccion('maquinas', 'Máquinas', html`
        <p class="ayuda">El costo por hora de cada máquina sale de su precio, su vida útil, el mantenimiento y la luz que gasta.</p>
        ${st.impresoras.map((imp, i) => html`
          <div class="maquina">
            <label class="check"><input type="radio" name="activa" data-path="settings.impresoraActiva" data-type="txt" value="${imp.id}" ${imp.id === s.impresoraActiva ? raw('checked') : ''}><span>Usar por defecto al cotizar</span></label>
            ${campo(st, `impresoras.${i}.nombre`, 'Nombre', { t: 'txt' })}
            <div class="fila">
              ${campo(st, `impresoras.${i}.precio`, 'Precio (Q)')}
              ${campo(st, `impresoras.${i}.vida`, 'Vida útil (horas)', { modo: 'numeric' })}
            </div>
            <div class="fila">
              ${campo(st, `impresoras.${i}.mantAnual`, 'Mantenimiento al año (Q)')}
              ${campo(st, `impresoras.${i}.horasAnio`, 'Horas de uso al año', { modo: 'numeric' })}
            </div>
            ${campo(st, `impresoras.${i}.kwh`, 'Consumo promedio (kWh por hora)', { ayuda: 'Una Kobra S1 imprimiendo PLA anda por 0.15.' })}
            <p class="calc-linea">Costo por hora: <b data-calc="hm-${i}"></b><span class="det" data-calc="hmd-${i}"></span></p>
            ${st.impresoras.length > 1 ? html`<button type="button" class="btn-link peligro" data-a="del-imp" data-i="${i}">Quitar esta máquina</button>` : ''}
          </div>`)}
        <button type="button" class="btn btn-ancho" data-a="add-imp">Agregar otra máquina</button>`)}

      ${seccion('precios', 'Luz, material y tu tiempo', html`
        ${campo(st, 'settings.tarifaLuz', 'Tarifa de luz', { sufijo: 'Q/kWh', ayuda: 'Dividí el total de tu recibo entre los kWh consumidos.' })}
        ${campo(st, 'settings.factorFallos', 'Material extra por fallos y purga', { t: 'fallos', sufijo: '%' })}
        ${campo(st, 'settings.costoGramoDefault', 'Costo por gramo si no elegís rollo', { sufijo: 'Q/g' })}
        ${campo(st, 'settings.postHora', 'Tu tiempo de acabado', { sufijo: 'Q/h' })}
        ${campo(st, 'settings.empaque', 'Empaque por pedido', { sufijo: 'Q' })}
        ${campo(st, 'settings.metaQHora', 'Meta de Q por hora-máquina', { sufijo: 'Q/h' })}`)}

      ${seccion('diseno', 'Tarifas de diseño', html`
        <p class="ayuda">Tené una tarifa normal y otras especiales. Al cotizar elegís cuál aplica, así la tarifa de estudiante nunca se cuela en un pedido de negocio.</p>
        ${listaValores(st, 'settings.tarifasDiseno', { etiquetaValor: 'Q por hora', sufijo: 'Q/h' })}
        ${campo(st, 'settings.multDiseno', 'Aplicar el multiplicador también al diseño', { t: 'bool',
          ayuda: 'Apagado: el diseño se cobra a su tarifa, sin inflarlo. Es lo recomendado.' })}`)}

      ${seccion('mult', 'Multiplicadores por tipo de trabajo', html`
        <p class="ayuda">El precio sugerido es el costo de producción por este número.</p>
        ${listaValores(st, 'settings.multiplicadores', { etiquetaValor: 'Multiplicador', sufijo: '×' })}`)}

      ${seccion('metas', 'Metas y costos fijos', html`
        ${campo(st, 'settings.metaHoras', 'Meta de horas facturadas al mes', { sufijo: 'h', modo: 'numeric' })}
        ${campo(st, 'settings.margenContrib', 'Margen de contribución estimado', { t: 'pct', sufijo: '%' })}
        <p class="sub-t">Costos fijos al mes</p>
        ${listaValores(st, 'settings.fijos', { etiquetaValor: 'Monto', sufijo: 'Q', min: 0 })}
        <p class="calc-linea">Total fijo: <b data-calc="fijos"></b><br>Punto de equilibrio: <b data-calc="pe"></b> en ventas al mes</p>`)}

      ${seccion('deuda', 'Deuda de la impresora', html`
        <div class="fila">
          ${campo(st, 'settings.deuda.saldo', 'Deuda original', { sufijo: 'Q' })}
          ${campo(st, 'settings.deuda.cuota', 'Cuota mensual', { sufijo: 'Q' })}
        </div>
        ${campo(st, 'settings.deuda.pagadas', 'Cuotas ya pagadas', { modo: 'numeric' })}
        <p class="calc-linea">Saldo pendiente: <b data-calc="saldo"></b></p>`)}

      ${seccion('reparto', 'Reparto de cada venta', html`
        ${listaValores(st, 'settings.reparto', { etiquetaValor: 'Porcentaje', t: 'pct', sufijo: '%' })}
        <p class="calc-linea">Suma: <b data-calc="reparto"></b></p>`)}

      ${seccion('listas', 'Canales y categorías', html`
        ${campo(st, 'settings.canales', 'Canales de venta', { t: 'lineas', ayuda: 'Uno por línea.' })}
        ${campo(st, 'settings.categoriasGasto', 'Categorías de gasto', { t: 'lineas', ayuda: 'Uno por línea.' })}`)}

      ${seccion('datos', 'Tus datos', html`
        <p class="ayuda">Todo se guarda solo en este teléfono. Si desinstalás la app o borrás los datos de Chrome, se pierde. Por eso: respaldá seguido y guardá el archivo en Drive.</p>
        <p class="calc-linea">Último respaldo: <b>${s.ultimoRespaldo ? new Date(s.ultimoRespaldo).toLocaleDateString('es-GT') : 'nunca'}</b><br>
          Protección contra borrado automático: <b data-calc="persist">revisando…</b></p>
        <button type="button" class="btn btn-primario btn-ancho" data-a="exportar">Descargar respaldo</button>
        <label class="btn btn-ancho btn-archivo">Restaurar un respaldo<input type="file" accept="application/json,.json" data-a="importar" hidden></label>
        <button type="button" class="btn-link peligro centro" data-a="borrar-todo">Borrar todos los datos</button>`)}

      <p class="ayuda centro pie-ver">EJEPRINT Taller ${VERSION}. <a href="privacidad.html">Privacidad</a></p>
    `);

    function pintarCalc() {
      const put = (k, v) => { const n = el.querySelector(`[data-calc="${k}"]`); if (n) n.textContent = v; };
      st.impresoras.forEach((imp, i) => {
        const h = horaMaquina(imp, s.tarifaLuz);
        put(`hm-${i}`, fmtQ(h.total));
        put(`hmd-${i}`, `Depreciación ${fmtQ(h.dep)}, mantenimiento ${fmtQ(h.mant)}, luz ${fmtQ(h.luz)}`);
      });
      put('fijos', fmtQ(fijosTotal(s)));
      put('pe', fmtQ(puntoEquilibrio(s), 0));
      put('saldo', fmtQ(saldoDeuda(s), 0));
      const suma = s.reparto.reduce((a, r) => a + r.pct, 0);
      put('reparto', `${fmtPct(suma)}${Math.abs(suma - 1) > 0.001 ? ', debería dar 100%' : ''}`);
    }
    pintarCalc();
    pedirPersistencia().then(ok => {
      const n = el.querySelector('[data-calc="persist"]');
      if (n) n.textContent = ok ? 'activa' : 'no disponible en este navegador';
    });

    el.addEventListener('toggle', e => {
      const id = e.target.dataset?.sec; if (!id) return;
      e.target.open ? abiertos.add(id) : abiertos.delete(id);
    }, true);

    el.addEventListener('change', async e => {
      const t = e.target;
      if (t.dataset.a === 'importar') {
        const archivo = t.files?.[0]; t.value = '';
        if (!archivo) return;
        const ok = await confirmar('¿Restaurar este respaldo?', { ok: 'Restaurar', peligro: true,
          detalle: 'Reemplaza todos los datos actuales de la app por los del archivo.' });
        if (!ok) return;
        try { importar(await archivo.text()); toast('Respaldo restaurado.'); ctx.rerender(); }
        catch (err) { toast(err.message); }
        return;
      }
      if (!t.dataset.path) return;
      if (t.type === 'radio' && !t.checked) return;
      setPath(st, t.dataset.path, leer(t));
      ctx.save();
      pintarCalc();
    });

    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-a]');
      if (!b || b.tagName === 'INPUT') return;
      const a = b.dataset.a;

      if (a === 'add') {
        const lista = getPath(st, b.dataset.list);
        if (lista.length >= 20) { toast('Máximo 20 elementos.'); return; }
        lista.push(b.dataset.kind === 'pct' ? { id: uid(), nombre: 'Nuevo', pct: 0 } : { id: uid(), nombre: 'Nuevo', valor: 0 });
        ctx.save(); ctx.rerender();
      }
      if (a === 'del') {
        getPath(st, b.dataset.list).splice(+b.dataset.i, 1);
        ctx.save(); ctx.rerender();
      }
      if (a === 'add-imp') {
        st.impresoras.push({ id: uid(), nombre: 'Nueva impresora', precio: 0, vida: 4000, mantAnual: 0, horasAnio: 1200, kwh: 0.15 });
        ctx.save(); ctx.rerender();
      }
      if (a === 'del-imp') {
        const imp = st.impresoras[+b.dataset.i];
        if (!(await confirmar(`¿Quitar ${imp.nombre}?`, { ok: 'Quitar', peligro: true, detalle: 'Las ventas hechas con ella conservan sus costos.' }))) return;
        st.impresoras.splice(+b.dataset.i, 1);
        if (s.impresoraActiva === imp.id) s.impresoraActiva = st.impresoras[0].id;
        if (st.borrador?.impresoraId === imp.id) st.borrador.impresoraId = s.impresoraActiva;
        ctx.save(); ctx.rerender();
      }
      if (a === 'exportar') {
        descargar(`ejeprint-respaldo-${hoyISO()}.json`, exportar());
        toast('Respaldo descargado. Subilo a tu Drive.');
        ctx.rerender();
      }
      if (a === 'borrar-todo') {
        const ok = await confirmar('¿Borrar todos los datos de la app?', { ok: 'Borrar todo', peligro: true,
          detalle: 'Ventas, gastos, rollos y ajustes. Descargá un respaldo antes si tenés dudas. No se puede deshacer.' });
        if (!ok) return;
        borrarTodo(); location.hash = '#/'; location.reload();
      }
    });
  }
};
