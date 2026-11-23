import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { CreateTenancyDto } from './dto/create-tenancy.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller(['tenancy', 'tenancies'])
export class TenancyController {
  constructor(private tenancyService: TenancyService) {}

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

  // Public certificate & hash verification endpoints (NO auth needed)
  @Post('demo/reset')
  async resetDemo() {
    return this.tenancyService.resetDemoData();
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
  async approveLandlord(@Param('token') token: string) {
    return this.tenancyService.approveByLandlordToken(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('claim/:token')
  async claimLandlord(@Request() req: any, @Param('token') token: string) {
    return this.tenancyService.claimByLandlord(req.user, token);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.tenancyService.findOne(id, req.user);
  }
}
