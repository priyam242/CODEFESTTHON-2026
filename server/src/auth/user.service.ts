import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  address?: string | null;
  upiId?: string | null;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  address?: string;
  avatarUrl?: string;
  upiId?: string;
  currentPassword?: string;
  newPassword?: string;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(
    email: string,
    password: string,
    role: string = 'TENANT',
    name: string = '',
    avatarUrl?: string,
    address?: string,
    upiId?: string,
  ): Promise<any> {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.userClient.create({
      data: {
        email,
        password: hashedPassword,
        role,
        name,
        avatarUrl: avatarUrl || null,
        address: address || null,
        upiId: upiId || null,
      },
    });
  }

  async findByEmail(email: string): Promise<any | null> {
    return this.prisma.userClient.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<any | null> {
    return this.prisma.userClient.findUnique({ where: { id } });
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<any> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const dataToUpdate: any = {};

    // 1. Name update
    if (input.name !== undefined) {
      dataToUpdate.name = input.name.trim();
    }

    // 2. Email update with uniqueness check
    if (input.email !== undefined && input.email.trim()) {
      const emailLower = input.email.trim().toLowerCase();
      if (emailLower !== user.email.toLowerCase()) {
        const existing = await this.findByEmail(emailLower);
        if (existing && existing.id !== user.id) {
          throw new ConflictException('This email address is already in use by another account');
        }
        dataToUpdate.email = emailLower;
      }
    }

    // 3. Address update
    if (input.address !== undefined) {
      dataToUpdate.address = input.address.trim() || null;
    }

    // 4. Avatar URL update (dataURL or web URL)
    if (input.avatarUrl !== undefined) {
      dataToUpdate.avatarUrl = input.avatarUrl.trim() || null;
    }

    // 5. Default UPI ID update
    if (input.upiId !== undefined) {
      dataToUpdate.upiId = input.upiId.trim() || null;
    }

    // 6. Password change
    if (input.newPassword && input.newPassword.trim()) {
      if (!input.currentPassword) {
        throw new BadRequestException('Current password is required to set a new password');
      }
      const isMatch = await this.validatePassword(input.currentPassword, user.password);
      if (!isMatch) {
        throw new BadRequestException('Current password does not match records');
      }
      if (input.newPassword.length < 6) {
        throw new BadRequestException('New password must be at least 6 characters');
      }
      dataToUpdate.password = await bcrypt.hash(input.newPassword, 10);
    }

    return this.prisma.userClient.update({
      where: { id: user.id },
      data: dataToUpdate,
    });
  }

  async deleteAccount(userId: string): Promise<{ success: boolean; message: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const emailLower = (user.email || '').trim().toLowerCase();
    if (
      emailLower === 'tenant.demo@rentshield.com' ||
      emailLower === 'landlord.demo@rentshield.com'
    ) {
      throw new ForbiddenException(
        'Judge Demo accounts are protected from deletion to preserve demonstration walkthroughs.',
      );
    }

    // Delete all tenancy items and tenancies linked to user
    try {
      const userTenancies = await this.prisma.tenancyClient.findMany({
        where: { userId: user.id },
      });

      for (const t of userTenancies) {
        try {
          const itemClient = (this.prisma as any).item || (this.prisma as any).Item;
          if (itemClient?.deleteMany) {
            await itemClient.deleteMany({ where: { tenancyId: t.id } });
          } else if (this.prisma.itemClient?.deleteMany) {
            await this.prisma.itemClient.deleteMany({ where: { tenancyId: t.id } });
          }
        } catch {}

        try {
          const tenancyClient = (this.prisma as any).tenancy || (this.prisma as any).Tenancy;
          if (tenancyClient?.delete) {
            await tenancyClient.delete({ where: { id: t.id } });
          } else if (this.prisma.tenancyClient?.delete) {
            await this.prisma.tenancyClient.delete({ where: { id: t.id } });
          }
        } catch {}
      }

      await this.prisma.userClient.delete({
        where: { id: user.id },
      });
    } catch (err: any) {
      throw new BadRequestException(`Failed to delete account: ${err?.message || 'Database error'}`);
    }

    return {
      success: true,
      message: 'Account and associated cryptographic escrow records permanently deleted.',
    };
  }

  toResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name || '',
      role: user.role || 'TENANT',
      avatarUrl: user.avatarUrl || null,
      address: user.address || null,
      upiId: user.upiId || null,
    };
  }
}
