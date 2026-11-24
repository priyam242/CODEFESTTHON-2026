import { Module } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { TenancyController } from './tenancy.controller';
import { AuthModule } from '../auth/auth.module';
import { AiAuditModule } from '../ai-audit/ai-audit.module';

@Module({
  imports: [AuthModule, AiAuditModule],
  controllers: [TenancyController],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}
