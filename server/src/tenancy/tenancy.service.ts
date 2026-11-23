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
        landlordToken,
        status: 'ACTIVE',
        estimatedRefund: dto.depositAmount,
        userId,
      },
    });
  }

  async findAllForUser(user: { id: string; email: string; role: string }) {
    if (user.role === 'LANDLORD') {
      return this.prisma.tenancyClient.findMany({
        where: { landlordEmail: user.email },
        include: { items: true },
      });
    }
    return this.prisma.tenancyClient.findMany({
      where: { userId: user.id },
      include: { items: true },
    });
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

  async approveByLandlordToken(token: string) {
    const tenancy = await this.findByLandlordToken(token);
    
    // Calculate sealed move-in SHA-256 hash if items are present
    const items = tenancy.items || [];
    const itemHashes = items
      .map((it: any) => it.moveInPhotoHash || '')
      .filter(Boolean)
      .sort()
      .join(':');
    
    const moveInHash = itemHashes ? createHash('sha256').update(itemHashes).digest('hex') : tenancy.moveInHash;

    return this.prisma.tenancyClient.update({
      where: { landlordToken: token },
      data: {
        status: 'APPROVED',
        moveInHash: moveInHash || createHash('sha256').update(tenancy.id + ':sealed-baseline').digest('hex'),
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

  async resetDemoData() {
    await this.prisma.seedDemoData(true);
    return {
      success: true,
      message: 'Demo tenancy successfully reset to pristine 2BHK Bangalore state',
      demoTenancyId: 'demo-tenancy-indiranagar-001',
    };
  }
}
