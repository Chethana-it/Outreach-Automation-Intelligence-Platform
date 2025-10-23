import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { AssignDto } from './dto/assign.dto';
import { EventsPublisher } from '../events/events.publisher';
import { ScraperService } from '../scraper/scraper.service';
import { XProfile } from 'generated/prisma';

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private scraper: ScraperService,       // to enqueue scrapes
  ) {}

  async create(ownerId: string, dto: CreateCampaignDto) {
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) {
        throw new BadRequestException('Owner user not found');
    }

  
    const campaign = await this.prisma.campaign.create({
      data: { name: dto.name, description: dto.description ?? null, ownerId },
    });

    await EventsPublisher.publish({
      type: 'campaign.created',
      entityId: campaign.id,
      source: 'campaign',
      payload: { name: campaign.name, ts: Date.now() },
    });

    return campaign;
  }

  findAll() {
    return this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { Deals: true } } },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        Deals: {
          include: { Profile: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  async remove(id: string) {
    await this.prisma.deal.deleteMany({ where: { campaignId: id } });
    await this.prisma.campaign.delete({ where: { id } });
    return { ok: true };
  }

  // Assign usernames/urls to a campaign → ensure XProfile rows → create deals → queue scrape for new ones
  async assign(campaignId: string, payload: AssignDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const usernames = normalizeUsernames(payload);
    if (usernames.length === 0) return { created: 0, skipped: 0, queuedScrapes: 0 };

    // ensure XProfile rows exist (create if not)
    const profiles: XProfile[] = [];
    const newScrapeUrls: string[] = [];

    for (const un of usernames) {
      let profile = await this.prisma.xProfile.findUnique({ where: { username: un } });
      if (!profile) {
        // create placeholder row now
        profile = await this.prisma.xProfile.create({ data: { username: un, displayName: un } });
        // enqueue scrape to hydrate fields
        newScrapeUrls.push(`https://x.com/${un}`);
      }
      profiles.push(profile);
    }

    // create deals (skip duplicates via createMany skipDuplicates)
    const data = profiles.map(p => ({
      profileId: p.id,
      campaignId: campaignId,
      stage: 'lead',
      followUpStatus: 'pending',
    }));

    const result = await this.prisma.deal.createMany({ data, skipDuplicates: true });

    // // emit deal.created per profile (lightweight, optional to do bulk)
    // for (const p of profiles) {
    //   await EventsPublisher.publish({
    //     type: 'deal.created',
    //     entityId: `${campaignId}:${p.id}`,
    //     source: 'campaign',
    //     payload: { campaignId, profileId: p.id, username: p.username, ts: Date.now() },
    //   });
    // }

    await Promise.all(
        profiles.map(p => 
          EventsPublisher.publish({
            type: 'deal.created',
            entityId: `${campaignId}:${p.id}`,
            payload: { campaignId, profileId: p.id, username: p.username, ts: Date.now() }
          })
        )
      );

    // queue new scrapes
    if (newScrapeUrls.length) await this.scraper.enqueue(newScrapeUrls);

    return { created: result.count, queuedScrapes: newScrapeUrls.length };
  }
}

function normalizeUsernames(payload: AssignDto): string[] {
  const set = new Set<string>();

  (payload.usernames ?? []).forEach(u => {
    const x = (u || '').trim().replace(/^@/, '');
    if (x) set.add(x);
  });

  (payload.urls ?? []).forEach(u => {
    const url = (u || '').trim();
    const m = url.match(/x\.com\/(?:@)?([A-Za-z0-9_.]+)/i) || url.match(/twitter\.com\/(?:@)?([A-Za-z0-9_.]+)/i);
    if (m?.[1]) set.add(m[1]);
  });

  return Array.from(set);
}
