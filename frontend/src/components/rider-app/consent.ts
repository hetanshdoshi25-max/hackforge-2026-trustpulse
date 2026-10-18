/**
 * One-time consent before any behavioural data is collected (DPDP Act: consent for a
 * stated purpose). Stored per device; bump CONSENT_VERSION if what we collect changes.
 */
export const CONSENT_VERSION = '1';
export const CONSENT_KEY = 'trustpulse_consent';

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === CONSENT_VERSION;
  } catch {
    return false;
  }
}
