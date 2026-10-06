// Punto de arranque. Para agregar una pantalla nueva:
//   1. Creá js/views/mi-pantalla.js exportando { id, titulo, icono, render(el, ctx) }
//   2. Importala aquí y agregala a MODULOS.
// Eso es todo: aparece sola en la barra de abajo.

import * as store from './store.js';
import { html, mount, toast } from './ui.js';
import cotizar from './views/cotizar.js';
import panel from './views/panel.js';
import filamento from './views/filamento.js';
import registro from './views/registro.js';
import ajustes from './views/ajustes.js';
import bienvenida from './views/bienvenida.js';

const MODULOS = [cotizar, panel, filamento, registro, ajustes];

store.load();

const vista = document.getElementById('vista');
const nav = document.getElementById('nav');
const titulo = document.getElementById('titulo');

const ctx = {
  get state() { return store.get(); },
  save: () => {
    const ok = store.save();
    if (!ok) toast('No se pudo guardar: el teléfono no tiene espacio libre.');
    return ok;
  },
  update: fn => { const ok = store.update(fn); if (!ok) toast('No se pudo guardar: el teléfono no tiene espacio libre.'); return ok; },
  go: id => { if (location.hash !== '#/' + id) location.hash = '#/' + id; },
  rerender: () => render()
};

function moduloActual() {
  const id = (location.hash.match(/^#\/([\w-]+)/) || [])[1];
  return MODULOS.find(m => m.id === id) || MODULOS[0];
}

function render() {
  const st = store.get();
  const enBienvenida = !st.onboarded;
  const mod = enBienvenida ? bienvenida : moduloActual();
  document.body.classList.toggle('sin-nav', enBienvenida);
  titulo.textContent = enBienvenida ? '' : mod.titulo;

  // cada render usa un contenedor nuevo: así los eventos viejos no se acumulan
  const scrollPrevio = vista.dataset.mod === mod.id ? window.scrollY : 0;
  const el = document.createElement('div');
  el.className = 'pantalla p-' + mod.id;
  vista.replaceChildren(el);
  vista.dataset.mod = mod.id;
  mod.render(el, ctx);
  window.scrollTo(0, scrollPrevio);

  if (!enBienvenida) {
    mount(nav, html`${MODULOS.map(m => html`
      <a href="#/${m.id}" class="${m.id === mod.id ? 'on' : ''}" ${m.id === mod.id ? html`aria-current="page"` : ''}>${m.icono}<span>${m.titulo}</span></a>`)}`);
    avisoRespaldo(st);
  }
}

// Recordatorio de respaldo: si hay datos y pasaron más de 14 días.
let avisado = false;
function avisoRespaldo(st) {
  if (avisado || !st.ventas.length) return;
  const ult = st.settings.ultimoRespaldo ? new Date(st.settings.ultimoRespaldo) : null;
  if (!ult || (Date.now() - ult.getTime()) > 14 * 864e5) {
    avisado = true;
    setTimeout(() => toast('Hace rato no respaldás tus datos.', { texto: 'Respaldar', fn: () => ctx.go('ajustes') }), 1200);
  }
}

window.addEventListener('hashchange', () => render());
render();
store.pedirPersistencia();

// ---------- funcionamiento sin internet y actualizaciones ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Hay una versión nueva de la app.', { texto: 'Actualizar', fn: () => nuevo.postMessage('activar') });
        }
      });
    });
  }).catch(() => { /* sin service worker la app igual funciona en línea */ });
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return; recargando = true; location.reload();
  });
}
