/** List of websites where our menu should not appear */
const excludedUrls = [
  'web.telegram.org',
];

type CtxtExclusionOptions = {
  isEditable?: boolean;
};

export function isCtxtExcludedSite(url: string, options: CtxtExclusionOptions = {}): boolean {
  const { isEditable = false } = options;
  const lowered = String(url || '').toLowerCase();
  const isExcluded = excludedUrls.some((excludedUrl) => lowered.includes(excludedUrl));
  if (!isExcluded) return false;

  // Keep Telegram Web excluded in general, but allow our menu in editable fields
  // so copy/paste works in the message composer.
  if (isEditable && lowered.includes('web.telegram.org')) {
    return false;
  }

  return true;
}
