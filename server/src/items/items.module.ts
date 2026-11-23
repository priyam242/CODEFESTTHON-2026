import { Module } from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { AiAuditModule } from '../ai-audit/ai-audit.module';
import { TenancyModule } from '../tenancy/tenancy.module';

@Module({
  imports: [AiAuditModule, TenancyModule],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule { }
