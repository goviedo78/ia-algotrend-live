import type { Metadata } from 'next'
import Link from 'next/link'
import s from '../legal.module.css'

export const metadata: Metadata = {
  title: 'Política de Privacidad | GONOVI',
  description: 'Política de Privacidad para el uso de productos, formularios y servicios digitales de GONOVI.',
  robots: { index: false, follow: false },
}

export default function PrivacyPage() {
  return (
    <main className={s.shell}>
      <div className={s.noise} />
      <article className={s.document}>
        <Link href="/official" className={s.backLink}>← Volver a GONOVI</Link>

        <header className={s.header}>
          <span className={s.eyebrow}>Legal · GONOVI</span>
          <h1 className={s.title}>Política de Privacidad</h1>
          <p className={s.lead}>
            Esta política explica qué datos podemos recopilar, cómo los utilizamos y qué opciones
            tienes al interactuar con GONOVI, sus páginas, formularios, checkout y productos digitales.
          </p>
          <span className={s.updated}>Última actualización: 14 de mayo de 2026</span>
        </header>

        <div className={s.content}>
          <section className={s.section}>
            <h2>1. Información que recopilamos</h2>
            <p>Podemos recopilar información que nos entregas directamente, incluyendo:</p>
            <ul>
              <li>Nombre y email para procesar compras, entregas y soporte.</li>
              <li>Usuario de TradingView, Telegram o WhatsApp si decides compartirlo como referencia.</li>
              <li>Producto seleccionado, método de pago, referencia de orden y comprobantes cuando corresponda.</li>
              <li>Mensajes enviados a soporte o formularios de contacto.</li>
            </ul>
          </section>

          <section className={s.section}>
            <h2>2. Información técnica y analítica</h2>
            <p>
              Podemos registrar datos técnicos básicos como páginas visitadas, dispositivo, navegador,
              país aproximado, referrer, eventos de navegación y métricas de uso. Esta información se
              utiliza para entender el rendimiento del sitio, mejorar el producto y detectar errores.
            </p>
          </section>

          <section className={s.section}>
            <h2>3. Uso de la información</h2>
            <p>Usamos la información recopilada para:</p>
            <ul>
              <li>Procesar compras y entregar scripts Pine Script completos.</li>
              <li>Enviar confirmaciones, instrucciones, actualizaciones o soporte relacionado.</li>
              <li>Mejorar la experiencia del sitio, el dashboard, el checkout y las páginas educativas.</li>
              <li>Prevenir fraude, abuso, reventa no autorizada o uso indebido de los productos.</li>
              <li>Cumplir obligaciones legales, contables o de seguridad cuando sea necesario.</li>
            </ul>
          </section>

          <section className={s.section}>
            <h2>4. Cookies y almacenamiento local</h2>
            <p>
              El sitio puede usar cookies, sessionStorage o localStorage para recordar preferencias,
              guardar progreso local, registrar órdenes simuladas, medir interacciones o mantener
              funciones del dashboard. Puedes borrar estos datos desde la configuración de tu navegador.
            </p>
          </section>

          <section className={s.section}>
            <h2>5. Pagos y terceros</h2>
            <p>
              Algunos pagos, comunicaciones o herramientas pueden procesarse mediante terceros como
              plataformas de checkout, proveedores de email, analítica, hosting o mensajería. Dichos
              proveedores pueden tratar datos conforme a sus propias políticas y medidas de seguridad.
            </p>
          </section>

          <section className={s.section}>
            <h2>6. Conservación y seguridad</h2>
            <p>
              Conservamos la información durante el tiempo necesario para operar el servicio, prestar
              soporte, cumplir obligaciones legales y proteger derechos de propiedad intelectual.
              Aplicamos medidas razonables para proteger la información, aunque ningún sistema es
              completamente infalible.
            </p>
          </section>

          <section className={s.section}>
            <h2>7. Derechos y opciones</h2>
            <p>
              Puedes solicitar acceso, corrección o eliminación de información personal cuando sea
              aplicable. También puedes dejar de usar el sitio, borrar datos locales del navegador o
              pedir soporte por los canales oficiales de GONOVI.
            </p>
          </section>

          <section className={s.section}>
            <h2>8. Menores de edad</h2>
            <p>
              GONOVI no está dirigido a menores de 13 años ni busca recopilar información de menores.
              Si detectamos información de un menor sin autorización válida, podremos eliminarla.
            </p>
          </section>

          <section className={s.section}>
            <h2>9. Cambios en esta política</h2>
            <p>
              Podemos actualizar esta Política de Privacidad para reflejar cambios legales, técnicos o
              comerciales. La versión publicada en esta página será la versión vigente.
            </p>
          </section>

          <section className={s.section}>
            <h2>10. Contacto</h2>
            <p>
              Para consultas de privacidad, soporte o solicitudes relacionadas con tus datos, utiliza
              los canales oficiales publicados por GONOVI.
            </p>
          </section>
        </div>

        <footer className={s.footer}>
          <Link href="/official/legal/terms" className={s.footerLink}>Términos de Servicio</Link>
          <Link href="/official/store" className={s.footerLink}>Tienda</Link>
          <Link href="/official/dashboard" className={s.footerLink}>Dashboard</Link>
        </footer>
      </article>
    </main>
  )
}
