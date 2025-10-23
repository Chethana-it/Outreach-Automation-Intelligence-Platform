import { Injectable, NestMiddleware } from '@nestjs/common';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private limiter: RateLimiterRedis;

  constructor() {
    const client = new Redis(process.env.REDIS_URL!);
    this.limiter = new RateLimiterRedis({
      storeClient: client,
      keyPrefix: 'rl:api',
      points: 100,      // 100 requests
      duration: 60,     // per 60 seconds (per IP)
      blockDuration: 2 // if exceeded, block for 2s
    });
  }

  async use(req: any, res: any, next: () => void) {
    const key = req.ip || 'global';
    try {
      await this.limiter.consume(key, 1);
      next();
    } catch {
      res.status(429).json({ message: 'Too Many Requests' });
    }
  }
}
