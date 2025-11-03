import type { MessengerDefinition, MessengerId, MessengerSettings } from '../types/models';

export const DEFAULT_MESSENGERS: MessengerDefinition[] = [
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    url: 'https://web.whatsapp.com'
  },
  {
    id: 'telegram',
    title: 'Telegram',
    url: 'https://web.telegram.org'
  },
  {
    id: 'messenger',
    title: 'Messenger',
    url: 'https://www.messenger.com'
  }
] as const;

export const DEFAULT_MESSENGER_ORDER: MessengerId[] = DEFAULT_MESSENGERS.map((item) => item.id);

const messengerIdSet = new Set<MessengerId>(DEFAULT_MESSENGER_ORDER);

export const isMessengerId = (value: unknown): value is MessengerId =>
  typeof value === 'string' && messengerIdSet.has(value as MessengerId);

export const sanitizeMessengerOrder = (raw: unknown): MessengerId[] => {
  if (!Array.isArray(raw)) return [...DEFAULT_MESSENGER_ORDER];
  const seen = new Set<MessengerId>();
  const order: MessengerId[] = [];
  for (const candidate of raw) {
    if (isMessengerId(candidate) && !seen.has(candidate)) {
      seen.add(candidate);
      order.push(candidate);
    }
  }
  if (order.length === 0) {
    return [...DEFAULT_MESSENGER_ORDER];
  }
  for (const fallback of DEFAULT_MESSENGER_ORDER) {
    if (!seen.has(fallback)) {
      order.push(fallback);
      seen.add(fallback);
    }
  }
  return order;
};

export const sanitizeMessengerSettings = (raw: unknown): MessengerSettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as { order?: unknown } : {};
  const order = sanitizeMessengerOrder(source.order);
  return { order };
};

export const buildMessengerSettings = (order: MessengerId[] | null | undefined): MessengerSettings => {
  const sanitized = sanitizeMessengerOrder(order);
  return { order: sanitized };
};

export const getMessengerDefinitionsById = (): Record<MessengerId, MessengerDefinition> => {
  const map: Partial<Record<MessengerId, MessengerDefinition>> = {};
  for (const item of DEFAULT_MESSENGERS) {
    map[item.id] = item;
  }
  return map as Record<MessengerId, MessengerDefinition>;
};

export const resolveOrderedMessengers = (settings: MessengerSettings | null | undefined): MessengerDefinition[] => {
  const order = sanitizeMessengerOrder(settings?.order ?? null);
  const byId = getMessengerDefinitionsById();
  return order.map((id) => byId[id]).filter(Boolean);
};

export const ensureMessengerOrder = (order: MessengerId[]): MessengerId[] => sanitizeMessengerOrder(order);

export type { MessengerId, MessengerDefinition, MessengerSettings };
