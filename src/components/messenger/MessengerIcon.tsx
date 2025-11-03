import React from 'react';
import type { MessengerId } from '../../types/models';

type IconProps = {
  size?: number;
  className?: string;
};

const baseProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  role: 'img',
  className
});

export const WhatsAppIcon: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 2a9 9 0 0 0-7.6 13.73L4 22l6.68-1.77A9 9 0 1 0 12 2Zm0 2a7 7 0 1 1 0 14 6.86 6.86 0 0 1-3.3-.85l-.3-.16-3.31.88.9-3.28-.16-.28A7 7 0 0 1 12 4Z" />
    <path d="m9.47 7.84-.16-.26a.9.9 0 0 0-.78-.45h-.14c-.43 0-.87.19-1.07.55-.27.48-.82 1.5-.2 3a8.2 8.2 0 0 0 3.54 3.9 6.6 6.6 0 0 0 3.1.92 1.77 1.77 0 0 0 1.52-.9c.3-.5.36-1.17.07-1.52l-.07-.08c-.23-.2-.7-.43-1.25-.75l-.14-.08c-.42-.24-.94-.54-1.15-.48-.14.04-.25.16-.45.4l-.05.06c-.2.26-.4.51-.56.51-.03 0-.06 0-.09-.02A6.6 6.6 0 0 1 9.9 11c-.55-.65-.9-1.38-.74-1.68s.45-.49.68-.76l.05-.05c.07-.1.15-.2.2-.3.1-.16.1-.34 0-.51l-.62-1.15Z" />
  </svg>
);

export const TelegramIcon: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M21.55 3.15a.9.9 0 0 0-.92-.05L3.7 10.39c-.8.35-.76 1.52.05 1.8l4.27 1.42 1.75 5.33a.9.9 0 0 0 1.6.24l2.1-3.73 4.26 3.6a.9.9 0 0 0 1.45-.52l2.15-13.3a.9.9 0 0 0-.78-1.06Zm-3.26 3.05-7.24 6.63a.8.8 0 0 0-.24.47l-.3 2.36-1.02-3.12a.8.8 0 0 0-.52-.5l-3.16-1.05 11.48-4.86Z" />
  </svg>
);

export const MessengerIconGlyph: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.58 9.83-1.75-1.04a.6.6 0 0 0-.68.06l-1.16.98-1.9-1.56a.6.6 0 0 0-.83.07L7.08 13.3a.3.3 0 0 1-.47-.36l2.08-3.54a.6.6 0 0 1 .88-.18l1.92 1.53a.6.6 0 0 0 .76-.01l2.15-1.82a.6.6 0 0 1 .93.18l1.62 3.1a.3.3 0 0 1-.47.34Z" />
  </svg>
);

export const SnapchatIcon: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 3.2c2.26 0 4.06 1.83 4.06 4.1 0 1.33.55 2.08 1.18 2.74.37.39.24.97-.25 1.22-.62.32-1.44.47-2.15.6-.18.04-.32.2-.32.4v.1c0 .16.1.3.25.37 1.2.52 2.46.93 3.12 1.07a.6.6 0 0 1 .02 1.16c-.46.13-1.08.21-1.74.3-.58.08-1.17.17-1.61.3-.12.04-.23.12-.3.23-.3.42-.7.83-1.07 1.1-.73.56-1.53.89-2.19.89s-1.46-.33-2.19-.9c-.37-.28-.76-.67-1.05-1.1a.6.6 0 0 0-.32-.23c-.43-.13-1.02-.22-1.6-.3-.66-.09-1.29-.17-1.75-.3a.6.6 0 0 1 .02-1.16c.66-.14 1.92-.55 3.12-1.07.15-.07.25-.2.25-.37v-.1c0-.2-.14-.36-.32-.4-.7-.13-1.53-.28-2.15-.6-.5-.25-.62-.83-.26-1.22.64-.66 1.19-1.41 1.19-2.74 0-2.27 1.8-4.1 4.06-4.1Z" />
  </svg>
);

export const BrowserIcon: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 2c1.1 0 2.13.3 3.02.82C14.38 6.63 13.62 8.4 13.44 10h-2.88c-.18-1.6-.94-3.37-1.58-4.18A6.98 6.98 0 0 1 12 5Zm-4.4 1.57c.67.98 1.33 2.63 1.53 3.93H5.14a7 7 0 0 1 2.46-3.93ZM5.03 13h4.1c-.2 1.29-.86 2.92-1.52 3.9A7 7 0 0 1 5.03 13Zm4.53 0h4.88c-.23 1.86-1.15 3.87-1.9 4.65-.3.05-.6.08-.94.08s-.64-.03-.94-.08c-.75-.78-1.67-2.79-1.1-4.65Zm5.31 3.9c.6-.86 1.23-2.37 1.45-3.9h2.37a7 7 0 0 1-3.82 3.9Zm1.45-5.9c-.2-1.5-.83-3.02-1.42-3.94a7 7 0 0 1 3.78 3.94Z" />
  </svg>
);

export const MessengerIcon: React.FC<{ id: MessengerId; size?: number; className?: string }> = ({ id, size, className }) => {
  switch (id) {
    case 'whatsapp':
      return <WhatsAppIcon size={size} className={className} />;
    case 'telegram':
      return <TelegramIcon size={size} className={className} />;
    case 'messenger':
      return <MessengerIconGlyph size={size} className={className} />;
    case 'snapchat':
    default:
      return <SnapchatIcon size={size} className={className} />;
  }
};
