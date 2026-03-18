import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

/**
 * A lightweight cache service backed by Redis when REDIS_URL is configured,
 * with a transparent in-memory fallback for development or environments
 * without Redis.
 *
 * Usage:
 *   await this.cache.get<string>('key')          → value or null
 *   await this.cache.set('key', value, 300)      → void (TTL in seconds)
 *   await this.cache.del('key')                  → void
 *   await this.cache.delByPattern('org:abc:*')   → void
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: any = null;
  private inMemory = new Map<string, { value: string; expiresAt: number }>();
  private readonly usingRedis: boolean;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        // Dynamic import to avoid hard dependency if ioredis is not installed
        const { default: Redis } = require('ioredis');
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          connectTimeout: 5000,
        });
        this.redis.on('error', (err: Error) => {
          this.logger.warn(`Redis error (falling back to in-memory): ${err.message}`);
          this.redis = null;
        });
        this.redis.on('connect', () => {
          this.logger.log('Redis connected');
        });
        this.usingRedis = true;
        this.logger.log(`Cache: Redis at ${redisUrl.replace(/\/\/.*@/, '//<credentials>@')}`);
      } catch (e) {
        this.logger.warn('ioredis not available — using in-memory cache');
        this.usingRedis = false;
      }
    } else {
      this.usingRedis = false;
      this.logger.log('Cache: in-memory (set REDIS_URL for Redis-backed cache)');
    }
  }

  async get<T = string>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      } catch {
        // Fall through to in-memory
      }
    }
    const entry = this.inMemory.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.inMemory.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.redis) {
      try {
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
        return;
      } catch {
        // Fall through to in-memory
      }
    }
    this.inMemory.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch { /* noop */ }
    }
    this.inMemory.delete(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    if (this.redis) {
      try {
        const keys: string[] = await this.redis.keys(pattern);
        if (keys.length > 0) await this.redis.del(...keys);
      } catch { /* noop */ }
    }
    // In-memory: match by prefix/suffix glob-like pattern
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.inMemory.keys()) {
      if (regex.test(key)) this.inMemory.delete(key);
    }
  }

  isRedisAvailable(): boolean {
    return this.usingRedis && this.redis !== null;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
    }
  }
}
