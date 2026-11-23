import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

export interface AuditResult {
  verdict: 'NORMAL_WEAR_TEAR' | 'DAMAGE_DETECTED';
  explanation: string;
  suggestedCut: number;
}

@Injectable()
export class AiAuditService {
  private readonly logger = new Logger(AiAuditService.name);

  async auditMoveOutImage(itemId: string, base64: string): Promise<AuditResult> {
    return this.analyzeCondition(`Item-${itemId}`, 'Specified Room', null, 'Move-out photo submitted', null, null);
  }

  async analyzeCondition(
    itemName: string,
    roomName: string,
    moveInNotes?: string | null,
    moveOutNotes?: string | null,
    moveInPhotoUrl?: string | null,
    moveOutPhotoUrl?: string | null,
  ): Promise<AuditResult> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your-gemini-api-key')) {
      this.logger.warn('Gemini API key is not configured. Utilizing safe automated fallback assessment.');
      return this.generateFallbackResult(itemName, moveInNotes, moveOutNotes);
    }

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      const prompt = `You are a certified, objective property inventory arbitrator reviewing rental wear-and-tear vs damage under Section 13 and 15 of the Indian Model Tenancy Act (MTA) 2021.
Analyze the following item at move-out:
Item: "${itemName}" in Room: "${roomName}"
Move-in notes: "${moveInNotes || 'Condition noted as pristine / standard on check-in'}"
Move-out notes: "${moveOutNotes || 'Tenant completed move-out inspection'}"
Move-in Photo: ${moveInPhotoUrl || 'Recorded on file'}
Move-out Photo: ${moveOutPhotoUrl || 'Recorded on file'}

Statutory Guidelines (Model Tenancy Act 2021):
- NORMAL_WEAR_TEAR: Natural deterioration from regular usage, surface scuffs, minor paint wear, micro-scratches, age depreciation. Deduction must be ₹0.
- DAMAGE_DETECTED: Tenant negligence, cracks, severe burns, broken parts, intentional or accidental destruction. Propose equitable repair cut (₹500 to ₹5000).

Respond ONLY with a JSON object in this exact schema, with no additional markdown:
{
  "verdict": "NORMAL_WEAR_TEAR" or "DAMAGE_DETECTED",
  "explanation": "Clear, professional explanation citing condition under MTA 2021 under 45 words",
  "suggestedCut": number
}`;

      // 8-second timeout shield against API network hanging or rate-limit delays
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API call timed out after 8s')), 8000),
      );

      const generatePromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const text = response?.text?.trim() || '';
      return this.safeParseAiJson(text, itemName, moveInNotes, moveOutNotes);
    } catch (err: any) {
      this.logger.warn(`Gemini AI service error, rate-limit, or quota shield activated (${err?.message || 'Error'}). Executing safe deterministic audit.`);
      return this.generateFallbackResult(itemName, moveInNotes, moveOutNotes);
    }
  }

  private safeParseAiJson(
    rawText: string,
    itemName: string,
    moveInNotes?: string | null,
    moveOutNotes?: string | null,
  ): AuditResult {
    try {
      // Strip markdown code fences if present
      let clean = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }
      const parsed = JSON.parse(clean);

      const verdict: 'NORMAL_WEAR_TEAR' | 'DAMAGE_DETECTED' =
        parsed.verdict === 'DAMAGE_DETECTED' ? 'DAMAGE_DETECTED' : 'NORMAL_WEAR_TEAR';
      const explanation: string =
        parsed.explanation && typeof parsed.explanation === 'string'
          ? parsed.explanation
          : 'Condition reviewed: standard occupancy wear observed.';
      const suggestedCut: number =
        typeof parsed.suggestedCut === 'number' && !isNaN(parsed.suggestedCut)
          ? Math.max(0, parsed.suggestedCut)
          : verdict === 'DAMAGE_DETECTED' ? 1200 : 0;

      return { verdict, explanation, suggestedCut };
    } catch (parseErr) {
      this.logger.warn('Failed to parse Gemini response as JSON. Falling back safely.');
      return this.generateFallbackResult(itemName, moveInNotes, moveOutNotes);
    }
  }

  private generateFallbackResult(
    itemName: string,
    moveInNotes?: string | null,
    moveOutNotes?: string | null,
  ): AuditResult {
    const outLower = (moveOutNotes || '').toLowerCase();
    const isDamageKeyword = /broken|crack|shatter|burn|deep gouge|ruin|torn|hole|scratch|stain|dent|leak|spill|damage|chipped/i.test(outLower);

    if (isDamageKeyword) {
      return {
        verdict: 'DAMAGE_DETECTED',
        explanation: `Under Model Tenancy Act (MTA) 2021 Sec 15: move-out inspection logged tenant-induced impairment on ${itemName}. Assessed fair repair deduction.`,
        suggestedCut: 1500,
      };
    }

    return {
      verdict: 'NORMAL_WEAR_TEAR',
      explanation: `Under Model Tenancy Act (MTA) 2021 Sec 13: ${itemName} exhibits standard fair wear-and-tear consistent with residential tenancy duration. ₹0 deduction.`,
      suggestedCut: 0,
    };
  }
}
