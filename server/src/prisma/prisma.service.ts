import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  DEMO_ROOM_CLEAN_DATA_URI,
  DEMO_ROOM_CLEAN_SHA256,
  DEMO_ROOM_DAMAGED_DATA_URI,
  DEMO_ROOM_DAMAGED_SHA256,
} from './demo-assets';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public isConnected = false;

  // Resilient in-memory fallback store when PostgreSQL is offline or unreachable
  public memoryUsers: Map<string, any> = new Map();
  public memoryTenancies: Map<string, any> = new Map();
  public memoryItems: Map<string, any> = new Map();

  constructor() {
    const url = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
    super(url ? { datasources: { db: { url } } } : undefined);
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
      // Clean startup: Do not automatically re-seed demo data on boot so DB remains empty
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(` PostgreSQL not reachable (${err?.message || 'Offline'}). Operating with in-memory fallback store for offline continuity.`);
    }
  }

  async clearAllData() {
    this.memoryItems.clear();
    this.memoryTenancies.clear();
    this.memoryUsers.clear();
    if (this.isConnected) {
      try {
        await this.$executeRawUnsafe(`TRUNCATE TABLE "Item", "Tenancy", "User" CASCADE;`);
      } catch {
        try { await this.$executeRawUnsafe(`DELETE FROM "Item";`); } catch {}
        try { await this.$executeRawUnsafe(`DELETE FROM "Tenancy";`); } catch {}
        try { await this.$executeRawUnsafe(`DELETE FROM "User";`); } catch {}
      }
    }
    this.logger.log(' All database and in-memory tables wiped clean.');
    return { success: true, message: 'All database and in-memory tables wiped clean.' };
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
      const alterQueries = [
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT;`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "upiId" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "landlordUpi" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "agreementRef" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "signerAudit" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "revisionNotes" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "customQrUrl" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "landlordQrUrl" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "tenantQrUrl" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "tenantUpi" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "depositPaid" BOOLEAN DEFAULT false;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "depositPaymentId" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "settlementPaymentId" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "pendingPaymentStage" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "pendingPaymentId" TEXT;`,
        `ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "pendingPaymentAmount" DECIMAL;`,
        `CREATE INDEX IF NOT EXISTS "idx_tenancy_userId" ON "Tenancy"("userId");`,
        `CREATE INDEX IF NOT EXISTS "idx_tenancy_landlordEmail" ON "Tenancy"("landlordEmail");`,
        `CREATE INDEX IF NOT EXISTS "idx_tenancy_landlordToken" ON "Tenancy"("landlordToken");`,
        `CREATE INDEX IF NOT EXISTS "idx_item_tenancyId" ON "Item"("tenancyId");`,
      ];
      for (const q of alterQueries) {
        try {
          await this.$executeRawUnsafe(q);
        } catch {}
      }
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

      // 3. Clean up only demo tenancies when force=true (preserve priyam@gmail.com / rajesh@gmail.com data)
      const scenarioAId = 'demo-tenancy-indiranagar-001';
      const scenarioBId = 'demo-tenancy-hsr-002';
      const scenarioCId = 'koramangala-settled-002';
      const demoIds = [scenarioAId, scenarioBId, scenarioCId];

      if (force) {
        if (this.isConnected) {
          try {
            const ic = (this as any).item || (this as any).Item;
            const tc = (this as any).tenancy || (this as any).Tenancy;
            const demoTenancies = await this.tenancyClient.findMany({
              where: {
                OR: [
                  { userId: tenant.id },
                  { landlordEmail },
                  { id: { in: demoIds } },
                ],
              },
            });
            const idsToWipe = demoTenancies.map((t: any) => t.id);
            if (idsToWipe.length > 0) {
              if (ic?.deleteMany) await ic.deleteMany({ where: { tenancyId: { in: idsToWipe } } });
              if (tc?.deleteMany) await tc.deleteMany({ where: { id: { in: idsToWipe } } });
            }
          } catch {}
        } else {
          for (const [k, v] of this.memoryTenancies.entries()) {
            if (v.userId === tenant.id || v.landlordEmail === landlordEmail || demoIds.includes(k)) {
              this.memoryTenancies.delete(k);
            }
          }
          for (const [k, v] of this.memoryItems.entries()) {
            if (!this.memoryTenancies.has(v.tenancyId)) this.memoryItems.delete(k);
          }
        }
      }

      // SCENARIO A (Active — Ready for Move-Out AI Audit): ₹25,000 deposit paid
      const existingA = await this.tenancyClient.findUnique({ where: { id: scenarioAId } });
      if (!existingA || force) {
        const tenancyA = await this.tenancyClient.create({
          data: {
            id: scenarioAId,
            propertyTitle: 'Skyline Cyber-Vault 2BHK Indiranagar',
            propertyAddress: '#402, 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru, KA 560038',
            depositAmount: 25000,
            depositAmountDecimal: 25000,
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
            depositPaid: true,
            depositPaymentId: 'pay_RS_DEMO_882910',
            moveInHash: DEMO_ROOM_CLEAN_SHA256,
            estimatedRefund: 25000,
            userId: tenant.id,
          },
        });

        await this.itemClient.create({
          data: {
            id: 'item-demo-001',
            roomName: 'Living Room',
            itemName: 'Italian Leather Sofa & Recliner',
            moveInNotes: 'Pristine beige leather upholstery, motorized recline tested & flawless.',
            moveInPhotoUrl: DEMO_ROOM_CLEAN_DATA_URI,
            moveInPhotoHash: DEMO_ROOM_CLEAN_SHA256,
            tenancyId: tenancyA.id,
          },
        });
      }

      // SCENARIO B (Active — Awaiting Owner Lock): ₹18,000 deposit, Step 01 uploaded
      const existingB = await this.tenancyClient.findUnique({ where: { id: scenarioBId } });
      if (!existingB || force) {
        const tenancyB = await this.tenancyClient.create({
          data: {
            id: scenarioBId,
            propertyTitle: 'Greenwood Cyber-Residency 1BHK HSR',
            propertyAddress: '#204, 27th Main Road, Sector 1, HSR Layout, Bengaluru, KA 560102',
            depositAmount: 18000,
            depositAmountDecimal: 18000,
            landlordName: 'Ramesh Malik',
            landlordPhone: '+91 98765 43210',
            landlordEmail: landlordEmail,
            landlordUpi: 'ramesh.malik@okhdfcbank',
            agreementRef: 'BLR-HSR-2026-KA-7120',
            landlordToken: 'demo-magic-token-hsr-2026',
            status: 'ACTIVE',
            depositPaid: false,
            moveInHash: DEMO_ROOM_CLEAN_SHA256,
            estimatedRefund: 18000,
            userId: tenant.id,
          },
        });

        await this.itemClient.create({
          data: {
            id: 'item-demo-hsr-001',
            roomName: 'Living Room',
            itemName: 'Modular Lounge & Wall Finish',
            moveInNotes: 'Freshly painted walls, spotless sofa cushions and glass coffee table.',
            moveInPhotoUrl: DEMO_ROOM_CLEAN_DATA_URI,
            moveInPhotoHash: DEMO_ROOM_CLEAN_SHA256,
            tenancyId: tenancyB.id,
          },
        });
      }

      // SCENARIO C (Settled History Stack): ₹45,000 deposit, ₹3,500 Gemini deduction, ₹41,500 refunded
      const existingC = await this.tenancyClient.findUnique({ where: { id: scenarioCId } });
      if (!existingC || force) {
        const tenancyC = await this.tenancyClient.create({
          data: {
            id: scenarioCId,
            propertyTitle: 'Prestige Lakeside 3BHK Koramangala',
            propertyAddress: '#18, 4th Block, 80 Feet Road, Koramangala, Bengaluru, KA 560034',
            depositAmount: 45000,
            depositAmountDecimal: 45000,
            landlordName: 'Ramesh Malik',
            landlordPhone: '+91 98765 43210',
            landlordEmail: landlordEmail,
            landlordUpi: 'ramesh.malik@okhdfcbank',
            tenantUpi: 'aarav.sharma@okaxis',
            agreementRef: 'BLR-KOR-2025-KA-9914',
            signerAudit: JSON.stringify({
              signerEmail: landlordEmail,
              signerIp: '103.212.154.42 (Bangalore, KA)',
              signedAt: '2025-04-10T11:00:00.000Z',
              ownerConfirmed: true,
              agreementRef: 'BLR-KOR-2025-KA-9914',
            }),
            landlordToken: 'demo-magic-token-koramangala-settled',
            status: 'SETTLED',
            depositPaid: true,
            depositPaymentId: 'pay_RS_DEMO_882910',
            settlementPaymentId: 'pay_RS_REFUND_994102',
            settledAt: new Date('2026-10-15T14:30:00.000Z'),
            moveInHash: DEMO_ROOM_CLEAN_SHA256,
            estimatedRefund: 41500,
            userId: tenant.id,
          },
        });

        await this.itemClient.create({
          data: {
            id: 'item-settled-001',
            roomName: 'Living Room',
            itemName: 'Upholstered Fabric Sofa Set',
            moveInNotes: 'Spotless cushion fabric and wooden armrests at handover.',
            moveInPhotoUrl: DEMO_ROOM_CLEAN_DATA_URI,
            moveInPhotoHash: DEMO_ROOM_CLEAN_SHA256,
            moveOutPhotoUrl: DEMO_ROOM_DAMAGED_DATA_URI,
            moveOutPhotoHash: DEMO_ROOM_DAMAGED_SHA256,
            aiVerdict: 'DAMAGE_DETECTED',
            aiExplanation: 'Localized fabric tear and cushion seam abrasion beyond normal wear under MTA 2021 Sec 15. Fair upholstery repair deduction applied.',
            suggestedCut: 3500,
            tenancyId: tenancyC.id,
          },
        });
      }
      this.logger.log('🎯 RentShield 3-Scenario Judge Demo data verified (Indiranagar Move-Out Ready + HSR Awaiting Owner Lock + Koramangala Settled)');
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
          avatarUrl: data.avatarUrl || null,
          address: data.address || null,
          upiId: data.upiId || null,
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
      update: async ({ where, data }: { where: { id?: string; email?: string }; data: any }) => {
        let target: any = null;
        if (where.id) target = this.memoryUsers.get(where.id);
        else if (where.email) {
          for (const u of this.memoryUsers.values()) {
            if (u.email.toLowerCase() === where.email.toLowerCase()) {
              target = u;
              break;
            }
          }
        }
        if (!target) throw new Error('User not found in memory store');
        Object.assign(target, data);
        return target;
      },
      delete: async ({ where }: { where: { id?: string; email?: string } }) => {
        let targetId: string | null = null;
        if (where.id) targetId = where.id;
        else if (where.email) {
          for (const [k, u] of this.memoryUsers.entries()) {
            if (u.email.toLowerCase() === where.email.toLowerCase()) {
              targetId = k;
              break;
            }
          }
        }
        if (targetId) this.memoryUsers.delete(targetId);
        return { id: targetId };
      },
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
          landlordUpi: data.landlordUpi || null,
          agreementRef: data.agreementRef || null,
          landlordQrUrl: data.landlordQrUrl || null,
          tenantUpi: data.tenantUpi || null,
          tenantQrUrl: data.tenantQrUrl || null,
          signerAudit: data.signerAudit || null,
          revisionNotes: data.revisionNotes || null,
          landlordToken: data.landlordToken || randomUUID(),
          status: data.status || 'ACTIVE',
          moveInHash: data.moveInHash || null,
          estimatedRefund: data.estimatedRefund || data.depositAmount,
          pendingPaymentStage: data.pendingPaymentStage || null,
          pendingPaymentId: data.pendingPaymentId || null,
          pendingPaymentAmount: data.pendingPaymentAmount || null,
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
