import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(email: string, password: string, role: string = 'TENANT', name: string = ''): Promise<any> {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.userClient.create({
      data: { email, password: hashedPassword, role, name },
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

  toResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name || '',
      role: user.role || 'TENANT',
    };
  }
}
