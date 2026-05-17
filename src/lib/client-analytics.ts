type AnalyticsPayload = Record<string, unknown>;

let queue: AnalyticsPayload[] = [];
let flushInterval: ReturnType<typeof setInterval> | null = null;

const FLUSH_INTERVAL_MS = 15000; // 15 seconds

function flushQueue() {
  if (queue.length === 0) return;
  
  const payload = [...queue];
  queue = [];
  
  // Try to use sendBeacon if available, otherwise fetch
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon('/api/analytics/track', blob);
  } else {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
}

function startInterval() {
  if (typeof window === 'undefined') return;
  if (!flushInterval) {
    flushInterval = setInterval(flushQueue, FLUSH_INTERVAL_MS);
    
    // Also flush on visibility change (page hide)
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushQueue();
      }
    });
  }
}

export function track(payload: AnalyticsPayload) {
  queue.push(payload);
  startInterval();
  
  // If queue is getting too large, flush immediately
  if (queue.length >= 20) {
    flushQueue();
  }
}
