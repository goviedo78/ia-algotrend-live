import Link from 'next/link'
import styles from './docs.module.css'

export function DocsPage() {
  return (
    <main className={styles.container}>
      <Link href="/official" className={styles.backLink}>← Volver a GONOVI</Link>
      <header className={styles.header}>
        <div className={styles.kickerWrapper}>
          <span className={styles.kickerDot} aria-hidden="true" />
          <p className={styles.kicker}>Documentación</p>
        </div>
        <h1 className={styles.title}>Guía de Instalación</h1>
        <p className={styles.description}>
          3 pasos para añadir tu script a TradingView.
        </p>
      </header>

      <section className={styles.content}>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Abrir el Editor Pine</h2>
              <p className={styles.stepDesc}>
                Abre tu gráfico en TradingView. En el panel inferior, haz clic en la pestaña &quot;Pine Editor&quot; (o &quot;Editor Pine&quot;).
              </p>
            </div>
          </div>
          
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Pegar el código</h2>
              <p className={styles.stepDesc}>
                Borra cualquier código existente en el editor. Abre el archivo de texto que recibiste con tu compra y copia todo su contenido. Pégalo directamente en el editor vacío.
              </p>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Guardar y Añadir</h2>
              <p className={styles.stepDesc}>
                Haz clic en el botón &quot;Guardar&quot; en la esquina superior derecha del editor, ponle un nombre y luego haz clic en &quot;Añadir al gráfico&quot;. ¡El indicador ya está listo para usarse!
              </p>
            </div>
          </div>
        </div>

        <div className={styles.codePanel}>
          <div className={styles.codeHeader}>
            <div className={styles.windowControls}>
              <div className={`${styles.dot} ${styles.dotRed}`} />
              <div className={`${styles.dot} ${styles.dotYellow}`} />
              <div className={`${styles.dot} ${styles.dotGreen}`} />
            </div>
            <span className={styles.fileName}>gonovi_indicator.pine</span>
          </div>
          <pre className={styles.codeBlock}>
            <code>
<span className={styles.codeComment}>{'// This source code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/'}</span>
<br />
<span className={styles.codeComment}>{'// © GONOVI AlgoTrend'}</span>
<br /><br />
<span className={styles.codeKeyword}>{'//@version'}</span><span className={styles.codePunctuation}>=</span><span className={styles.codeNumber}>5</span>
<br />
<span className={styles.codeFunction}>indicator</span><span className={styles.codePunctuation}>(</span><span className={styles.codeString}>&quot;GONOVI Fusion X10&quot;</span><span className={styles.codePunctuation}>,</span> <span className={styles.codeKeyword}>overlay</span> <span className={styles.codePunctuation}>=</span> <span className={styles.codeKeyword}>true</span><span className={styles.codePunctuation}>)</span>
<br /><br />
<span className={styles.codeComment}>{'// --- INPUTS ---'}</span>
<br />
<span className={styles.codeKeyword}>length</span> <span className={styles.codePunctuation}>=</span> <span className={styles.codeFunction}>input.int</span><span className={styles.codePunctuation}>(</span><span className={styles.codeNumber}>20</span><span className={styles.codePunctuation}>,</span> <span className={styles.codeString}>&quot;EMA Length&quot;</span><span className={styles.codePunctuation}>)</span>
<br />
<span className={styles.codeKeyword}>src</span> <span className={styles.codePunctuation}>=</span> <span className={styles.codeFunction}>input.source</span><span className={styles.codePunctuation}>(</span><span className={styles.codeKeyword}>close</span><span className={styles.codePunctuation}>,</span> <span className={styles.codeString}>&quot;Source&quot;</span><span className={styles.codePunctuation}>)</span>
<br /><br />
<span className={styles.codeComment}>{'// --- LOGIC ---'}</span>
<br />
<span className={styles.codeKeyword}>emaValue</span> <span className={styles.codePunctuation}>=</span> <span className={styles.codeFunction}>ta.ema</span><span className={styles.codePunctuation}>(</span><span className={styles.codeKeyword}>src</span><span className={styles.codePunctuation}>,</span> <span className={styles.codeKeyword}>length</span><span className={styles.codePunctuation}>)</span>
<br />
<span className={styles.codeKeyword}>isBullish</span> <span className={styles.codePunctuation}>=</span> <span className={styles.codeKeyword}>close</span> <span className={styles.codePunctuation}>{'>'}</span> <span className={styles.codeKeyword}>emaValue</span>
<br /><br />
<span className={styles.codeComment}>{'// --- PLOT ---'}</span>
<br />
<span className={styles.codeFunction}>plot</span><span className={styles.codePunctuation}>(</span><span className={styles.codeKeyword}>emaValue</span><span className={styles.codePunctuation}>,</span> <span className={styles.codeKeyword}>color</span><span className={styles.codePunctuation}>=</span><span className={styles.codeKeyword}>isBullish</span> <span className={styles.codePunctuation}>?</span> <span className={styles.codeFunction}>color.new</span><span className={styles.codePunctuation}>(</span><span className={styles.codeString}>#f44e1c</span><span className={styles.codePunctuation}>,</span> <span className={styles.codeNumber}>0</span><span className={styles.codePunctuation}>)</span> <span className={styles.codePunctuation}>:</span> <span className={styles.codeFunction}>color.new</span><span className={styles.codePunctuation}>(</span><span className={styles.codeString}>#a8aaba</span><span className={styles.codePunctuation}>,</span> <span className={styles.codeNumber}>50</span><span className={styles.codePunctuation}>)</span><span className={styles.codePunctuation}>)</span>
            </code>
          </pre>
        </div>
      </section>
    </main>
  )
}
