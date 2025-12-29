import type { Mode } from './models';

export type NavigationState = {
  back?: boolean;
  forward?: boolean;
};

export type CreateWebviewOptions = {
  zoom: number;
  mode: Mode;
};
