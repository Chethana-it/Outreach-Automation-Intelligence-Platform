import { Body, Controller, Post } from '@nestjs/common';
import { ScraperService } from './scraper.service';

@Controller('scrape')
export class ScraperController {
  constructor(private scraper: ScraperService) {}

  // Enqueue a list of profile URLs
  @Post()
  async enqueue(@Body() body: { urls: string[] }) {
    return this.scraper.enqueue(body.urls);
  }

  // Start a manual login (open browser headful once)
  @Post('login')
  async login() {
    return this.scraper.manualLoginStart();
  }
}
