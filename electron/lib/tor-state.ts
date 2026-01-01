'use strict';

export type TorState = {
  enabled: boolean;
  starting: boolean;
  reason: string | null;
};

let torState: TorState = { enabled: false, starting: false, reason: null };

export const getTorState = (): TorState => ({ ...torState });

export const setTorState = (next: TorState): void => {
  torState = { ...next };
};

export const updateTorState = (patch: Partial<TorState>): TorState => {
  torState = { ...torState, ...patch };
  return getTorState();
};
