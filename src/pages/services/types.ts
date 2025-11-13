import type { Mode } from '../../types/models';

export type ServicePageProps = {
  mode: Mode;
  openInNewTab: (url: string) => void;
};
