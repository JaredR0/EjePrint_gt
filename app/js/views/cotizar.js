import { html, raw, mount, fmtQ, fmtN, fmtPct, fmtHoras, toast, abrirDialogo, confirmar, debounce, estrato } from '../ui.js';
import { cotizar, evaluar, num } from '../calc.js';
import { uid } from '../store.js';
import { ESTADOS, hoyISO } from '../defaults.js';

const ICONO = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20h14M7 16h10M9 12h6M11 8h2" /></svg>');

function rollosActivos(st) { return st.filamentos.filter(f => !f.archivado && f.restante > 0); }

export function borradorNuevo(st) {
  const s = st.settings;
  return {
    impresoraId: s.impresoraActiva, producto: '', h: '', m: '', piezas: '1',
    materiales: [{ filamentoId: rollosActivos(st)[0]?.id || '', gramos: '' }],
    postMin: '', disenoH: '', tarifaId: s.tarifasDiseno[0]?.id || '', multId: s.multiplicadores[0]?.id || '',
    empaque: String(s.empaque || ''), precio: ''
  };
}

export default {
  id: 'cotizar',
  titulo: 'Cotizar',
  icono: ICONO,

  render(el, ctx) {
    const st = ctx.state;
    if (!st.borrador) { st.borrador = borradorNuevo(st); ctx.save(); }
    const b = st.borrador;
    const s = st.settings;
    const guardar = debounce(() => ctx.save(), 400);

    mount(el, html`
      <div class="pegajoso" id="pill"></div>

      <section class="bloque">
        <label class="campo">
          <span>Máquina</span>
          <select data-k="impresoraId">
            ${st.impresoras.map(i => html`<option value="${i.id}" ${i.id === b.impresoraId ? raw('selected') : ''}>${i.nombre}</option>`)}
          </select>
        </label>
        <label class="campo">
          <span>Trabajo</span>
          <input data-k="producto" value="${b.producto}" placeholder="Ej. 3 llaveros con nombre" autocomplete="off" maxlength="120">
        </label>
      </section>

      <section class="bloque">
        <h2 class="bloque-t">Lo que dice el laminador</h2>
        <div class="fila">
          <label class="campo"><span>Horas</span>
            <input data-k="h" value="${b.h}" inputmode="numeric" placeholder="0" autocomplete="off"></label>
          <label class="campo"><span>Minutos</span>
            <input data-k="m" value="${b.m}" inputmode="numeric" placeholder="0" autocomplete="off"></label>
          <label class="campo"><span>Piezas</span>
            <input data-k="piezas" value="${b.piezas}" inputmode="numeric" placeholder="1" autocomplete="off"></label>
        </div>
        <p class="ayuda">Usá el tiempo total y los gramos totales del laminador, purga incluida. Piezas es cuántas salen en esa cama.</p>
        <div id="mats"></div>
      </section>

      <section class="bloque">
        <h2 class="bloque-t">Tu trabajo</h2>
        <div class="fila">
          <label class="campo"><span>Acabado (min)</span>
            <input data-k="postMin" value="${b.postMin}" inputmode="decimal" placeholder="0" autocomplete="off"></label>
          <label class="campo"><span>Diseño (horas)</span>
            <input data-k="disenoH" value="${b.disenoH}" inputmode="decimal" placeholder="0" autocomplete="off"></label>
          <label class="campo"><span>Empaque (Q)</span>
            <input data-k="empaque" value="${b.empaque}" inputmode="decimal" placeholder="0" autocomplete="off"></label>
        </div>
        <fieldset class="chips">
          <legend>Tarifa de diseño</legend>
          ${s.tarifasDiseno.map(t => html`
            <label class="chip"><input type="radio" name="tarifa" data-k="tarifaId" value="${t.id}" ${t.id === b.tarifaId ? raw('checked') : ''}>
            <span>${t.nombre} <small>${fmtQ(t.valor, 0)}/h</small></span></label>`)}
        </fieldset>
        <fieldset class="chips">
          <legend>Tipo de trabajo</legend>
          ${s.multiplicadores.map(m => html`
            <label class="chip"><input type="radio" name="mult" data-k="multId" value="${m.id}" ${m.id === b.multId ? raw('checked') : ''}>
            <span>${m.nombre} <small>×${fmtN(m.valor, 1)}</small></span></label>`)}
        </fieldset>
      </section>

      <section class="resultado" id="calc"></section>

      <section class="bloque precio-final">
        <label class="campo campo-grande">
          <span>Tu precio</span>
          <div class="con-prefijo"><b>Q</b><input data-k="precio" value="${b.precio}" inputmode="decimal" placeholder="Precio sugerido" autocomplete="off"></div>
        </label>
        <button type="button" class="btn btn-suave" data-a="usar-sugerido">Usar el sugerido</button>
        <div id="eval"></div>
      </section>

      <div class="acciones-pie">
        <button type="button" class="btn btn-primario btn-ancho" data-a="registrar">Registrar venta</button>
        <div class="fila-btn">
          <button type="button" class="btn" data-a="cotizacion">Guardar como cotización</button>
          <button type="button" class="btn" data-a="limpiar">Empezar de nuevo</button>
        </div>
      </div>
    `);

    // ----- materiales (varios colores) -----
    function pintarMateriales() {
      const rollos = rollosActivos(st);
      const c = cotizar(b, st);
      mount(el.querySelector('#mats'), html`
        <div class="mat-cab"><span>Material usado</span><span>Gramos</span></div>
        ${b.materiales.map((l, i) => {
          const f = st.filamentos.find(x => x.id === l.filamentoId);
          const g = num(l.gramos);
          const falta = f && g > f.restante;
          return html`
            <div class="mat-fila">
              <span class="punto" data-c="${f ? f.hex : '#888888'}"></span>
              <select data-mi="${i}" data-mk="filamentoId" aria-label="Rollo">
                <option value="">Sin rollo (costo general)</option>
                ${rollos.map(r => html`<option value="${r.id}" ${r.id === l.filamentoId ? raw('selected') : ''}>${r.color} ${r.material} (${fmtN(r.restante)} g)</option>`)}
              </select>
              <input data-mi="${i}" data-mk="gramos" value="${l.gramos}" inputmode="decimal" placeholder="0" aria-label="Gramos" autocomplete="off">
              ${b.materiales.length > 1 ? html`<button type="button" class="btn-x" data-a="quitar-mat" data-i="${i}" aria-label="Quitar color">×</button>` : html`<span></span>`}
            </div>
            <p class="aviso" data-aviso="${i}" ${falta ? '' : raw('hidden')}>${falta ? `No alcanza: a este rollo le quedan ${fmtN(f.restante)} g.` : ''}</p>`;
        })}
        <button type="button" class="btn-link" data-a="agregar-mat">Agregar otro color</button>
        ${!rollos.length ? html`<p class="ayuda">Todavía no tenés rollos registrados. <a href="#/filamento">Agregalos en Filamento</a> para que se descuenten solos.</p>` : ''}
        <p class="ayuda" data-total ${c.gramos > 0 ? '' : raw('hidden')}>Total: ${fmtN(c.gramos, 1)} g de material.</p>
      `);
    }

    // Actualiza avisos y total sin redibujar: así no se pierde un toque ni el foco.
    function actualizarAvisos() {
      b.materiales.forEach((l, i) => {
        const p = el.querySelector(`[data-aviso="${i}"]`); if (!p) return;
        const f = st.filamentos.find(x => x.id === l.filamentoId);
        const falta = f && num(l.gramos) > f.restante;
        p.hidden = !falta;
        p.textContent = falta ? `No alcanza: a este rollo le quedan ${fmtN(f.restante)} g.` : '';
      });
      const t = el.querySelector('[data-total]');
      const g = cotizar(b, st).gramos;
      if (t) { t.hidden = g <= 0; t.textContent = `Total: ${fmtN(g, 1)} g de material.`; }
    }

    // ----- precio sugerido -----
    function pintarCalculo() {
      const c = cotizar(b, st);
      const vacio = c.total <= 0;
      mount(el.querySelector('#pill'), vacio
        ? html`<span>Llená los datos del laminador</span>`
        : html`<span>Sugerido</span><b>${fmtQ(c.sugerido, 0)}</b>`);
      mount(el.querySelector('#calc'), vacio ? html`
        <p class="vacio-txt">Poné el tiempo y los gramos que te dio el laminador y acá aparece el precio.</p>` : html`
        <p class="res-etq">Precio sugerido</p>
        <p class="res-num">${fmtQ(c.sugerido, 0)}</p>
        <p class="res-sub">${c.piezas > 1 ? html`${fmtQ(c.sugerido / c.piezas)} por pieza, ` : ''}${fmtHoras(c.horas)} de máquina</p>
        <div class="luz-pagar">
          <span><b>Luz a pagar en casa</b><small>${fmtN(c.kwh, 2)} kWh a ${fmtQ(st.settings.tarifaLuz)} el kWh</small></span>
          <b class="luz-monto">${fmtQ(c.luz)}</b>
        </div>
        ${estrato([
          { nombre: 'Material', valor: c.material, clase: 'c-mat' },
          { nombre: 'Máquina', valor: c.desgaste, clase: 'c-maq' },
          { nombre: 'Luz', valor: c.luz, clase: 'c-luz' },
          { nombre: 'Tu tiempo', valor: c.post + c.diseno, clase: 'c-tiempo' },
          { nombre: 'Empaque', valor: c.empaque, clase: 'c-emp' },
          { nombre: 'Ganancia', valor: c.sugerido - c.total, clase: 'c-gan' }
        ], c.sugerido)}
        <details class="desglose">
          <summary>Ver el cálculo</summary>
          <dl>
            <dt>Material (con ${fmtPct(st.settings.factorFallos - 1)} por fallos)</dt><dd>${fmtQ(c.material)}</dd>
            <dt>Máquina, desgaste y mantenimiento: ${fmtQ(c.hm.dep + c.hm.mant)}/h × ${fmtN(c.horas, 2)} h</dt><dd>${fmtQ(c.desgaste)}</dd>
            <dt>Luz: ${fmtN(c.kwh, 2)} kWh × ${fmtQ(st.settings.tarifaLuz)}</dt><dd>${fmtQ(c.luz)}</dd>
            <dt>Acabado</dt><dd>${fmtQ(c.post)}</dd>
            <dt>Diseño (${c.tarifa.nombre})</dt><dd>${fmtQ(c.diseno)}</dd>
            <dt>Empaque</dt><dd>${fmtQ(c.empaque)}</dd>
            <dt class="total">Costo total</dt><dd class="total">${fmtQ(c.total)}</dd>
            <dt>${c.mult.nombre}: ×${fmtN(c.mult.valor, 2)}${st.settings.multDiseno ? '' : ' (sin multiplicar el diseño)'}</dt><dd>${fmtQ(c.sugeridoExacto)}</dd>
          </dl>
        </details>`);
    }

    // ----- qué pasa con tu precio -----
    function pintarEvaluacion() {
      const c = cotizar(b, st);
      const precio = num(b.precio, 0);
      const box = el.querySelector('#eval');
      if (precio <= 0 || c.total <= 0) { mount(box, html``); return; }
      const e = evaluar(c, precio);
      const meta = st.settings.metaQHora;
      const nivel = e.qHora >= meta ? 'bien' : e.qHora >= meta * 0.75 ? 'medio' : 'bajo';
      const textoNivel = { bien: 'Buen uso de la máquina', medio: 'Aceptable, cerca de tu meta', bajo: 'Bajo: subí el precio o pensalo dos veces' }[nivel];
      mount(box, html`
        <div class="eval">
          <div class="eval-fila destacada ${e.margen < 0 ? 'neg' : ''}">
            <span>Ganancia del negocio</span><b>${fmtQ(e.margen)} <small>${fmtPct(e.margenPct)}</small></b>
          </div>
          <div class="eval-fila"><span>Te llevás <small>tu tiempo más la ganancia</small></span><b>${fmtQ(e.teLlevas)}</b></div>
          <div class="eval-fila"><span>Queda para el negocio <small>material, desgaste de la máquina y empaque</small></span><b>${fmtQ(e.reserva)}</b></div>
          <div class="eval-fila fila-luz"><span>Pagás de luz en casa <small>lo único que sale de tu bolsa en este trabajo</small></span><b>${fmtQ(e.luz)}</b></div>
          ${c.piezas > 1 ? html`<div class="eval-fila"><span>Por pieza</span><b>${fmtQ(e.porPieza)}</b></div>` : ''}
          <div class="eval-fila nivel-${nivel}">
            <span>Q por hora-máquina <small>${textoNivel}</small></span><b>${fmtQ(e.qHora)}</b>
          </div>
          ${e.margen < 0 ? html`<p class="aviso">Con este precio perdés ${fmtQ(-e.margen)}. Cubrís menos de lo que cuesta hacerlo.</p>` : ''}
        </div>`);
    }

    function pintarTodo() { pintarCalculo(); pintarEvaluacion(); }

    pintarMateriales();
    pintarTodo();

    el.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.k) b[t.dataset.k] = t.value;
      else if (t.dataset.mi !== undefined) {
        b.materiales[+t.dataset.mi][t.dataset.mk] = t.value;
        if (t.dataset.mk === 'filamentoId') pintarMateriales(); else actualizarAvisos();
      } else return;
      guardar();
      if (t.dataset.k === 'precio') pintarEvaluacion(); else pintarTodo();
    });

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      if (a === 'agregar-mat') { b.materiales.push({ filamentoId: '', gramos: '' }); ctx.save(); pintarMateriales(); }
      if (a === 'quitar-mat') { b.materiales.splice(+e.target.dataset.i, 1); ctx.save(); pintarMateriales(); pintarTodo(); }
      if (a === 'usar-sugerido') {
        const c = cotizar(b, st);
        b.precio = c.sugerido ? String(c.sugerido) : '';
        el.querySelector('[data-k="precio"]').value = b.precio;
        ctx.save(); pintarEvaluacion();
      }
      if (a === 'limpiar') {
        if (await confirmar('¿Borrar los datos de esta cotización?', { ok: 'Borrar' })) {
          st.borrador = borradorNuevo(st); ctx.save(); ctx.rerender();
        }
      }
      if (a === 'registrar') registrar(false);
      if (a === 'cotizacion') registrar(true);
    });

    async function registrar(soloCotizacion) {
      const c = cotizar(b, st);
      if (c.horas <= 0) { toast('Poné el tiempo de impresión que te dio el laminador.'); return; }
      if (c.gramos <= 0) { toast('Poné los gramos de material que usa el trabajo.'); return; }
      const precio = num(b.precio, 0) > 0 ? num(b.precio) : c.sugerido;
      const faltantes = c.lineas.filter(l => l.filamentoId && l.gramos > l.restante);

      const fd = await abrirDialogo(html`
        <form method="dialog">
          <h2>${soloCotizacion ? 'Guardar cotización' : 'Registrar venta'}</h2>
          <p class="dlg-detalle">${b.producto || 'Trabajo sin nombre'}, por ${fmtQ(precio)}. Luz de este trabajo: ${fmtQ(c.luz)}${soloCotizacion ? ', se suma a lo que debés de luz cuando pase a venta' : ', se suma a lo que debés de luz'}.</p>
          <label class="campo"><span>Cliente</span><input name="cliente" maxlength="80" autocomplete="off" placeholder="Nombre"></label>
          <div class="fila">
            <label class="campo"><span>Canal</span><select name="canal">${st.settings.canales.map(x => html`<option>${x}</option>`)}</select></label>
            <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${hoyISO()}" required></label>
          </div>
          <label class="campo"><span>Estado</span><select name="estado">
            ${ESTADOS.filter(x => soloCotizacion ? x === 'Cotizado' : x !== 'Cotizado').map(x => html`<option ${x === (soloCotizacion ? 'Cotizado' : 'Anticipo') ? raw('selected') : ''}>${x}</option>`)}
          </select></label>
          <label class="campo"><span>Nota</span><input name="nota" maxlength="300" autocomplete="off" placeholder="Opcional"></label>
          ${c.lineas.some(l => l.filamentoId) ? html`
            <label class="check"><input type="checkbox" name="descontar" ${soloCotizacion ? '' : raw('checked')}>
              <span>Descontar ${fmtN(c.gramos, 1)} g del inventario de filamento</span></label>` : ''}
          ${faltantes.length ? html`<p class="aviso">Ojo: ${faltantes.map(l => l.nombre).join(', ')} no alcanza para este trabajo.</p>` : ''}
          <p class="dlg-error" hidden></p>
          <div class="dlg-acciones">
            <button class="btn" value="cancel" formnovalidate>Cancelar</button>
            <button class="btn btn-primario" value="ok">${soloCotizacion ? 'Guardar' : 'Registrar'}</button>
          </div>
        </form>`, { validar: fd => (fd.get('fecha') ? null : 'Poné la fecha.') });
      if (!fd) return;

      const descontar = fd.get('descontar') === 'on';
      const venta = {
        id: uid(), fecha: fd.get('fecha'), cliente: fd.get('cliente'), canal: fd.get('canal'),
        producto: b.producto || 'Trabajo sin nombre', impresoraId: c.imp?.id || '', impresoraNombre: c.imp?.nombre || '',
        horas: c.horas, piezas: c.piezas,
        materiales: c.lineas.map(l => ({ filamentoId: l.filamentoId, nombre: l.nombre, hex: l.hex, gramos: l.gramos, costoG: l.costoG })),
        postMin: num(b.postMin), disenoH: num(b.disenoH),
        tarifaNombre: c.tarifa.nombre, tarifaValor: c.tarifa.valor, multNombre: c.mult.nombre, multValor: c.mult.valor,
        costos: { material: c.material, maquina: c.maquina, post: c.post, diseno: c.diseno, empaque: c.empaque, total: c.total, dep: c.dep, luz: c.luz, kwh: c.kwh },
        sugerido: c.sugerido, precio, estado: fd.get('estado'), descontado: descontar, nota: fd.get('nota')
      };
      const ok = ctx.update(s => {
        s.ventas.push(venta);
        if (descontar) for (const l of venta.materiales) {
          const f = s.filamentos.find(x => x.id === l.filamentoId);
          if (f) f.restante = Math.max(0, f.restante - l.gramos);
        }
        s.borrador = borradorNuevo(s);
      });
      if (!ok) { toast('No se pudo guardar: el teléfono no tiene espacio.'); return; }
      toast(soloCotizacion ? 'Cotización guardada.' : 'Venta registrada.', { texto: 'Ver registro', fn: () => ctx.go('registro') });
      ctx.rerender();
    }
  }
};
