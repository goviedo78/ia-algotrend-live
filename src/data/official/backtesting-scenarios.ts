export type BacktestingScenario = {
  id: string
  symbol: 'BTC' | 'XAU' | 'NQ' | 'ETH'
  timeframe: '5M'
  title: string
  context: string
  difficulty: 'inicial' | 'intermedio' | 'avanzado'
  /** Array de velas [open, high, low, close] normalizado 0-100 para el MVP SVG */
  candles: [number, number, number, number][]
  hiddenFromIndex: number
  suggestedBias?: 'long' | 'short' | 'skip'
  lesson: string
}

const scenarios: BacktestingScenario[] = [
  {
    id: 'bt-btc-5m-breakout',
    symbol: 'BTC',
    timeframe: '5M',
    title: 'Ruptura de Consolidacion Asiatica',
    context: 'El precio consolido en un rango estrecho durante 4 horas. En los ultimos 15 minutos, el volumen ha aumentado. Se acaba de producir una vela impulsiva alcista cerrando fuera del rango.',
    difficulty: 'inicial',
    candles: [
      /* consolidacion */
      [40, 42, 38, 41], [41, 43, 40, 40], [40, 41, 39, 41], [41, 42, 39, 40],
      [40, 44, 38, 39], [39, 41, 37, 40], [40, 42, 39, 41], [41, 42, 40, 41],
      [41, 43, 39, 42], [42, 45, 41, 44], [44, 46, 43, 45],
      /* vela de breakout (index 11) */
      [45, 58, 44, 56],
      /* velas ocultas (pullback y continuacion) */
      [56, 57, 51, 52], [52, 54, 48, 50], [50, 52, 49, 51], // pullback al borde roto
      [51, 62, 50, 60], [60, 68, 58, 66], [66, 75, 65, 74], // continuacion
      [74, 76, 70, 71], [71, 74, 69, 72]
    ],
    hiddenFromIndex: 12,
    suggestedBias: 'long',
    lesson: 'Las rupturas verdaderas de consolidaciones largas suelen ofrecer un pullback rapido a la zona rota (break and retest) antes de continuar el impulso principal.'
  },
  {
    id: 'bt-nq-5m-fakeout',
    symbol: 'NQ',
    timeframe: '5M',
    title: 'Apertura NY - Falso Quiebre Bajista',
    context: 'Apertura de New York (9:30). Primera vela de 5M es una barrida fuerte hacia abajo rompiendo el minimo del pre-market, pero es fuertemente rechazada dejando una mecha enorme.',
    difficulty: 'intermedio',
    candles: [
      /* premarket chop */
      [60, 62, 58, 61], [61, 63, 59, 60], [60, 64, 58, 62], [62, 63, 60, 61],
      /* apertura 9:30 (index 4) */
      [61, 62, 30, 58], 
      /* velas ocultas (reversion alcista fuerte) */
      [58, 68, 55, 66], [66, 75, 64, 73], [73, 80, 71, 78], [78, 85, 75, 84],
      [84, 86, 80, 81], [81, 88, 79, 87]
    ],
    hiddenFromIndex: 5,
    suggestedBias: 'long',
    lesson: 'En aperturas de indices, el movimiento inicial violento que rompe soportes y es comprado agresivamente en la misma vela (pin bar/hammer) suele ser trampa de liquidez para atrapar cortos.'
  },
  {
    id: 'bt-xau-5m-trend',
    symbol: 'XAU',
    timeframe: '5M',
    title: 'Tendencia Alcista - Compra en EMA',
    context: 'Oro en clara tendencia alcista de corto plazo haciendo higher highs y higher lows. El precio acaba de retroceder ordenadamente hacia el pivot anterior.',
    difficulty: 'inicial',
    candles: [
      /* impulso inicial */
      [20, 28, 18, 26], [26, 35, 25, 34], [34, 45, 32, 42], [42, 52, 40, 50],
      /* pullback a demanda (index 4-7) */
      [50, 51, 46, 47], [47, 49, 44, 45], [45, 47, 42, 44], [44, 46, 41, 45],
      /* vela martillo oculta que confirma (index 8) */
      [45, 46, 38, 44], 
      /* continuacion alcista */
      [44, 58, 43, 56], [56, 68, 54, 65], [65, 75, 62, 73], [73, 85, 71, 82],
      [82, 85, 78, 80]
    ],
    hiddenFromIndex: 8,
    suggestedBias: 'long',
    lesson: 'No es necesario adivinar el fin de un pullback. Esperar a ver una vela de absorcion (mecha inferior) en una zona estructural clave mejora la probabilidad de la entrada.'
  },
  {
    id: 'bt-eth-5m-chop',
    symbol: 'ETH',
    timeframe: '5M',
    title: 'Rango Agotador sin Volumen',
    context: 'Tarde de viernes, sin catalizadores. El precio oscila sin direccion con velas pequeñas y mechas por ambos lados. No hay estructura clara definida.',
    difficulty: 'avanzado',
    candles: [
      [50, 52, 48, 51], [51, 53, 49, 50], [50, 54, 48, 49], [49, 52, 47, 51],
      [51, 53, 50, 50], [50, 55, 49, 51], [51, 54, 49, 52], [52, 53, 48, 49],
      /* ocultas: mas rango interminable */
      [49, 52, 48, 50], [50, 53, 49, 51], [51, 54, 50, 50], [50, 52, 48, 51],
      [51, 55, 49, 50], [50, 52, 47, 50], [50, 53, 48, 51], [51, 54, 49, 50]
    ],
    hiddenFromIndex: 8,
    suggestedBias: 'skip',
    lesson: 'En mercados laterales y estrechos sin volumen, la decision correcta es "No operar". Intentar cazar rupturas aqui suele terminar en falsos quiebres constantes.'
  }
]

export default scenarios
