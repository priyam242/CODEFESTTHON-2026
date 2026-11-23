import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { ItemsModule } from './items/items.module';
import { AiAuditModule } from './ai-audit/ai-audit.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenancyModule,
    ItemsModule,
    AiAuditModule,
  ],
})
export class AppModule {}