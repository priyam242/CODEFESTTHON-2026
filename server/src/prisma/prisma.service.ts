import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public isConnected = false;

  // Resilient in-memory fallback store when PostgreSQL is offline or unreachable
  public memoryUsers: Map<string, any> = new Map();
  public memoryTenancies: Map<string, any> = new Map();
  public memoryItems: Map<string, any> = new Map();

  constructor() {
    super();
    // Neutralize PrismaClient internal property assignment shadowing getters
    Object.defineProperty(this, 'userClient', {
      get: () => this.getUserClient(),
      configurable: true,
      enumerable: true,
    });
    Object.defineProperty(this, 'tenancyClient', {
      get: () => this.getTenancyClient(),
      configurable: true,
      enumerable: true,
    });
    Object.defineProperty(this, 'itemClient', {
      get: () => this.getItemClient(),
      configurable: true,
      enumerable: true,
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log(' Connected to PostgreSQL database via Prisma');

      // Auto-ensure core tables exist on Neon PostgreSQL even on fresh blank database
      await this.ensureTablesExist();
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(` PostgreSQL not reachable (${err?.message || 'Offline'}). Operating with in-memory fallback store for offline continuity.`);
    }
    await this.seedDemoData();
  }

  async ensureTablesExist() {
    if (!this.isConnected) return;
    try {
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "User" (
          "id" TEXT PRIMARY KEY,
          "email" TEXT UNIQUE NOT NULL,
          "password" TEXT NOT NULL,
          "name" TEXT NOT NULL DEFAULT '',
          "role" TEXT NOT NULL DEFAULT 'TENANT',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Tenancy" (
          "id" TEXT PRIMARY KEY,
          "propertyTitle" TEXT NOT NULL,
          "propertyAddress" TEXT NOT NULL,
          "depositAmount" DECIMAL NOT NULL,
          "landlordName" TEXT NOT NULL,
          "landlordPhone" TEXT NOT NULL,
          "landlordEmail" TEXT,
          "landlordUpi" TEXT,
          "agreementRef" TEXT,
          "signerAudit" TEXT,
          "revisionNotes" TEXT,
          "landlordToken" TEXT UNIQUE NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "moveInHash" TEXT,
          "estimatedRefund" DECIMAL,
          "depositAmountDecimal" DECIMAL,
          "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Item" (
          "id" TEXT PRIMARY KEY,
          "roomName" TEXT NOT NULL,
          "itemName" TEXT NOT NULL,
          "moveInNotes" TEXT,
          "moveInPhotoUrl" TEXT NOT NULL,
          "moveInPhotoHash" TEXT,
          "moveOutPhotoUrl" TEXT,
          "moveOutPhotoHash" TEXT,
          "aiVerdict" TEXT,
          "aiExplanation" TEXT,
          "suggestedCut" DECIMAL,
          "tenancyId" TEXT NOT NULL REFERENCES "Tenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure anti-fraud and audit columns exist in existing PostgreSQL databases
      await this.$executeRawUnsafe(`
        ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "landlordUpi" TEXT;
        ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "agreementRef" TEXT;
        ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "signerAudit" TEXT;
        ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "revisionNotes" TEXT;
      `);
      this.logger.log(' Core database schema verified / created on PostgreSQL');
    } catch (e: any) {
      this.logger.warn(` Schema ensure note: ${e?.message}`);
    }
  }

  async seedDemoData(force = false) {
    try {
      const tenantEmail = 'tenant.demo@rentshield.com';
      const landlordEmail = 'landlord.demo@rentshield.com';
      const hashedPassword = await bcrypt.hash('password123', 10);

      // 1. Seed or retrieve Tenant
      let tenant = await this.userClient.findUnique({ where: { email: tenantEmail } });
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
      let landlord = await this.userClient.findUnique({ where: { email: landlordEmail } });
      if (!landlord) {
        landlord = await this.userClient.create({
          data: {
            id: 'landlord-demo-uuid-002',
            email: landlordEmail,
            password: hashedPassword,
            name: 'Ramesh Malik (Owner)',
            role: 'LANDLORD',
          },
        });
      }

      // 3. Seed Realistic Indian Rental Tenancy (2BHK Indiranagar, Bangalore)
      const tenancyId = 'demo-tenancy-indiranagar-001';

      if (force) {
        if (this.isConnected) {
          try {
            const ic = (this as any).item || (this as any).Item;
            const tc = (this as any).tenancy || (this as any).Tenancy;
            if (ic?.deleteMany) await ic.deleteMany({});
            if (tc?.deleteMany) await tc.deleteMany({});
          } catch {}
        } else {
          this.memoryTenancies.clear();
          this.memoryItems.clear();
        }
      }

      const existingTenancy = await this.tenancyClient.findUnique({ where: { id: tenancyId } });

      if (!existingTenancy || force) {
        if (this.isConnected && !force) {
          try {
            const ic = (this as any).item || (this as any).Item;
            const tc = (this as any).tenancy || (this as any).Tenancy;
            if (ic?.deleteMany) await ic.deleteMany({ where: { tenancyId } });
            if (tc?.deleteMany) await tc.deleteMany({ where: { id: tenancyId } });
          } catch {}
        } else if (!force) {
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
            landlordUpi: 'ramesh.malik@okhdfcbank',
            agreementRef: 'BLR-IND-2026-KA-4892',
            signerAudit: JSON.stringify({
              signerEmail: landlordEmail,
              signerIp: '103.212.154.42 (Bangalore, KA)',
              signerFingerprint: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
              signedAt: new Date().toISOString(),
              ownerConfirmed: true,
              agreementRef: 'BLR-IND-2026-KA-4892',
              landlordUpi: 'ramesh.malik@okhdfcbank',
            }),
            landlordToken: 'demo-magic-token-2026',
            status: 'APPROVED',
            moveInHash: '58a9db3bdc324855635e803e45982f1603afd532eeb6dfa4f92a73332df269fe',
            estimatedRefund: 50000,
            userId: tenant.id,
          },
        });

        // Seed 3 realistic pre-hashed inventory fixtures with high-res interior thumbnails
        const samplePhoto1 = 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&auto=format&fit=crop&q=80';
        const samplePhoto2 = 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80';
        const samplePhoto3 = 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&auto=format&fit=crop&q=80';

        await this.itemClient.create({
          data: {
            id: 'item-demo-001',
            roomName: 'Master Bedroom',
            itemName: 'Teak Wood Double Wardrobe',
            moveInNotes: 'Pristine polished teak finish, all 4 internal shelves and hinges intact with keys.',
            moveInPhotoUrl: samplePhoto1,
            moveInPhotoHash: '45210e409329f475e91241b6f60c28f6da45acab8639d3bf6f3a4c70c100d17b',
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
            moveInPhotoHash: 'f1a0fa58d46547f7131791b4fe579506011c5bc3f4d203d30202bf2e5aedec72',
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
            moveInPhotoHash: '96387f60937f6fb9dc418675ee7b14df6be3ffd231a8616f1bd506475bc95854',
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

  // Safe resolver for User model delegate
  getUserClient() {
    const delegate = (this as any).user || (this as any).User || (this as any)._originalClient?.user;
    if (this.isConnected && delegate && typeof delegate.findUnique === 'function') {
      return delegate;
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

  get userClient() {
    return this.getUserClient();
  }

  // Safe resolver for Tenancy model delegate
  getTenancyClient() {
    const delegate = (this as any).tenancy || (this as any).Tenancy || (this as any)._originalClient?.tenancy;
    if (this.isConnected && delegate && typeof delegate.findUnique === 'function') {
      return delegate;
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
          landlordUpi: data.landlordUpi || 'ramesh.malik@okhdfcbank',
          agreementRef: data.agreementRef || 'BLR-IND-2026-KA-4892',
          signerAudit: data.signerAudit || null,
          revisionNotes: data.revisionNotes || null,
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
      findMany: async ({ where, include }: { where?: { userId?: string; landlordEmail?: any; OR?: any[] }; include?: any } = {}) => {
        let results = Array.from(this.memoryTenancies.values());
        if (where?.userId) {
          results = results.filter(t => t.userId === where.userId);
        } else if (where?.landlordEmail) {
          const lEmail = (typeof where.landlordEmail === 'string' ? where.landlordEmail : where.landlordEmail?.equals || '').toLowerCase();
          results = results.filter(t => t.landlordEmail && t.landlordEmail.toLowerCase() === lEmail);
        } else if (where?.OR && Array.isArray(where.OR)) {
          const orEmails = where.OR.map((o: any) => (o.landlordEmail?.equals || o.landlordEmail || '').toLowerCase()).filter(Boolean);
          results = results.filter(t => t.landlordEmail && orEmails.includes(t.landlordEmail.toLowerCase()));
        }
        return results.map(t => {
          const items = Array.from(this.memoryItems.values()).filter(item => item.tenancyId === t.id);
          const user = this.memoryUsers.get(t.userId) || { name: 'Aarav Sharma (Tenant)', email: 'tenant.demo@rentshield.com' };
          return { ...t, items, user };
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

  get tenancyClient() {
    return this.getTenancyClient();
  }

  // Safe resolver for Item model delegate
  getItemClient() {
    const delegate = (this as any).item || (this as any).Item || (this as any)._originalClient?.item;
    if (this.isConnected && delegate && typeof delegate.findUnique === 'function') {
      return delegate;
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

  get itemClient() {
    return this.getItemClient();
  }
}
