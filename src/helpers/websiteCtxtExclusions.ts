/** List of websites where our menu should not appear */
const excludedUrls = [
  'web.telegram.org',  // Telegram Web
  // Add other exclusions here as needed, e.g., 'someotherapp.com'
];

/**
 * Check if the current URL matches any in the exclusion list.
 * Returns true if the site is excluded.
 */
export function isCtxtExcludedSite(url: string): boolean {
  return excludedUrls.some((excludedUrl) => url.includes(excludedUrl));
}