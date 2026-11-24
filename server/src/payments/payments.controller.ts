import { Controller, Post, Body, Req } from '@nestjs/common';
import { PaymentsService, CreateOrderDto, VerifyPaymentDto } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('create-order')
  async createOrder(@Body() dto: CreateOrderDto, @Req() req: any) {
    return this.paymentsService.createOrder(dto, req.user);
  }

  @Post('verify')
  async verifyPayment(@Body() dto: VerifyPaymentDto, @Req() req: any) {
    return this.paymentsService.verifyPayment(dto, req.user);
  }

  @Post('update-recipient')
  async updateRecipientUpi(
    @Body()
    dto: {
      tenancyId?: string;
      landlordToken?: string;
      tenantUpi?: string;
      landlordUpi?: string;
      customQrUrl?: string;
      landlordQrUrl?: string;
      tenantQrUrl?: string;
    },
    @Req() req: any,
  ) {
    return this.paymentsService.updateRecipientUpi(dto, req.user);
  }
}
