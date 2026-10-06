import { html, raw, mount, fmtQ, fmtN, pct, toast, abrirDialogo, confirmar } from '../ui.js';
import { costoGramo, num } from '../calc.js';
import { uid } from '../store.js';
import { MATERIALES, hoyISO } from '../defaults.js';

const ICONO = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></svg>');

const COLORES = [
  ['Rojo', '#ce2229'], ['Blanco', '#f2f2ee'], ['Negro', '#1e1c1a'], ['Azul', '#1f63b5'],
  ['Amarillo', '#e9b10f'], ['Verde', '#2e8b4e'], ['Gris', '#8a8a86'], ['Naranja', '#e8701d'], ['Dorado', '#b8903e']
];
let verArchivados = false;

function formRollo(f = {}) {
  const nuevo = !f.id;
  return html`
    <form method="dialog">
      <h2>${nuevo ? 'Agregar rollo' : 'Editar rollo'}</h2>
      <div class="fila">
        <label class="campo"><span>Material</span><select name="material">
          ${MATERIALES.map(m => html`<option ${m === (f.material || 'PLA') ? raw('selected') : ''}>${m}</option>`)}
        </select></label>
        <label class="campo"><span>Marca</span><input name="marca" value="${f.marca || ''}" maxlength="60" autocomplete="off" placeholder="eSUN"></label>
      </div>
      <div class="fila">
        <label class="campo"><span>Color</span><input name="color" value="${f.color || ''}" maxlength="40" required autocomplete="off" placeholder="Rojo"></label>
        <label class="campo campo-color"><span>Tono</span><input type="color" name="hex" value="${f.hex || '#ce2229'}"></label>
      </div>
      <div class="muestras" aria-label="Colores rápidos">
        ${COLORES.map(([n, h]) => html`<button type="button" class="muestra" data-c="${h}" data-nombre="${n}" data-hex="${h}" aria-label="${n}"></button>`)}
      </div>
      <div class="fila">
        <label class="campo"><span>Costo por rollo (Q)</span><input name="costo" value="${f.costo ?? ''}" inputmode="decimal" required autocomplete="off" placeholder="169"></label>
        <label class="campo"><span>Peso neto (g)</span><input name="pesoNeto" value="${f.pesoNeto ?? 1000}" inputmode="numeric" required autocomplete="off"></label>
      </div>
      ${nuevo ? html`
        <label class="campo"><span>Cuántos rollos iguales compraste</span><input name="cantidad" value="1" inputmode="numeric" autocomplete="off"></label>
        <label class="check"><input type="checkbox" name="gasto" checked><span>Anotar la compra en Gastos</span></label>`
      : html`<label class="campo"><span>Gramos que le quedan</span><input name="restante" value="${Math.round(f.restante)}" inputmode="numeric" autocomplete="off"></label>`}
      <p class="dlg-error" hidden></p>
      <div class="dlg-acciones">
        <button class="btn" value="cancel" formnovalidate>Cancelar</button>
        <button class="btn btn-primario" value="ok">${nuevo ? 'Agregar' : 'Guardar'}</button>
      </div>
    </form>`;
}

const validarRollo = fd => {
  if (!String(fd.get('color') || '').trim()) return 'Poné el nombre del color.';
  if (num(fd.get('costo'), -1) < 0) return 'El costo tiene que ser un número.';
  if (num(fd.get('pesoNeto'), 0) <= 0) return 'El peso neto tiene que ser mayor que cero.';
  return null;
};

const setupColores = d => d.addEventListener('click', e => {
  const m = e.target.closest('.muestra');
  if (!m) return;
  d.querySelector('[name="hex"]').value = m.dataset.hex;
  const color = d.querySelector('[name="color"]');
  if (!color.value.trim() || COLORES.some(([n]) => n === color.value.trim())) color.value = m.dataset.nombre;
});

