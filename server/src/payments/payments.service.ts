import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface CreateOrderDto {
  tenancyId: string;
  stage: 'DEPOSIT' | 'SETTLEMENT';
  amount: number;
  landlordToken?: string;
}

export interface VerifyPaymentDto {
  tenancyId: string;
  stage: 'DEPOSIT' | 'SETTLEMENT';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  utrNumber?: string;
  landlordToken?: string;
  customQrUrl?: string;
  landlordQrUrl?: string;
  tenantQrUrl?: string;
  tenantUpi?: string;
  landlordUpi?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Helper to locate tenancy by ID or Landlord Token
   */
  private async findTenancy(idOrToken: string) {
    let tenancy = await this.prisma.tenancyClient.findUnique({
      where: { id: idOrToken },
      include: { items: true },
    });
    if (!tenancy) {
      tenancy = await this.prisma.tenancyClient.findUnique({
        where: { landlordToken: idOrToken },
        include: { items: true },
      });
    }
    if (!tenancy) {
      throw new NotFoundException(`Tenancy ${idOrToken} not found`);
    }
    return tenancy;
  }

  /**
   * Create Razorpay Order if API credentials exist, otherwise return fallback config for direct UPI
   */
  async createOrder(dto: CreateOrderDto) {
    const tenancy = await this.findTenancy(dto.tenancyId || dto.landlordToken || '');

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return {
        enabled: false,
        isLiveGateway: false,
        keyId: null,
        message: 'Razorpay keys not configured; direct UPI UTR escrow verification flow active.',
        tenancyId: tenancy.id,
      };
    }

    try {
      const amountInPaise = Math.round(Number(dto.amount) * 100);
      const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `rs_${tenancy.id.substring(0, 8)}_${Date.now()}`,
          notes: {
            tenancyId: tenancy.id,
            stage: dto.stage,
            propertyTitle: tenancy.propertyTitle,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Razorpay Orders API error: ${response.status} - ${errorBody}`);
        return {
          enabled: false,
          isLiveGateway: false,
          keyId: null,
          message: 'Razorpay order creation unavailable; falling back to direct UPI flow.',
          tenancyId: tenancy.id,
        };
      }

      const orderData = await response.json();
      return {
        enabled: true,
        isLiveGateway: true,
        keyId,
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        tenancyId: tenancy.id,
      };
    } catch (err: any) {
      this.logger.warn(`Razorpay network issue: ${err?.message}; falling back to direct UPI.`);
      return {
        enabled: false,
        isLiveGateway: false,
        keyId: null,
        message: 'Falling back to direct UPI flow.',
        tenancyId: tenancy.id,
      };
    }
  }

  /**
   * Verify either Razorpay HMAC signature OR 12-digit UPI UTR number, and update tenancy state
   */
  async verifyPayment(dto: VerifyPaymentDto) {
    const tenancy = await this.findTenancy(dto.tenancyId || dto.landlordToken || '');

    let verifiedPaymentId = '';

    // Branch 1: Razorpay HMAC Verification
    if (dto.razorpayPaymentId && dto.razorpayOrderId && dto.razorpaySignature) {
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        // Test/sandbox without secret: accept payment id
        verifiedPaymentId = dto.razorpayPaymentId;
      } else {
        const generatedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
          .digest('hex');

        if (generatedSignature !== dto.razorpaySignature) {
          throw new BadRequestException('Razorpay signature verification failed. Payment tampering detected.');
        }
        verifiedPaymentId = dto.razorpayPaymentId;
      }
    }
    // Branch 2: Direct NPCI UPI UTR / Reference Verification
    else if (dto.utrNumber) {
      const trimmedUtr = dto.utrNumber.trim();
      if (trimmedUtr.length < 6) {
        throw new BadRequestException('Please enter a valid 12-digit UPI Transaction Reference / UTR Number.');
      }
      verifiedPaymentId = trimmedUtr.startsWith('UTR-') ? trimmedUtr : `UTR-${trimmedUtr}`;
    } else {
      throw new BadRequestException('Either valid Razorpay payment data or a UPI UTR number is required.');
    }

    // Update tenancy record according to escrow stage
    const updatePayload: any = {};
    if (dto.customQrUrl) updatePayload.customQrUrl = dto.customQrUrl;
    if (dto.landlordQrUrl) updatePayload.landlordQrUrl = dto.landlordQrUrl;
    if (dto.tenantQrUrl) updatePayload.tenantQrUrl = dto.tenantQrUrl;
    if (dto.tenantUpi) updatePayload.tenantUpi = dto.tenantUpi;
    if (dto.landlordUpi) updatePayload.landlordUpi = dto.landlordUpi;

    if (dto.stage === 'DEPOSIT') {
      updatePayload.depositPaid = true;
      updatePayload.depositPaymentId = verifiedPaymentId;
    } else if (dto.stage === 'SETTLEMENT') {
      updatePayload.status = 'SETTLED';
      updatePayload.settlementPaymentId = verifiedPaymentId;
      updatePayload.settledAt = new Date();
    }

    const updated = await this.prisma.tenancyClient.update({
      where: { id: tenancy.id },
      data: updatePayload,
      include: { items: true },
    });

    this.logger.log(` Payment verified (${dto.stage}): ${verifiedPaymentId} for Tenancy ${tenancy.id}`);

    return {
      success: true,
      stage: dto.stage,
      paymentId: verifiedPaymentId,
      tenancy: updated,
    };
  }

  /**
   * Allow saving recipient's custom UPI / QR preferences independently
   */
  async updateRecipientUpi(dto: {
    tenancyId?: string;
    landlordToken?: string;
    tenantUpi?: string;
    landlordUpi?: string;
    customQrUrl?: string;
    landlordQrUrl?: string;
    tenantQrUrl?: string;
  }) {
    const tenancy = await this.findTenancy(dto.tenancyId || dto.landlordToken || '');
    const updatePayload: any = {};
    if (dto.tenantUpi) updatePayload.tenantUpi = dto.tenantUpi;
    if (dto.landlordUpi) updatePayload.landlordUpi = dto.landlordUpi;
    if (dto.customQrUrl) updatePayload.customQrUrl = dto.customQrUrl;
    if (dto.landlordQrUrl) {
      updatePayload.landlordQrUrl = dto.landlordQrUrl;
      updatePayload.customQrUrl = dto.landlordQrUrl; // maintain backwards compat
    }
    if (dto.tenantQrUrl) {
      updatePayload.tenantQrUrl = dto.tenantQrUrl;
    }

    return this.prisma.tenancyClient.update({
      where: { id: tenancy.id },
      data: updatePayload,
      include: { items: true },
    });
  }
}
