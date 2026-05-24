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
  /** Mock candle data: OHLC with real market scale */
  candles: [number, number, number, number][]
  /** Index where the "hidden future" begins (inclusive) */
  revealFrom: number
  /** Key levels drawn on chart */
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
      [18352, 18358, 18348, 18355],
      [18355, 18360, 18352, 18353],
      [18353, 18356, 18350, 18354],
      [18354, 18355, 18346, 18347],
      [18347, 18348, 18332, 18334],
      [18334, 18355, 18330, 18352],
      // — reveal from here —
      [18352, 18362, 18350, 18360],
      [18360, 18368, 18358, 18366],
      [18366, 18374, 18364, 18372],
      [18372, 18378, 18370, 18376],
    ],
    revealFrom: 6,
    levels: [
      { y: 18348, label: 'Soporte rango', kind: 'support' },
      { y: 18360, label: 'Resistencia rango', kind: 'resistance' },
      { y: 18352, label: 'Entrada', kind: 'entry' },
      { y: 18330, label: 'SL', kind: 'sl' },
      { y: 18376, label: 'TP 2R', kind: 'tp' },
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
      [2340, 2348, 2338, 2346],
      [2346, 2356, 2344, 2354],
      [2354, 2364, 2352, 2362],
      [2362, 2372, 2360, 2370],
      [2370, 2388, 2368, 2378],
      [2378, 2382, 2364, 2366],
      [2366, 2376, 2364, 2374],
      [2374, 2390, 2372, 2374],
      // — reveal from here —
      [2374, 2376, 2362, 2364],
      [2364, 2366, 2352, 2354],
      [2354, 2358, 2344, 2346],
    ],
    revealFrom: 8,
    levels: [
      { y: 2388, label: 'Oferta', kind: 'resistance' },
      { y: 2374, label: 'Entrada', kind: 'entry' },
      { y: 2392, label: 'SL', kind: 'sl' },
      { y: 2346, label: 'TP', kind: 'tp' },
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
      [67500, 67560, 67460, 67520],
      [67520, 67580, 67480, 67540],
      [67540, 67570, 67490, 67510],
      [67510, 67550, 67470, 67530],
      [67530, 67560, 67480, 67500],
      [67500, 67540, 67460, 67520],
      // — reveal from here —
      [67520, 67550, 67470, 67490],
      [67490, 67530, 67450, 67510],
      [67510, 67580, 67440, 67460],
      [67460, 67480, 67360, 67380],
    ],
    revealFrom: 6,
    levels: [
      { y: 67580, label: 'Techo rango', kind: 'resistance' },
      { y: 67460, label: 'Piso rango', kind: 'support' },
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
      [18442, 18448, 18438, 18444],
      [18444, 18446, 18440, 18442],
      [18442, 18450, 18440, 18448],
      [18448, 18472, 18446, 18470],
      [18470, 18472, 18456, 18458],
      [18458, 18460, 18450, 18452],
      [18452, 18454, 18446, 18450],
      // — reveal from here —
      [18450, 18462, 18448, 18460],
      [18460, 18474, 18458, 18472],
      [18472, 18484, 18470, 18482],
      [18482, 18492, 18478, 18488],
    ],
    revealFrom: 7,
    levels: [
      { y: 18446, label: 'OB bajo', kind: 'support' },
      { y: 18450, label: 'OB alto', kind: 'entry' },
      { y: 18442, label: 'SL', kind: 'sl' },
      { y: 18488, label: 'TP 3R', kind: 'tp' },
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
      [1.0844, 1.0850, 1.0842, 1.0848],
      [1.0848, 1.0852, 1.0846, 1.0850],
      [1.0850, 1.0854, 1.0848, 1.0852],
      [1.0852, 1.0856, 1.0850, 1.0854],
      [1.0854, 1.0858, 1.0852, 1.0856],
      [1.0856, 1.0872, 1.0855, 1.0870],
      [1.0870, 1.0871, 1.0854, 1.0856],
      // — reveal —
      [1.0856, 1.0858, 1.0846, 1.0848],
      [1.0848, 1.0850, 1.0838, 1.0840],
      [1.0840, 1.0844, 1.0836, 1.0838],
    ],
    revealFrom: 7,
    levels: [
      { y: 1.0858, label: 'Resistencia', kind: 'resistance' },
      { y: 1.0856, label: 'Entrada', kind: 'entry' },
      { y: 1.0873, label: 'SL', kind: 'sl' },
      { y: 1.0838, label: 'TP', kind: 'tp' },
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
      [5238, 5244, 5236, 5242],
      [5242, 5250, 5240, 5248],
      [5248, 5256, 5247, 5254],
      [5254, 5260, 5252, 5258],
      [5258, 5266, 5257, 5264],
      [5264, 5272, 5263, 5270],
      // — reveal —
      [5270, 5276, 5268, 5274],
      [5274, 5278, 5266, 5268],
      [5268, 5270, 5258, 5260],
      [5260, 5264, 5256, 5262],
    ],
    revealFrom: 6,
    levels: [
      { y: 5272, label: 'Extension', kind: 'resistance' },
      { y: 5242, label: 'EMA20 aprox', kind: 'support' },
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
      [2858, 2862, 2854, 2856],
      [2856, 2858, 2842, 2844],
      [2844, 2854, 2840, 2852],
      [2852, 2856, 2850, 2854],
      [2854, 2856, 2848, 2850],
      [2850, 2852, 2838, 2842],
      [2842, 2856, 2836, 2854],
      // — reveal —
      [2854, 2862, 2852, 2860],
      [2860, 2868, 2858, 2866],
      [2866, 2876, 2864, 2874],
    ],
    revealFrom: 7,
    levels: [
      { y: 2840, label: 'Soporte semanal', kind: 'support' },
      { y: 2854, label: 'Entrada', kind: 'entry' },
      { y: 2834, label: 'SL', kind: 'sl' },
      { y: 2874, label: 'TP', kind: 'tp' },
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
      [64000, 64020, 63880, 63900],
      [63900, 64200, 63880, 64180],
      [64180, 64600, 64100, 64580],
      [64580, 65000, 64500, 64980],
      [64980, 65152, 64900, 65100],
      [65100, 65200, 65050, 65150],
      // — reveal —
      [65150, 65240, 64320, 64340],
      [64340, 64360, 64220, 64240],
      [64240, 64300, 64200, 64280],
      [64280, 64300, 64180, 64200],
    ],
    revealFrom: 6,
    levels: [
      { y: 65152, label: 'Oferta', kind: 'resistance' },
      { y: 64080, label: 'OB impulso', kind: 'support' },
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
      [18500, 18504, 18496, 18502],
      [18502, 18504, 18498, 18500],
      [18500, 18502, 18498, 18500],
      [18500, 18518, 18492, 18508],
      [18508, 18512, 18484, 18490],
      [18490, 18506, 18488, 18504],
      // — reveal —
      [18504, 18508, 18494, 18496],
      [18496, 18502, 18490, 18500],
      [18500, 18506, 18498, 18504],
      [18504, 18508, 18500, 18506],
    ],
    revealFrom: 6,
    levels: [
      { y: 18518, label: 'Mecha alta', kind: 'resistance' },
      { y: 18484, label: 'Mecha baja', kind: 'support' },
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
      [2310, 2322, 2308, 2320],
      [2320, 2332, 2318, 2330],
      [2330, 2340, 2328, 2338],
      [2338, 2344, 2336, 2342],
      [2342, 2344, 2332, 2334],
      [2334, 2336, 2326, 2328],
      [2328, 2330, 2318, 2320],
      [2320, 2328, 2316, 2326],
      // — reveal —
      [2326, 2336, 2324, 2334],
      [2334, 2344, 2332, 2342],
      [2342, 2350, 2340, 2348],
    ],
    revealFrom: 8,
    levels: [
      { y: 2320, label: 'Demanda alta', kind: 'support' },
      { y: 2316, label: 'Demanda baja', kind: 'support' },
      { y: 2326, label: 'Entrada', kind: 'entry' },
      { y: 2314, label: 'SL', kind: 'sl' },
      { y: 2348, label: 'TP', kind: 'tp' },
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
      [5142, 5148, 5140, 5146],
      [5146, 5154, 5144, 5152],
      [5152, 5160, 5150, 5158],
      [5158, 5166, 5156, 5164],
      [5164, 5172, 5162, 5170],
      [5170, 5176, 5168, 5174],
      [5174, 5178, 5172, 5176],
      [5176, 5180, 5160, 5162],
      // — reveal —
      [5162, 5164, 5152, 5154],
      [5154, 5158, 5148, 5150],
      [5150, 5152, 5142, 5144],
    ],
    revealFrom: 8,
    levels: [
      { y: 5178, label: 'Oferta', kind: 'resistance' },
      { y: 5162, label: 'Entrada', kind: 'entry' },
      { y: 5182, label: 'SL', kind: 'sl' },
      { y: 5144, label: 'TP', kind: 'tp' },
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
      [66580, 66620, 66560, 66600],
      [66600, 66620, 66560, 66580],
      [66580, 66600, 66540, 66560],
      [66560, 66580, 66520, 66540],
      [66540, 66560, 66360, 66380],
      [66380, 66480, 66340, 66460],
      [66460, 66580, 66440, 66560],
      // — reveal —
      [66560, 66640, 66540, 66620],
      [66620, 66700, 66600, 66680],
      [66680, 66760, 66660, 66740],
    ],
    revealFrom: 7,
    levels: [
      { y: 66540, label: 'Soporte', kind: 'support' },
      { y: 66560, label: 'Entrada', kind: 'entry' },
      { y: 66320, label: 'SL', kind: 'sl' },
      { y: 66740, label: 'TP', kind: 'tp' },
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
      [3142, 3152, 3140, 3150],
      [3150, 3168, 3148, 3164],
      [3164, 3166, 3152, 3154],
      [3154, 3162, 3152, 3160],
      [3160, 3178, 3158, 3172],
      [3172, 3174, 3156, 3158],
      [3158, 3164, 3156, 3162],
      [3162, 3170, 3158, 3160],
      [3160, 3162, 3148, 3150],
      // — reveal —
      [3150, 3152, 3140, 3142],
      [3142, 3146, 3134, 3136],
      [3134, 3140, 3130, 3132],
    ],
    revealFrom: 9,
    levels: [
      { y: 3178, label: 'Cabeza', kind: 'resistance' },
      { y: 3168, label: 'Hombros', kind: 'resistance' },
      { y: 3150, label: 'Neckline', kind: 'support' },
      { y: 3150, label: 'Entrada', kind: 'entry' },
      { y: 3172, label: 'SL', kind: 'sl' },
      { y: 3132, label: 'TP', kind: 'tp' },
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
      [18338, 18352, 18336, 18350],
      [18350, 18362, 18348, 18360],
      [18360, 18364, 18358, 18362],
      [18362, 18364, 18360, 18362],
      [18362, 18364, 18360, 18362],
      [18362, 18366, 18360, 18364],
      [18364, 18366, 18362, 18364],
      [18364, 18378, 18362, 18376],
      // — reveal —
      [18376, 18384, 18374, 18382],
      [18382, 18390, 18380, 18388],
      [18388, 18394, 18384, 18392],
    ],
    revealFrom: 8,
    levels: [
      { y: 18370, label: 'Techo consolidacion', kind: 'resistance' },
      { y: 18350, label: 'Piso consolidacion', kind: 'support' },
      { y: 18376, label: 'Entrada', kind: 'entry' },
      { y: 18348, label: 'SL', kind: 'sl' },
      { y: 18392, label: 'TP', kind: 'tp' },
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
      [2350, 2354, 2348, 2352],
      [2352, 2356, 2350, 2354],
      [2354, 2356, 2350, 2352],
      [2352, 2354, 2350, 2352],
      [2352, 2382, 2328, 2354],
      [2354, 2358, 2346, 2350],
      [2350, 2354, 2348, 2352],
      // — reveal —
      [2352, 2356, 2344, 2346],
      [2346, 2354, 2342, 2352],
      [2352, 2360, 2350, 2358],
    ],
    revealFrom: 7,
    levels: [
      { y: 2382, label: 'Spike alto', kind: 'resistance' },
      { y: 2328, label: 'Spike bajo', kind: 'support' },
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
      [1.034, 1.040, 1.032, 1.038],
      [1.038, 1.046, 1.036, 1.044],
      [1.044, 1.052, 1.042, 1.050],
      [1.050, 1.058, 1.048, 1.056],
      [1.056, 1.064, 1.054, 1.062],
      [1.062, 1.068, 1.060, 1.066],
      [1.066, 1.082, 1.064, 1.066],
      // — reveal —
      [1.066, 1.068, 1.058, 1.060],
      [1.060, 1.062, 1.052, 1.054],
      [1.054, 1.058, 1.050, 1.052],
    ],
    revealFrom: 7,
    levels: [
      { y: 1.072, label: 'Resistencia mensual', kind: 'resistance' },
      { y: 1.066, label: 'Entrada', kind: 'entry' },
      { y: 1.084, label: 'SL', kind: 'sl' },
      { y: 1.052, label: 'TP', kind: 'tp' },
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
      [63000, 64400, 62800, 64200],
      [64200, 65600, 64000, 65400],
      [65400, 66800, 65200, 66600],
      [66600, 66800, 65800, 66000],
      [66000, 66200, 65400, 65600],
      [65600, 65800, 65000, 65200],
      [65200, 65400, 64600, 64800],
      [64800, 65600, 64400, 65400],
      // — reveal —
      [65400, 66600, 65200, 66400],
      [66400, 67600, 66200, 67400],
      [67400, 68600, 67200, 68400],
    ],
    revealFrom: 8,
    levels: [
      { y: 64800, label: 'Fib 38.2%', kind: 'support' },
      { y: 64400, label: 'Bandera baja', kind: 'support' },
      { y: 65400, label: 'Entrada', kind: 'entry' },
      { y: 64200, label: 'SL', kind: 'sl' },
      { y: 68400, label: 'TP', kind: 'tp' },
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
      [5046, 5054, 5044, 5052],
      [5052, 5060, 5050, 5058],
      [5058, 5066, 5056, 5064],
      [5064, 5070, 5062, 5068],
      [5068, 5070, 5058, 5060],
      [5060, 5062, 5054, 5056],
      [5056, 5062, 5052, 5060],
      // — reveal —
      [5060, 5068, 5058, 5066],
      [5066, 5070, 5062, 5064],
      [5064, 5066, 5054, 5056],
    ],
    revealFrom: 7,
    levels: [
      { y: 5068, label: 'Resistencia cercana', kind: 'resistance' },
      { y: 5056, label: 'Zona de demanda', kind: 'support' },
      { y: 5038, label: 'SL logico', kind: 'sl' },
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
      [18342, 18348, 18340, 18346],
      [18346, 18354, 18344, 18352],
      [18352, 18358, 18350, 18356],
      [18356, 18364, 18354, 18362],
      [18362, 18368, 18356, 18358],
      [18358, 18374, 18356, 18360],
      [18360, 18376, 18356, 18358],
      [18358, 18378, 18354, 18356],
      // — reveal —
      [18356, 18358, 18346, 18348],
      [18348, 18352, 18340, 18342],
      [18342, 18346, 18336, 18338],
    ],
    revealFrom: 8,
    levels: [
      { y: 18376, label: 'Techo distribucion', kind: 'resistance' },
      { y: 18356, label: 'Entrada', kind: 'entry' },
      { y: 18380, label: 'SL', kind: 'sl' },
      { y: 18338, label: 'TP', kind: 'tp' },
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
      [2756, 2762, 2754, 2760],
      [2760, 2762, 2748, 2750],
      [2750, 2758, 2746, 2756],
      [2756, 2760, 2754, 2758],
      [2758, 2760, 2746, 2748],
      [2748, 2754, 2744, 2752],
      [2752, 2756, 2750, 2754],
      [2754, 2756, 2744, 2746],
      [2746, 2750, 2742, 2748],
      // — reveal —
      [2748, 2750, 2738, 2740],
      [2740, 2744, 2730, 2732],
      [2732, 2738, 2728, 2734],
    ],
    revealFrom: 9,
    levels: [
      { y: 2746, label: 'Soporte visual', kind: 'support' },
      { y: 2748, label: 'Entrada', kind: 'entry' },
      { y: 2756, label: 'SL', kind: 'sl' },
      { y: 2732, label: 'TP', kind: 'tp' },
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
      [68030, 68040, 68028, 68038], [68038, 68048, 68036, 68046], [68046, 68056, 68044, 68054], [68054, 68064, 68052, 68062], [68062, 68070, 68060, 68068], [68068, 68070, 68066, 68068],
      [68068, 68080, 68066, 68078], [68078, 68088, 68076, 68086], [68086, 68096, 68084, 68094]
    ],
    revealFrom: 6,
    levels: [
      { y: 68068, label: 'Entrada', kind: 'entry' },
      { y: 68064, label: 'SL', kind: 'sl' },
      { y: 68086, label: 'TP', kind: 'tp' }
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
      [2350, 2354, 2348, 2352], [2352, 2358, 2350, 2356], [2356, 2362, 2354, 2360], [2360, 2368, 2358, 2366], [2366, 2374, 2364, 2372], [2372, 2376, 2360, 2362],
      [2362, 2364, 2352, 2354], [2354, 2356, 2342, 2344], [2344, 2348, 2334, 2336]
    ],
    revealFrom: 6,
    levels: [
      { y: 2368, label: 'Resistencia', kind: 'resistance' },
      { y: 2362, label: 'Entrada', kind: 'entry' },
      { y: 2376, label: 'SL', kind: 'sl' },
      { y: 2342, label: 'TP', kind: 'tp' }
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
      [5150, 5152, 5148, 5151], [5151, 5153, 5149, 5150], [5150, 5152, 5148, 5151], [5151, 5152, 5149, 5150], [5150, 5153, 5149, 5151], [5151, 5152, 5148, 5150],
      [5150, 5153, 5149, 5151], [5151, 5155, 5147, 5154], [5154, 5160, 5152, 5158]
    ],
    revealFrom: 6,
    levels: [
      { y: 5153, label: 'Techo Rango', kind: 'resistance' },
      { y: 5148, label: 'Piso Rango', kind: 'support' }
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
      [18430, 18440, 18428, 18438], [18438, 18450, 18436, 18448], [18448, 18470, 18446, 18468], [18468, 18472, 18460, 18462], [18462, 18464, 18454, 18456], [18456, 18458, 18448, 18452],
      [18452, 18464, 18450, 18462], [18462, 18476, 18460, 18474], [18474, 18488, 18472, 18486]
    ],
    revealFrom: 6,
    levels: [
      { y: 18448, label: 'Order Block', kind: 'support' },
      { y: 18452, label: 'Entrada', kind: 'entry' },
      { y: 18446, label: 'SL', kind: 'sl' },
      { y: 18474, label: 'TP', kind: 'tp' }
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
      [69960, 69970, 69958, 69968], [69968, 69980, 69966, 69978], [69978, 69982, 69970, 69972], [69972, 69976, 69964, 69966], [69966, 69978, 69964, 69976], [69976, 69980, 69968, 69970],
      [69970, 69972, 69958, 69960], [69960, 69962, 69948, 69950], [69950, 69954, 69938, 69940]
    ],
    revealFrom: 6,
    levels: [
      { y: 69980, label: 'Resistencia', kind: 'resistance' },
      { y: 69970, label: 'Entrada', kind: 'entry' },
      { y: 69982, label: 'SL', kind: 'sl' },
      { y: 69950, label: 'TP', kind: 'tp' }
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
      [2350, 2354, 2348, 2352], [2352, 2356, 2350, 2354], [2354, 2356, 2350, 2352], [2352, 2354, 2350, 2352], [2352, 2390, 2310, 2350], [2350, 2360, 2340, 2352],
      [2352, 2356, 2348, 2350], [2350, 2352, 2346, 2348], [2348, 2354, 2346, 2352]
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
      [5070, 5072, 5060, 5062], [5062, 5064, 5052, 5054], [5054, 5056, 5044, 5046], [5046, 5048, 5036, 5038], [5038, 5040, 5032, 5034], [5034, 5044, 5032, 5042],
      [5042, 5052, 5040, 5050], [5050, 5060, 5048, 5058], [5058, 5068, 5056, 5066]
    ],
    revealFrom: 6,
    levels: [
      { y: 5036, label: 'Zona Demanda', kind: 'support' },
      { y: 5042, label: 'Entrada', kind: 'entry' },
      { y: 5030, label: 'SL', kind: 'sl' },
      { y: 5060, label: 'TP', kind: 'tp' }
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
      [18450, 18458, 18442, 18452], [18452, 18460, 18446, 18448], [18448, 18454, 18440, 18450], [18450, 18456, 18444, 18448], [18448, 18458, 18442, 18452], [18452, 18456, 18446, 18450],
      [18450, 18454, 18444, 18452], [18452, 18458, 18446, 18448], [18448, 18456, 18442, 18450]
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
      [60055, 60060, 60050, 60052], [60052, 60055, 60048, 60049], [60049, 60052, 60045, 60046], [60046, 60048, 60030, 60032], [60032, 60050, 60030, 60048], [60048, 60052, 60045, 60050],
      [60050, 60060, 60048, 60058], [60058, 60068, 60056, 60066], [60066, 60076, 60064, 60074]
    ],
    revealFrom: 6,
    levels: [
      { y: 60045, label: 'Soporte', kind: 'support' },
      { y: 60050, label: 'Entrada', kind: 'entry' },
      { y: 60028, label: 'SL', kind: 'sl' },
      { y: 60068, label: 'TP', kind: 'tp' }
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
      [2380, 2382, 2370, 2372], [2372, 2374, 2360, 2362], [2362, 2364, 2350, 2352], [2352, 2356, 2350, 2354], [2354, 2358, 2352, 2356], [2356, 2360, 2354, 2358],
      [2358, 2360, 2348, 2350], [2350, 2352, 2340, 2342], [2342, 2344, 2330, 2332]
    ],
    revealFrom: 6,
    levels: [
      { y: 2358, label: 'Entrada', kind: 'entry' },
      { y: 2362, label: 'SL', kind: 'sl' },
      { y: 2342, label: 'TP', kind: 'tp' }
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
      [5140, 5144, 5138, 5142], [5142, 5146, 5140, 5144], [5144, 5148, 5142, 5146], [5146, 5150, 5144, 5148], [5148, 5176, 5146, 5174], [5174, 5178, 5172, 5176],
      [5176, 5180, 5174, 5178], [5178, 5182, 5176, 5180], [5180, 5184, 5178, 5182]
    ],
    revealFrom: 6,
    levels: [
      { y: 5150, label: 'Resistencia Rota', kind: 'support' },
      { y: 5144, label: 'SL Estructural lejanísimo', kind: 'sl' }
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
      [18440, 18444, 18438, 18442], [18442, 18446, 18440, 18444], [18444, 18448, 18442, 18446], [18446, 18460, 18446, 18460], [18460, 18472, 18460, 18472], [18472, 18478, 18470, 18476],
      [18476, 18488, 18476, 18488], [18488, 18498, 18486, 18496], [18496, 18498, 18492, 18494]
    ],
    revealFrom: 6,
    levels: [
      { y: 18446, label: 'VWAP', kind: 'support' },
      { y: 18472, label: 'Entrada', kind: 'entry' },
      { y: 18458, label: 'SL', kind: 'sl' },
      { y: 18492, label: 'TP', kind: 'tp' }
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
      [73050, 73060, 73048, 73058], [73058, 73068, 73056, 73066], [73066, 73076, 73064, 73074], [73074, 73084, 73072, 73082], [73082, 73098, 73080, 73084], [73084, 73086, 73072, 73074],
      [73074, 73076, 73060, 73062], [73062, 73066, 73050, 73052], [73050, 73054, 73038, 73040]
    ],
    revealFrom: 6,
    levels: [
      { y: 73084, label: 'Entrada', kind: 'entry' },
      { y: 73100, label: 'SL', kind: 'sl' },
      { y: 73048, label: 'TP', kind: 'tp' }
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
      [2330, 2340, 2328, 2338], [2338, 2350, 2336, 2348], [2348, 2360, 2346, 2358], [2358, 2370, 2356, 2368], [2368, 2370, 2362, 2364], [2364, 2366, 2358, 2360],
      [2360, 2368, 2356, 2366], [2366, 2376, 2364, 2374], [2374, 2386, 2372, 2384]
    ],
    revealFrom: 6,
    levels: [
      { y: 2358, label: 'Fib 61.8%', kind: 'support' },
      { y: 2360, label: 'Entrada', kind: 'entry' },
      { y: 2354, label: 'SL', kind: 'sl' },
      { y: 2378, label: 'TP', kind: 'tp' }
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
      [5250, 5256, 5248, 5254], [5254, 5260, 5252, 5258], [5258, 5264, 5256, 5262], [5262, 5268, 5260, 5266], [5266, 5276, 5264, 5274], [5274, 5278, 5260, 5262],
      [5262, 5264, 5250, 5252], [5252, 5256, 5242, 5244], [5244, 5246, 5230, 5232]
    ],
    revealFrom: 6,
    levels: [
      { y: 5266, label: 'Oferta', kind: 'resistance' },
      { y: 5262, label: 'Entrada', kind: 'entry' },
      { y: 5278, label: 'SL', kind: 'sl' },
      { y: 5244, label: 'TP', kind: 'tp' }
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
      [18440, 18444, 18438, 18442], [18442, 18448, 18440, 18446], [18446, 18448, 18442, 18444], [18444, 18446, 18440, 18442], [18442, 18450, 18440, 18448], [18448, 18452, 18446, 18450],
      [18450, 18490, 18410, 18485], [18485, 18495, 18420, 18430], [18430, 18460, 18420, 18450]
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
      [60050, 60052, 60049, 60051], [60051, 60052, 60049, 60050], [60050, 60051, 60048, 60049], [60049, 60051, 60048, 60050], [60050, 60051, 60049, 60050], [60050, 60052, 60049, 60051],
      [60051, 60052, 60050, 60051], [60051, 60052, 60049, 60050], [60050, 60052, 60048, 60051]
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
      [2370, 2372, 2358, 2360], [2360, 2364, 2356, 2358], [2358, 2362, 2350, 2352], [2352, 2360, 2348, 2358], [2358, 2360, 2354, 2356], [2356, 2358, 2346, 2348],
      [2348, 2360, 2346, 2358], [2358, 2368, 2356, 2366], [2366, 2376, 2364, 2374]
    ],
    revealFrom: 6,
    levels: [
      { y: 2348, label: 'Soporte Clave', kind: 'support' },
      { y: 2358, label: 'Entrada', kind: 'entry' },
      { y: 2344, label: 'SL', kind: 'sl' },
      { y: 2380, label: 'TP', kind: 'tp' }
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
      [5080, 5082, 5068, 5070], [5070, 5072, 5058, 5060], [5060, 5062, 5048, 5050], [5050, 5056, 5048, 5054], [5054, 5058, 5052, 5056], [5056, 5058, 5044, 5046],
      [5046, 5048, 5034, 5036], [5036, 5040, 5026, 5028], [5026, 5030, 5018, 5020]
    ],
    revealFrom: 6,
    levels: [
      { y: 5056, label: 'EMA 20', kind: 'resistance' },
      { y: 5046, label: 'Entrada', kind: 'entry' },
      { y: 5058, label: 'SL', kind: 'sl' },
      { y: 5026, label: 'TP', kind: 'tp' }
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
      [18330, 18340, 18328, 18338], [18338, 18380, 18336, 18375], [18375, 18430, 18370, 18425], [18425, 18480, 18420, 18475], [18475, 18486, 18466, 18484], [18484, 18490, 18482, 18488],
      [18488, 18492, 18480, 18482], [18482, 18486, 18472, 18474], [18474, 18476, 18464, 18466]
    ],
    revealFrom: 6,
    levels: [
      { y: 18490, label: 'Resistencia Mayor', kind: 'resistance' },
      { y: 18340, label: 'Punto Ruptura original', kind: 'support' }
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
      [2940, 3050, 2938, 2948], [2948, 2950, 2942, 2942], [2942, 2950, 2940, 2946], [2946, 2948, 2944, 2944], [2944, 2950, 2942, 2948], [2948, 3060, 2946, 3058],
      [3058, 3068, 3056, 3066], [3066, 3076, 3064, 3074], [3074, 3084, 3072, 3082]
    ],
    revealFrom: 6,
    levels: [
      { y: 3050, label: 'Resistencia Rota', kind: 'support' },
      { y: 3058, label: 'Entrada', kind: 'entry' },
      { y: 3046, label: 'SL', kind: 'sl' },
      { y: 3080, label: 'TP', kind: 'tp' }
    ]
  }
]

export default scenarios
