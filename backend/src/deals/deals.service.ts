import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStageDto } from './dto/update-stage.dto';
import { EventsPublisher } from '../events/events.publisher';

@Injectable()
export class DealsService {
  constructor(private prisma: PrismaService) {}

  async updateStage(id: string, dto: UpdateStageDto) {
    const existing = await this.prisma.deal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Deal not found');

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        stage: dto.stage,
        followUpStatus: dto.followUpStatus ?? existing.followUpStatus,
      },
      include: { Profile: true, Campaign: true },
    });

    await EventsPublisher.publish({
      type: 'deal.updated',
      entityId: id,
      source: 'campaign',
      payload: {
        campaignId: updated.campaignId,
        profileId: updated.profileId,
        stage: updated.stage,
        followUpStatus: updated.followUpStatus,
        ts: Date.now(),
      },
    });

    return updated;
  }
}
