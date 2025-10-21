import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService implements OnModuleInit {
  private readonly logger = new Logger(EventsService.name);
  private sub!: Redis;
  private redis!: Redis;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const url = process.env.REDIS_URL!;
    this.sub = new Redis(url);
    this.redis = new Redis(url);

    await this.sub.subscribe('events');
    this.sub.on('message', async (_ch, msg) => {
      const evt = JSON.parse(msg);
      try {
        // dedup: SETNX for eventId (build one if not present)
        const eventId = evt.id ?? `${evt.type}:${evt.entityId}:${evt.payload?.ts ?? Date.now()}`;
        const added = await this.redis.setnx(`dedup:${eventId}`, '1');
        if (!added) {
          this.logger.debug(`duplicate event skipped: ${eventId}`);
          return;
        }
        // expire dedup key after 1 day
        await this.redis.expire(`dedup:${eventId}`, 86400);

        // log as pending
        const row = await this.prisma.syncEvent.create({
          data: {
            type: evt.type,
            entityId: evt.entityId ?? 'unknown',
            payload: evt.payload ?? {},
            source: evt.source ?? 'scraper',
            status: 'pending',
          },
        });

        // do any processing here (for now nothing heavy)
        // mark processed
        await this.prisma.syncEvent.update({
          where: { id: row.id },
          data: { status: 'processed' },
        });
      } catch (e) {
        this.logger.error('event process failed', e as any);
        // simple DLQ: push failed payload to a Redis list
        await this.redis.lpush('dlq:events', msg);
      }
    });
  }
}
