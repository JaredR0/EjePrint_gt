// Valores iniciales de la app. Todo esto se puede cambiar después en Ajustes.
// Si agregás un campo nuevo a los ajustes, ponelo aquí con su valor por defecto
// y store.js lo va a completar solo en los datos que ya existen.

export const SCHEMA = 1;
export const VERSION = '1.0.0';

export const MATERIALES = ['PLA', 'PLA+', 'PLA Silk', 'PLA Mate', 'PETG', 'TPU', 'ABS', 'ASA', 'Otro'];
export const ESTADOS = ['Cotizado', 'Anticipo', 'Imprimiendo', 'Listo', 'Entregado', 'Cancelado'];
// Estados que todavía no cuentan como venta en el panel
export const ESTADOS_SIN_VENTA = ['Cotizado', 'Cancelado'];

export function hoyISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function defaultSettings() {
  return {
    tarifaLuz: 1.51,          // Q por kWh
    factorFallos: 1.12,       // 12 % de material extra por fallos y purga
    costoGramoDefault: 0.169, // se usa solo si una línea no tiene rollo
    postHora: 30,             // tu tiempo de acabado, Q por hora
    empaque: 0,               // Q por pedido
    multDiseno: false,        // ¿el multiplicador también se aplica al diseño?
    metaQHora: 20,            // Q por hora-máquina que buscás
    tarifasDiseno: [
      { id: 'normal', nombre: 'Normal', valor: 100 },
      { id: 'estudiante', nombre: 'Estudiante', valor: 25 }
    ],
    multiplicadores: [
      { id: 'funcional', nombre: 'Funcional o prototipo', valor: 2.2 },
      { id: 'catalogo', nombre: 'Producto de catálogo', valor: 4 },
      { id: 'personalizado', nombre: 'Personalizado', valor: 5 },
      { id: 'corporativo', nombre: 'Corporativo o volumen', valor: 2.5 }
    ],
    metaHoras: 120,
    margenContrib: 0.7,
    fijos: [
      { id: 'cuota', nombre: 'Cuota de la impresora', valor: 160 },
      { id: 'mant', nombre: 'Reserva de mantenimiento', valor: 65 },
      { id: 'repo', nombre: 'Fondo de reposición', valor: 120 },
      { id: 'insumos', nombre: 'Empaque e insumos', valor: 50 },
      { id: 'luz', nombre: 'Luz de la casa', valor: 60 },
      { id: 'publi', nombre: 'Publicidad', valor: 0 }
    ],
    reparto: [
      { id: 'filamento', nombre: 'Reponer filamento', pct: 0.25 },
      { id: 'fijos', nombre: 'Cuota y fijos', pct: 0.15 },
      { id: 'reinversion', nombre: 'Reinversión', pct: 0.20 },
      { id: 'pago', nombre: 'Tu pago', pct: 0.40 }
    ],
    deuda: { saldo: 5700, cuota: 160, pagadas: 2 },
    canales: ['Instagram', 'TikTok', 'Facebook Marketplace', 'WhatsApp', 'Referido', 'Universidad', 'Corporativo', 'En persona', 'Otro'],
    categoriasGasto: ['Filamento', 'Cuota impresora', 'Repuestos', 'Empaque', 'Publicidad', 'Envíos', 'Herramientas', 'Impuestos SAT', 'Otro'],
    impresoraActiva: 'kobra-s1',
    ultimoRespaldo: ''
  };
}

export function defaultState() {
  return {
    schema: SCHEMA,
    onboarded: false,
    settings: defaultSettings(),
    impresoras: [
      { id: 'kobra-s1', nombre: 'Anycubic Kobra S1', precio: 5500, vida: 4000, mantAnual: 800, horasAnio: 1200, kwh: 0.15 }
    ],
    filamentos: [],
    ventas: [],
    gastos: [],
    borrador: null
  };
}
