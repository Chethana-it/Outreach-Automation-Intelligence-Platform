import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, JobsOptions, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { chromium, BrowserContext, Cookie } from 'playwright';
import { PrismaService } from '../prisma/prisma.service';
import { SCRAPE_QUEUE, SCRAPE_DLQ } from './queue.constants';
import { EventsPublisher } from '../events/events.publisher';

type ScrapeJob = { url: string };

@Injectable()
export class ScraperService implements OnModuleInit {
  private readonly logger = new Logger(ScraperService.name);
  private queue!: Queue<ScrapeJob>;
  private dlq!: Queue<ScrapeJob>;
  private worker!: Worker<ScrapeJob>;
  private redis!: Redis;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const connection = new Redis(process.env.REDIS_URL!,
      {
        maxRetriesPerRequest: null,
      }
    );
    this.redis = connection;

    this.queue = new Queue<ScrapeJob>(SCRAPE_QUEUE, { connection });
    this.dlq = new Queue<ScrapeJob>(SCRAPE_DLQ, { connection });

    const concurrency = Number(process.env.BULL_CONCURRENCY ?? 2);

    this.worker = new Worker<ScrapeJob>(
      SCRAPE_QUEUE,
      async job => this.processJob(job.data),
      {
        connection,
        concurrency,
        // retry/backoff handled by job options; here we can also set limiter if needed
      }
    );

    // move permanently failed to DLQ
    const qe = new QueueEvents(SCRAPE_QUEUE, { connection });
    qe.on('failed', async ({ jobId, failedReason }) => {
      this.logger.warn(`job failed ${jobId}: ${failedReason}`);
      const job = await this.queue.getJob(jobId!);
      if (job && (job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1)) {
        await this.dlq.add('dlq', job.data);
      }
    });
  }

  // Public API: enqueue many URLs
  async enqueue(urls: string[]) {
    const jobs = urls.map(url => ({
      name: 'scrape',
      data: { url },
      opts: this.jobOptions(),
    }));
    await this.queue.addBulk(jobs);
    return { queued: urls.length };
  }

  private jobOptions(): JobsOptions {
    return {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s...
      removeOnComplete: true,
      removeOnFail: 50,
    };
  }

  // core worker logic
  private async processJob({ url }: ScrapeJob) {
    this.logger.log(`scraping ${url}`);
    const headless = (process.env.SCRAPER_HEADLESS ?? 'true') === 'true';

    const browser = await chromium.launch({ headless });
    const context = await browser.newContext();
    await this.loadCookies(context);

    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });

      // naive selectors for demo – X changes often; adapt if needed
      // try/catch each to avoid crash
      const username = url.split('/').pop()!.replace('@', '');
      const displayName = await safeText(page, 'div[data-testid="UserName"] span')
        ?? await safeText(page, 'header h2'); // fallback
      const bio = await safeText(page, 'div[data-testid="UserDescription"] span');
      const location = await safeText(page, 'div[data-testid="UserProfileHeader_Items"] span');
      const verified = !!(await page.$('svg[aria-label="Verified account"]'));

      // counts (very loose demo scraping; real site is dynamic)
      const followersCount = await numericFrom(page, 'div[class="css-175oi2r r-1rtiivn"] span span');
      const followingCount = await numericFrom(page,  'a[href$="/verified_followers"] span span');
      const postsCount = await numericFrom(page, 'a[href$="/with_replies"] span') ?? 0;

      console.log("followersCount:", followersCount);
      console.log("followingCount:",followingCount);
      
      

      const lastActive = new Date(); // for demo; would need to inspect first tweet timestamp

      // upsert DB
      const profile = await this.prisma.xProfile.upsert({
        where: { username },
        update: {
          displayName, bio, location, verified,
          followersCount: followersCount ?? 0,
          followingCount: followingCount ?? 0,
          postsCount,
          lastActive,
        },
        create: {
          username,
          displayName: displayName ?? username,
          bio: bio ?? '',
          location: location ?? null,
          verified,
          followersCount: followersCount ?? 0,
          followingCount: followingCount ?? 0,
          postsCount,
          lastActive,
        },
      });

      console.log("db updated xprofile...:", profile.username);
      

      // publish event
      await EventsPublisher.publish({
        type: 'profile.scraped',
        entityId: profile.id,
        source: 'scraper',
        payload: { username, followersCount, ts: Date.now() },
      });

      await browser.close();
      return true;
    } catch (e) {
      await browser.close();
      // detect auth failure (very rough): redirect to login page text
      const msg = (e as Error).message ?? 'scrape failed';
      this.logger.error(`scrape error for ${url}`, e as any);
      throw e; // let BullMQ handle retries/ DLQ
    }
  }

  // Manual login once (open headful, you login, we save cookies)
  async manualLoginStart() {
    const browser = await chromium.launch({ headless: false, slowMo: 50 });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://x.com/login');
    this.logger.log('Please log in manually, then close the browser to save cookies.');

    // Wait until user closes window
    await page.waitForEvent('close');
    const cookies = await context.cookies();
    await this.saveCookies(cookies);
    await browser.close();
    return { ok: true };
  }

  private async loadCookies(ctx: BrowserContext) {
    try {
      const fs = await import('fs/promises');
      const path = process.env.SCRAPER_COOKIE_FILE!;
      const txt = await fs.readFile(path, 'utf-8');
      const cookies = JSON.parse(txt) as Cookie[];
      await ctx.addCookies(cookies);
    } catch {
      // no cookies yet – that’s fine
    }
  }

  private async saveCookies(cookies: Cookie[]) {
    const fs = await import('fs/promises');
    const path = process.env.SCRAPER_COOKIE_FILE!;
    await fs.writeFile(path, JSON.stringify(cookies, null, 2), 'utf-8');
  }
}

// helpers
async function safeText(page: any, selector: string) {
  try {
    const el = await page.$(selector);
    if (!el) return null;
    const txt = (await el.innerText())?.trim();
    return txt || null;
  } catch { return null; }
}

async function numericFrom(page: any, selector: string) {
  try {
    const t = await safeText(page, selector);
    if (!t) return null;
    // convert 1,234 or 12.3K → 1234/12300
    const n = parseHumanNumber(t);
    return n ?? null;
  } catch { return null; }
}

function parseHumanNumber(s: string): number | null {
  const clean = s.replace(/,/g, '').trim().toUpperCase();
  const m = clean.match(/^([0-9]*\\.?[0-9]+)([KMB])?$/);
  if (!m) return Number.isFinite(Number(clean)) ? Number(clean) : null;
  let val = parseFloat(m[1]);
  const suffix = m[2];
  if (suffix === 'K') val *= 1e3;
  if (suffix === 'M') val *= 1e6;
  if (suffix === 'B') val *= 1e9;
  return Math.round(val);
}
