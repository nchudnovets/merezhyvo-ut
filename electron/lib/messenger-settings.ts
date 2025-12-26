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

export async function updateMessengerSettings(payload: Partial<MessengerSettings>): Promise<MessengerSettings> {
  const sanitizedOrder = 'order' in payload ? sanitizeMessengerOrder(payload.order) : undefined;
  const hideToolbar = typeof payload.hideToolbar === 'boolean' ? payload.hideToolbar : undefined;
  const state: SettingsState = await readSettingsState();
  const nextMessenger = sanitizeMessengerSettings({
    order: sanitizedOrder ?? state?.messenger?.order,
    hideToolbar: hideToolbar ?? state?.messenger?.hideToolbar
  });
  const nextState: SettingsState = {
    ...state,
    messenger: nextMessenger
  };
  await writeSettingsState(nextState);
  return nextMessenger;
}
