import type { Mode } from '../../types/models';

export type ServicePageProps = {
  mode: Mode;
  openInTab: (url: string) => void;
  openInNewTab: (url: string) => void;
  serviceUrl?: string;
  onClose?: () => void;
};