export default {
  id: 'filamento',
  titulo: 'Filamento',
  icono: ICONO,

  render(el, ctx) {
    const st = ctx.state;
    const activos = st.filamentos.filter(f => !f.archivado);
    const archivados = st.filamentos.filter(f => f.archivado);
    const lista = verArchivados ? archivados : activos;
    const totalG = activos.reduce((a, f) => a + f.restante, 0);
    const valor = activos.reduce((a, f) => a + f.restante * costoGramo(f), 0);
    const bajos = activos.filter(f => f.restante / f.pesoNeto < 0.3);

    // consumo por rollo según las ventas registradas
    const usado = {};
    for (const v of st.ventas) if (v.descontado) for (const l of v.materiales) usado[l.filamentoId] = (usado[l.filamentoId] || 0) + l.gramos;

    mount(el, html`
      <section class="heroe heroe-chico">
        <p class="res-etq">Material disponible</p>
        <p class="res-num">${fmtN(totalG / 1000, 2)} <small>kg</small></p>
        <p class="res-sub">${activos.length} ${activos.length === 1 ? 'rollo' : 'rollos'}, valen ${fmtQ(valor, 0)}${bajos.length ? html`, <b class="txt-alerta">${bajos.length} por terminarse</b>` : ''}</p>
      </section>

      <button type="button" class="btn btn-primario btn-ancho" data-a="nuevo">Agregar rollo</button>

      ${lista.length ? html`
        <ul class="rollos">
          ${lista.map(f => {
            const p = pct(f.restante, f.pesoNeto);
            const bajo = p < 30;
            return html`
              <li class="rollo ${bajo ? 'bajo' : ''}" data-c="${f.hex}">
                <span class="carrete"></span>
                <div class="rollo-info">
                  <p class="rollo-nombre">${f.material} ${f.color.toLowerCase()} ${f.marca ? html`<small>${f.marca}</small>` : ''}</p>
                  <div class="prog-barra"><span data-w="${p}"></span></div>
                  <p class="rollo-datos">
                    <b>${fmtN(f.restante)} g</b> de ${fmtN(f.pesoNeto)} g, ${fmtQ(costoGramo(f), 3)}/g
                    ${usado[f.id] ? html`<br>${fmtN(usado[f.id])} g usados en ventas` : ''}
                    ${bajo && !f.archivado ? html`<br><span class="txt-alerta">${f.restante <= 0 ? 'Terminado' : 'Comprá el siguiente ya'}</span>` : ''}
                  </p>
                </div>
                <div class="rollo-acc">
                  <button type="button" class="btn btn-suave btn-chico" data-a="pesar" data-id="${f.id}">Pesar</button>
                  <button type="button" class="btn-link" data-a="editar" data-id="${f.id}">Editar</button>
                </div>
              </li>`;
          })}
        </ul>` : html`
        <section class="vacio">
          <p class="vacio-titulo">${verArchivados ? 'No hay rollos terminados' : 'Todavía no hay rollos'}</p>
          ${verArchivados ? '' : html`<p>Agregá los rollos que tenés. Cada vez que registres una venta, los gramos usados se descuentan solos y vas a saber cuánto te queda.</p>`}
        </section>`}

      ${archivados.length || verArchivados ? html`
        <button type="button" class="btn-link centro" data-a="ver-arch">${verArchivados ? 'Ver rollos activos' : `Ver rollos terminados (${archivados.length})`}</button>` : ''}

      <p class="ayuda centro">Pesá tus rollos de vez en cuando: el peso real corrige cualquier diferencia con lo calculado.</p>
    `);

    el.addEventListener('click', async e => {
      const btn = e.target.closest('[data-a]');
      if (!btn) return;
      const a = btn.dataset.a;
      const f = st.filamentos.find(x => x.id === btn.dataset.id);

      if (a === 'ver-arch') { verArchivados = !verArchivados; ctx.rerender(); }

      if (a === 'nuevo') {
        const fd = await abrirDialogo(formRollo(), { validar: validarRollo, setup: setupColores });
        if (!fd) return;
        const cant = Math.max(1, Math.min(50, Math.round(num(fd.get('cantidad'), 1))));
        const pesoNeto = num(fd.get('pesoNeto'), 1000);
        const costo = num(fd.get('costo'));
        ctx.update(s => {
          for (let i = 0; i < cant; i++) {
            s.filamentos.push({ id: uid(), marca: fd.get('marca'), material: fd.get('material'), color: fd.get('color'),
              hex: fd.get('hex'), costo, pesoNeto, restante: pesoNeto, fecha: hoyISO(), archivado: false });
          }
          if (fd.get('gasto') === 'on' && costo > 0) {
            s.gastos.push({ id: uid(), fecha: hoyISO(), categoria: 'Filamento',
              descripcion: `${cant} ${cant === 1 ? 'rollo' : 'rollos'} ${fd.get('material')} ${fd.get('color')}`, monto: costo * cant });
          }
        });
        toast(cant === 1 ? 'Rollo agregado.' : `${cant} rollos agregados.`);
        ctx.rerender();
      }

      if (a === 'pesar' && f) {
        const fd = await abrirDialogo(html`
          <form method="dialog">
            <h2>Pesar ${f.material} ${f.color.toLowerCase()}</h2>
            <p class="dlg-detalle">Poné el rollo en la báscula. Se le resta el carrete y queda el filamento real.</p>
            <div class="fila">
              <label class="campo"><span>Peso en la báscula (g)</span><input name="bascula" inputmode="numeric" required autocomplete="off"></label>
              <label class="campo"><span>Carrete vacío (g)</span><input name="carrete" value="220" inputmode="numeric" autocomplete="off"></label>
            </div>
            <p class="dlg-error" hidden></p>
            <div class="dlg-acciones">
              <button class="btn" value="cancel" formnovalidate>Cancelar</button>
              <button class="btn btn-primario" value="ok">Actualizar</button>
            </div>
          </form>`, { validar: d => (num(d.get('bascula'), -1) < 0 ? 'Poné el peso que marca la báscula.' : null) });
        if (!fd) return;
        const restante = Math.max(0, Math.min(f.pesoNeto, num(fd.get('bascula')) - num(fd.get('carrete'), 220)));
        ctx.update(() => { f.restante = restante; f.archivado = restante <= 0 ? f.archivado : false; });
        toast(`Quedan ${fmtN(restante)} g.`);
        ctx.rerender();
      }

      if (a === 'editar' && f) {
        const fd = await abrirDialogo(html`${formRollo(f)}`, {
          validar: validarRollo,
          setup: d => {
            setupColores(d);
            const acc = d.querySelector('.dlg-acciones');
            const extra = document.createElement('div');
            extra.className = 'dlg-extra';
            extra.innerHTML = '<button type="button" class="btn-link" data-x="archivar"></button><button type="button" class="btn-link peligro" data-x="borrar">Borrar rollo</button>';
            extra.querySelector('[data-x="archivar"]').textContent = f.archivado ? 'Volver a activos' : 'Marcar como terminado';
            acc.before(extra);
            extra.addEventListener('click', async ev => {
              const x = ev.target.dataset.x;
              if (x === 'archivar') { ctx.update(() => { f.archivado = !f.archivado; }); d.close(); ctx.rerender(); }
              if (x === 'borrar') {
                d.close();
                if (await confirmar('¿Borrar este rollo?', { ok: 'Borrar', peligro: true, detalle: 'Las ventas que lo usaron conservan su costo.' })) {
                  ctx.update(s => { s.filamentos = s.filamentos.filter(r => r.id !== f.id); });
                  toast('Rollo borrado.'); ctx.rerender();
                }
              }
            });
          }
        });
        if (!fd) return;
        ctx.update(() => {
          const pesoNeto = num(fd.get('pesoNeto'), f.pesoNeto);
          Object.assign(f, { material: fd.get('material'), marca: fd.get('marca'), color: fd.get('color'), hex: fd.get('hex'),
            costo: num(fd.get('costo'), f.costo), pesoNeto, restante: Math.max(0, Math.min(pesoNeto, num(fd.get('restante'), f.restante))) });
        });
        toast('Rollo actualizado.');
        ctx.rerender();
      }
    });
  }
};
