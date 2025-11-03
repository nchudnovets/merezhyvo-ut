import {
  readSettingsState,
  writeSettingsState,
  type SettingsState
} from './shortcuts';
import {
  sanitizeMessengerSettings,
  type MessengerSettings,
  sanitizeMessengerOrder
} from '../../src/shared/messengers';

export async function getMessengerSettings(): Promise<MessengerSettings> {
  const state = await readSettingsState();
  return sanitizeMessengerSettings(state?.messenger);
}

export async function updateMessengerOrder(order: MessengerSettings['order']): Promise<MessengerSettings> {
  const sanitizedOrder = sanitizeMessengerOrder(order);
  const state: SettingsState = await readSettingsState();
  const nextMessenger = sanitizeMessengerSettings({ order: sanitizedOrder });
  const nextState: SettingsState = {
    ...state,
    messenger: nextMessenger
  };
  await writeSettingsState(nextState);
  return nextMessenger;
}
