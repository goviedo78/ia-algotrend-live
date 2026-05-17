/**
 * In-memory rate limiter by IP address.
 * Protects against DDoS and brute-force attacks.
 * 
 * Usage:
 *   const { success } = rateLimiter.check(ip, 'public')
 *   if (!success) return new Response('Too Many Requests', { status: 429 })
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const PRESETS: Record<string, RateLimitConfig> = {
  // Public data endpoints (candles, trades, signal)
  public: { maxRequests: 60, windowMs: 60_000 },         // 60 req/min

  // Sensitive endpoints (backfill, push/send, debug)
  sensitive: { maxRequests: 5, windowMs: 60_000 },        // 5 req/min

  // Auth endpoints (login)
  auth: { maxRequests: 5, windowMs: 3_600_000 },          // 5 req/hour

  // Analytics/tracking (high volume OK)
  analytics: { maxRequests: 120, windowMs: 60_000 },      // 120 req/min

  // Push subscribe
  subscribe: { maxRequests: 10, windowMs: 60_000 },       // 10 req/min

  // Webhook endpoints (TradingView, cron)
  webhook: { maxRequests: 30, windowMs: 60_000 },         // 30 req/min
}

class RateLimiter {
  private stores = new Map<string, Map<string, RateLimitEntry>>()

  check(ip: string, preset: keyof typeof PRESETS): { success: boolean; remaining: number; resetIn: number } {
    const config = PRESETS[preset] || PRESETS.public
    const storeKey = preset as string

    if (!this.stores.has(storeKey)) {
      this.stores.set(storeKey, new Map())
    }
    const store = this.stores.get(storeKey)!

    const now = Date.now()
    const entry = store.get(ip)

    // Clean expired entries periodically (every 100 checks)
    if (Math.random() < 0.01) {
      for (const [key, val] of store.entries()) {
        if (now > val.resetTime) store.delete(key)
      }
    }

    if (!entry || now > entry.resetTime) {
      store.set(ip, { count: 1, resetTime: now + config.windowMs })
      return { success: true, remaining: config.maxRequests - 1, resetIn: config.windowMs }
    }

    entry.count++
    const remaining = Math.max(0, config.maxRequests - entry.count)
    const resetIn = entry.resetTime - now

    if (entry.count > config.maxRequests) {
      return { success: false, remaining: 0, resetIn }
    }

    return { success: true, remaining, resetIn }
  }
}

// Singleton — persists across requests in the same serverless instance
export const rateLimiter = new RateLimiter()
export { PRESETS as rateLimitPresets }
