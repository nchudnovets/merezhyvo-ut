import type { TorState, Unsubscribe } from '../../types/models';
import { ipc } from '../ipc/ipc';

type TorStateHandler = (enabled: boolean, reason: string | null) => void;

export const torService = {
  toggle(): Promise<TorState | null> {
    return ipc.tor.toggle();
  },
  getState(): Promise<TorState | null> {
    return ipc.tor.getState();
  },
  subscribe(handler: TorStateHandler): Unsubscribe {
    return ipc.tor.onState(handler);
  },
  checkUrl: 'https://check.torproject.org/'
};
