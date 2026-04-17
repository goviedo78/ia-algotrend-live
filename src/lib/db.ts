import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'trades.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        direction   TEXT NOT NULL,       -- 'LONG' | 'SHORT'
        open_time   INTEGER NOT NULL,    -- unix seconds
        open_price  REAL NOT NULL,
        stop_loss   REAL NOT NULL,
        take_profit REAL NOT NULL,
        close_time  INTEGER,
        close_price REAL,
        close_reason TEXT,              -- 'SL' | 'TP' | 'SIGNAL'
        pnl_usd     REAL,
        pnl_pct     REAL,
        status      TEXT NOT NULL DEFAULT 'OPEN'  -- 'OPEN' | 'CLOSED'
      );

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)

    // Seed initial balance if not exists
    const row = _db.prepare('SELECT value FROM settings WHERE key = ?').get('balance') as { value: string } | undefined
    if (!row) {
      _db.prepare("INSERT INTO settings (key, value) VALUES ('balance', '10000')").run()
    }
  }
  return _db
}

export type TradeStatus = 'OPEN' | 'CLOSED'
export type TradeDirection = 'LONG' | 'SHORT'
export type CloseReason = 'SL' | 'TP' | 'SIGNAL'

export interface Trade {
  id: number
  direction: TradeDirection
  open_time: number
  open_price: number
  stop_loss: number
  take_profit: number
  close_time: number | null
  close_price: number | null
  close_reason: CloseReason | null
  pnl_usd: number | null
  pnl_pct: number | null
  status: TradeStatus
}

const POSITION_SIZE_USD = 10000   // full capital per trade (no leverage)

export function openTrade(
  direction: TradeDirection,
  openTime: number,
  openPrice: number,
  stopLoss: number,
  takeProfit: number
): Trade {
  const db = getDb()

  // Close any open trade before opening a new one (one position at a time)
  const open = db.prepare("SELECT * FROM trades WHERE status = 'OPEN'").get() as Trade | undefined
  if (open) {
    closeTrade(open.id, openTime, openPrice, 'SIGNAL')
  }

  const result = db.prepare(`
    INSERT INTO trades (direction, open_time, open_price, stop_loss, take_profit, status)
    VALUES (?, ?, ?, ?, ?, 'OPEN')
  `).run(direction, openTime, openPrice, stopLoss, takeProfit)

  return db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid) as Trade
}

export function closeTrade(
  id: number,
  closeTime: number,
  closePrice: number,
  reason: CloseReason
): Trade {
  const db = getDb()
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(id) as Trade

  const multiplier = trade.direction === 'LONG' ? 1 : -1
  const pnlPct = ((closePrice - trade.open_price) / trade.open_price) * multiplier * 100
  const pnlUsd = POSITION_SIZE_USD * pnlPct / 100

  db.prepare(`
    UPDATE trades
    SET close_time = ?, close_price = ?, close_reason = ?,
        pnl_usd = ?, pnl_pct = ?, status = 'CLOSED'
    WHERE id = ?
  `).run(closeTime, closePrice, reason, pnlUsd, pnlPct, id)

  return db.prepare('SELECT * FROM trades WHERE id = ?').get(id) as Trade
}

export function getOpenTrade(): Trade | null {
  const db = getDb()
  return (db.prepare("SELECT * FROM trades WHERE status = 'OPEN'").get() as Trade) ?? null
}

export function getAllTrades(limit = 100): Trade[] {
  const db = getDb()
  return db.prepare('SELECT * FROM trades ORDER BY open_time DESC LIMIT ?').all(limit) as Trade[]
}

export function getStats() {
  const db = getDb()
  const closed = db.prepare("SELECT * FROM trades WHERE status = 'CLOSED'").all() as Trade[]
  const total = closed.length
  const wins  = closed.filter(t => (t.pnl_usd ?? 0) > 0).length
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl_usd ?? 0), 0)
  const winRate = total > 0 ? (wins / total * 100) : 0
  const balance = 10000 + totalPnl
  return { total, wins, winRate, totalPnl, balance }
}
