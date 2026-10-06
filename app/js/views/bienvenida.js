import { html, mount, toast } from '../ui.js';
import { num } from '../calc.js';
import { importar } from '../store.js';

let paso = 0;

export default {
  id: 'bienvenida',
  titulo: 'Bienvenida',

  render(el, ctx) {
    const st = ctx.state;
    const s = st.settings;
    const imp = st.impresoras[0];
    const tarifa = id => s.tarifasDiseno.find(t => t.id === id)?.valor ?? 0;

    const pasos = [
      html`
        <h1 class="bv-t">Tu taller en el bolsillo</h1>
        <p class="bv-p">Cotizá con los datos del laminador, llevá el inventario de filamento y mirá cuánto ganás de verdad. Todo queda guardado en este teléfono.</p>
        <p class="bv-p">Primero, tres datos rápidos. Los podés cambiar cuando quieras en Ajustes.</p>
        <button type="button" class="btn btn-primario btn-ancho" data-a="sig">Empezar</button>
        <label class="btn btn-ancho btn-archivo">Ya tengo un respaldo<input type="file" accept="application/json,.json" data-a="importar" hidden></label>`,
      html`
        <p class="bv-paso">Paso 1 de 3</p>
        <h1 class="bv-t">Tu máquina</h1>
        <label class="campo"><span>Nombre</span><input name="nombre" value="${imp.nombre}" maxlength="80" autocomplete="off"></label>
        <div class="fila">
          <label class="campo"><span>Precio (Q)</span><input name="precio" value="${imp.precio}" inputmode="decimal" autocomplete="off"></label>
          <label class="campo"><span>Vida útil (horas)</span><input name="vida" value="${imp.vida}" inputmode="numeric" autocomplete="off"></label>
        </div>
        <p class="ayuda">Si la compraste a cuotas, poné el total que vas a pagar.</p>`,
      html`
        <p class="bv-paso">Paso 2 de 3</p>
        <h1 class="bv-t">Luz y material</h1>
        <label class="campo"><span>Tarifa de luz (Q por kWh)</span><input name="tarifaLuz" value="${s.tarifaLuz}" inputmode="decimal" autocomplete="off"></label>
        <p class="ayuda">Dividí el total de tu recibo entre los kWh que consumiste.</p>
        <label class="campo"><span>Material extra por fallos y purga (%)</span><input name="fallos" value="${Math.round((s.factorFallos - 1) * 100)}" inputmode="numeric" autocomplete="off"></label>
        <p class="ayuda">Los rollos los agregás después en la pestaña Filamento.</p>`,
      html`
        <p class="bv-paso">Paso 3 de 3</p>
        <h1 class="bv-t">Cómo cobrás tu tiempo</h1>
        <label class="campo"><span>Acabado (Q por hora)</span><input name="postHora" value="${s.postHora}" inputmode="decimal" autocomplete="off"></label>
        <div class="fila">
          <label class="campo"><span>Diseño normal (Q/h)</span><input name="disNormal" value="${tarifa('normal')}" inputmode="decimal" autocomplete="off"></label>
          <label class="campo"><span>Diseño estudiante (Q/h)</span><input name="disEst" value="${tarifa('estudiante')}" inputmode="decimal" autocomplete="off"></label>
        </div>
        <p class="ayuda">Los multiplicadores por tipo de trabajo ya vienen puestos. Los ajustás en Ajustes.</p>`
    ];

    mount(el, html`
      <div class="bienvenida">
        <div class="bv-marca"><span class="dot"></span>EJEPRINT <small>Taller</small></div>
        <form class="bv-form" novalidate>${pasos[paso]}</form>
        ${paso > 0 ? html`
          <div class="fila-btn">
            <button type="button" class="btn" data-a="ant">Atrás</button>
            <button type="button" class="btn btn-primario" data-a="sig">${paso === pasos.length - 1 ? 'Listo' : 'Siguiente'}</button>
          </div>` : ''}
      </div>`);

    function guardarPaso() {
      const f = new FormData(el.querySelector('form'));
      if (paso === 1) Object.assign(imp, {
        nombre: String(f.get('nombre') || imp.nombre).slice(0, 80),
        precio: Math.max(0, num(f.get('precio'), imp.precio)), vida: Math.max(1, num(f.get('vida'), imp.vida))
      });
      if (paso === 2) {
        s.tarifaLuz = Math.max(0, num(f.get('tarifaLuz'), s.tarifaLuz));
        s.factorFallos = 1 + Math.max(0, Math.min(200, num(f.get('fallos'), 12))) / 100;
      }
      if (paso === 3) {
        s.postHora = Math.max(0, num(f.get('postHora'), s.postHora));
        for (const [id, campo] of [['normal', 'disNormal'], ['estudiante', 'disEst']]) {
          const t = s.tarifasDiseno.find(x => x.id === id);
          if (t) t.valor = Math.max(0, num(f.get(campo), t.valor));
        }
      }
      ctx.save();
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'sig') {
        if (paso > 0) guardarPaso();
        if (paso === pasos.length - 1) { st.onboarded = true; paso = 0; ctx.save(); ctx.go('cotizar'); ctx.rerender(); return; }
        paso++; ctx.rerender();
      }
      if (a === 'ant') { guardarPaso(); paso--; ctx.rerender(); }
    });

    el.addEventListener('change', async e => {
      if (e.target.dataset.a !== 'importar') return;
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      try { importar(await archivo.text()); toast('Respaldo restaurado.'); ctx.go('panel'); ctx.rerender(); }
      catch (err) { toast(err.message); }
    });
  }
};
