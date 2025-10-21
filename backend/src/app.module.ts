
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { EventsModule } from './events/events.module';
import { ScraperModule } from './scraper/scraper.module';
import { BullBoardModule } from './bull-board/bull-board.module';


@Module({
  imports: [
     ConfigModule.forRoot({ isGlobal: true }),
     BullBoardModule.forRoot(),
     PrismaModule,
     RedisModule,
     AuthModule,
     EventsModule,
     ScraperModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
