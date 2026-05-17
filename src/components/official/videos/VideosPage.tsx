'use client'

import { useState } from 'react'
import styles from './videos.module.css'

type Video = {
  id: string
  title: string
  duration: string
  description: string
}

type Category = {
  id: string
  title: string
  videos: Video[]
}

const CATEGORIES: Category[] = [
  {
    id: 'pine-script',
    title: 'Pine Script',
    videos: [
      { id: 'vid-01', title: 'Pine Script v6: Guía Completa desde Cero', duration: '15:20', description: 'Aprende las novedades de Pine Script v6 y construye tu primer indicador técnico profesional para TradingView.' },
      { id: 'vid-05', title: 'Programando un Filtro KNN en Pine Script', duration: '22:30', description: 'Tutorial avanzado para implementar vecinos más cercanos (KNN) y clasificar tendencias en tiempo real.' },
      { id: 'vid-09', title: 'Automatización: De Pine Script a Telegram', duration: '19:40', description: 'Configura alertas inteligentes que envíen señales de trading directamente a tu móvil sin scripts externos.' },
    ],
  },
  {
    id: 'estrategia',
    title: 'Estrategia',
    videos: [
      { id: 'vid-02', title: 'Estrategia Scalping BTC: Supertrend + IA', duration: '12:45', description: 'Combinamos el indicador Supertrend con lógica de Machine Learning para filtrar señales falsas en Bitcoin.' },
      { id: 'vid-06', title: 'Estrategia de Apertura New York para NQ', duration: '14:15', description: 'Aprovecha la volatilidad inicial del Nasdaq con este sistema de breakouts basado en rangos horarios.' },
      { id: 'vid-10', title: 'Estrategia Institucional para Gold (XAUUSD)', duration: '13:55', description: 'Análisis de Order Blocks y zonas de liquidez para operar el Oro con alta probabilidad de acierto.' },
    ],
  },
  {
    id: 'backtesting',
    title: 'Backtesting',
    videos: [
      { id: 'vid-03', title: 'Cómo Backtestear el Oro (XAUUSD) correctamente', duration: '18:10', description: 'Metodología paso a paso para validar estrategias en el Gold utilizando datos históricos de alta precisión.' },
      { id: 'vid-07', title: 'Deep Backtesting vs Estrategia Estándar', duration: '16:50', description: 'Comparativa real de resultados utilizando la nueva herramienta de Deep Backtesting de TradingView.' },
      { id: 'vid-11', title: 'Evita el Curve Fitting en tus Backtests', duration: '17:25', description: 'Cómo identificar cuando una estrategia está sobre-optimizada y por qué fallará en el trading real.' },
    ],
  },
  {
    id: 'riesgo',
    title: 'Gestión de Riesgo',
    videos: [
      { id: 'vid-04', title: 'La Regla del 1%: Gestión de Riesgo en Nasdaq', duration: '10:05', description: 'Por qué el tamaño de la posición es más importante que la entrada. Análisis aplicado al NQ100.' },
      { id: 'vid-08', title: 'Ratio Riesgo/Beneficio Dinámico con ATR', duration: '11:20', description: 'Ajusta tus Take Profit y Stop Loss automáticamente según la volatilidad del mercado usando el ATR.' },
      { id: 'vid-12', title: 'Psicología y Control del Drawdown Máximo', duration: '09:45', description: 'Plan de acción matemático y mental para gestionar rachas de pérdidas sin destruir tu cuenta de trading.' },
    ],
  },
]

function getVideoUrl(video: Video) {
  const query = encodeURIComponent(`GONOVI AlgoTrend ${video.title}`)
  return `https://www.youtube.com/@gonovi/search?query=${query}`
}

export function VideosPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCategories = CATEGORIES.map(category => ({
    ...category,
    videos: category.videos.filter(video =>
      video.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => {
    const matchesCategory = activeCategory === 'all' || category.id === activeCategory;
    const hasVideos = category.videos.length > 0;
    return matchesCategory && hasVideos;
  })

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div className={styles.kickerWrapper}>
          <span className={styles.kickerDot} aria-hidden="true" />
          <p className={styles.kicker}>Aprendizaje Visual</p>
        </div>
        <h1 className={styles.title}>Hub de Videos</h1>
        <p className={styles.description}>
          Tutoriales, guías y operativas en vivo para dominar AlgoTrend y mejorar tu lectura de mercado.
        </p>

        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            type="text" 
            placeholder="Buscar por título..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className={styles.filters}>
          <button 
            type="button" 
            className={`${styles.filterBtn} ${activeCategory === 'all' ? styles.active : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            Todos
          </button>
          {CATEGORIES.map(cat => (
            <button 
              key={cat.id}
              type="button" 
              className={`${styles.filterBtn} ${activeCategory === cat.id ? styles.active : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.title}
            </button>
          ))}
        </div>
      </header>

      {filteredCategories.map(category => (
        <section key={category.id} className={styles.categorySection}>
          <h2 className={styles.categoryTitle}>{category.title}</h2>
          <div className={styles.videoGrid}>
            {category.videos.map(video => (
              <a href={getVideoUrl(video)} key={video.id} className={styles.videoCard} rel="noreferrer" target="_blank">
                <div className={styles.thumbnailWrapper}>
                  <div className={styles.playIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <span className={styles.duration}>{video.duration}</span>
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.videoTitle}>{video.title}</h3>
                  {video.description && <p className={styles.videoDesc}>{video.description}</p>}
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
