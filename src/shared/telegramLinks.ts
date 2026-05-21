const TELEGRAM_LINK_HOSTS = new Set([
  't.me',
  'telegram.me',
  'telegram.dog'
]);

export function isTelegramDeepLink(rawUrl: string | null | undefined): boolean {
  const input = String(rawUrl || '').trim();
  if (!input) return false;
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return TELEGRAM_LINK_HOSTS.has(host);
  } catch {
    return false;
  }
}
