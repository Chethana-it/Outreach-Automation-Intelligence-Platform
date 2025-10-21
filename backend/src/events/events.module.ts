import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsService } from './events.service';

@Module({
  imports: [PrismaModule],
  providers: [EventsService],
})
export class EventsModule implements OnModuleInit {
  constructor(private cfg: ConfigService) {}
  onModuleInit() {
    // init publisher
    const { EventsPublisher } = require('./events.publisher');
    EventsPublisher.init(this.cfg.get<string>('REDIS_URL')!);
  }
}
