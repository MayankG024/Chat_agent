/**
 * Sanitizes input strings to strip dangerous HTML tags and escape special characters.
 * This prevents XSS and HTML/CSS injection.
 */
export function sanitizeInput(val: string): string {
  if (typeof val !== 'string') {
    return '';
  }

  // 1. Remove dangerous elements and their children
  let sanitized = val.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
  sanitized = sanitized.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');
  sanitized = sanitized.replace(/<iframe[^>]*>([\s\S]*?)<\/iframe>/gi, '');

  // 2. Strip all other HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // 3. Escape standard HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized.trim();
}
