export type LessonStatus = 'locked' | 'available' | 'completed'

export type AcademiaLesson = {
  id: string
  title: string
  duration: string
  concept: string
  keyPoints: string[]
  labScenarioId?: string
}

export type AcademiaModule = {
  id: string
  order: number
  title: string
  description: string
  tag: string
  lessons: AcademiaLesson[]
}

const modules: AcademiaModule[] = [
  {
    id: 'estructura',
    order: 1,
    title: 'Estructura de mercado',
    description: 'Aprende a leer el terreno antes de operar: barridas, reclaims y Order Blocks.',
    tag: 'Fundamentos',
    lessons: [
      {
        id: 'barrida-reclaim',
        title: 'Barridas de liquidez y reclaim',
        duration: '5 min',
        concept:
          'El mercado busca liquidez donde los traders tienen sus stops. Una barrida es un movimiento brusco que barre los stops por debajo de un soporte o por encima de una resistencia, para luego revertir con fuerza. El reclaim ocurre cuando el precio regresa y cierra de vuelta dentro del nivel barrido. Este patrón indica que los "stops fueron cazados" y que el movimiento real puede ser en la dirección opuesta.',
        keyPoints: [
          'La mecha larga es la evidencia de la barrida — sin mecha no hay barrida limpia.',
          'El cierre de vuelta dentro del nivel es la confirmación del reclaim.',
          'Volumen alto en la vela de reclaim refuerza la señal institucional.',
          'Cuanto más limpia la estructura previa, más confiable el setup.',
        ],
        labScenarioId: 'nq-sweep-reclaim',
      },
      {
        id: 'order-blocks',
        title: 'Order Blocks y zonas de demanda',
        duration: '6 min',
        concept:
          'Un Order Block (OB) es la última vela antes de un movimiento impulsivo de alta velocidad. Representa una zona donde hubo acumulación o distribución institucional. Cuando el precio regresa a ese nivel, los participantes que no pudieron entrar en el impulso original vuelven a comprar (o vender), generando un rebote. No todos los pullbacks al OB son válidos — hay que verificar que el volumen decreció en el retroceso.',
        keyPoints: [
          'El OB alcista es la última vela bajista antes del impulso alcista.',
          'El OB bajista es la última vela alcista antes del impulso bajista.',
          'Volumen decreciente en el pullback confirma que no hay presión contraria.',
          'El OB pierde validez si el precio lo atraviesa con cierre sólido al otro lado.',
        ],
        labScenarioId: 'nq-breakout-pullback',
      },
      {
        id: 'quiebre-estructura',
        title: 'Quiebres de estructura verdaderos vs falsos',
        duration: '7 min',
        concept:
          'No todo quiebre de nivel es real. Un quiebre verdadero requiere cierre del cuerpo de la vela más allá del nivel, de preferencia con volumen superior al promedio. Un quiebre falso (fakeout) ocurre cuando el precio supera el nivel con mecha pero no sostiene el cierre por encima. Los fakeouts son trampas para los traders de breakout y generan oportunidades en la dirección contraria.',
        keyPoints: [
          'Cierre del cuerpo por encima/debajo del nivel es la validación mínima.',
          'Volumen bajo en el quiebre es una señal de alerta de fakeout.',
          'La vela siguiente al quiebre debe continuar — si retrocede de inmediato, sospechoso.',
          'Los fakeouts en zonas de alta confluencia (mensual/semanal) son muy frecuentes.',
        ],
        labScenarioId: 'eur-false-breakout',
      },
    ],
  },
  {
    id: 'reversiones',
    order: 2,
    title: 'Patrones de reversión',
    description: 'Reconoce las señales de agotamiento antes de que el mercado cambie de dirección.',
    tag: 'Patrones',
    lessons: [
      {
        id: 'doble-techo-piso',
        title: 'Doble techo y doble piso',
        duration: '5 min',
        concept:
          'El doble techo forma dos picos al mismo nivel de resistencia con un pullback entre ellos. El doble piso forma dos valles al mismo soporte. La clave no está en la forma visual, sino en la calidad: el segundo testeo debe mostrar señales de debilidad (divergencia en RSI, vela de rechazo más pronunciada, volumen decreciente en el segundo intento). Sin esas confirmaciones, el patrón puede ser una simple pausa antes de continuar.',
        keyPoints: [
          'La divergencia en RSI entre el primer y segundo techo/piso es la mejor confirmación.',
          'El segundo testeo con volumen menor indica que el impulso se agota.',
          'El objetivo clásico es la distancia del patrón proyectada desde el neckline.',
          'Un doble techo en zona de oferta tiene mucha más probabilidad que en medio del rango.',
        ],
        labScenarioId: 'xau-double-top',
      },
      {
        id: 'hombro-cabeza-hombro',
        title: 'Hombro-Cabeza-Hombro (HCH)',
        duration: '8 min',
        concept:
          'El HCH es una de las formaciones de reversa más estudiadas. Se forma con tres picos: dos hombros similares y una cabeza más alta en el centro. El neckline conecta los valles entre picos. La confirmación viene con el cierre por debajo del neckline. El volumen idealmente decrece en cada pico subsiguiente, mostrando que el mercado pierde convicción alcista con cada intento.',
        keyPoints: [
          'Los hombros deben ser aproximadamente simétricos en tiempo y altura.',
          'La cabeza debe ser notablemente más alta que los hombros.',
          'El quiebre del neckline con volumen es la entrada clásica.',
          'El pullback al neckline después del quiebre ofrece una segunda entrada más conservadora.',
        ],
        labScenarioId: 'eth-head-shoulders',
      },
      {
        id: 'distribucion-rechazo',
        title: 'Distribución: rechazos sucesivos en techo',
        duration: '6 min',
        concept:
          'La distribución ocurre cuando el precio intenta repetidamente superar un nivel de oferta y falla. Cada intento genera una vela de rechazo, y con el tiempo los cierres quedan progresivamente más bajos aunque las mechas toquen el mismo nivel. Este patrón indica que los vendedores absorben cada impulso comprador. Es diferente del HCH en que no tiene la estructura de hombros definida, pero es igualmente confiable en zonas de alta oferta.',
        keyPoints: [
          'Tres o más rechazos al mismo nivel con cierres decrecientes.',
          'El volumen vendedor debe aumentar en cada rechazo para confirmar absorción.',
          'La entrada corta se toma al cierre de la tercera vela de rechazo.',
          'SL por encima de las mechas de los rechazos, TP en el soporte de sesión.',
        ],
        labScenarioId: 'nq-distribution',
      },
    ],
  },
  {
    id: 'riesgo',
    order: 3,
    title: 'Gestión de riesgo',
    description: 'El R:R y el tamaño de posición son más importantes que el porcentaje de aciertos.',
    tag: 'Disciplina',
    lessons: [
      {
        id: 'rr-calculo',
        title: 'Cálculo del R:R y cuándo es suficiente',
        duration: '5 min',
        concept:
          'El ratio Riesgo:Recompensa (R:R) mide cuánto ganás por cada unidad que arriesgás. Un R:R de 2:1 significa que si ganás, ganás el doble de lo que perdés cuando fallás. Con un R:R de 2:1 y un win rate del 40%, la estrategia sigue siendo rentable. El error más común es tomar setups técnicamente correctos pero con R:R menor a 1.5:1 — donde necesitás ganar más del 60% de las veces solo para empatar.',
        keyPoints: [
          'R:R mínimo aceptable: 1.5:1. Ideal: 2:1 o más.',
          'Con R:R = 2:1, un 34% de win rate ya es rentable.',
          'Un stop demasiado ajustado mejora el R:R en papel pero aumenta los stopouts prematuros.',
          'El TP debe estar en un nivel técnico real, no solo donde da el R:R deseado.',
        ],
        labScenarioId: 'spx-bad-rr',
      },
      {
        id: 'cuando-no-operar',
        title: 'Cuándo NO operar: los 3 filtros',
        duration: '6 min',
        concept:
          'No operar es una posición válida. Los tres filtros principales son: (1) Chop / lateralidad — el ATR está comprimido y el CHOP Index alto indica que no hay dirección. (2) Post-noticia — los primeros 15 minutos después de un dato de alto impacto son ruido puro. (3) Tendencia sobreextendida — entrar largo después de 8 velas consecutivas alcistas sin pullback te deja con un SL enorme y un TP muy cercano a resistencia.',
        keyPoints: [
          'CHOP Index > 61.8 = mercado lateral, mejor esperar.',
          'NFP, CPI, FOMC: los primeros 15 min son trampa — esperá el spread normal.',
          'Una tendencia extendida sin retroceso tiene más probabilidad de corrección que de continuación inmediata.',
          'El aburrimiento no es razón para entrar — la siguiente oportunidad llega.',
        ],
        labScenarioId: 'btc-chop-noise',
      },
      {
        id: 'fomo-late-entry',
        title: 'FOMO: el costo de perseguir el movimiento',
        duration: '5 min',
        concept:
          'El FOMO (Fear Of Missing Out) lleva a entrar después de que el movimiento ya está avanzado, con un SL enorme y un TP cercano a la resistencia más próxima. El resultado es un R:R desfavorable y alta exposición al stop-hunt. La disciplina de solo entrar en pullbacks a zonas o en confirmaciones claras evita el 80% de las entradas apresuradas. Si perdiste el tren, el siguiente setup es siempre mejor que perseguir el actual.',
        keyPoints: [
          'Si el precio ya subió 2% sin retroceso, el momento óptimo de entrada ya pasó.',
          'El volumen decreciente en la extensión del impulso confirma agotamiento.',
          'Esperá el pullback al OB o a la zona de demanda — suele llegar.',
          'Anota cuántas veces el FOMO te costó dinero para construir memoria emocional.',
        ],
        labScenarioId: 'btc-late-entry',
      },
    ],
  },
  {
    id: 'tendencia',
    order: 4,
    title: 'Operando en tendencia',
    description: 'Los mejores setups son pullbacks limpios dentro de tendencias claras.',
    tag: 'Estrategia',
    lessons: [
      {
        id: 'pullback-demanda',
        title: 'Pullback a zona de demanda en tendencia alcista',
        duration: '5 min',
        concept:
          'En una tendencia alcista con higher highs y higher lows, la entrada de mayor probabilidad es el pullback ordenado a la zona de demanda previa. El retroceso ideal muestra volumen decreciente (poca convicción vendedora), cuerpos de vela pequeños y una vela de absorción o cierre alcista al llegar a la zona. La tendencia hace el trabajo — el trader solo tiene que esperar que el precio ofrezca una entrada de bajo riesgo.',
        keyPoints: [
          'En tendencia, esperar el pullback siempre es mejor que perseguir el impulso.',
          'Volumen decreciente en el retroceso = los vendedores no tienen convicción.',
          'Una martillo o vela envolvente alcista en la zona de demanda es la señal de entrada.',
          'SL por debajo de la zona de demanda, TP en el high anterior o extensión.',
        ],
        labScenarioId: 'xau-pullback-demand',
      },
      {
        id: 'bandera-alcista',
        title: 'Banderas y pennants de continuación',
        duration: '6 min',
        concept:
          'Una bandera alcista se forma cuando después de un impulso brusco el precio consolida en un canal descendente estrecho con volumen decreciente. Este retroceso ordenado es una pausa de los compradores, no un cambio de tendencia. El quiebre de la bandera con volumen retomando confirma la continuación. El objetivo es la proyección del "mástil" (el impulso previo) desde el punto de quiebre.',
        keyPoints: [
          'El retroceso debe ser ordenado y con volumen decreciente — si no, no es bandera.',
          'El quiebre de la bandera debe tener volumen creciente para ser válido.',
          'El retroceso al 38.2% o 50% de Fibonacci refuerza la validez de la bandera.',
          'Objetivo: proyectar la altura del impulso previo desde el punto de quiebre.',
        ],
        labScenarioId: 'btc-bull-flag',
      },
      {
        id: 'consolidacion-breakout',
        title: 'Consolidación estrecha antes del quiebre',
        duration: '5 min',
        concept:
          'Cuando el precio entra en una consolidación estrecha (rango de velas muy reducido) después de un impulso, está "cargando" para el siguiente movimiento. Este patrón, a menudo llamado "bandera apretada" o "tight flag", produce algunos de los mejores R:R del mercado porque el SL es muy ajustado. El quiebre con volumen 2x o 3x el promedio confirma que la consolidación terminó y el impulso retoma.',
        keyPoints: [
          'Cuanto más estrecha la consolidación, más comprimida está la energía.',
          'Velas con cuerpos muy pequeños y mechas mínimas = rango de consolidación real.',
          'El quiebre necesita al menos 2x el volumen promedio para ser confiable.',
          'Esta formación funciona en cualquier temporalidad — es fractal.',
        ],
        labScenarioId: 'nq-consolidation-breakout',
      },
    ],
  },
]

export default modules
