export class UpdateStageDto {
    stage!: 'lead' | 'contacted' | 'interested' | 'closed';
    followUpStatus?: 'pending' | 'sent' | 'failed';
  }
  