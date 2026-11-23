import { Controller, Post, Body, Param } from '@nestjs/common';
import { AiAuditService } from './ai-audit.service';

@Controller('ai-audit')
export class AiAuditController {
  constructor(private aiAuditService: AiAuditService) {}

  @Post(':itemId/move-out')
  auditMoveOut(
    @Param('itemId') itemId: string,
    @Body() body: { moveOutImageBase64: string },
  ) {
    return this.aiAuditService.auditMoveOutImage(itemId, body.moveOutImageBase64);
  }

  @Post(':itemId/upload-photo')
  uploadPhoto(
    @Param('itemId') itemId: string,
    @Body() body: { moveOutPhotoUrl: string },
  ) {
    // Just store the moveOutPhotoUrl directly without AI audit
    return { status: 'ok' };
  }
}