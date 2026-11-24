import { test, expect } from 'playwright/test';

// Helper to generate a minimal valid 1x1 PNG data buffer
function createTestImageBuffer(r = 16, g = 185, b = 129): Buffer {
  // Minimal valid 1x1 PNG
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, r, g, b, 0x00, 0x00,
    0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

test.describe.serial('RentShield Full E2E Verification Suite (10 Critical Scenarios)', () => {
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

    // Assert Active Tenancy Card (Indiranagar)
    const activeProperty = page.locator('text=Indiranagar').first();
    await expect(activeProperty).toBeVisible({ timeout: 10000 });

    // Assert Settled History Stack (Koramangala)
    const settledHeader = page.locator('text=Settled History & Past Locations').first();
    await expect(settledHeader).toBeVisible();
    const settledCard = page.locator('text=Koramangala').first();
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

    // Attach Move-In Image
    const moveInImg = createTestImageBuffer(16, 185, 129);
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
    await page.waitForTimeout(600);

    // Switch to Tenant view: assert Revision Requested banner appears
    await page.goto(`/tenancy/${createdTenancyId}`);
    await page.keyboard.press('Escape');
    const revisionBanner = page.locator('text=Revision Requested by Owner').first();
    await expect(revisionBanner).toBeVisible();

    // Landlord approves & locks baseline
    await page.goto(`/verify/${landlordToken}`);
    await page.keyboard.press('Escape');

    // Check anti-collusion checkbox
    const ownerCheckbox = page.locator('input[type="checkbox"]');
    if (!(await ownerCheckbox.isChecked())) {
      await ownerCheckbox.check();
    }

    // Click Lock & Approve Baseline
    const lockApproveBtn = page.locator('button:has-text("Lock & Approve Baseline")');
    await lockApproveBtn.click();
    await page.waitForTimeout(1000);

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

    // Verify Owner's receiving VPA is displayed (use .first() to prevent strict mode duplicate with subtitle)
    const vpaDisplay = page.locator('text=anand.singhania@okhdfcbank').first();
    await expect(vpaDisplay).toBeVisible();

    // Verify QR code image is generated and scannable
    const qrImg = page.locator('img[alt*="UPI QR"]').first();
    await expect(qrImg).toBeVisible();
    const qrSrc = await qrImg.getAttribute('src');
    expect(qrSrc).toContain('data:image/png;base64');

    // Confirm Payment via Instant UPI Confirmation
    const confirmPaymentBtn = page.locator('button:has-text("Instant Confirm")');
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
  // Scenario 6: Step 04 — Duplicate Photo Anti-Fraud Blocker & Gemini AI Audit
  // --------------------------------------------------------------------------
  test('06. Step 04 — Duplicate Photo Anti-Fraud Blocker & Gemini AI Audit', async ({ page }) => {
    // Authenticate as tenant
    await loginAsTenant(page);
    await page.goto(`/tenancy/${createdTenancyId}`);
    await page.keyboard.press('Escape');

    // Click Move-Out Audit button on item
    const moveOutBtn = page.locator('button:has-text("Upload Move-Out & Audit")').first();
    await expect(moveOutBtn).toBeVisible();
    await moveOutBtn.click();

    // 1. Upload EXACT SAME Move-In photo bytes to trigger Anti-Fraud
    const identicalImg = createTestImageBuffer(16, 185, 129); // identical bytes
    const moveOutFileInput = page.locator('input[type="file"]');
    await moveOutFileInput.setInputFiles({
      name: 'identical-move-in.png',
      mimeType: 'image/png',
      buffer: identicalImg,
    });
    await page.waitForTimeout(500);

    // Assert Anti-Fraud Triggered warning
    const fraudWarning = page.locator('text=ANTI-FRAUD TRIGGERED').first();
    await expect(fraudWarning).toBeVisible();

    // Assert submit button is disabled
    const submitAiBtn = page.locator('button[type="submit"]:has-text("Run AI Damage Audit")');
    await expect(submitAiBtn).toBeDisabled();

    // Use Judge Bypass to permit test flow
    const bypassLink = page.locator('button:has-text("Bypass for Quick Judge Test")');
    await bypassLink.click();
    await page.waitForTimeout(300);

    // Verify submit button is now enabled
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

    // Run AI Audit
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

    // Complete refund settlement via Instant UPI Confirmation
    const confirmBtn = page.locator('button:has-text("Instant Confirm")');
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
});
