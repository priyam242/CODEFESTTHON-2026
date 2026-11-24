import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { CreateTenancyDto } from './dto/create-tenancy.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiAuditService } from '../ai-audit/ai-audit.service';

@Controller(['tenancy', 'tenancies'])
export class TenancyController {
  constructor(
    private tenancyService: TenancyService,
    private aiAuditService: AiAuditService,
  ) {}

  // Authenticated tenant endpoints
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req: any, @Body() dto: CreateTenancyDto) {
    return this.tenancyService.create(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Request() req: any) {
    return this.tenancyService.findAllForUser(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/notify-owner')
  async notifyOwner(@Request() req: any, @Param('id') id: string) {
    return this.tenancyService.notifyOwner(id, req.user);
  }

  // Settlement endpoints (supported via PATCH & POST with caller authorization)
  @UseGuards(OptionalJwtAuthGuard)
  @Patch(':id/settle')
  async settleTenancyPatch(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.tenancyService.settle(id, body, req?.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/settle')
  async settleTenancyPost(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.tenancyService.settle(id, body, req?.user);
  }

  // Public certificate & hash verification endpoints (NO auth needed)
  @Post('demo/reset')
  async resetDemo() {
    return this.tenancyService.resetDemoData();
  }

  @Post('demo/clear')
  async clearAll() {
    return this.tenancyService.clearAllData();
  }

  @Get('certificate/demo/latest')
  async getLatestDemoCertificate() {
    return this.tenancyService.getLatestDemoCertificate();
  }

  @Get('certificate/:id')
  async getPublicCertificate(@Param('id') id: string) {
    return this.tenancyService.getPublicCertificate(id);
  }

  // Public landlord token review & lock endpoints (MUST NOT require auth)
  @Get('verify/:token')
  async verifyLandlord(@Param('token') token: string) {
    return this.tenancyService.findByLandlordToken(token);
  }

  @Post('verify/:token/approve')
  async approveLandlord(@Param('token') token: string, @Body() body?: any) {
    return this.tenancyService.approveByLandlordToken(token, body?.signerData);
  }

  @Post('verify/:token/revision')
  async requestRevision(@Param('token') token: string, @Body() body: { notes: string }) {
    return this.tenancyService.requestRevision(token, body?.notes || 'Revision requested by owner');
  }

  @Post('verify/:token/settle')
  async settleByToken(@Param('token') token: string, @Body() body: any) {
    return this.tenancyService.settleByToken(token, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('claim/:token')
  async claimLandlord(@Request() req: any, @Param('token') token: string) {
    return this.tenancyService.claimByLandlord(req.user, token);
  }

  // Safe diagnostic endpoint verifying live Gemini Vision status on Render
  @Get('ai-health')
  async getAiHealth() {
    return this.aiAuditService.checkHealth();
  }

  @Post('ai-tts')
  async generateAiTts(@Body() body: { text: string; voiceName?: string }) {
    return this.aiAuditService.generateSpeech(body.text, body.voiceName || 'Puck');
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.tenancyService.findOne(id, req.user);
  }
}
