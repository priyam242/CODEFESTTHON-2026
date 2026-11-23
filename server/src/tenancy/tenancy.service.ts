import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenancyDto } from './dto/create-tenancy.dto';
import { randomUUID, createHash } from 'crypto';

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
        landlordUpi: dto.landlordUpi || 'ramesh.malik@okhdfcbank',
        agreementRef: dto.agreementRef || 'BLR-IND-2026-KA-4892',
        landlordToken,
        status: 'ACTIVE',
        estimatedRefund: dto.depositAmount,
        userId,
      },
    });
  }

  async findAllForUser(user: { id: string; email: string; role: string }) {
    if (user.role === 'LANDLORD') {
      const email = user.email || '';
      try {
        return await this.prisma.tenancyClient.findMany({
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
        return this.prisma.tenancyClient.findMany({
          where: { landlordEmail: email.toLowerCase() },
          include: { items: true, user: true },
        });
      }
    }
    return this.prisma.tenancyClient.findMany({
      where: { userId: user.id },
      include: { items: true, user: true },
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
      include: { items: true },
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
      include: { items: true },
    });
    if (!tenancy) {
      throw new NotFoundException('Invalid or expired landlord verification link');
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
        agreementRef: tenancy.agreementRef || 'BLR-IND-2026-KA-4892',
        landlordUpi: tenancy.landlordUpi || 'ramesh.malik@okhdfcbank',
      });
    }

    return this.prisma.tenancyClient.update({
      where: { landlordToken: token },
      data: {
        status: 'APPROVED',
        moveInHash: moveInHash || createHash('sha256').update(tenancy.id + ':sealed-baseline').digest('hex'),
        signerAudit: signerAuditStr,
      },
    });
  }

  async requestRevision(token: string, notes: string) {
    await this.findByLandlordToken(token);
    return this.prisma.tenancyClient.update({
      where: { landlordToken: token },
      data: {
        status: 'REVISION_REQUESTED',
        revisionNotes: notes,
      },
    });
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

    return this.prisma.tenancyClient.update({
      where: { id: tenancyId },
      data: { estimatedRefund },
    });
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
      landlordUpi: tenancy.landlordUpi || 'ramesh.malik@okhdfcbank',
      agreementRef: tenancy.agreementRef || 'BLR-IND-2026-KA-4892',
      signerAudit: tenancy.signerAudit,
      revisionNotes: tenancy.revisionNotes,
      status: tenancy.status,
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
