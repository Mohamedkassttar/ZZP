/**
 * Bank Transaction Matching Utilities
 *
 * Shared utilities for intelligent bank transaction matching
 * with word boundaries and description cleaning.
 */

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Test if keyword matches using word boundaries
 *
 * Examples:
 * - "BP" matches "BP Station" ✓
 * - "BP" does NOT match "BPost" ✗
 * - "SHELL" matches "SHELL UTRECHT" ✓
 * - "SHELL" does NOT match "SHELLFISH" ✗
 *
 * @param text - Text to search in
 * @param keyword - Keyword to find
 * @returns true if keyword found as complete word
 */
export function matchesWithWordBoundary(text: string, keyword: string): boolean {
  const escapedKeyword = escapeRegex(keyword);
  const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
  return regex.test(text);
}

/**
 * Clean transaction description for better AI matching
 *
 * ROOT CAUSE FIX: Aggressive Payment Processor Noise Filter
 *
 * Removes:
 * - Dates (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD)
 * - Timestamps (HH:MM:SS, HH:MM)
 * - Common bank codes (SEPA, TRX, PAS, BEA, NR, REF, etc.)
 * - Payment processors (Apple Pay, Google Pay, CCV, Mollie, etc.)
 * - Payment method noise (Betaalautomaat, Contactloos, Pasnummer, etc.)
 * - Transaction IDs and reference numbers
 *
 * Examples:
 * Input:  "BEA 12:00 24-12-2024 SHELL UTRECHT NR 12345 PAS 678"
 * Output: "SHELL UTRECHT"
 *
 * Input:  "Betaalautomaat 18:55 pasnr. 001 Apple Pay SHELL SCHWEITZERDREE UTRECHT"
 * Output: "SHELL SCHWEITZERDREE UTRECHT"
 */
export function cleanTransactionDescription(description: string): string {
  if (!description) return '';

  let cleaned = description;

  // Remove payment processors (CRITICAL FIX for Apple Pay bias)
  cleaned = cleaned.replace(/\b(Apple Pay|Google Pay|Samsung Pay|Garmin Pay)\b/gi, '');

  // Remove payment processor platforms
  cleaned = cleaned.replace(/\b(CCV|Mollie|Buckaroo|Adyen|MultiSafepay|Pay\.nl|Sisow)\b/gi, '');

  // Remove payment method noise (Dutch)
  cleaned = cleaned.replace(/\b(Betaalautomaat|Betaal automaat|Pinautomaat|Pin automaat)\b/gi, '');
  cleaned = cleaned.replace(/\b(Contactloos|Mobiele betaling|Mobile payment|NFC)\b/gi, '');
  cleaned = cleaned.replace(/\b(Pasnummer|Pasnr\.?|Pas nr\.?|Kaart nr\.?|Card nr\.?)\b/gi, '');

  // Remove dates (multiple formats)
  cleaned = cleaned.replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, ''); // DD-MM-YYYY, DD/MM/YYYY
  cleaned = cleaned.replace(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, ''); // YYYY-MM-DD

  // Remove timestamps
  cleaned = cleaned.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ''); // HH:MM:SS or HH:MM

  // Remove common Dutch bank codes and prefixes
  cleaned = cleaned.replace(/\b(BEA|SEPA|TRX|PAS|NR|REF|IBAN|BIC|TERM|PIN|ID|CODE|Omschrijving|Incasso)\b/gi, '');

  // Remove transaction/terminal IDs (sequences of 4+ digits)
  cleaned = cleaned.replace(/\b\d{4,}\b/g, '');

  // Remove multiple spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}
