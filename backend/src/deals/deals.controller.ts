import { Body, Controller, Param, Patch } from '@nestjs/common';
import { DealsService } from './deals.service';
import { UpdateStageDto } from './dto/update-stage.dto';

@Controller('deals')
export class DealsController {
  constructor(private service: DealsService) {}

  @Patch(':id/stage')
  update(@Param('id') id: string, @Body() dto: UpdateStageDto) {
    return this.service.updateStage(id, dto);
  }
}

