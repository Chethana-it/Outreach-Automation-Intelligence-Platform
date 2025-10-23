import { Body, Controller, Delete, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { AssignDto } from './dto/assign.dto';
import { parse } from 'csv-parse/sync';
import { log } from 'node:console';

@Controller('campaigns')
export class CampaignsController {
  constructor(private service: CampaignsService) {}

  // For demo, ownerId is hard-coded; later use req.user from JWT
  private ownerId() { return 'cmh2br75h0000pp4wdyulqb17'; }

  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.service.create(this.ownerId(), dto);
  }

  @Get()
  list() {
    return this.service.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // Assign by raw usernames/urls
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() body: AssignDto) {
    return this.service.assign(id, body);
  }

  // CSV upload (memory storage)
  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    const text = file.buffer.toString('utf-8');
    const rows = parse(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

    // Accept columns: username, url, handle, profile
    const usernames: string[] = [];
    const urls: string[] = [];

    for (const r of rows) {
      const u = (r.username || r.handle || '').toString().trim();
      const link = (r.url || r.profile || '').toString().trim();
      if (u) usernames.push(u);
      if (link) urls.push(link);
    }

    return this.service.assign(id, { usernames, urls });
  }
}
