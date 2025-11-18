import React, { type ReactNode, useEffect, useState } from 'react';

import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
// import { styles as baseStyles } from '../../../styles/styles';
import type { Mode } from '../../../types/models';

type settingsSectionProps = {
  mode: Mode;
  title: string;
  body: ReactNode;
  expandedDefault?: boolean;
  forceExpanded?: boolean;
  sectionRef?: React.RefObject<HTMLElement | null>;
};

export const SettingsSection: React.FC<settingsSectionProps> = ({
  mode,
  title,
  body,
  expandedDefault=false,
  forceExpanded,
  sectionRef
}) => {
  const [expanded, setExpanded] = useState<boolean>(expandedDefault);

  useEffect(() => {
    if (forceExpanded) {
      setExpanded(true);
    }
  }, [forceExpanded]);

  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  
  

  return (
    <section
      ref={sectionRef}
      style={{
      ...styles.block,
      ...(modeStyles.settingsBlock || {})
    }}>
      <div style={styles.blockHeader}>
        <h3
          style={{
            ...styles.blockTitle,
            ...(modeStyles.settingsBlockTitle || {})
          }}
        >
          {title}
        </h3>
        <div
          style={{
            ...styles.blockHeaderActions,
            ...(modeStyles.settingsBlockHeaderActions || {})
          }}
        >
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            style={{
              ...styles.blockToggleButton,
              ...(modeStyles.settingsBlockToggleButton || {})
            }}
          >
            {
              expanded
                ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                    {/* <!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--> */}
                    <path fill="#ffffff" d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z"/>
                  </svg>
                : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                    {/* <!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--> */}
                    <path fill="#ffffff" d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z"/>
                  </svg>
            }
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{
          ...styles.blockBody,
          ...(modeStyles.settingsBlockBody || {})
        }}>
          { body }
        </div>
      )}
    </section>
  );
};

export default SettingsSection;
