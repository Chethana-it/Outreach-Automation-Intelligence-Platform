import { Module } from '@nestjs/common';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { SCRAPE_QUEUE, SCRAPE_DLQ } from '../scraper/queue.constants';

@Module({})
export class BullBoardModule {
  static forRoot() {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    const connection = new Redis(process.env.REDIS_URL!);

    const scrapeQueue = new Queue(SCRAPE_QUEUE, { connection });
    const dlqQueue = new Queue(SCRAPE_DLQ, { connection });

    createBullBoard({
      queues: [
        // new BullAdapter(scrapeQueue),
        // new BullAdapter(dlqQueue),
      ],
      serverAdapter,
    });

    return {
      module: BullBoardModule,
      providers: [
        {
          provide: 'BULL_BOARD_ADAPTER',
          useValue: serverAdapter,
        },
      ],
      exports: ['BULL_BOARD_ADAPTER'],
    };
  }
}