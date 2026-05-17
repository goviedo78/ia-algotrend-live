import type { Metadata } from 'next'
import Link from 'next/link'
import s from '../legal.module.css'

export const metadata: Metadata = {
  title: 'Términos de Servicio | GONOVI',
  description: 'Términos de Servicio para la compra y uso de scripts Pine Script de GONOVI.',
  robots: { index: false, follow: false },
}

export default function TermsPage() {
  return (
    <main className={s.shell}>
      <div className={s.noise} />
      <article className={s.document}>
        <Link href="/official" className={s.backLink}>← Volver a GONOVI</Link>

        <header className={s.header}>
          <span className={s.eyebrow}>Legal · GONOVI</span>
          <h1 className={s.title}>Términos de Servicio</h1>
          <p className={s.lead}>
            Estos términos regulan el acceso, compra, descarga y uso de los scripts, indicadores,
            materiales educativos y herramientas digitales ofrecidas por GONOVI.
          </p>
          <span className={s.updated}>Última actualización: 14 de mayo de 2026</span>
        </header>

        <div className={s.content}>
          <section className={s.section}>
            <h2>1. Aceptación de los términos</h2>
            <p>
              Al comprar, descargar o utilizar cualquier producto digital de GONOVI, aceptas estos
              Términos de Servicio. Si no estás de acuerdo con alguna condición, no debes comprar,
              descargar ni utilizar los productos.
            </p>
          </section>

          <section className={s.section}>
            <h2>2. Productos digitales</h2>
            <p>
              GONOVI vende scripts completos de Pine Script, indicadores, herramientas de análisis
              y materiales educativos relacionados con trading. La entrega puede realizarse por
              email, descarga directa, dashboard del cliente u otro medio habilitado por GONOVI.
            </p>
            <p>
              Los productos se entregan como archivos digitales. No constituyen acceso revocable a
              una cuenta de TradingView, salvo que una oferta específica indique lo contrario.
            </p>
          </section>

          <section className={s.section}>
            <h2>3. Propiedad intelectual y uso permitido</h2>
            <p className={s.highlight}>
              El código fuente Pine Script provisto es propiedad intelectual de GONOVI y su reventa está prohibida.
            </p>
            <p>
              La compra te otorga una licencia personal, limitada y no transferible para utilizar el
              script en tus propios análisis y operaciones. No puedes revender, redistribuir, sublicenciar,
              publicar, copiar para terceros, empaquetar como producto propio ni compartir el código en
              repositorios públicos o privados destinados a terceros.
            </p>
          </section>

          <section className={s.section}>
            <h2>4. Pagos y entrega</h2>
            <p>
              Los precios, métodos de pago y condiciones de entrega se muestran antes de confirmar la
              compra. En compras manuales, cripto o pagos que requieran verificación, la entrega puede
              quedar sujeta a validación del comprobante.
            </p>
          </section>

          <section className={s.section}>
            <h2>5. Reembolsos</h2>
            <p>
              Debido a la naturaleza digital y descargable de los scripts, las compras pueden no ser
              reembolsables una vez entregado el archivo, salvo error técnico atribuible a GONOVI o
              disposición legal aplicable. Cada solicitud se revisará caso por caso.
            </p>
          </section>

          <section className={s.section}>
            <h2>6. No asesoría financiera</h2>
            <p>
              Los productos de GONOVI son herramientas educativas y de análisis técnico. No constituyen
              asesoría financiera, recomendación de inversión, promesa de rentabilidad ni garantía de
              resultados. El usuario es responsable de sus decisiones, gestión de riesgo y cumplimiento
              regulatorio aplicable.
            </p>
          </section>

          <section className={s.section}>
            <h2>7. Disponibilidad y soporte</h2>
            <p>
              GONOVI puede actualizar productos, documentación, precios o servicios relacionados sin
              aviso previo. El soporte se presta por los canales oficiales y puede requerir capturas,
              comprobantes o información técnica para resolver incidencias.
            </p>
          </section>

          <section className={s.section}>
            <h2>8. Limitación de responsabilidad</h2>
            <p>
              En la máxima medida permitida por la ley, GONOVI no será responsable por pérdidas de
              trading, lucro cesante, errores de configuración, interrupciones de plataformas externas
              o decisiones tomadas por el usuario a partir del uso de los productos.
            </p>
          </section>

          <section className={s.section}>
            <h2>9. Cambios en estos términos</h2>
            <p>
              GONOVI puede modificar estos términos para reflejar cambios en productos, procesos,
              obligaciones legales o prácticas comerciales. La versión publicada en esta página será
              la versión vigente.
            </p>
          </section>
        </div>

        <footer className={s.footer}>
          <Link href="/official/legal/privacy" className={s.footerLink}>Política de Privacidad</Link>
          <Link href="/official/store" className={s.footerLink}>Tienda</Link>
          <Link href="/official/dashboard" className={s.footerLink}>Dashboard</Link>
        </footer>
      </article>
    </main>
  )
}
