import { Tenancy, Item } from '../api';

export type EscrowPhase =
  | 'NEEDS_MOVE_IN_ITEMS'
  | 'NEEDS_OWNER_SEAL_AND_QR'
  | 'NEEDS_GUEST_DEPOSIT_PAYMENT'
  | 'NEEDS_MOVE_OUT_AUDIT_AND_GUEST_QR'
  | 'NEEDS_FINAL_SETTLEMENT'
  | 'SETTLED_ARCHIVED';

export interface EscrowState {
  phase: EscrowPhase;
  phaseNumber: 1 | 2 | 3 | 4 | 5 | 6;
  phaseLabel: string;
  items: Item[];
  totalItems: number;
  hasOwnerQrOrUpi: boolean;
  hasGuestQrOrUpi: boolean;
  depositPaid: boolean;
  isOwnerSealed: boolean;
  allItemsAudited: boolean;
  auditedItemsCount: number;
  originalDeposit: number;
  totalDeductions: number;
  netRefund: number;
  excessDamage: number;
  isSettled: boolean;

  // Strict role permissions
  canTenantUploadMoveIn: boolean;
  canOwnerApproveAndSeal: boolean;
  canTenantPayDeposit: boolean;
  canTenantUploadMoveOut: boolean;
  canTenantSetRefundUpi: boolean;
  canOwnerPayRefund: boolean;
  canTenantPayExcessDamage: boolean;
  canInstantSettleZero: boolean;
}

/**
 * Pure, authoritative single source of truth for RentShield 6-step Cyber-Escrow sequence.
 * Shared across Dashboard, TenancyDetail, and LandlordVerify.
 */
export function getEscrowState(tenancy: Tenancy | null | undefined): EscrowState {
  const items = tenancy?.items || [];
  const totalItems = items.length;
  const isSettled = tenancy?.status === 'SETTLED';
  
  const hasOwnerQrOrUpi = Boolean(
    tenancy?.landlordUpi?.trim() || tenancy?.landlordQrUrl || tenancy?.customQrUrl
  );
  const hasGuestQrOrUpi = Boolean(
    tenancy?.tenantUpi?.trim() || tenancy?.tenantQrUrl
  );
  const depositPaid = Boolean(tenancy?.depositPaid);
  const isOwnerSealed =
    ['APPROVED', 'LOCKED', 'VACATED', 'SETTLED'].includes(tenancy?.status || '') ||
    Boolean(tenancy?.signerAudit);

  const auditedItemsCount = items.filter(
    (it) => Boolean((it.moveOutPhotoUrl || it.moveOutPhotoHash) && it.aiVerdict)
  ).length;
  const allItemsAudited = totalItems > 0 && auditedItemsCount === totalItems;

  const originalDeposit = Number(tenancy?.depositAmount || 0);
  const totalDeductions = items.reduce(
    (acc, it) => acc + Number(it.suggestedCut || 0),
    0
  );
  const netRefund = Math.max(0, originalDeposit - totalDeductions);
  const excessDamage = Math.max(0, totalDeductions - originalDeposit);

  let phase: EscrowPhase = 'NEEDS_MOVE_IN_ITEMS';
  let phaseNumber: 1 | 2 | 3 | 4 | 5 | 6 = 1;
  let phaseLabel = 'Step 01: Move-In Baseline Photo Evidence';

  if (isSettled) {
    phase = 'SETTLED_ARCHIVED';
    phaseNumber = 6;
    phaseLabel = 'Step 06: Settled & Cryptographically Sealed';
  } else if (totalItems === 0) {
    phase = 'NEEDS_MOVE_IN_ITEMS';
    phaseNumber = 1;
    phaseLabel = 'Step 01: Move-In Baseline Photo Evidence';
  } else if (!isOwnerSealed || !hasOwnerQrOrUpi) {
    phase = 'NEEDS_OWNER_SEAL_AND_QR';
    phaseNumber = 2;
    phaseLabel = 'Step 02: Owner Seal & Receiving QR Verification';
  } else if (!depositPaid) {
    phase = 'NEEDS_GUEST_DEPOSIT_PAYMENT';
    phaseNumber = 3;
    phaseLabel = 'Step 03: Escrow Security Deposit Payment';
  } else if (!allItemsAudited || (netRefund > 0 && !hasGuestQrOrUpi)) {
    phase = 'NEEDS_MOVE_OUT_AUDIT_AND_GUEST_QR';
    phaseNumber = 4;
    phaseLabel = 'Step 04: Move-Out Damage Audit & Guest Refund VPA';
  } else {
    phase = 'NEEDS_FINAL_SETTLEMENT';
    phaseNumber = 5;
    phaseLabel = 'Step 05: Final Escrow Settlement & Refund Payout';
  }

  return {
    phase,
    phaseNumber,
    phaseLabel,
    items,
    totalItems,
    hasOwnerQrOrUpi,
    hasGuestQrOrUpi,
    depositPaid,
    isOwnerSealed,
    allItemsAudited,
    auditedItemsCount,
    originalDeposit,
    totalDeductions,
    netRefund,
    excessDamage,
    isSettled,

    canTenantUploadMoveIn: phase === 'NEEDS_MOVE_IN_ITEMS',
    canOwnerApproveAndSeal: phase === 'NEEDS_OWNER_SEAL_AND_QR',
    canTenantPayDeposit: phase === 'NEEDS_GUEST_DEPOSIT_PAYMENT',
    canTenantUploadMoveOut: phase === 'NEEDS_MOVE_OUT_AUDIT_AND_GUEST_QR' && depositPaid,
    canTenantSetRefundUpi: phase === 'NEEDS_MOVE_OUT_AUDIT_AND_GUEST_QR' || phase === 'NEEDS_FINAL_SETTLEMENT',
    canOwnerPayRefund: phase === 'NEEDS_FINAL_SETTLEMENT' && netRefund > 0,
    canTenantPayExcessDamage: phase === 'NEEDS_FINAL_SETTLEMENT' && excessDamage > 0,
    canInstantSettleZero: phase === 'NEEDS_FINAL_SETTLEMENT' && netRefund === 0 && excessDamage === 0,
  };
}
