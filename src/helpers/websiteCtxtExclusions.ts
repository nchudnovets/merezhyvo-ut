/** List of websites where our menu should not appear */
const excludedUrls = [
  'web.telegram.org',
];

export function isCtxtExcludedSite(url: string): boolean {
  return excludedUrls.some((excludedUrl) => url.includes(excludedUrl));
}