import { Module } from '@nestjs/common';
import { AiAuditService } from './ai-audit.service';
import { AiAuditController } from './ai-audit.controller';

@Module({
  controllers: [AiAuditController],
  providers: [AiAuditService],
  exports: [AiAuditService],
})
export class AiAuditModule {}
