import { test, expect } from 'playwright/test';
import * as zlib from 'zlib';

// Helper to generate a valid PNG data buffer with real zlib deflate stream
function createTestImageBuffer(r = 16, g = 185, b = 129): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rawScanline = Buffer.from([0, r, g, b]);
  const compressed = zlib.deflateSync(rawScanline);
  function makeChunk(type: string, data: Buffer) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = (zlib as any).crc32 ? (zlib as any).crc32(buf.subarray(4, 8 + len)) : 0;
    buf.writeUInt32BE(crc >>> 0, 8 + len);
    return buf;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

test.describe.serial('RentShield Full E2E Verification Suite (14 Critical Scenarios)', () => {
  let createdTenancyId = '';
  let landlordToken = '';
  const tenantEmail = `tenant.e2e.${Date.now()}@rentshield.com`;
  const landlordEmail = `landlord.e2e.${Date.now()}@rentshield.com`;
  const password = 'password123';

  async function loginAsTenant(page: any) {
    await page.goto('/login');
    await page.keyboard.press('Escape');
    await page.locator('input[type="email"]').fill(tenantEmail);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]:has-text("Sign In")').click();
    await page.waitForURL('/');
    await page.keyboard.press('Escape');
  }

  // --------------------------------------------------------------------------
  // Scenario 1: IntroSplash & Header Navigation ("Sign In" Button Check)
  // --------------------------------------------------------------------------
  test('01. IntroSplash renders & top-header "Sign In" button is interactive', async ({ page }) => {
    await page.goto('/login');
    // Dismiss intro splash via Escape if active
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify Sign In link in header
    const headerSignIn = page.locator('nav a:has-text("Sign In"), nav button:has-text("Sign In")').first();
    await expect(headerSignIn).toBeVisible();

    // Clicking Sign In while on /login focuses email input smoothly
    await headerSignIn.click();
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeFocused();

    // Navigate to /verify and click Sign In from there
    await page.goto('/verify');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const verifyHeaderSignIn = page.locator('nav a:has-text("Sign In")').first();
    await expect(verifyHeaderSignIn).toBeVisible();
    await verifyHeaderSignIn.click();
    await expect(page).toHaveURL(/\/login/);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: 1-Click Judge Demo Accounts & Pre-Seeded History
  // --------------------------------------------------------------------------
  test('02. 1-Click Judge Demo Accounts & Pre-Seeded History Stack with NOC', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Escape');

    // Click 1-Click Demo as Tenant
    const demoTenantBtn = page.locator('button:has-text("Demo as Tenant")');
    await expect(demoTenantBtn).toBeVisible();
    await demoTenantBtn.click();

    // Wait for Dashboard
    await page.waitForURL('/');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Assert all 3 Pre-Seeded Judge Scenarios (Indiranagar Active, HSR Pending, Koramangala Settled)
    await expect(page.locator('text=Skyline Cyber-Vault 2BHK Indiranagar').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Greenwood Cyber-Residency 1BHK HSR').first()).toBeVisible();

    // Assert real embedded room thumbnails loaded cleanly (naturalWidth > 0)
    const firstThumbWidth = await page.locator('img[alt*="Indiranagar"]').first().evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(firstThumbWidth).toBeGreaterThan(0);

    // Assert Settled History Stack (Prestige Lakeside Koramangala)
    const settledHeader = page.locator('text=Settled History & Past Locations').first();
    await expect(settledHeader).toBeVisible();
    const settledCard = page.locator('text=Prestige Lakeside 3BHK Koramangala').first();
    await expect(settledCard).toBeVisible();

    // Assert Society Gate Pass NOC button works on settled card
    const nocBtn = page.locator('button:has-text("Society Gate Pass & NOC")').first();
    await expect(nocBtn).toBeVisible();
    await nocBtn.click();

    // Verify NOC Modal with exact heading locator
    const nocModalTitle = page.locator('h1:has-text("SOCIETY MOVE-OUT GATE PASS")').first();
    await expect(nocModalTitle).toBeVisible();
    const clearedStamp = page.locator('text=CLEARED FOR SOCIETY EXIT').first();
    await expect(clearedStamp).toBeVisible();

    // Close NOC modal
    const closeBtn = page.locator('button:has-text("Close Pass")').first();
    await closeBtn.click();

    // Log out
    const logoutBtn = page.locator('button[title="Logout"]').first();
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/login/);

    // Click 1-Click Demo as Landlord
    const demoLandlordBtn = page.locator('button:has-text("Demo as Owner")').first();
    await expect(demoLandlordBtn).toBeVisible();
    await demoLandlordBtn.click();

    // Wait for Landlord Dashboard
    await page.waitForURL('/');
    await page.keyboard.press('Escape');
    const landlordPill = page.locator('span:has-text("LANDLORD")').first();
    await expect(landlordPill).toBeVisible();

    // Log out
    await page.locator('button[title="Logout"]').first().click();
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Fresh Tenancy Creation & Anti-Collusion Anchor
  // --------------------------------------------------------------------------
  test('03. Fresh Tenancy Creation & Anti-Collusion Anchor', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Escape');

    // Register fresh Tenant
    const createAccountToggle = page.locator('button:has-text("Create one here")');
    await createAccountToggle.click();

    await page.locator('input[placeholder*="Aarav Sharma"]').fill('Vikram Malhotra (Tenant)');
    await page.locator('input[type="email"]').fill(tenantEmail);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]:has-text("Create Account")').click();

    await page.waitForURL('/');
    await page.keyboard.press('Escape');

    // Click Protect New Deposit
    await page.goto('/tenancy/new');
    await page.keyboard.press('Escape');

    // Assert form starts clean with zero pre-filled demo credentials for real users
    await expect(page.locator('input[placeholder*="Green Glen"]')).toHaveValue('');
    await expect(page.locator('input[placeholder*="Ramesh Malik"]')).toHaveValue('');
    await expect(page.locator('input[placeholder*="landlord.demo"]')).toHaveValue('');

    // Fill Tenancy Creation Form
    const propTitle = `Skyline Cyber-Vault Flat ${Date.now().toString().slice(-4)}`;
    await page.locator('input[placeholder*="Green Glen"]').fill(propTitle);
    await page.locator('textarea').fill('88, 100ft Road, Indiranagar, Bengaluru, KA 560038');
    await page.locator('input[type="number"]').fill('25000');
    await page.locator('input[placeholder*="Ramesh Malik"]').fill('Anand Singhania');
    await page.locator('input[placeholder*="98765"]').fill('+91 99887 76655');
    await page.locator('input[placeholder*="landlord.demo"]').fill(landlordEmail);
    await page.locator('input[placeholder*="okhdfcbank"]').fill('anand.singhania@okhdfcbank');
    await page.locator('input[placeholder*="BLR-IND"]').fill('BLR-IND-2026-KA-9912');

    // Submit
    await page.locator('button[type="submit"]:has-text("Initialize & Protect Deposit")').click();

    // Wait strictly until URL navigates away from /tenancy/new to /tenancy/:id
    await page.waitForURL((url) => url.pathname.startsWith('/tenancy/') && url.pathname !== '/tenancy/new', {
      timeout: 15000,
    });
    await page.keyboard.press('Escape');

    createdTenancyId = page.url().split('/tenancy/')[1].split('?')[0];
    expect(createdTenancyId).toBeTruthy();
    expect(createdTenancyId).not.toBe('new');

    // Protocol Progress shows 0/6 Sealed
    const progressPill = page.locator('span:has-text("0/6 Sealed")').first();
    await expect(progressPill).toBeVisible();

    // Assert Step 03 is unpaid initially
    const step3 = page.locator('text=03 ESCROW DEPOSIT').first();
    await expect(step3).toBeVisible();
    const awaitingPayment = page.locator('text=Action Required').first();
    await expect(awaitingPayment).toBeVisible();

    // Verify Dashboard Active Protected Deposit excludes unfunded tenancy (starts at ₹0)
    await page.goto('/');
    await page.keyboard.press('Escape');
    const depositKpiZero = page.locator('div:has-text("Active Protected Deposit")').locator('text=₹0').first();
    await expect(depositKpiZero).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Step 01 & Step 02 — Move-In SHA-256 Upload, Revision Loop & Owner Lock
  // --------------------------------------------------------------------------
  test('04. Step 01 & Step 02 — Move-In SHA-256 Upload, Revision Loop & Owner Lock', async ({ page }) => {
    // Authenticate as tenant
    await loginAsTenant(page);
    await page.goto(`/tenancy/${createdTenancyId}`);
    await page.keyboard.press('Escape');

    // Step 01: Upload Room Item
    const uploadBtn = page.locator('button:has-text("Upload Room Item")').first();
    await expect(uploadBtn).toBeVisible({ timeout: 10000 });
    await uploadBtn.click();

    // Fill fixture details
    await page.locator('input[placeholder*="Living Room"]').fill('Living Room');
    await page.locator('input[placeholder*="Inverter AC"]').fill('Italian Leather Recliner');
    await page.locator('textarea[placeholder*="pre-existing"]').fill('Pristine tan leather, dual motorized recline mechanism fully operational.');

    // Attach Move-In Image (Bright beige living room photo)
    const moveInImg = createTestImageBuffer(210, 195, 175);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'living-room-move-in.png',
      mimeType: 'image/png',
      buffer: moveInImg,
    });

    // Submit Move-In fixture
    await page.locator('button[type="submit"]:has-text("Lock Item Hash")').click();
    await page.waitForTimeout(1000);

    // Verify item appears and Step 01 is logged
    await expect(page.locator('text=Italian Leather Recliner').first()).toBeVisible();
    await expect(page.locator('text=1 Logged').first()).toBeVisible();

    // Verify Step 04 (Move-Out Audit) is STRICTLY LOCKED because Step 03 is not paid
    const step4Status = page.locator('text=04 MOVE-OUT & REFUND QR').locator('..').locator('text=🔒 Locked').first();
    await expect(step4Status).toBeVisible();

    // Extract Landlord Token from the Share Review link ("Open Portal" anchor)
    const portalLink = page.locator('a:has-text("Open Portal"), a[href*="/verify/"]').first();
    await expect(portalLink).toBeVisible();
    const fullReviewUrl = await portalLink.getAttribute('href');
    expect(fullReviewUrl).toBeTruthy();
    landlordToken = fullReviewUrl!.split('/verify/')[1].split('?')[0];
    expect(landlordToken).toBeTruthy();

    // Open Landlord Portal
    await page.goto(`/verify/${landlordToken}`);
    await page.keyboard.press('Escape');

    // Landlord tests "Flag Discrepancy / Request Revision"
    const flagRevisionBtn = page.locator('button:has-text("Flag Discrepancy / Request Revision")').first();
    await expect(flagRevisionBtn).toBeVisible();
    await flagRevisionBtn.click();

    const revisionNotesInput = page.locator('textarea[placeholder*="missing angles"]');
    await revisionNotesInput.fill('Please upload an additional photo of the recliner power adapter cable.');
    await page.locator('button:has-text("Send Revision Request")').click();
    await expect(page.locator('text=Revision request dispatched to tenant')).toBeVisible({ timeout: 15000 });

    // Switch to Tenant view: assert Revision Requested banner appears
    await page.goto(`/tenancy/${createdTenancyId}`);
    await page.keyboard.press('Escape');
    const revisionBanner = page.locator('text=Revision Requested by Owner').first();
    await expect(revisionBanner).toBeVisible({ timeout: 15000 });

    // Landlord approves & locks baseline
    await page.goto(`/verify/${landlordToken}`);
    await page.keyboard.press('Escape');

    // Check anti-collusion checkbox
    const ownerCheckbox = page.locator('input[type="checkbox"]');
    if (!(await ownerCheckbox.isChecked())) {
      await ownerCheckbox.check();
    }

    // Click Lock & Approve Baseline
    await page.locator('button:has-text("Lock & Approve Baseline")').click();
    await expect(page.locator('text=Inventory cryptographically sealed and approved successfully!')).toBeVisible({ timeout: 15000 });

    // Assert green approved state
    const approvedBadge = page.locator('text=Inventory Baseline Approved & Sealed').first();
    await expect(approvedBadge).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Step 03 — Stage 1 Security Deposit Payment (Guest -> Owner)
  // --------------------------------------------------------------------------
  test('05. Step 03 — Stage 1 Security Deposit Payment (Guest -> Owner)', async ({ page }) => {
    // Authenticate as tenant
    await loginAsTenant(page);
    await page.goto(`/tenancy/${createdTenancyId}`);
    await page.keyboard.press('Escape');

    // Assert Step 03 has Pay button
    const payDepositBtn = page.locator('button:has-text("Pay Security Deposit"), button:has-text("Pay & Lock Deposit")').first();
    await expect(payDepositBtn).toBeVisible();
    await payDepositBtn.click();

    // Payment Modal opens
    const modalHeader = page.locator('text=Stage 1: Move-In Security Deposit Escrow').first();
    await expect(modalHeader).toBeVisible();

    // Verify Owner's receiving VPA is displayed & NO duplicate QR exists inside Payer checkout
    const vpaDisplay = page.locator('text=anand.singhania@okhdfcbank').first();
    await expect(vpaDisplay).toBeVisible();
    const modalQrImgs = await page.locator('.fixed.inset-0 img').count();
    expect(modalQrImgs).toBe(0);

    // Confirm Payment via Razorpay Test Webhook
    const confirmPaymentBtn = page.locator('button:has-text("Judge Demo Simulate Razorpay Webhook"), button:has-text("Instant Confirm")').first();
    await expect(confirmPaymentBtn).toBeVisible();
    await confirmPaymentBtn.click();
    await page.waitForTimeout(1000);

    // Verify Step 03 is marked Paid
    const step3Paid = page.locator('text=Deposit Escrow Locked').first();
    await expect(step3Paid).toBeVisible();

    // Verify Step 04 (Move-Out Audit) is now UNLOCKED
    const step4Ready = page.locator('button:has-text("Upload Move-Out & Audit")').first();
    await expect(step4Ready).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Step 04 — Scene Mismatch Hard Blocker, Fraud Detection & Gemini AI Audit
  // --------------------------------------------------------------------------
  test('06. Step 04 — Scene Mismatch Hard Blocker, Fraud Detection & Gemini AI Audit', async ({ page }) => {
    // Authenticate as tenant
    await loginAsTenant(page);
    await page.goto(`/tenancy/${createdTenancyId}`);
    await page.keyboard.press('Escape');

    // Click Move-Out Audit button on item
    const moveOutBtn = page.locator('button:has-text("Upload Move-Out & Audit")').first();
    await expect(moveOutBtn).toBeVisible();
    await moveOutBtn.click();

    // Assert Move-Out modal is rendered in Portal directly under document.body and has max-h-[90vh] scroll layout
    const portalModal = page.locator('body > div.fixed.z-\\[9999\\]').first();
    await expect(portalModal).toBeVisible();
    const scrollableCard = portalModal.locator('div.max-h-\\[90vh\\].overflow-y-auto').first();
    await expect(scrollableCard).toBeVisible();

    const moveOutFileInput = page.locator('input[type="file"]');
    const submitAiBtn = page.locator('button[type="submit"]:has-text("Run AI Damage Audit")');

    // =========================================================================
    // CASE A: Move-In Room Photo vs Dark Website Screenshot -> HARD BLOCKED!
    // =========================================================================
    const darkScreenshotImg = createTestImageBuffer(15, 20, 30); // dark digital screenshot
    await moveOutFileInput.setInputFiles({
      name: 'dark-website-screenshot.png',
      mimeType: 'image/png',
      buffer: darkScreenshotImg,
    });
    await page.waitForTimeout(600);

    // Assert Client Canvas 16x16 pre-check flags SCENE MISMATCH DETECTED
    const sceneMismatchBanner = page.locator('text=SCENE MISMATCH DETECTED').first();
    await expect(sceneMismatchBanner).toBeVisible();
    await expect(submitAiBtn).toBeDisabled();

    // Force Submit with Judge Override to verify Server-Side Hard HTTP 400 Rejection
    const bypassCheckbox = page.locator('input[type="checkbox"]').last();
    await bypassCheckbox.check();
    await expect(submitAiBtn).toBeEnabled();
    await submitAiBtn.click();
    await page.waitForTimeout(1000);

    // Assert Server-Side SCENE MISMATCH BLOCKED rejection banner
    const serverMismatchBlocked = page.locator('text=SCENE MISMATCH BLOCKED').first();
    await expect(serverMismatchBlocked).toBeVisible();

    // =========================================================================
    // CASE A2: Human Face / Selfie Portrait vs Room Baseline -> HARD BLOCKED!
    // =========================================================================
    const humanSelfieImg = createTestImageBuffer(220, 150, 110); // human skin-tone portrait
    await moveOutFileInput.setInputFiles({
      name: 'human-selfie-portrait.png',
      mimeType: 'image/png',
      buffer: humanSelfieImg,
    });
    await page.waitForTimeout(600);

    // Verify Human Selfie is detected and blocked
    await expect(sceneMismatchBanner).toBeVisible();
    await expect(submitAiBtn).toBeDisabled();

    // =========================================================================
    // CASE B & C: Authentic Room Move-Out Photo -> Processed Cleanly
    // =========================================================================
    const authenticMoveOutImg = createTestImageBuffer(215, 200, 180); // authentic room with slight natural light shift
    await moveOutFileInput.setInputFiles({
      name: 'authentic-move-out.png',
      mimeType: 'image/png',
      buffer: authenticMoveOutImg,
    });
    await page.waitForTimeout(600);

    // Verify Scene Mismatch error is cleared and submit button is enabled
    await expect(sceneMismatchBanner).not.toBeVisible();
    await expect(submitAiBtn).toBeEnabled();

    // Set Guest receiving refund UPI
    const guestRefundUpi = page.locator('input[placeholder*="yourname@okaxis"]');
    if (await guestRefundUpi.isVisible()) {
      await guestRefundUpi.fill('fresh.tenant@okaxis');
      const saveUpiBtn = page.locator('button:has-text("Save UPI")');
      if (await saveUpiBtn.isVisible()) {
        await saveUpiBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Run AI Audit with authentic photo
    await submitAiBtn.click();

    // Verify Move-Out AI audit completed
    const auditedBadge = page.locator('text=Gemini AI Audit Arbitration').first();
    await expect(auditedBadge).toBeVisible({ timeout: 35000 });
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Step 05 — Stage 2 Final Refund Settlement (Owner -> Guest QR Isolation)
  // --------------------------------------------------------------------------
  test('07. Step 05 — Stage 2 Final Refund Settlement with QR Isolation', async ({ page }) => {
    // Open Landlord Portal (public token, no auth needed)
    await page.goto(`/verify/${landlordToken}`);
    await page.keyboard.press('Escape');

    // Assert Property Vacated banner
    const vacatedBanner = page.locator('text=PROPERTY VACATED • FREE FOR NEXT TENANT').first();
    await expect(vacatedBanner).toBeVisible();

    // Open Pay Net Refund
    const refundPayBtn = page.locator('button:has-text("Scan Guest QR / Pay Net Refund")').first();
    await expect(refundPayBtn).toBeVisible();
    await refundPayBtn.click();

    // Assert Modal opens in Settlement stage
    const settlementTitle = page.locator('text=Stage 2: Move-Out Final Net Escrow Refund').first();
    await expect(settlementTitle).toBeVisible();

    // Complete refund settlement via Razorpay Test Webhook
    const confirmBtn = page.locator('button:has-text("Judge Demo Simulate Razorpay Webhook"), button:has-text("Instant Confirm")').first();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Verify Settled status
    const settledBanner = page.locator('text=Refund Settled • Property Free for Next Tenant').first();
    await expect(settledBanner).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Step 06 — Auto-Clear Active Workspace & Settled History Stack
  // --------------------------------------------------------------------------
  test('08. Step 06 — Auto-Clear Active Workspace & Settled History Stack', async ({ page }) => {
    // Return to Tenant Dashboard
    await loginAsTenant(page);
    await page.goto('/');
    await page.keyboard.press('Escape');

    // Assert property is in Settled History & Past Locations stack
    const settledSection = page.locator('text=Settled History & Past Locations').first();
    await expect(settledSection).toBeVisible();

    // Open Society Gate Pass & NOC from the settled card
    const viewNocBtn = page.locator('button:has-text("Society Gate Pass & NOC")').first();
    await expect(viewNocBtn).toBeVisible();
    await viewNocBtn.click();

    // Assert Certificate opens cleanly
    const passTitle = page.locator('h1:has-text("SOCIETY MOVE-OUT GATE PASS")').first();
    await expect(passTitle).toBeVisible();
    const mtaRef = page.locator('text=Model Tenancy Act').first();
    await expect(mtaRef).toBeVisible();

    // Verify Scannable QR exists on Certificate
    const certQr = page.locator('img[alt*="Gate Pass QR"]').first();
    await expect(certQr).toBeVisible();

    // Close certificate
    await page.locator('button:has-text("Close Pass")').first().click();
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Role-Guard Check on /tenancy/:id
  // --------------------------------------------------------------------------
  test('09. Role-Guard Check on /tenancy/:id prevents Landlord tenant actions', async ({ page }) => {
    // Log in as Landlord
    await page.goto('/login');
    await page.keyboard.press('Escape');
    await page.locator('button:has-text("Demo as Owner")').click();
    await page.waitForURL('/');
    await page.keyboard.press('Escape');

    // Visit tenancy detail page
    await page.goto(`/tenancy/${createdTenancyId}`);
    await page.keyboard.press('Escape');

    // Landlord MUST NOT see "Upload Room Item" or "Pay Security Deposit"
    const uploadRoomBtn = page.locator('button:has-text("Upload Room Item")');
    await expect(uploadRoomBtn).not.toBeVisible();

    const payDepositBtn = page.locator('button:has-text("Pay Security Deposit")');
    await expect(payDepositBtn).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Zero-Server Public Courtroom Verifier (/verify)
  // --------------------------------------------------------------------------
  test('10. Zero-Server Public Courtroom Verifier (/verify)', async ({ page }) => {
    await page.goto('/verify');
    await page.keyboard.press('Escape');

    // Verify Courtroom explainer banner
    const explainer = page.locator('text=Zero-Trust Courtroom Proof').first();
    await expect(explainer).toBeVisible();

    // Load Demo Certificate
    const loadDemoBtn = page.locator('button:has-text("Load Demo Certificate")');
    await expect(loadDemoBtn).toBeVisible();
    await loadDemoBtn.click();

    // Assert Authentic Ledger Record rendered
    const recordBanner = page.locator('text=Authentic Ledger Record').first();
    await expect(recordBanner).toBeVisible({ timeout: 10000 });

    // Assert SHA-256 baseline ledger section visible
    const shaSection = page.locator('text=Cryptographic Seal Signature (SHA-256):').first();
    await expect(shaSection).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Scenario 11: User Profile Modal Portal & Responsiveness (1280x720 & 375x667)
  // --------------------------------------------------------------------------
  test('11. User Profile Modal renders in Portal, non-clipped on 1280x720 & 375x667, with no stuck dots', async ({ page }) => {
    // 1. Desktop Viewport (1280x720)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/login');
    await page.keyboard.press('Escape');
    await page.locator('button:has-text("Demo as Tenant")').click();
    await page.waitForURL('/');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Click User Pill in Navbar
    const userPill = page.locator('button[title*="Open Profile"]').first();
    await expect(userPill).toBeVisible();
    await userPill.click();

    // Verify modal is rendered via Portal as direct child of body
    const modalBackdrop = page.locator('div[role="dialog"]').first();
    await expect(modalBackdrop).toBeVisible();

    // Verify modal panel bounding box is NOT clipped off top (y >= 0)
    const modalBox = await modalBackdrop.locator('div.relative.w-full').first().boundingBox();
    expect(modalBox).not.toBeNull();
    if (modalBox) {
      expect(modalBox.y).toBeGreaterThanOrEqual(0);
      expect(modalBox.height).toBeLessThanOrEqual(720);
    }

    // Assert live stats do NOT display stuck '...' inside Activity & Vault tab
    const statsTab = modalBackdrop.locator('button:has-text("Activity")').first();
    await statsTab.click();
    const activeStat = modalBackdrop.locator('text=Active Escrows').locator('..').locator('.text-2xl').first();
    await expect(activeStat).toBeVisible();
    const statText = await activeStat.textContent();
    expect(statText).not.toBe('...');

    // Test Security Tab & Password Eye Toggles
    const securityTab = modalBackdrop.locator('button:has-text("Security")').first();
    await securityTab.click();
    const newPwdInput = modalBackdrop.locator('input[placeholder*="Min 6 characters"]').first();
    await expect(newPwdInput).toBeVisible();
    expect(await newPwdInput.getAttribute('type')).toBe('password');
    // Toggle Eye
    const eyeBtn = modalBackdrop.locator('button[title*="new password"], button[title*="password"]').nth(1);
    await eyeBtn.click();
    expect(await newPwdInput.getAttribute('type')).toBe('text');

    // Test Danger Zone & Demo Protection
    const dangerTab = modalBackdrop.locator('button:has-text("Danger Zone")').first();
    await dangerTab.click();
    const demoWarning = modalBackdrop.locator('text=Demo Account Protected').first();
    await expect(demoWarning).toBeVisible();

    // Close Modal via Escape or close button
    await modalBackdrop.locator('button[title*="Close"]').first().click();
    await expect(modalBackdrop).not.toBeVisible();

    // 2. Mobile Viewport (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);

    // Reopen profile modal
    await userPill.click();
    await expect(modalBackdrop).toBeVisible();

    const mobileModalBox = await modalBackdrop.locator('div.relative.w-full').first().boundingBox();
    expect(mobileModalBox).not.toBeNull();
    if (mobileModalBox) {
      expect(mobileModalBox.y).toBeGreaterThanOrEqual(0);
      expect(mobileModalBox.width).toBeLessThanOrEqual(375);
    }

    // Close Modal
    await modalBackdrop.locator('button[title*="Close"]').first().click();
    await expect(modalBackdrop).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Backend Profile & Account Protection API Verification
  // --------------------------------------------------------------------------
  test('12. Backend Profile Endpoints: GET /api/auth/me, PATCH /profile, & DELETE demo protection', async ({ request }) => {
    // 1. Login as Tenant to get token
    const loginRes = await request.post('http://localhost:4000/api/auth/login', {
      data: {
        email: 'tenant.demo@rentshield.com',
        password: 'password123',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const token = loginData.access_token || loginData.token;
    expect(token).toBeDefined();

    // 2. GET /api/auth/me
    const meRes = await request.get('http://localhost:4000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.ok()).toBeTruthy();
    const meData = await meRes.json();
    expect(meData.email).toBe('tenant.demo@rentshield.com');
    expect(meData.role).toBe('TENANT');

    // 3. PATCH /api/auth/profile
    const updateRes = await request.patch('http://localhost:4000/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        address: '100 Feet Rd, Indiranagar, Bengaluru',
        upiId: 'tenant.demo@okhdfcbank',
      },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updateData = await updateRes.json();
    expect(updateData.user.address).toBe('100 Feet Rd, Indiranagar, Bengaluru');
    expect(updateData.user.upiId).toBe('tenant.demo@okhdfcbank');

    // 4. DELETE /api/auth/account (Must return 403 Forbidden for demo account)
    const deleteRes = await request.delete('http://localhost:4000/api/auth/account', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.status()).toBe(403);
    const deleteData = await deleteRes.json();
    expect(deleteData.message).toContain('Judge Demo accounts are protected from deletion');
  });

  // --------------------------------------------------------------------------
  // Scenario 13: MTA 2021 Smart Lease & Deposit Clause Scanner (UI + Gemini API)
  // --------------------------------------------------------------------------
  test('13. MTA 2021 Smart Lease & Deposit Clause Scanner detects predatory deposit & wear traps', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Escape');

    // Open Lease Risk Scanner from Navbar
    const scannerNavBtn = page.locator('button:has-text("Lease Risk Scanner")').first();
    await expect(scannerNavBtn).toBeVisible();
    await scannerNavBtn.click();

    await expect(page.locator('h3:has-text("MTA 2021 Smart Lease")')).toBeVisible();

    // Click Predatory 10-Month Deposit Sample & scan
    const predatoryBtn = page.locator('button:has-text("Predatory 10-Month Deposit")').first();
    await predatoryBtn.click();

    // Verify Risk Score & Red Illegal Clause flag rendered
    const resultPanel = page.locator('#lease-audit-result');
    await expect(resultPanel).toBeVisible({ timeout: 20000 });
    await expect(resultPanel.locator('text=Legal Risk Score')).toBeVisible();
    await expect(resultPanel.locator('text=ILLEGAL / PREDATORY CLAUSE').first()).toBeVisible();

    // Close modal
    await page.locator('button[title="Close Lease Scanner"]').click();
  });

  // --------------------------------------------------------------------------
  // Scenario 14: 1-Click Judge Evidence Simulator Chips in Step 04 Move-Out Modal
  // --------------------------------------------------------------------------
  test('14. 1-Click Judge Evidence Simulator Chips trigger Duplicate Hash & 32x32 Selfie Blockers', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Escape');
    await page.locator('button:has-text("Demo as Tenant")').click();
    await page.waitForURL('/');
    await page.keyboard.press('Escape');

    // Ensure fresh demo sandbox via Reset Judge Demo
    const resetBtn = page.locator('button:has-text("Reset Judge Demo")').first();
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await page.waitForTimeout(800);
    }

    // Open Scenario A (Skyline Cyber-Vault 2BHK Indiranagar — Ready for Move-Out AI Audit)
    await page.goto('/tenancy/demo-tenancy-indiranagar-001');
    await page.keyboard.press('Escape');

    const moveOutBtn = page.locator('button:has-text("Upload Move-Out & Audit")').first();
    await expect(moveOutBtn).toBeVisible({ timeout: 10000 });
    await moveOutBtn.click();

    // Verify all 3 Judge Evidence Chips render inside Move-Out Modal
    const dupChip = page.locator('button:has-text("Load Duplicate Move-In Photo")').first();
    const selfieChip = page.locator('button:has-text("Load Selfie Portrait")').first();
    const damagedChip = page.locator('button:has-text("Load Damaged Sofa Photo")').first();
    await expect(dupChip).toBeVisible();
    await expect(selfieChip).toBeVisible();
    await expect(damagedChip).toBeVisible();

    // Click Duplicate chip -> triggers instant SHA-256 Anti-Fraud block!
    await dupChip.click();
    await expect(page.locator('text=ANTI-FRAUD TRIGGERED').first()).toBeVisible({ timeout: 8000 });

    // Click Selfie Portrait chip -> triggers instant 32x32 Skin-Cluster Scene Mismatch block!
    await selfieChip.click();
    await expect(page.locator('text=SCENE MISMATCH BLOCKED').first()).toBeVisible({ timeout: 8000 });

    // Click Damaged Sofa chip -> clears alerts & enables Run AI Damage Audit!
    await damagedChip.click();
    await page.waitForTimeout(500);
    await expect(page.locator('button[type="submit"]:has-text("Run AI Damage Audit")')).toBeEnabled();
  });
});
