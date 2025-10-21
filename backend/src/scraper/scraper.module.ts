import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScraperController } from './scraper.controller';

@Module({
  imports: [PrismaModule],
  providers: [ScraperService],
  controllers: [ScraperController],
})
export class ScraperModule {}
