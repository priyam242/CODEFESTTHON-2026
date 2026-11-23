import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public isConnected = false;

  // Resilient in-memory fallback store when PostgreSQL is offline or unreachable
  private memoryUsers: Map<string, any> = new Map();
  private memoryTenancies: Map<string, any> = new Map();
  private memoryItems: Map<string, any> = new Map();

  async onModuleInit() {
    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log(' Connected to PostgreSQL database via Prisma');
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(` PostgreSQL not reachable (${err?.message || 'Offline'}). Operating with in-memory fallback store for offline continuity.`);
    }
    await this.seedDemoData();
  }

  async seedDemoData(force = false) {
    try {
      const tenantEmail = 'tenant.demo@rentshield.com';
      const landlordEmail = 'landlord.demo@rentshield.com';

      const existingTenant = await this.userClient.findUnique({ where: { email: tenantEmail } });
      if (existingTenant && !force) {
        return;
      }

      const hashedPassword = await bcrypt.hash('password123', 10);

      // 1. Seed or retrieve Tenant
      let tenant = existingTenant;
      if (!tenant) {
        tenant = await this.userClient.create({
          data: {
            id: 'tenant-demo-uuid-001',
            email: tenantEmail,
            password: hashedPassword,
            name: 'Aarav Sharma (Tenant)',
            role: 'TENANT',
          },
        });
      }

      // 2. Seed or retrieve Landlord
      const existingLandlord = await this.userClient.findUnique({ where: { email: landlordEmail } });
      if (!existingLandlord) {
        await this.userClient.create({
          data: {
            id: 'landlord-demo-uuid-002',
            email: landlordEmail,
            password: hashedPassword,
            name: 'Ramesh Malik (Owner)',
            role: 'LANDLORD',
          },
        });
      }

      // 3. Seed Realistic Indian Rental Tenancy
      const tenancyId = 'demo-tenancy-indiranagar-001';
      const existingTenancy = await this.tenancyClient.findUnique({ where: { id: tenancyId } });

      if (!existingTenancy || force) {
        if (this.isConnected) {
          try {
            await (this as any).item.deleteMany({ where: { tenancyId } });
            await (this as any).tenancy.deleteMany({ where: { id: tenancyId } });
          } catch {}
        } else {
          this.memoryTenancies.delete(tenancyId);
          for (const [k, v] of this.memoryItems.entries()) {
            if (v.tenancyId === tenancyId) this.memoryItems.delete(k);
          }
        }

        const demoTenancy = await this.tenancyClient.create({
          data: {
            id: tenancyId,
            propertyTitle: '2BHK Luxury Apt - Indiranagar, Bangalore',
            propertyAddress: '#402, 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru, KA 560038',
            depositAmount: 50000,
            depositAmountDecimal: 50000,
            landlordName: 'Ramesh Malik',
            landlordPhone: '+91 98765 43210',
            landlordEmail: landlordEmail,
            landlordToken: 'demo-magic-token-2026',
            status: 'APPROVED',
            moveInHash: 'a7b8c9d0e1f234567890abcdef1234567890abcdef1234567890abcdef123456',
            estimatedRefund: 50000,
            userId: tenant.id,
          },
        });

        // Seed 3 realistic pre-hashed inventory fixtures
        const samplePhoto1 = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&auto=format&fit=crop&q=80';
        const samplePhoto2 = 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80';
        const samplePhoto3 = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80';

        await this.itemClient.create({
          data: {
            id: 'item-demo-001',
            roomName: 'Master Bedroom',
            itemName: 'Teak Wood Double Wardrobe',
            moveInNotes: 'Pristine polished teak finish, all 4 internal shelves and hinges intact with keys.',
            moveInPhotoUrl: samplePhoto1,
            moveInPhotoHash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
            tenancyId: demoTenancy.id,
          },
        });

        await this.itemClient.create({
          data: {
            id: 'item-demo-002',
            roomName: 'Kitchen',
            itemName: 'Granite Countertop & 3-Burner Hob',
            moveInNotes: 'Jet black polished granite without any hairline cracks; gas burners operational.',
            moveInPhotoUrl: samplePhoto2,
            moveInPhotoHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            tenancyId: demoTenancy.id,
          },
        });

        await this.itemClient.create({
          data: {
            id: 'item-demo-003',
            roomName: 'Living Room',
            itemName: 'Daikin 1.5 Ton Inverter AC',
            moveInNotes: 'Brand new condition, cooling tested at 18C, remote controller operational.',
            moveInPhotoUrl: samplePhoto3,
            moveInPhotoHash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
            tenancyId: demoTenancy.id,
          },
        });
      }
      this.logger.log('🎯 RentShield demo seed data verified (2BHK Indiranagar, ₹50,000 Deposit)');
    } catch (err: any) {
      this.logger.warn(`Could not seed demo data: ${err?.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect();
    }
  }

  // Fallback-aware proxy for User operations
  get userClient() {
    if (this.isConnected) {
      return this.user;
    }
    return {
      create: async ({ data }: { data: any }) => {
        const id = data.id || randomUUID();
        const user = {
          id,
          email: data.email,
          password: data.password,
          name: data.name || '',
          role: data.role || 'TENANT',
          createdAt: new Date(),
        };
        this.memoryUsers.set(id, user);
        return user;
      },
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return this.memoryUsers.get(where.id) || null;
        if (where.email) {
          for (const u of this.memoryUsers.values()) {
            if (u.email.toLowerCase() === where.email.toLowerCase()) return u;
          }
        }
        return null;
      },
      findMany: async () => Array.from(this.memoryUsers.values()),
    };
  }

  // Fallback-aware proxy for Tenancy operations
  get tenancyClient() {
    if (this.isConnected) {
      return this.tenancy;
    }
    return {
      create: async ({ data }: { data: any }) => {
        const id = data.id || randomUUID();
        const tenancy = {
          id,
          propertyTitle: data.propertyTitle,
          propertyAddress: data.propertyAddress,
          depositAmount: data.depositAmount,
          depositAmountDecimal: data.depositAmountDecimal ?? data.depositAmount,
          landlordName: data.landlordName,
          landlordPhone: data.landlordPhone,
          landlordEmail: data.landlordEmail || null,
          landlordToken: data.landlordToken || randomUUID(),
          status: data.status || 'ACTIVE',
          moveInHash: data.moveInHash || null,
          estimatedRefund: data.estimatedRefund || data.depositAmount,
          userId: data.userId,
          createdAt: new Date(),
        };
        this.memoryTenancies.set(id, tenancy);
        return { ...tenancy, items: [] };
      },
      findUnique: async ({ where, include }: { where: { id?: string; landlordToken?: string }; include?: any }) => {
        let found: any = null;
        if (where.id) {
          found = this.memoryTenancies.get(where.id);
        } else if (where.landlordToken) {
          for (const t of this.memoryTenancies.values()) {
            if (t.landlordToken === where.landlordToken) {
              found = t;
              break;
            }
          }
        }
        if (!found) return null;
        const items = Array.from(this.memoryItems.values()).filter(item => item.tenancyId === found.id);
        return { ...found, items };
      },
      findMany: async ({ where, include }: { where?: { userId?: string; landlordEmail?: string }; include?: any } = {}) => {
        let results = Array.from(this.memoryTenancies.values());
        if (where?.userId) {
          results = results.filter(t => t.userId === where.userId);
        } else if (where?.landlordEmail) {
          const lEmail = where.landlordEmail.toLowerCase();
          results = results.filter(t => t.landlordEmail && t.landlordEmail.toLowerCase() === lEmail);
        }
        return results.map(t => {
          const items = Array.from(this.memoryItems.values()).filter(item => item.tenancyId === t.id);
          return { ...t, items };
        });
      },
      update: async ({ where, data }: { where: { id?: string; landlordToken?: string }; data: any }) => {
        let targetId = where.id;
        if (!targetId && where.landlordToken) {
          for (const t of this.memoryTenancies.values()) {
            if (t.landlordToken === where.landlordToken) {
              targetId = t.id;
              break;
            }
          }
        }
        if (!targetId || !this.memoryTenancies.has(targetId)) {
          throw new Error('Tenancy not found in memory store');
        }
        const existing = this.memoryTenancies.get(targetId);
        const updated = { ...existing, ...data };
        this.memoryTenancies.set(targetId, updated);
        const items = Array.from(this.memoryItems.values()).filter(item => item.tenancyId === targetId);
        return { ...updated, items };
      },
    };
  }

  // Fallback-aware proxy for Item operations
  get itemClient() {
    if (this.isConnected) {
      return this.item;
    }
    return {
      create: async ({ data }: { data: any }) => {
        const id = data.id || randomUUID();
        const item = {
          id,
          roomName: data.roomName,
          itemName: data.itemName,
          moveInNotes: data.moveInNotes || null,
          moveInPhotoUrl: data.moveInPhotoUrl,
          moveInPhotoHash: data.moveInPhotoHash || null,
          moveOutPhotoUrl: data.moveOutPhotoUrl || null,
          moveOutPhotoHash: data.moveOutPhotoHash || null,
          aiVerdict: data.aiVerdict || null,
          aiExplanation: data.aiExplanation || null,
          suggestedCut: data.suggestedCut ?? null,
          tenancyId: data.tenancyId,
          createdAt: new Date(),
        };
        this.memoryItems.set(id, item);
        return item;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return this.memoryItems.get(where.id) || null;
      },
      findMany: async ({ where }: { where?: { tenancyId?: string } } = {}) => {
        let results = Array.from(this.memoryItems.values());
        if (where?.tenancyId) {
          results = results.filter(i => i.tenancyId === where.tenancyId);
        }
        return results;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const existing = this.memoryItems.get(where.id);
        if (!existing) throw new Error('Item not found in memory store');
        const updated = { ...existing, ...data };
        this.memoryItems.set(where.id, updated);
        return updated;
      },
    };
  }
}
