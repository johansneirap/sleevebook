import type { ScanStatus } from "../../lib/scan-types";

/** Spanish copy for the scanner. Kept here so the components stay readable. */
export const SCANNER_COPY = {
  guideHint: "Encuadra la carta dentro del marco",
  capture: "Capturar",
  upload: "Subir una foto",
  again: "Escanear otra",
  reading: "Leyendo la carta…",
  bestMatch: "Mejor coincidencia",
  noMatchTitle: "No encontramos esta carta en el catálogo.",
  noMatchHint: "Puedes buscarla a mano en tu lista de deseos.",
  searchManually: "Buscar a mano",
  historyTitle: "Esta visita",
  wishlistAdd: "Agregar a mis deseos",
  wishlistSaving: "Agregando…",
  wishlistDone: "En tus deseos",
  binderAdd: "Agregar a un binder",
  binderPlace: "Colocar",
  binderPlacing: "Colocando…",
  notThis: "No es esta",
  createBinder: "Crear un binder",
  cameraHelp: "Si no ves la cámara, sube una foto de la carta.",
  tipsTitle: "Para una buena lectura",
  tips: [
    "Carta plana, sobre un fondo liso y oscuro.",
    "Luz pareja, sin reflejos sobre el foil.",
    "Que se vea bien el nombre y el número de la carta.",
    "Nosotros no guardamos nada hasta que tú lo elijas.",
  ],
  unreadable: "No pudimos usar esa imagen. Prueba con una foto JPG, PNG o WebP.",
  captureFailed: "No pudimos capturar la foto. Intenta de nuevo.",
  notReady: "La cámara todavía se está iniciando. Intenta de nuevo en un momento.",
} as const;

export const CAMERA_ERROR_COPY = {
  insecure:
    "La cámara solo funciona en una conexión segura (https). Sube una foto de la carta en su lugar.",
  denied:
    "No tenemos permiso para usar la cámara. Puedes permitirlo en la configuración del navegador o subir una foto.",
  missing: "No encontramos una cámara en este dispositivo. Sube una foto de la carta.",
  unknown: "No pudimos abrir la cámara. Puedes subir una foto de la carta en su lugar.",
} as const;

export const STATUS_COPY: Record<Exclude<ScanStatus, "ok">, string> = {
  "no-card":
    "No vemos una carta en la foto. Acércala, centra la carta en el marco y procura buena luz.",
  limit: "Llegaste al límite de escaneos de hoy. Vuelve mañana o busca la carta a mano.",
  disabled: "El escaneo aún no está disponible. Mientras tanto, busca la carta a mano.",
  invalid: "No pudimos usar esa foto. Prueba con una imagen JPG, PNG o WebP de menos de 1,5 MB.",
  error: "No pudimos leer la carta. Intenta de nuevo.",
};

export const FINISH_LABEL: Record<string, string> = {
  holo: "holo",
  reverse: "reverse",
  normal: "normal",
};
