import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';

@Module({
  imports: [PrismaModule],
  providers: [DealsService],
  controllers: [DealsController],
  exports: [DealsService],
})
export class DealsModule {}
