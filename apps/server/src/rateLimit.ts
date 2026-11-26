/** Token-bucket rate limiter. */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  take(cost = 1): boolean {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.refillPerSec);
    this.last = t;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

/** Keyed limiter with automatic cleanup (e.g. per IP). */
export class KeyedLimiter {
  private buckets = new Map<string, { bucket: TokenBucket; seen: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {}

  take(key: string, cost = 1): boolean {
    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { bucket: new TokenBucket(this.capacity, this.refillPerSec), seen: Date.now() };
      this.buckets.set(key, entry);
    }
    entry.seen = Date.now();
    if (this.buckets.size > 10_000) this.sweep();
    return entry.bucket.take(cost);
  }

  private sweep(): void {
    const cutoff = Date.now() - 10 * 60_000;
    for (const [k, v] of this.buckets) if (v.seen < cutoff) this.buckets.delete(k);
  }
}

/** Bounded set for replay/idempotency checks of client message ids. */
export class RecentIds {
  private set = new Set<string>();
  private order: string[] = [];

  constructor(private readonly limit = 256) {}

  /** Returns false if the id was already seen. */
  add(id: string): boolean {
    if (this.set.has(id)) return false;
    this.set.add(id);
    this.order.push(id);
    if (this.order.length > this.limit) this.set.delete(this.order.shift()!);
    return true;
  }
}
