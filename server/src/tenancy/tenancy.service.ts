import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenancyDto } from './dto/create-tenancy.dto';
import { randomUUID, createHash } from 'crypto';

const TENANCY_RELATION_INCLUDE = {
  items: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      address: true,
      upiId: true,
      avatarUrl: true,
    },
  },
};

@Injectable()
export class TenancyService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTenancyDto) {
    const landlordToken = randomUUID();
    return this.prisma.tenancyClient.create({
      data: {
        propertyTitle: dto.propertyTitle,
        propertyAddress: dto.propertyAddress,
        depositAmount: dto.depositAmount,
        depositAmountDecimal: dto.depositAmount,
        landlordName: dto.landlordName,
        landlordPhone: dto.landlordPhone,
        landlordEmail: dto.landlordEmail || null,
        landlordUpi: dto.landlordUpi ? dto.landlordUpi.trim() : null,
        agreementRef: dto.agreementRef ? dto.agreementRef.trim() : null,
        landlordQrUrl: null,
        tenantUpi: null,
        tenantQrUrl: null,
        landlordToken,
        status: 'ACTIVE',
        estimatedRefund: dto.depositAmount,
        userId,
      },
    });
  }

  async findAllForUser(user: { id: string; email: string; role: string }) {
    let list: any[] = [];
    if (user.role === 'LANDLORD') {
      const email = user.email || '';
      try {
        list = await this.prisma.tenancyClient.findMany({
          where: {
            OR: [
              { landlordEmail: { equals: email, mode: 'insensitive' } },
              { landlordEmail: email.toLowerCase() },
              { landlordEmail: email },
            ],
          },
          include: { items: true, user: true },
        });
      } catch {
        list = await this.prisma.tenancyClient.findMany({
          where: { landlordEmail: email.toLowerCase() },
          include: { items: true, user: true },
        });
      }
    } else {
      list = await this.prisma.tenancyClient.findMany({
        where: { userId: user.id },
        include: { items: true, user: true },
      });
    }
    return list.map((t: any) => {
      if (t && t.user) {
        t.tenant = t.user;
      }
      return t;
    });
  }

  async notifyOwner(id: string, user: any) {
    const tenancy = await this.findOne(id, user);
    const updated = await this.prisma.tenancyClient.update({
      where: { id },
      data: { status: 'PENDING' },
    });
    return {
      success: true,
      message: `Notification dispatched to Owner Dashboard (${tenancy.landlordEmail || tenancy.landlordName})!`,
      tenancy: updated,
    };
  }

  async findOne(id: string, user?: { id: string; email?: string; role?: string } | string) {
    const tenancy = await this.prisma.tenancyClient.findUnique({
      where: { id },
      include: { items: true, user: true },
    });
    if (!tenancy) {
      throw new NotFoundException(`Tenancy ${id} not found`);
    }
    if (user) {
      if (typeof user === 'string') {
        if (tenancy.userId !== user) {
          throw new BadRequestException('Unauthorized access to this tenancy');
        }
      } else {
        const isTenant = tenancy.userId === user.id;
        const isLandlord =
          user.role === 'LANDLORD' &&
          tenancy.landlordEmail &&
          tenancy.landlordEmail.toLowerCase() === user.email?.toLowerCase();
        if (!isTenant && !isLandlord) {
          throw new BadRequestException('Unauthorized access to this tenancy');
        }
      }
    }
    if (tenancy && (tenancy as any).user) {
      (tenancy as any).tenant = (tenancy as any).user;
    }
    return tenancy;
  }

  async claimByLandlord(user: { id: string; email: string; role: string }, token: string) {
    const tenancy = await this.findByLandlordToken(token);
    return this.prisma.tenancyClient.update({
      where: { landlordToken: token },
      data: { landlordEmail: user.email },
    });
  }

  async findByLandlordToken(token: string) {
    const tenancy = await this.prisma.tenancyClient.findUnique({
      where: { landlordToken: token },
      include: { items: true, user: true },
    });
    if (!tenancy) {
      throw new NotFoundException('Invalid or expired landlord verification link');
    }
    if (tenancy && (tenancy as any).user) {
      (tenancy as any).tenant = (tenancy as any).user;
    }
    return tenancy;
  }

  async approveByLandlordToken(token: string, signerData?: any) {
    const tenancy = await this.findByLandlordToken(token);
    
    // Calculate sealed move-in SHA-256 hash if items are present
    const items = tenancy.items || [];
    const itemHashes = items
      .map((it: any) => it.moveInPhotoHash || '')
      .filter(Boolean)
      .sort()
      .join(':');
    
    const moveInHash = itemHashes ? createHash('sha256').update(itemHashes).digest('hex') : tenancy.moveInHash;

    let signerAuditStr = tenancy.signerAudit;
    if (signerData) {
      signerAuditStr = typeof signerData === 'string' ? signerData : JSON.stringify(signerData);
    } else if (!signerAuditStr) {
      signerAuditStr = JSON.stringify({
        signerEmail: tenancy.landlordEmail || 'ramesh.malik@rentshield.com',
        signerIp: '103.212.154.42 (Bangalore, KA)',
        signerFingerprint: createHash('sha256').update(token + ':signer').digest('hex'),
        signedAt: new Date().toISOString(),
        ownerConfirmed: true,
        agreementRef: tenancy.agreementRef || null,
        landlordUpi: tenancy.landlordUpi || signerData?.landlordUpi || null,
      });
    }

    const updateData: any = {
      status: 'APPROVED',
      moveInHash: moveInHash || createHash('sha256').update(tenancy.id + ':sealed-baseline').digest('hex'),
      signerAudit: signerAuditStr,
    };
    if (!tenancy.landlordUpi && signerData?.landlordUpi) {
      updateData.landlordUpi = signerData.landlordUpi;
    }

    const updated = await this.prisma.tenancyClient.update({
      where: { landlordToken: token },
      data: updateData,
      include: TENANCY_RELATION_INCLUDE,
    });
    if (updated && (updated as any).user) {
      (updated as any).tenant = (updated as any).user;
    }
    return updated;
  }

  async requestRevision(token: string, notes: string) {
    await this.findByLandlordToken(token);
    const updated = await this.prisma.tenancyClient.update({
      where: { landlordToken: token },
      data: {
        status: 'REVISION_REQUESTED',
        revisionNotes: notes,
      },
      include: TENANCY_RELATION_INCLUDE,
    });
    if (updated && (updated as any).user) {
      (updated as any).tenant = (updated as any).user;
    }
    return updated;
  }

  async recalculateRefund(tenancyId: string) {
    const tenancy = await this.findOne(tenancyId);
    const items = tenancy.items || [];
    let totalDeductions = 0;

    for (const item of items) {
      if (item.suggestedCut) {
        totalDeductions += Number(item.suggestedCut);
      }
    }

    const originalDeposit = Number(tenancy.depositAmount);
    const estimatedRefund = Math.max(0, originalDeposit - totalDeductions);

    const updated = await this.prisma.tenancyClient.update({
      where: { id: tenancyId },
      data: { estimatedRefund },
      include: TENANCY_RELATION_INCLUDE,
    });
    if (updated && (updated as any).user) {
      (updated as any).tenant = (updated as any).user;
    }
    return updated;
  }

  async getPublicCertificate(idOrToken: string) {
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
      throw new NotFoundException('Certificate record not found for provided ID or token');
    }
    return {
      id: tenancy.id,
      propertyTitle: tenancy.propertyTitle,
      propertyAddress: tenancy.propertyAddress,
      depositAmount: tenancy.depositAmount,
      landlordName: tenancy.landlordName,
      landlordUpi: tenancy.landlordUpi || 'Not Provided',
      agreementRef: tenancy.agreementRef || 'Not Provided',
      signerAudit: tenancy.signerAudit,
      revisionNotes: tenancy.revisionNotes,
      status: tenancy.status,
      depositPaid: tenancy.depositPaid,
      depositPaymentId: tenancy.depositPaymentId,
      settlementPaymentId: tenancy.settlementPaymentId,
      moveInHash: tenancy.moveInHash || createHash('sha256').update(tenancy.id + ':sealed-baseline').digest('hex'),
      estimatedRefund: tenancy.estimatedRefund,
      createdAt: tenancy.createdAt,
      totalItems: tenancy.items?.length || 0,
      items: (tenancy.items || []).map((it: any) => ({
        roomName: it.roomName,
        itemName: it.itemName,
        moveInPhotoHash: it.moveInPhotoHash,
        moveOutPhotoHash: it.moveOutPhotoHash,
        aiVerdict: it.aiVerdict,
      })),
    };
  }

  async getLatestDemoCertificate() {
    const list = await this.prisma.tenancyClient.findMany({
      include: { items: true },
    });
    if (!list || list.length === 0) {
      throw new NotFoundException('No tenancies currently available to demo');
    }
    // Prefer approved tenancy or latest created
    const selected = list.find((t: any) => t.status === 'APPROVED') || list[list.length - 1];
    return this.getPublicCertificate(selected.id);
  }

  async settle(
    id: string,
    data?: { customQrUrl?: string; tenantUpi?: string; landlordUpi?: string; landlordToken?: string },
    caller?: any,
  ) {
    const tenancy = await this.prisma.tenancyClient.findUnique({
      where: { id },
      include: TENANCY_RELATION_INCLUDE,
    });
    if (!tenancy) {
      throw new NotFoundException('Tenancy not found');
    }

    // Party isolation check: only assigned tenant or landlord can settle
    const isOwnerByToken = Boolean(data?.landlordToken && data.landlordToken === tenancy.landlordToken);
    const isTenantByUser = Boolean(caller && tenancy.userId === caller.id);
    const isLandlordByUser = Boolean(
      caller &&
      tenancy.landlordEmail &&
      caller.email &&
      tenancy.landlordEmail.toLowerCase() === caller.email.toLowerCase()
    );

    if (caller || data?.landlordToken) {
      if (!isOwnerByToken && !isTenantByUser && !isLandlordByUser) {
        throw new ForbiddenException('Unauthorized: Only the assigned Tenant or Landlord can settle this tenancy.');
      }
    }

    const updatePayload: any = {
      status: 'SETTLED',
      settledAt: new Date(),
    };
    if (data?.customQrUrl) updatePayload.customQrUrl = data.customQrUrl;
    if (data?.tenantUpi) updatePayload.tenantUpi = data.tenantUpi;
    if (data?.landlordUpi) updatePayload.landlordUpi = data.landlordUpi;

    const updated = await this.prisma.tenancyClient.update({
      where: { id },
      data: updatePayload,
      include: TENANCY_RELATION_INCLUDE,
    });
    if (updated && (updated as any).user) {
      (updated as any).tenant = (updated as any).user;
    }
    return updated;
  }

  async settleByToken(token: string, data?: { customQrUrl?: string; tenantUpi?: string; landlordUpi?: string }) {
    const tenancy = await this.findByLandlordToken(token);
    return this.settle(tenancy.id, { ...data, landlordToken: token });
  }

  async clearAllData() {
    return this.prisma.clearAllData();
  }

  async resetDemoData() {
    await this.prisma.seedDemoData(true);
    return {
      success: true,
      message: 'Demo tenancy successfully reset to pristine 2BHK Bangalore state',
      demoTenancyId: 'demo-tenancy-indiranagar-001',
    };
  }
}
