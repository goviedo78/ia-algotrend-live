export type LabCategory = 'breakout' | 'reversal' | 'chop' | 'trend' | 'risk' | 'news'

export type LabScenario = {
  id: string
  market: string
  timeframe: string
  title: string
  difficulty: 'inicial' | 'intermedio' | 'avanzado'
  category: LabCategory
  context: string
  correctDecision: 'long' | 'short' | 'skip'
  resultR: number
  explanation: string
  /** Mock candle data: [open, high, low, close] normalised 0-100 */
  candles: [number, number, number, number][]
  /** Index where the "hidden future" begins (inclusive) */
  revealFrom: number
  /** Key levels drawn on chart (normalised 0-100) */
  levels: { y: number; label: string; kind: 'support' | 'resistance' | 'entry' | 'sl' | 'tp' }[]
}

const scenarios: LabScenario[] = [
  {
    id: 'nq-sweep-reclaim',
    market: 'NASDAQ',
    timeframe: '15M',
    title: 'Barrida de rango y reclaim sobre soporte',
    difficulty: 'inicial',
    category: 'breakout',
    context:
      'Precio consolido durante la sesion asiatica entre 18 320 y 18 380. En la apertura de NY el precio barrio el low del rango, dejo mecha larga y cerro de vuelta dentro. Volumen alto en la vela de reclaim.',
    correctDecision: 'long',
    resultR: 2.4,
    explanation:
      'La barrida de liquidez bajo el rango seguida de un cierre inmediato dentro es una trampa de vendedores clasica. El volumen alto confirma absorcion institucional. Entrada al cierre de la vela de reclaim con SL bajo la mecha da un R:R excelente hacia el high del rango.',
    candles: [
      [52, 58, 48, 55],
      [55, 60, 52, 53],
      [53, 56, 50, 54],
      [54, 55, 46, 47],
      [47, 48, 32, 34],
      [34, 55, 30, 52],
      // — reveal from here —
      [52, 62, 50, 60],
      [60, 68, 58, 66],
      [66, 74, 64, 72],
      [72, 78, 70, 76],
    ],
    revealFrom: 6,
    levels: [
      { y: 48, label: 'Soporte rango', kind: 'support' },
      { y: 60, label: 'Resistencia rango', kind: 'resistance' },
      { y: 30, label: 'SL', kind: 'sl' },
      { y: 76, label: 'TP 2R', kind: 'tp' },
    ],
  },
  {
    id: 'xau-double-top',
    market: 'XAU/USD',
    timeframe: '30M',
    title: 'Doble techo en zona de oferta con divergencia',
    difficulty: 'intermedio',
    category: 'reversal',
    context:
      'Oro llego a zona de oferta en 2 345 dos veces sin poder cerrar por encima. En el segundo intento, el RSI marco un high mas bajo que el primero. La vela de rechazo dejo mecha superior larga y cuerpo bajista. Contexto macro: DXY subiendo.',
    correctDecision: 'short',
    resultR: 1.8,
    explanation:
      'El doble techo con divergencia bearish en RSI en zona de oferta es una de las señales de reversa mas confiables en oro. El DXY al alza apoya la tesis bajista. Entrada al cierre de la vela de rechazo, SL 2 pips sobre el high, TP en el soporte intermedio.',
    candles: [
      [40, 48, 38, 46],
      [46, 56, 44, 54],
      [54, 64, 52, 62],
      [62, 72, 60, 70],
      [70, 88, 68, 78],
      [78, 82, 64, 66],
      [66, 76, 64, 74],
      [74, 90, 72, 74],
      // — reveal from here —
      [74, 76, 62, 64],
      [64, 66, 52, 54],
      [54, 58, 44, 46],
    ],
    revealFrom: 8,
    levels: [
      { y: 88, label: 'Oferta', kind: 'resistance' },
      { y: 74, label: 'Entrada', kind: 'entry' },
      { y: 92, label: 'SL', kind: 'sl' },
      { y: 46, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'btc-chop-noise',
    market: 'BTC/USD',
    timeframe: '1H',
    title: 'Consolidacion sin direccion clara',
    difficulty: 'avanzado',
    category: 'chop',
    context:
      'BTC lleva 14 horas entre 67 200 y 67 800 sin ninguna vela que cierre fuera del rango. El ATR esta en minimos del dia, CHOP Index por encima de 60. No hay noticias ni reportes macroeconomicos pendientes en las proximas 4 horas.',
    correctDecision: 'skip',
    resultR: 0,
    explanation:
      'El CHOP Index alto y el ATR comprimido indican que el mercado esta en fase de acumulacion sin direccion definida. Forzar una entrada aqui tiene probabilidad de stop-hunt en ambas direcciones. La mejor decision es esperar el quiebre con volumen. No operar es operar.',
    candles: [
      [50, 56, 46, 52],
      [52, 58, 48, 54],
      [54, 57, 49, 51],
      [51, 55, 47, 53],
      [53, 56, 48, 50],
      [50, 54, 46, 52],
      // — reveal from here —
      [52, 55, 47, 49],
      [49, 53, 45, 51],
      [51, 58, 44, 46],
      [46, 48, 36, 38],
    ],
    revealFrom: 6,
    levels: [
      { y: 58, label: 'Techo rango', kind: 'resistance' },
      { y: 46, label: 'Piso rango', kind: 'support' },
    ],
  },
  {
    id: 'nq-breakout-pullback',
    market: 'NASDAQ',
    timeframe: '5M',
    title: 'Quiebre de estructura con pullback al OB',
    difficulty: 'intermedio',
    category: 'trend',
    context:
      'NQ rompio estructura al alza con vela impulsiva de alto volumen, dejando un Order Block entre 18 440 y 18 455. El precio retrocedio al OB en las siguientes 3 velas con volumen decreciente. La ultima vela cerro justo en el borde superior del OB con mecha inferior de absorcion.',
    correctDecision: 'long',
    resultR: 3.1,
    explanation:
      'Quiebre de estructura + pullback al Order Block con volumen decreciente es el setup de continuacion mas limpio en temporalidades rapidas. La vela de absorcion en el OB confirma que los compradores defienden la zona. SL bajo el OB, TP en extension 1.618 del impulso.',
    candles: [
      [42, 48, 38, 44],
      [44, 46, 40, 42],
      [42, 50, 40, 48],
      [48, 72, 46, 70],
      [70, 72, 56, 58],
      [58, 60, 50, 52],
      [52, 54, 46, 50],
      // — reveal from here —
      [50, 62, 48, 60],
      [60, 74, 58, 72],
      [72, 84, 70, 82],
      [82, 92, 78, 88],
    ],
    revealFrom: 7,
    levels: [
      { y: 46, label: 'OB bajo', kind: 'support' },
      { y: 50, label: 'OB alto', kind: 'entry' },
      { y: 42, label: 'SL', kind: 'sl' },
      { y: 88, label: 'TP 3R', kind: 'tp' },
    ],
  },
  {
    id: 'eur-false-breakout',
    market: 'EUR/USD',
    timeframe: '15M',
    title: 'Quiebre falso sobre resistencia en sesion Londres',
    difficulty: 'intermedio',
    category: 'breakout',
    context:
      'EUR/USD rompio resistencia en 1.0865 con una vela impulsiva al abrir Londres. Sin embargo, la vela siguiente cerro completamente por debajo del nivel roto. El volumen de la vela de quiebre fue bajo comparado con las anteriores. DXY muestra soporte cercano.',
    correctDecision: 'short',
    resultR: 1.6,
    explanation:
      'Un quiebre con volumen bajo que no sostiene el cierre por encima es una señal clasica de fake breakout. El cierre de vuelta bajo resistencia atrapa a los compradores apurados. Entrada al cierre de la vela que re-entra, SL sobre la mecha del fake breakout, TP en el soporte del rango.',
    candles: [
      [44, 50, 42, 48],
      [48, 52, 46, 50],
      [50, 54, 48, 52],
      [52, 56, 50, 54],
      [54, 58, 52, 56],
      [56, 72, 55, 70],
      [70, 71, 54, 56],
      // — reveal —
      [56, 58, 46, 48],
      [48, 50, 38, 40],
      [40, 44, 36, 38],
    ],
    revealFrom: 7,
    levels: [
      { y: 58, label: 'Resistencia', kind: 'resistance' },
      { y: 56, label: 'Entrada', kind: 'entry' },
      { y: 73, label: 'SL', kind: 'sl' },
      { y: 38, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'spx-trend-extended',
    market: 'SPX',
    timeframe: '1H',
    title: 'Tendencia alcista extendida sin pullback',
    difficulty: 'avanzado',
    category: 'risk',
    context:
      'SPX lleva 8 velas consecutivas al alza sin ningun retroceso. El precio esta 2.5% por encima de la EMA20. RSI en 82. No hay soporte cercano definido. El movimiento inicio con gap alcista en apertura y no ha testeado ningun nivel.',
    correctDecision: 'skip',
    resultR: 0,
    explanation:
      'Entrar largo en una tendencia tan extendida sin pullback expone a un retroceso abrupto con SL amplio. Entrar corto contra tendencia sin señal de reversa es apuesta. El RSI en sobrecompra no es señal de venta por si solo. Lo correcto es esperar un retroceso a zona de demanda o una señal de agotamiento clara.',
    candles: [
      [38, 44, 36, 42],
      [42, 50, 40, 48],
      [48, 56, 47, 54],
      [54, 60, 52, 58],
      [58, 66, 57, 64],
      [64, 72, 63, 70],
      // — reveal —
      [70, 76, 68, 74],
      [74, 78, 66, 68],
      [68, 70, 58, 60],
      [60, 64, 56, 62],
    ],
    revealFrom: 6,
    levels: [
      { y: 72, label: 'Extension', kind: 'resistance' },
      { y: 42, label: 'EMA20 aprox', kind: 'support' },
    ],
  },
  {
    id: 'eth-double-bottom',
    market: 'ETH/USD',
    timeframe: '4H',
    title: 'Doble piso con mecha de absorcion en soporte semanal',
    difficulty: 'inicial',
    category: 'reversal',
    context:
      'ETH toco la zona de 2 820 dos veces en las ultimas 48 horas. Ambos testeos dejaron mechas inferiores largas y cierres por encima del nivel. En el segundo testeo, el volumen fue significativamente mayor. BTC estable, sin presion bajista macro.',
    correctDecision: 'long',
    resultR: 2.2,
    explanation:
      'El doble piso con aumento de volumen en el segundo testeo indica acumulacion institucional. Las mechas largas confirman demanda real en la zona. BTC estable elimina riesgo de correlacion bajista. Entrada sobre el cierre de la segunda vela de testeo, SL bajo la mecha mas profunda.',
    candles: [
      [58, 62, 54, 56],
      [56, 58, 42, 44],
      [44, 54, 40, 52],
      [52, 56, 50, 54],
      [54, 56, 48, 50],
      [50, 52, 38, 42],
      [42, 56, 36, 54],
      // — reveal —
      [54, 62, 52, 60],
      [60, 68, 58, 66],
      [66, 76, 64, 74],
    ],
    revealFrom: 7,
    levels: [
      { y: 40, label: 'Soporte semanal', kind: 'support' },
      { y: 54, label: 'Entrada', kind: 'entry' },
      { y: 34, label: 'SL', kind: 'sl' },
      { y: 74, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'btc-late-entry',
    market: 'BTC/USD',
    timeframe: '15M',
    title: 'Movimiento impulsivo ya avanzado sin retroceso',
    difficulty: 'intermedio',
    category: 'risk',
    context:
      'BTC acaba de subir 1.8% en 4 velas de 15 minutos desde una barrida de lows. El movimiento fue explosivo con volumen decreciente en las ultimas 2 velas. No ha retrocedido en ningun momento. La zona de oferta esta a solo 0.4% arriba.',
    correctDecision: 'skip',
    resultR: 0,
    explanation:
      'Entrar largo despues de un impulso de 1.8% sin retroceso deja un SL enorme y un TP muy cercano a resistencia. El volumen decreciente indica que el impulso pierde fuerza. El error clasico es FOMO: ver el movimiento y perseguirlo. Lo correcto es esperar pullback al OB del impulso o a la siguiente zona de demanda.',
    candles: [
      [40, 42, 30, 32],
      [32, 52, 30, 50],
      [50, 64, 48, 62],
      [62, 74, 60, 72],
      [72, 80, 70, 78],
      [78, 84, 76, 82],
      // — reveal —
      [82, 86, 74, 76],
      [76, 78, 64, 66],
      [66, 72, 62, 70],
      [70, 72, 60, 62],
    ],
    revealFrom: 6,
    levels: [
      { y: 86, label: 'Oferta', kind: 'resistance' },
      { y: 50, label: 'OB impulso', kind: 'support' },
    ],
  },
  {
    id: 'nq-opening-noise',
    market: 'NASDAQ',
    timeframe: '5M',
    title: 'Primeros 10 minutos de apertura NY con ruido',
    difficulty: 'inicial',
    category: 'news',
    context:
      'Son las 9:30 NY. Las primeras dos velas de 5M tienen mechas enormes en ambas direcciones. El spread esta amplio. No hay datos macro programados pero el pre-market tuvo gaps en ambas direcciones. El volumen es alto pero desordenado.',
    correctDecision: 'skip',
    resultR: 0,
    explanation:
      'Los primeros 10-15 minutos de apertura de NY son los mas ruidosos del dia. Las mechas enormes y el spread amplio hacen que cualquier SL sea enorme. El volumen alto pero desordenado no da direccion. Esperar a que se forme el rango de apertura (15-30 min) y operar el quiebre con contexto es mucho mas seguro.',
    candles: [
      [50, 54, 46, 52],
      [52, 54, 48, 50],
      [50, 52, 48, 50],
      [50, 68, 42, 58],
      [58, 62, 34, 40],
      [40, 56, 38, 54],
      // — reveal —
      [54, 58, 44, 46],
      [46, 52, 40, 50],
      [50, 56, 48, 54],
      [54, 58, 50, 56],
    ],
    revealFrom: 6,
    levels: [
      { y: 68, label: 'Mecha alta', kind: 'resistance' },
      { y: 34, label: 'Mecha baja', kind: 'support' },
    ],
  },
  {
    id: 'xau-pullback-demand',
    market: 'XAU/USD',
    timeframe: '1H',
    title: 'Pullback limpio a zona de demanda en tendencia alcista',
    difficulty: 'inicial',
    category: 'trend',
    context:
      'Oro viene en tendencia alcista con higher highs y higher lows claros. El precio retrocedio a la zona de demanda entre 2 310 y 2 318 con 3 velas bajistas de cuerpo pequeño y volumen decreciente. La ultima vela es un martillo con cierre alcista justo en el borde superior de la zona. DXY lateral.',
    correctDecision: 'long',
    resultR: 2.0,
    explanation:
      'Pullback ordenado a zona de demanda en tendencia alcista con volumen decreciente es el setup mas limpio de continuacion. El martillo confirma rechazo de la zona. SL bajo la zona de demanda, TP en el high anterior o extension. El error seria esperar mas confirmacion y perder la entrada.',
    candles: [
      [40, 52, 38, 50],
      [50, 62, 48, 60],
      [60, 70, 58, 68],
      [68, 74, 66, 72],
      [72, 74, 62, 64],
      [64, 66, 56, 58],
      [58, 60, 48, 50],
      [50, 58, 46, 56],
      // — reveal —
      [56, 66, 54, 64],
      [64, 74, 62, 72],
      [72, 80, 70, 78],
    ],
    revealFrom: 8,
    levels: [
      { y: 50, label: 'Demanda alta', kind: 'support' },
      { y: 46, label: 'Demanda baja', kind: 'support' },
      { y: 56, label: 'Entrada', kind: 'entry' },
      { y: 44, label: 'SL', kind: 'sl' },
      { y: 78, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'spx-bearish-engulfing',
    market: 'SPX',
    timeframe: '30M',
    title: 'Envolvente bajista en zona de oferta con contexto macro',
    difficulty: 'intermedio',
    category: 'reversal',
    context:
      'SPX llego a zona de oferta historica despues de un rally de 3 dias. La ultima vela de 30M es una envolvente bajista que cubre completamente las 2 velas anteriores. El VIX subio 8% en la ultima hora. Datos de CPI salen manana temprano.',
    correctDecision: 'short',
    resultR: 1.5,
    explanation:
      'Envolvente bajista en zona de oferta con VIX en ascenso es una combinacion fuerte de reversa. El rally previo de 3 dias genera profit-taking natural en resistencia. La incertidumbre del CPI amplifica la presion vendedora. Entrada al cierre de la envolvente, SL sobre la mecha, TP en el soporte del dia.',
    candles: [
      [42, 48, 40, 46],
      [46, 54, 44, 52],
      [52, 60, 50, 58],
      [58, 66, 56, 64],
      [64, 72, 62, 70],
      [70, 76, 68, 74],
      [74, 78, 72, 76],
      [76, 80, 60, 62],
      // — reveal —
      [62, 64, 52, 54],
      [54, 58, 48, 50],
      [50, 52, 42, 44],
    ],
    revealFrom: 8,
    levels: [
      { y: 78, label: 'Oferta', kind: 'resistance' },
      { y: 62, label: 'Entrada', kind: 'entry' },
      { y: 82, label: 'SL', kind: 'sl' },
      { y: 44, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'btc-fakeout-short-trap',
    market: 'BTC/USD',
    timeframe: '30M',
    title: 'Quiebre falso bajista que atrapa vendedores',
    difficulty: 'inicial',
    category: 'breakout',
    context:
      'BTC rompio el soporte de 66 400 con una vela de cuerpo grande. Pero las siguientes 2 velas no continuaron a la baja: cerraron con mechas inferiores largas y cuerpos cada vez mas pequeños. La ultima vela cerro por encima del soporte roto. El funding rate sigue positivo.',
    correctDecision: 'long',
    resultR: 1.9,
    explanation:
      'Cuando un quiebre bajista no produce continuacion y el precio recupera el nivel, los vendedores quedan atrapados con stops por encima. Esos stops se convierten en combustible alcista. La recuperacion del soporte con mechas de absorcion confirma demanda oculta. SL bajo la mecha mas baja del fakeout.',
    candles: [
      [58, 62, 56, 60],
      [60, 62, 56, 58],
      [58, 60, 54, 56],
      [56, 58, 52, 54],
      [54, 56, 36, 38],
      [38, 48, 34, 46],
      [46, 58, 44, 56],
      // — reveal —
      [56, 64, 54, 62],
      [62, 70, 60, 68],
      [68, 76, 66, 74],
    ],
    revealFrom: 7,
    levels: [
      { y: 54, label: 'Soporte', kind: 'support' },
      { y: 56, label: 'Entrada', kind: 'entry' },
      { y: 32, label: 'SL', kind: 'sl' },
      { y: 74, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'eth-head-shoulders',
    market: 'ETH/USD',
    timeframe: '1H',
    title: 'Hombro cabeza hombro en resistencia con volumen decreciente',
    difficulty: 'avanzado',
    category: 'reversal',
    context:
      'ETH formo 3 picos en la zona de 3 150. El pico central es el mas alto, los laterales son similares. El volumen en cada pico fue menor que el anterior. El neckline esta en 3 080. La ultima vela cerro justo en el neckline con cuerpo bajista. BTC muestra debilidad en temporalidad mayor.',
    correctDecision: 'short',
    resultR: 2.1,
    explanation:
      'El HCH con volumen decreciente en cada pico es una de las formaciones de reversa mas estudiadas. El cierre en el neckline con cuerpo bajista confirma la presion vendedora. BTC debil refuerza la tesis. Entrada al cierre bajo el neckline, SL sobre el hombro derecho, TP en la proyeccion del patron.',
    candles: [
      [42, 52, 40, 50],
      [50, 68, 48, 64],
      [64, 66, 52, 54],
      [54, 62, 52, 60],
      [60, 78, 58, 72],
      [72, 74, 56, 58],
      [58, 64, 56, 62],
      [62, 70, 58, 60],
      [60, 62, 48, 50],
      // — reveal —
      [50, 52, 40, 42],
      [42, 46, 34, 36],
      [36, 40, 30, 32],
    ],
    revealFrom: 9,
    levels: [
      { y: 78, label: 'Cabeza', kind: 'resistance' },
      { y: 68, label: 'Hombros', kind: 'resistance' },
      { y: 50, label: 'Neckline', kind: 'support' },
      { y: 50, label: 'Entrada', kind: 'entry' },
      { y: 72, label: 'SL', kind: 'sl' },
      { y: 32, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'nq-consolidation-breakout',
    market: 'NASDAQ',
    timeframe: '15M',
    title: 'Consolidacion estrecha que rompe al alza con volumen',
    difficulty: 'intermedio',
    category: 'breakout',
    context:
      'NQ lleva 5 velas de 15M en un rango de apenas 20 puntos despues de un impulso alcista. Las velas tienen cuerpos muy pequeños y mechas minimas. La ultima vela rompio el techo del rango con cuerpo lleno y volumen 3x el promedio. El contexto general es alcista.',
    correctDecision: 'long',
    resultR: 2.8,
    explanation:
      'Consolidacion estrecha despues de impulso = bandera/pennant de continuacion. El quiebre con volumen 3x confirma interes real. Las 5 velas de acumulacion construyeron la base para el siguiente movimiento. Entrada al cierre del breakout, SL bajo la consolidacion, TP en extension del impulso previo.',
    candles: [
      [38, 52, 36, 50],
      [50, 62, 48, 60],
      [60, 64, 58, 62],
      [62, 64, 60, 62],
      [62, 64, 60, 62],
      [62, 66, 60, 64],
      [64, 66, 62, 64],
      [64, 78, 62, 76],
      // — reveal —
      [76, 84, 74, 82],
      [82, 90, 80, 88],
      [88, 94, 84, 92],
    ],
    revealFrom: 8,
    levels: [
      { y: 66, label: 'Techo consolidacion', kind: 'resistance' },
      { y: 60, label: 'Piso consolidacion', kind: 'support' },
      { y: 76, label: 'Entrada', kind: 'entry' },
      { y: 58, label: 'SL', kind: 'sl' },
      { y: 92, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'xau-news-spike',
    market: 'XAU/USD',
    timeframe: '5M',
    title: 'Spike por noticia NFP: mecha en ambas direcciones',
    difficulty: 'avanzado',
    category: 'news',
    context:
      'Datos de NFP acaban de salir. La vela de 5M mostro una mecha de 30 pips arriba y 25 pips abajo en menos de 2 minutos. El spread se abrio 8x. Las siguientes 2 velas tienen cuerpos minimos y el precio quedo en el medio del spike. No hay lectura clara todavia.',
    correctDecision: 'skip',
    resultR: 0,
    explanation:
      'Operar en los primeros minutos despues de NFP es una de las trampas mas comunes. El spike en ambas direcciones caza stops de ambos lados. El spread amplio hace que cualquier entrada tenga un costo oculto enorme. Lo correcto es esperar 15-30 minutos a que el mercado digiera la data y el spread se normalice.',
    candles: [
      [50, 54, 48, 52],
      [52, 56, 50, 54],
      [54, 56, 50, 52],
      [52, 54, 50, 52],
      [52, 82, 28, 54],
      [54, 58, 46, 50],
      [50, 54, 48, 52],
      // — reveal —
      [52, 56, 44, 46],
      [46, 54, 42, 52],
      [52, 60, 50, 58],
    ],
    revealFrom: 7,
    levels: [
      { y: 82, label: 'Spike alto', kind: 'resistance' },
      { y: 28, label: 'Spike bajo', kind: 'support' },
    ],
  },
  {
    id: 'eur-reversal-key-level',
    market: 'EUR/USD',
    timeframe: '4H',
    title: 'Rechazo fuerte en resistencia mensual con pin bar',
    difficulty: 'intermedio',
    category: 'reversal',
    context:
      'EUR/USD llego a la resistencia mensual en 1.1020 por primera vez en 6 semanas. La vela de 4H dejo una pin bar con mecha superior de 35 pips y cierre bajista debajo del nivel. Las ultimas 3 sesiones mostraron momentum alcista pero debilitandose. El dolar tiene soporte tecnico cercano.',
    correctDecision: 'short',
    resultR: 1.4,
    explanation:
      'Una pin bar bajista en resistencia mensual con momentum debilitandose es una señal de alta probabilidad. La resistencia mensual no se rompe facil y el primer testeo suele producir rechazo. El soporte tecnico del dolar refuerza la tesis. SL sobre la mecha, TP en el soporte intermedio.',
    candles: [
      [34, 40, 32, 38],
      [38, 46, 36, 44],
      [44, 52, 42, 50],
      [50, 58, 48, 56],
      [56, 64, 54, 62],
      [62, 68, 60, 66],
      [66, 82, 64, 66],
      // — reveal —
      [66, 68, 58, 60],
      [60, 62, 52, 54],
      [54, 58, 50, 52],
    ],
    revealFrom: 7,
    levels: [
      { y: 72, label: 'Resistencia mensual', kind: 'resistance' },
      { y: 66, label: 'Entrada', kind: 'entry' },
      { y: 84, label: 'SL', kind: 'sl' },
      { y: 52, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'btc-bull-flag',
    market: 'BTC/USD',
    timeframe: '4H',
    title: 'Bandera alcista despues de impulso con retroceso ordenado',
    difficulty: 'inicial',
    category: 'trend',
    context:
      'BTC tuvo un impulso de 4.2% en 3 velas de 4H. Luego retrocedio con 4 velas bajistas de cuerpo pequeño formando un canal descendente. El retroceso llego al 38.2% de Fibonacci y la ultima vela muestra rechazo al alza. Volumen en el retroceso mucho menor que en el impulso.',
    correctDecision: 'long',
    resultR: 2.6,
    explanation:
      'La bandera alcista es un patron de continuacion clasico. El retroceso ordenado con volumen bajo al 38.2% de Fib es textbook. La vela de rechazo en la zona de Fibonacci confirma que los compradores defienden. SL bajo la bandera, TP en extension 1:1 del mastil.',
    candles: [
      [30, 44, 28, 42],
      [42, 56, 40, 54],
      [54, 68, 52, 66],
      [66, 68, 58, 60],
      [60, 62, 54, 56],
      [56, 58, 50, 52],
      [52, 54, 46, 48],
      [48, 56, 44, 54],
      // — reveal —
      [54, 66, 52, 64],
      [64, 76, 62, 74],
      [74, 86, 72, 84],
    ],
    revealFrom: 8,
    levels: [
      { y: 48, label: 'Fib 38.2%', kind: 'support' },
      { y: 44, label: 'Bandera baja', kind: 'support' },
      { y: 54, label: 'Entrada', kind: 'entry' },
      { y: 42, label: 'SL', kind: 'sl' },
      { y: 84, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'spx-bad-rr',
    market: 'SPX',
    timeframe: '15M',
    title: 'Setup correcto pero con R:R desfavorable',
    difficulty: 'avanzado',
    category: 'risk',
    context:
      'SPX muestra un pullback a zona de demanda con vela de absorcion. El setup parece bueno: tendencia alcista, retroceso a zona, vela de confirmacion. Sin embargo, la resistencia mas cercana esta a solo 12 puntos arriba mientras que el SL logico esta a 18 puntos abajo. El R:R real es menor a 1:1.',
    correctDecision: 'skip',
    resultR: 0,
    explanation:
      'Un setup tecnico correcto no es suficiente si el R:R es menor a 1:1. Arriesgar 18 puntos para ganar 12 necesita un win rate superior al 60% solo para breakeven. La disciplina de solo tomar setups con R:R minimo 1.5:1 es lo que separa al trader rentable del que gana muchas veces pero pierde mas de lo que gana.',
    candles: [
      [46, 54, 44, 52],
      [52, 60, 50, 58],
      [58, 66, 56, 64],
      [64, 70, 62, 68],
      [68, 70, 58, 60],
      [60, 62, 54, 56],
      [56, 62, 52, 60],
      // — reveal —
      [60, 68, 58, 66],
      [66, 70, 62, 64],
      [64, 66, 54, 56],
    ],
    revealFrom: 7,
    levels: [
      { y: 70, label: 'Resistencia cercana', kind: 'resistance' },
      { y: 56, label: 'Zona de demanda', kind: 'support' },
      { y: 42, label: 'SL logico', kind: 'sl' },
    ],
  },
  {
    id: 'nq-distribution',
    market: 'NASDAQ',
    timeframe: '1H',
    title: 'Distribucion en techo con velas de rechazo sucesivas',
    difficulty: 'avanzado',
    category: 'reversal',
    context:
      'NQ intento romper el high del dia 3 veces en la ultima hora y media. Cada intento dejo mechas superiores mas largas. Los cierres de las ultimas 3 velas son progresivamente mas bajos aunque las mechas superan el mismo nivel. El volumen vendedor aumenta en cada rechazo.',
    correctDecision: 'short',
    resultR: 1.7,
    explanation:
      'Multiples rechazos al mismo nivel con mechas crecientes y cierres descendentes es el patron clasico de distribucion. Los compradores no logran sostener y cada intento genera mas venta. Entrada al cierre de la tercera vela de rechazo, SL sobre las mechas, TP en el soporte de sesion.',
    candles: [
      [42, 48, 40, 46],
      [46, 54, 44, 52],
      [52, 58, 50, 56],
      [56, 64, 54, 62],
      [62, 68, 56, 58],
      [58, 74, 56, 60],
      [60, 76, 56, 58],
      [58, 78, 54, 56],
      // — reveal —
      [56, 58, 46, 48],
      [48, 52, 40, 42],
      [42, 46, 36, 38],
    ],
    revealFrom: 8,
    levels: [
      { y: 76, label: 'Techo distribucion', kind: 'resistance' },
      { y: 56, label: 'Entrada', kind: 'entry' },
      { y: 80, label: 'SL', kind: 'sl' },
      { y: 38, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'eth-support-divergence',
    market: 'ETH/USD',
    timeframe: '15M',
    title: 'Soporte que aguanta pero con divergencia oculta bajista',
    difficulty: 'avanzado',
    category: 'reversal',
    context:
      'ETH reboto 2 veces en soporte de 2 750 y parece que va a rebotar de nuevo. Pero hay una divergencia bajista oculta: los lows del precio son iguales pero el RSI marca lows mas bajos en cada testeo. El volumen de compra en cada rebote es menor. BTC perdio su propio soporte hace 2 horas.',
    correctDecision: 'short',
    resultR: 2.3,
    explanation:
      'La divergencia bajista oculta en RSI con volumen de compra decreciente indica que el soporte se esta debilitando. Cada rebote tiene menos fuerza. Que BTC ya perdiera su soporte es una señal macro poderosa. El error comun es confiar en el soporte visual sin verificar la calidad de los rebotes. SL sobre el ultimo rebote, TP en el siguiente soporte.',
    candles: [
      [56, 62, 54, 60],
      [60, 62, 48, 50],
      [50, 58, 46, 56],
      [56, 60, 54, 58],
      [58, 60, 46, 48],
      [48, 54, 44, 52],
      [52, 56, 50, 54],
      [54, 56, 44, 46],
      [46, 50, 42, 48],
      // — reveal —
      [48, 50, 38, 40],
      [40, 44, 30, 32],
      [32, 38, 28, 34],
    ],
    revealFrom: 9,
    levels: [
      { y: 46, label: 'Soporte visual', kind: 'support' },
      { y: 48, label: 'Entrada', kind: 'entry' },
      { y: 56, label: 'SL', kind: 'sl' },
      { y: 32, label: 'TP', kind: 'tp' },
    ],
  },
  {
    id: 'btc-trend-long',
    market: 'BTC/USD',
    timeframe: '15M',
    title: 'Tendencia fuerte alcista y consolidación menor',
    difficulty: 'inicial',
    category: 'trend',
    context: 'BTC viene con fuerte momentum alcista. Tras un impulso claro, forma una pequeña vela de indecisión (doji) que descansa justo sobre la EMA20 dinámica. Volumen comprador domina.',
    correctDecision: 'long',
    resultR: 2.1,
    explanation: 'Un doji tras un impulso fuerte que descansa sobre una media móvil clave suele ser una pausa antes de continuar. Tomar posiciones aquí ofrece un stop ajustado por debajo del doji.',
    candles: [
      [30, 40, 28, 38], [38, 48, 36, 46], [46, 56, 44, 54], [54, 64, 52, 62], [62, 70, 60, 68], [68, 70, 66, 68],
      [68, 80, 66, 78], [78, 88, 76, 86], [86, 96, 84, 94]
    ],
    revealFrom: 6,
    levels: [
      { y: 68, label: 'Entrada', kind: 'entry' },
      { y: 64, label: 'SL', kind: 'sl' },
      { y: 86, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'xau-fakeout-short',
    market: 'XAU/USD',
    timeframe: '15M',
    title: 'Falso quiebre de resistencia (Fakeout)',
    difficulty: 'intermedio',
    category: 'breakout',
    context: 'El oro rompió una resistencia clave en 2350, pero la vela siguiente fue envuelta completamente a la baja (Bearish Engulfing) devolviendo el precio por debajo del nivel.',
    correctDecision: 'short',
    resultR: 2.8,
    explanation: 'Los falsos quiebres (fakeouts) que terminan con patrones envolventes bajistas indican trampa de liquidez. Entrar corto tras el cierre envolvente ofrece un excelente R:R.',
    candles: [
      [50, 54, 48, 52], [52, 58, 50, 56], [56, 62, 54, 60], [60, 68, 58, 66], [66, 74, 64, 72], [72, 76, 60, 62],
      [62, 64, 52, 54], [54, 56, 42, 44], [44, 48, 34, 36]
    ],
    revealFrom: 6,
    levels: [
      { y: 68, label: 'Resistencia', kind: 'resistance' },
      { y: 62, label: 'Entrada', kind: 'entry' },
      { y: 76, label: 'SL', kind: 'sl' },
      { y: 42, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'spx-consolidation-skip',
    market: 'SP500',
    timeframe: '5M',
    title: 'Rango estrecho en pre-market',
    difficulty: 'inicial',
    category: 'chop',
    context: 'El SP500 se encuentra en un rango muy estrecho de 4 puntos durante el pre-market. Ninguna vela tiene dirección clara y las medias móviles están completamente planas.',
    correctDecision: 'skip',
    resultR: 0,
    explanation: 'Operar en rangos estrechos sin catalizadores aumenta el riesgo de whipsaw. Esperar la apertura oficial y el aumento de volumen es la única decisión prudente.',
    candles: [
      [50, 52, 48, 51], [51, 53, 49, 50], [50, 52, 48, 51], [51, 52, 49, 50], [50, 53, 49, 51], [51, 52, 48, 50],
      [50, 53, 49, 51], [51, 55, 47, 54], [54, 60, 52, 58]
    ],
    revealFrom: 6,
    levels: [
      { y: 53, label: 'Techo Rango', kind: 'resistance' },
      { y: 48, label: 'Piso Rango', kind: 'support' }
    ]
  },
  {
    id: 'nq-pullback-long',
    market: 'NASDAQ',
    timeframe: '1H',
    title: 'Pullback a Order Block alcista',
    difficulty: 'intermedio',
    category: 'trend',
    context: 'NASDAQ hizo un fuerte rally dejando un Order Block (OB) sin mitigar. Acaba de retroceder a esa zona con velas de bajo volumen y formó un pin bar alcista al tocar el OB.',
    correctDecision: 'long',
    resultR: 3.0,
    explanation: 'El toque a un Order Block en tendencia alcista combinado con un patrón de rechazo (pin bar) y bajo volumen de retroceso confirma la continuidad de la tendencia.',
    candles: [
      [30, 40, 28, 38], [38, 50, 36, 48], [48, 70, 46, 68], [68, 72, 60, 62], [62, 64, 54, 56], [56, 58, 48, 52],
      [52, 64, 50, 62], [62, 76, 60, 74], [74, 88, 72, 86]
    ],
    revealFrom: 6,
    levels: [
      { y: 48, label: 'Order Block', kind: 'support' },
      { y: 52, label: 'Entrada', kind: 'entry' },
      { y: 46, label: 'SL', kind: 'sl' },
      { y: 74, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'btc-double-top-short',
    market: 'BTC/USD',
    timeframe: '4H',
    title: 'Doble techo con divergencia MACD',
    difficulty: 'avanzado',
    category: 'reversal',
    context: 'BTC falla en romper los 70k por segunda vez, formando un patrón de doble techo. El indicador MACD muestra una divergencia bajista evidente entre ambos picos.',
    correctDecision: 'short',
    resultR: 2.2,
    explanation: 'El doble techo validado por una divergencia en osciladores (como MACD o RSI) en marcos mayores como 4H tiene alta probabilidad de éxito para reversiones.',
    candles: [
      [60, 70, 58, 68], [68, 80, 66, 78], [78, 82, 70, 72], [72, 76, 64, 66], [66, 78, 64, 76], [76, 80, 68, 70],
      [70, 72, 58, 60], [60, 62, 48, 50], [50, 54, 38, 40]
    ],
    revealFrom: 6,
    levels: [
      { y: 80, label: 'Resistencia', kind: 'resistance' },
      { y: 70, label: 'Entrada', kind: 'entry' },
      { y: 82, label: 'SL', kind: 'sl' },
      { y: 50, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'xau-news-skip',
    market: 'XAU/USD',
    timeframe: '5M',
    title: 'Volatilidad extrema post-CPI',
    difficulty: 'intermedio',
    category: 'news',
    context: 'Se acaban de publicar los datos de inflación (CPI). La última vela tiene una mecha de 50 pips hacia arriba y otra de 40 pips hacia abajo. El libro de órdenes está vacío.',
    correctDecision: 'skip',
    resultR: 0,
    explanation: 'Operar durante la publicación de noticias clave como el CPI con extrema volatilidad y poca liquidez resulta en deslizamientos graves. Mantenerse al margen protege el capital.',
    candles: [
      [50, 54, 48, 52], [52, 56, 50, 54], [54, 56, 50, 52], [52, 54, 50, 52], [52, 90, 10, 50], [50, 60, 40, 52],
      [52, 56, 48, 50], [50, 52, 46, 48], [48, 54, 46, 52]
    ],
    revealFrom: 6,
    levels: []
  },
  {
    id: 'spx-reversal-long',
    market: 'SP500',
    timeframe: '15M',
    title: 'Patrón Morning Star en zona de demanda',
    difficulty: 'inicial',
    category: 'reversal',
    context: 'El SP500 ha estado en una tendencia bajista intradiaria. Al llegar a una zona de demanda crítica del día anterior, forma un patrón Morning Star perfecto.',
    correctDecision: 'long',
    resultR: 2.0,
    explanation: 'El patrón Morning Star (vela bajista fuerte, doji, vela alcista fuerte) en una zona de demanda histórica indica agotamiento vendedor y giro alcista inminente.',
    candles: [
      [70, 72, 60, 62], [62, 64, 52, 54], [54, 56, 44, 46], [46, 48, 36, 38], [38, 40, 32, 34], [34, 44, 32, 42],
      [42, 52, 40, 50], [50, 60, 48, 58], [58, 68, 56, 66]
    ],
    revealFrom: 6,
    levels: [
      { y: 36, label: 'Zona Demanda', kind: 'support' },
      { y: 42, label: 'Entrada', kind: 'entry' },
      { y: 30, label: 'SL', kind: 'sl' },
      { y: 60, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'nq-chop-skip',
    market: 'NASDAQ',
    timeframe: '1M',
    title: 'Acción de precio errática y velas solapadas',
    difficulty: 'avanzado',
    category: 'chop',
    context: 'NASDAQ en el marco de 1 minuto muestra velas con cuerpos muy pequeños y largas mechas en ambas direcciones. El precio oscila sin hacer máximos o mínimos claros (choppy market).',
    correctDecision: 'skip',
    resultR: 0,
    explanation: 'Los mercados picados (choppy) en temporalidades bajas destrozan cuentas debido a la cacería constante de stops. Identificar este ruido y apartarse es clave para la supervivencia.',
    candles: [
      [50, 58, 42, 52], [52, 60, 46, 48], [48, 54, 40, 50], [50, 56, 44, 48], [48, 58, 42, 52], [52, 56, 46, 50],
      [50, 54, 44, 52], [52, 58, 46, 48], [48, 56, 42, 50]
    ],
    revealFrom: 6,
    levels: []
  },
  {
    id: 'btc-fake-breakdown-long',
    market: 'BTC/USD',
    timeframe: '1H',
    title: 'Falso quiebre de soporte (Spring)',
    difficulty: 'intermedio',
    category: 'breakout',
    context: 'BTC parecía perder un soporte de hace semanas en 60k, pero la siguiente vela horaria absorbió todas las ventas y cerró muy por encima del nivel con volumen climático.',
    correctDecision: 'long',
    resultR: 2.7,
    explanation: 'Un falso quiebre bajista con alto volumen seguido de recuperación inmediata (Spring) revela la trampa de grandes operadores para acumular liquidez y subir el precio.',
    candles: [
      [55, 60, 50, 52], [52, 55, 48, 49], [49, 52, 45, 46], [46, 48, 30, 32], [32, 50, 30, 48], [48, 52, 45, 50],
      [50, 60, 48, 58], [58, 68, 56, 66], [66, 76, 64, 74]
    ],
    revealFrom: 6,
    levels: [
      { y: 45, label: 'Soporte', kind: 'support' },
      { y: 50, label: 'Entrada', kind: 'entry' },
      { y: 28, label: 'SL', kind: 'sl' },
      { y: 68, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'xau-trend-short',
    market: 'XAU/USD',
    timeframe: '30M',
    title: 'Continuación bajista con banderín',
    difficulty: 'inicial',
    category: 'trend',
    context: 'Oro en clara tendencia bajista. Tras un fuerte impulso a la baja, el precio forma un pequeño banderín consolidando ligeramente hacia arriba antes de romper a la baja.',
    correctDecision: 'short',
    resultR: 2.3,
    explanation: 'El banderín bajista es un patrón clásico de continuación. Unir cortos en la rotura del banderín a favor de la tendencia principal suele dar movimientos rápidos y limpios.',
    candles: [
      [80, 82, 70, 72], [72, 74, 60, 62], [62, 64, 50, 52], [52, 56, 50, 54], [54, 58, 52, 56], [56, 60, 54, 58],
      [58, 60, 48, 50], [50, 52, 40, 42], [42, 44, 30, 32]
    ],
    revealFrom: 6,
    levels: [
      { y: 58, label: 'Entrada', kind: 'entry' },
      { y: 62, label: 'SL', kind: 'sl' },
      { y: 42, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'spx-risk-skip',
    market: 'SP500',
    timeframe: '15M',
    title: 'Setup prometedor con stop loss gigante',
    difficulty: 'avanzado',
    category: 'risk',
    context: 'SP500 rompe resistencia con fuerza, pero la vela de quiebre es inusualmente grande (anomalía de volatilidad). Para poner el SL debajo de la estructura se requiere arriesgar demasiado capital.',
    correctDecision: 'skip',
    resultR: 0,
    explanation: 'Nunca se debe tomar un trade donde el stop loss estructural excede tus parámetros de riesgo métricos o arruina tu R:R, por muy seguro que parezca el setup. Es mejor dejar pasar la oportunidad.',
    candles: [
      [40, 44, 38, 42], [42, 46, 40, 44], [44, 48, 42, 46], [46, 50, 44, 48], [48, 76, 46, 74], [74, 78, 72, 76],
      [76, 80, 74, 78], [78, 82, 76, 80], [80, 84, 78, 82]
    ],
    revealFrom: 6,
    levels: [
      { y: 50, label: 'Resistencia Rota', kind: 'support' },
      { y: 44, label: 'SL Estructural lejanísimo', kind: 'sl' }
    ]
  },
  {
    id: 'nq-breakout-long',
    market: 'NASDAQ',
    timeframe: '5M',
    title: 'Ruptura limpia de VWAP en pre-mercado',
    difficulty: 'intermedio',
    category: 'breakout',
    context: 'Tras respetar el VWAP inferior por 2 horas, NQ cruza el VWAP central con decisión, aumentando el volumen y dejando velas marubozu alcistas sin mechas superiores.',
    correctDecision: 'long',
    resultR: 2.4,
    explanation: 'Un cruce del VWAP acompañado de aumento de volumen y velas sin mecha (fuerte convicción compradora) es un setup sólido de impulso (momentum) en intradía.',
    candles: [
      [40, 44, 38, 42], [42, 46, 40, 44], [44, 48, 42, 46], [46, 60, 46, 60], [60, 72, 60, 72], [72, 78, 70, 76],
      [76, 88, 76, 88], [88, 98, 86, 96], [96, 98, 92, 94]
    ],
    revealFrom: 6,
    levels: [
      { y: 46, label: 'VWAP', kind: 'support' },
      { y: 72, label: 'Entrada', kind: 'entry' },
      { y: 58, label: 'SL', kind: 'sl' },
      { y: 92, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'btc-reversal-short',
    market: 'BTC/USD',
    timeframe: '1D',
    title: 'Shooting Star en ATH (Máximo Histórico)',
    difficulty: 'intermedio',
    category: 'reversal',
    context: 'BTC alcanza un nuevo máximo histórico, pero la vela diaria termina formando una Shooting Star con una enorme mecha superior (rechazo) acompañada de altísimo volumen de venta institucional.',
    correctDecision: 'short',
    resultR: 3.5,
    explanation: 'Una Shooting Star climática en máximos históricos advierte de una inminente y severa corrección o toma de ganancias. Ofrece uno de los trades cortos con mayor ratio R:R posible.',
    candles: [
      [50, 60, 48, 58], [58, 68, 56, 66], [66, 76, 64, 74], [74, 84, 72, 82], [82, 98, 80, 84], [84, 86, 72, 74],
      [74, 76, 60, 62], [62, 66, 50, 52], [52, 54, 38, 40]
    ],
    revealFrom: 6,
    levels: [
      { y: 84, label: 'Entrada', kind: 'entry' },
      { y: 100, label: 'SL', kind: 'sl' },
      { y: 48, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'xau-pullback-long',
    market: 'XAU/USD',
    timeframe: '15M',
    title: 'Pullback a 0.618 de Fib con volumen decreciente',
    difficulty: 'inicial',
    category: 'trend',
    context: 'XAU/USD tuvo un buen rally. El retroceso actual fue lento y con poco volumen, tocando exactamente el nivel 61.8% de Fibonacci, donde rebotó formando una vela de cuerpo alcista.',
    correctDecision: 'long',
    resultR: 2.1,
    explanation: 'La confluencia del golden ratio de Fibonacci (61.8%) con un retroceso de bajo volumen es la receta ideal para entrar a favor de la tendencia con bajo riesgo.',
    candles: [
      [30, 40, 28, 38], [38, 50, 36, 48], [48, 60, 46, 58], [58, 70, 56, 68], [68, 70, 62, 64], [64, 66, 58, 60],
      [60, 68, 56, 66], [66, 76, 64, 74], [74, 86, 72, 84]
    ],
    revealFrom: 6,
    levels: [
      { y: 58, label: 'Fib 61.8%', kind: 'support' },
      { y: 60, label: 'Entrada', kind: 'entry' },
      { y: 54, label: 'SL', kind: 'sl' },
      { y: 78, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'spx-fakeout-short',
    market: 'SP500',
    timeframe: '1H',
    title: 'Trampa de toros sobre zona de oferta',
    difficulty: 'avanzado',
    category: 'breakout',
    context: 'SP500 cruzó la fuerte zona de oferta que traía de la semana pasada. Sin embargo, en la hora siguiente fue rechazado de golpe y volvió por debajo del nivel. Se llama "bull trap".',
    correctDecision: 'short',
    resultR: 2.6,
    explanation: 'Las trampas de toros absorben a los compradores rezagados y atrapan su liquidez. Vender en corto tan pronto como el precio retorna bajo la resistencia es una operativa altamente rentable.',
    candles: [
      [50, 56, 48, 54], [54, 60, 52, 58], [58, 64, 56, 62], [62, 68, 60, 66], [66, 76, 64, 74], [74, 78, 60, 62],
      [62, 64, 50, 52], [52, 56, 42, 44], [44, 46, 30, 32]
    ],
    revealFrom: 6,
    levels: [
      { y: 66, label: 'Oferta', kind: 'resistance' },
      { y: 62, label: 'Entrada', kind: 'entry' },
      { y: 78, label: 'SL', kind: 'sl' },
      { y: 44, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'nq-news-skip',
    market: 'NASDAQ',
    timeframe: '5M',
    title: 'Discurso de Powell de la FED',
    difficulty: 'inicial',
    category: 'news',
    context: 'En 3 minutos comienza a hablar Jerome Powell (Presidente de la FED). El gráfico actualmente luce técnicamente alcista, con un patrón de taza y asa formándose cerca de una resistencia.',
    correctDecision: 'skip',
    resultR: 0,
    explanation: 'Eventos de impacto macro, como conferencias de la FED, anulan todo análisis técnico a corto plazo. Es imperativo no tener posiciones abiertas y esperar a que el polvo se asiente tras sus declaraciones.',
    candles: [
      [40, 44, 38, 42], [42, 48, 40, 46], [46, 48, 42, 44], [44, 46, 40, 42], [42, 50, 40, 48], [48, 52, 46, 50],
      [50, 90, 10, 85], [85, 95, 20, 30], [30, 60, 20, 50]
    ],
    revealFrom: 6,
    levels: []
  },
  {
    id: 'btc-consolidation-skip',
    market: 'BTC/USD',
    timeframe: '15M',
    title: 'Compresión asimétrica de fin de semana',
    difficulty: 'intermedio',
    category: 'chop',
    context: 'Es domingo por la tarde. El volumen es inexistente y BTC ha estado rebotando en un rango de apenas $200 dólares durante las últimas 8 horas. No hay liquidez en los libros.',
    correctDecision: 'skip',
    resultR: 0,
    explanation: 'El trading de fin de semana en cripto suele caracterizarse por una acción de precio engañosa dominada por bots. Es mejor ahorrar energía y capital para la apertura del mercado tradicional.',
    candles: [
      [50, 52, 49, 51], [51, 52, 49, 50], [50, 51, 48, 49], [49, 51, 48, 50], [50, 51, 49, 50], [50, 52, 49, 51],
      [51, 52, 50, 51], [51, 52, 49, 50], [50, 52, 48, 51]
    ],
    revealFrom: 6,
    levels: []
  },
  {
    id: 'xau-double-bottom-long',
    market: 'XAU/USD',
    timeframe: '1H',
    title: 'Doble suelo en soporte clave',
    difficulty: 'intermedio',
    category: 'reversal',
    context: 'El Oro toca por segunda vez el soporte mayor de la semana. La vela de rechazo es clara (Hammer) y el oscilador RSI muestra fuerte divergencia alcista en zona de sobreventa.',
    correctDecision: 'long',
    resultR: 2.5,
    explanation: 'Doble suelo más divergencia de RSI en sobreventa en zona de soporte es un excelente trigger. Entrar en la validación del rechazo asegura confirmación con buen margen de ganancia.',
    candles: [
      [70, 72, 58, 60], [60, 64, 56, 58], [58, 62, 50, 52], [52, 60, 48, 58], [58, 60, 54, 56], [56, 58, 46, 48],
      [48, 60, 46, 58], [58, 68, 56, 66], [66, 76, 64, 74]
    ],
    revealFrom: 6,
    levels: [
      { y: 48, label: 'Soporte Clave', kind: 'support' },
      { y: 58, label: 'Entrada', kind: 'entry' },
      { y: 44, label: 'SL', kind: 'sl' },
      { y: 80, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'spx-trend-short',
    market: 'SP500',
    timeframe: '5M',
    title: 'Cascada bajista e intento fallido de rebote',
    difficulty: 'inicial',
    category: 'trend',
    context: 'SP500 abre a la baja en cascada. Intenta rebotar hacia la EMA 20, pero apenas la toca, los vendedores reaparecen y forman una vela envolvente bajista enorme (bearish engulfing).',
    correctDecision: 'short',
    resultR: 2.0,
    explanation: 'En días de alta presión bajista ("trend days"), intentar atrapar el suelo (catching falling knives) es suicida. Vender los rebotes hacia las EMAs es la estrategia de mayor probabilidad.',
    candles: [
      [80, 82, 68, 70], [70, 72, 58, 60], [60, 62, 48, 50], [50, 56, 48, 54], [54, 58, 52, 56], [56, 58, 44, 46],
      [46, 48, 34, 36], [36, 40, 26, 28], [28, 30, 18, 20]
    ],
    revealFrom: 6,
    levels: [
      { y: 56, label: 'EMA 20', kind: 'resistance' },
      { y: 46, label: 'Entrada', kind: 'entry' },
      { y: 58, label: 'SL', kind: 'sl' },
      { y: 26, label: 'TP', kind: 'tp' }
    ]
  },
  {
    id: 'nq-risk-skip',
    market: 'NASDAQ',
    timeframe: '15M',
    title: 'Entrada tardía (FOMO)',
    difficulty: 'intermedio',
    category: 'risk',
    context: 'NASDAQ ha subido 150 puntos en las últimas 3 velas de 15 minutos sin retroceso. El setup de ruptura ocurrió hace mucho. Ahora está a punto de tocar una resistencia crítica.',
    correctDecision: 'skip',
    resultR: 0,
    explanation: 'Entrar tarde motivado por FOMO (Fear Of Missing Out) y justo frente a una resistencia mayor garantiza comprar el tope antes del retroceso. Nunca persigas el precio, espera que el precio venga a ti.',
    candles: [
      [30, 40, 28, 38], [38, 42, 36, 40], [40, 54, 38, 52], [52, 70, 50, 68], [68, 86, 66, 84], [84, 90, 82, 88],
      [88, 92, 80, 82], [82, 86, 72, 74], [74, 76, 64, 66]
    ],
    revealFrom: 6,
    levels: [
      { y: 90, label: 'Resistencia Mayor', kind: 'resistance' },
      { y: 40, label: 'Punto Ruptura original', kind: 'support' }
    ]
  },
  {
    id: 'eth-trend-long',
    market: 'ETH/USD',
    timeframe: '1H',
    title: 'Triángulo ascendente en tendencia alcista',
    difficulty: 'inicial',
    category: 'breakout',
    context: 'ETH formando un triángulo ascendente claro: máximos planos en $3000 y mínimos cada vez más altos. Acaba de romper la resistencia de los $3000 con incremento de volumen.',
    correctDecision: 'long',
    resultR: 2.2,
    explanation: 'El triángulo ascendente es un patrón de continuación alcista de alta fiabilidad. Romper la resistencia superior plana valida la acumulación previa y proyecta una subida fuerte.',
    candles: [
      [40, 50, 38, 48], [48, 44, 42, 42], [42, 50, 40, 46], [46, 44, 44, 44], [44, 50, 42, 48], [48, 60, 46, 58],
      [58, 68, 56, 66], [66, 76, 64, 74], [74, 84, 72, 82]
    ],
    revealFrom: 6,
    levels: [
      { y: 50, label: 'Resistencia Rota', kind: 'support' },
      { y: 58, label: 'Entrada', kind: 'entry' },
      { y: 46, label: 'SL', kind: 'sl' },
      { y: 80, label: 'TP', kind: 'tp' }
    ]
  }
]

export default scenarios
