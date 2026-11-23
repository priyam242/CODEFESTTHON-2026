import { Controller, Post, Body } from '@nestjs/common';
import { PaymentsService, CreateOrderDto, VerifyPaymentDto } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('create-order')
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.paymentsService.createOrder(dto);
  }

  @Post('verify')
  async verifyPayment(@Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(dto);
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
  ) {
    return this.paymentsService.updateRecipientUpi(dto);
  }
}
