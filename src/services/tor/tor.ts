import type { TorClearResult, TorIpResult, TorState, Unsubscribe } from '../../types/models';
import { ipc } from '../ipc/ipc';

type TorStateHandler = (enabled: boolean, reason: string | null) => void;

export const torService = {
  toggle(): Promise<TorState | null> {
    return ipc.tor.toggle();
  },
  getState(): Promise<TorState | null> {
    return ipc.tor.getState();
  },
  getIp(): Promise<TorIpResult> {
    return ipc.tor.getIp();
  },
  clearSession(): Promise<TorClearResult> {
    return ipc.tor.clearSession();
  },
  subscribe(handler: TorStateHandler): Unsubscribe {
    return ipc.tor.onState(handler);
  },
  checkUrl: 'https://check.torproject.org/'
};
