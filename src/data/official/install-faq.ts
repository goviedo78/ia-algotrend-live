export interface FaqItem {
  id: string
  question: string
  answer: string
}

export interface InstallStep {
  number: string
  title: string
  detail: string
}

export const installSteps: InstallStep[] = [
  {
    number: '01',
    title: 'Compra el script completo',
    detail:
      'Adquiri el indicador desde la tienda oficial de GONOVI. Recibiras el Pine Script completo por email despues de confirmar el pago.',
  },
  {
    number: '02',
    title: 'Abri TradingView',
    detail:
      'Entra a TradingView desde navegador o la app de escritorio. El script es tuyo y podes cargarlo en tu cuenta.',
  },
  {
    number: '03',
    title: 'Abri Pine Editor',
    detail:
      'En la parte inferior del grafico, abri la pestana Pine Editor para pegar el codigo completo del indicador.',
  },
  {
    number: '04',
    title: 'Pega el codigo',
    detail:
      'Copia el Pine Script recibido por email, pegalo en Pine Editor y guardalo con el nombre recomendado.',
  },
  {
    number: '05',
    title: 'Agrega al grafico',
    detail:
      'Hace click en "Agregar al grafico". Si TradingView muestra algun aviso, revisa que el codigo se haya copiado completo.',
  },
  {
    number: '06',
    title: 'Carga la configuracion recomendada',
    detail:
      'Aplica los parametros sugeridos desde el panel de ajustes del indicador para respetar la version comprada.',
  },
  {
    number: '07',
    title: 'Guarda tu plantilla',
    detail:
      'Guarda el layout o plantilla para no repetir la configuracion cada vez que abras TradingView.',
  },
  {
    number: '08',
    title: 'Configura alertas',
    detail:
      'Si queres notificaciones, crea alertas desde TradingView usando las condiciones disponibles del script.',
  },
]

export const beforeBuyingItems = [
  {
    question: 'Que necesito para usar los indicadores?',
    answer:
      'Una cuenta de TradingView y haber comprado el Pine Script completo. No necesitas instalar nada en tu computadora.',
  },
  {
    question: 'Recibo el script completo?',
    answer:
      'Si. Recibis el codigo fuente completo de Pine Script por email. Es tuyo para siempre, sin suscripcion ni acceso revocable.',
  },
  {
    question: 'Necesito TradingView pago?',
    answer:
      'No es obligatorio. Los indicadores funcionan en cualquier plan, incluyendo el gratuito. Algunas funciones avanzadas como alertas multiples o webhooks si requieren plan pago de TradingView.',
  },
  {
    question: 'Dependo de una activacion manual?',
    answer:
      'No. Al recibir el script completo, no dependes de una activacion manual ni de un acceso revocable.',
  },
]

export const alertInfo = [
  {
    title: 'Alerta visual',
    detail:
      'El indicador marca senales directamente en el grafico con flechas, colores o etiquetas. No requiere configuracion extra.',
  },
  {
    title: 'Alerta push / notificacion',
    detail:
      'Podes crear una alerta en TradingView para que te avise al celular o email cuando el indicador genere una senal. Disponible en cualquier plan.',
  },
  {
    title: 'Webhook',
    detail:
      'Permite conectar la senal a un sistema externo (bot, servidor, Telegram). Requiere plan Essential o superior de TradingView.',
  },
]

export const alertSteps = [
  'Hace click derecho en el indicador en el grafico o usa el boton de alerta.',
  'En "Condicion", selecciona el nombre del indicador AlgoTrend.',
  'Elegi la condicion de la senal (ejemplo: "Senal de compra", "Probabilidad cruza arriba").',
  'Configura como queres recibir la alerta: push, email, webhook o popup.',
  'Dale nombre descriptivo y guarda.',
]

export const faqItems: FaqItem[] = [
  {
    id: 'codigo-fuente',
    question: 'Recibo el codigo fuente del indicador?',
    answer:
      'Si. Recibis el Pine Script completo por email. Es tuyo para siempre, sin suscripcion ni acceso revocable.',
  },
  {
    id: 'tiempo-entrega',
    question: 'Cuanto tarda la entrega?',
    answer:
      'La entrega se realiza por email despues de confirmar el pago. En compras manuales o cripto puede requerir validacion del comprobante.',
  },
  {
    id: 'plan-tradingview',
    question: 'Necesito TradingView pago?',
    answer:
      'No para usar el indicador. El plan gratuito de TradingView es suficiente para ver y usar las senales. Si queres alertas avanzadas, multiples alertas simultaneas o webhooks, necesitas un plan pago de TradingView.',
  },
  {
    id: 'celular',
    question: 'Puedo usarlo en celular?',
    answer:
      'Si. TradingView tiene app para iOS y Android. El indicador aparece igual que en la version de escritorio. Las alertas push tambien llegan al celular.',
  },
  {
    id: 'cambiar-usuario',
    question: 'Puedo usarlo en otra cuenta de TradingView?',
    answer:
      'El script completo queda en tu poder. Podes cargarlo en tu TradingView como cualquier codigo Pine Script propio.',
  },
  {
    id: 'no-aparece',
    question: 'Que hago si no aparece el indicador?',
    answer:
      'Primero verifica que pegaste el codigo completo en Pine Editor y guardaste el script. Si aparece un error, escribinos con una captura de pantalla.',
  },
  {
    id: 'opera-solo',
    question: 'El indicador opera por mi?',
    answer:
      'No. El indicador es una herramienta de analisis visual. Muestra senales, probabilidades y contexto de mercado. La decision de operar siempre es tuya. No ejecuta ni conecta ordenes automaticamente.',
  },
  {
    id: 'asesoria',
    question: 'Las senales son recomendacion financiera?',
    answer:
      'No. Los indicadores son herramientas educativas y de analisis tecnico. No constituyen asesoria financiera, recomendacion de inversion ni garantia de resultados. Cada persona es responsable de sus decisiones de trading.',
  },
  {
    id: 'varios-dispositivos',
    question: 'Puedo usarlo en varios dispositivos?',
    answer:
      'Si. Al estar cargado en tu cuenta de TradingView, podes abrirlo desde computadora, tablet y celular.',
  },
  {
    id: 'soporte',
    question: 'Donde pido soporte?',
    answer:
      'Por WhatsApp al canal oficial de GONOVI, por email o a traves de la seccion de comunidad en gonovi.app. El tiempo de respuesta habitual es menor a 24 horas.',
  },
]
