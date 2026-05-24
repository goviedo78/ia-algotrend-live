export type BacktestingScenario = {
  id: string
  symbol: 'BTC' | 'XAU' | 'NQ' | 'ETH'
  timeframe: '5M'
  title: string
  context: string
  difficulty: 'inicial' | 'intermedio' | 'avanzado'
  /** Array de velas [open, high, low, close] with real market scale */
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
      /* consolidacion around 67000 */
      [67040, 67042, 67038, 67041], [67041, 67043, 67040, 67040], [67040, 67041, 67039, 67041], [67041, 67042, 67039, 67040],
      [67040, 67044, 67038, 67039], [67039, 67041, 67037, 67040], [67040, 67042, 67039, 67041], [67041, 67042, 67040, 67041],
      [67041, 67043, 67039, 67042], [67042, 67045, 67041, 67044], [67044, 67046, 67043, 67045],
      /* vela de breakout (index 11) */
      [67045, 67058, 67044, 67056],
      /* velas ocultas (pullback y continuacion) */
      [67056, 67057, 67051, 67052], [67052, 67054, 67048, 67050], [67050, 67052, 67049, 67051], // pullback al borde roto
      [67051, 67062, 67050, 67060], [67060, 67068, 67058, 67066], [67066, 67075, 67065, 67074], // continuacion
      [67074, 67076, 67070, 67071], [67071, 67074, 67069, 67072]
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
      /* premarket chop around 18000 */
      [18060, 18062, 18058, 18061], [18061, 18063, 18059, 18060], [18060, 18064, 18058, 18062], [18062, 18063, 18060, 18061],
      /* apertura 9:30 (index 4) */
      [18061, 18062, 18030, 18058], 
      /* velas ocultas (reversion alcista fuerte) */
      [18058, 18068, 18055, 18066], [18066, 18075, 18064, 18073], [18073, 18080, 18071, 18078], [18078, 18085, 18075, 18084],
      [18084, 18086, 18080, 18081], [18081, 18088, 18079, 18087]
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
      /* impulso inicial around 2300 */
      [2320, 2328, 2318, 2326], [2326, 2335, 2325, 2334], [2334, 2345, 2332, 2342], [2342, 2352, 2340, 2350],
      /* pullback a demanda (index 4-7) */
      [2350, 2351, 2346, 2347], [2347, 2349, 2344, 2345], [2345, 2347, 2342, 2344], [2344, 2346, 2341, 2345],
      /* vela martillo oculta que confirma (index 8) */
      [2345, 2346, 2338, 2344], 
      /* continuacion alcista */
      [2344, 2358, 2343, 2356], [2356, 2368, 2354, 2365], [2365, 2375, 2362, 2373], [2373, 2385, 2371, 2382],
      [2382, 2385, 2378, 2380]
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
      /* around 3500 */
      [3550, 3552, 3548, 3551], [3551, 3553, 3549, 3550], [3550, 3554, 3548, 3549], [3549, 3552, 3547, 3551],
      [3551, 3553, 3550, 3550], [3550, 3555, 3549, 3551], [3551, 3554, 3549, 3552], [3552, 3553, 3548, 3549],
      /* ocultas: mas rango interminable */
      [3549, 3552, 3548, 3550], [3550, 3553, 3549, 3551], [3551, 3554, 3550, 3550], [3550, 3552, 3548, 3551],
      [3551, 3555, 3549, 3550], [3550, 3552, 3547, 3550], [3550, 3553, 3548, 3551], [3551, 3554, 3549, 3550]
    ],
    hiddenFromIndex: 8,
    suggestedBias: 'skip',
    lesson: 'En mercados laterales y estrechos sin volumen, la decision correcta es "No operar". Intentar cazar rupturas aqui suele terminar en falsos quiebres constantes.'
  }
]

export default scenarios
