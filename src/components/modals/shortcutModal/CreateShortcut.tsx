import React, {
  CSSProperties,
  RefObject,
  PointerEvent,
  FocusEvent,
  ChangeEvent,
  MouseEvent,
  FormEvent
} from 'react';
import type { Mode } from '../../../types/models';
import { shortcutModalStyles } from './createShortcutStyles';

interface CreateShortcutProps {
  mode: Mode;
  modalBackdropStyle: CSSProperties;
  shortcutCompleted: boolean;
  shortcutSuccessMsg: string;
  busy: boolean;
  msg: string;
  title: string;
  shortcutUrl: string;
  modalTitleInputRef: RefObject<HTMLInputElement | null>;
  modalUrlInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onCreateShortcut: () => void;
  onTitleChange: (value: string) => void;
  onShortcutUrlChange: (value: string) => void;
  onTitlePointerDown: (event: PointerEvent<HTMLInputElement>) => void;
  onTitleFocus: (event: FocusEvent<HTMLInputElement>) => void;
  onTitleBlur: (event: FocusEvent<HTMLInputElement>) => void;
  onUrlPointerDown: (event: PointerEvent<HTMLInputElement>) => void;
  onUrlFocus: (event: FocusEvent<HTMLInputElement>) => void;
  onUrlBlur: (event: FocusEvent<HTMLInputElement>) => void;
}

const CreateShortcut: React.FC<CreateShortcutProps> = ({
  mode,
  modalBackdropStyle,
  shortcutCompleted,
  shortcutSuccessMsg,
  busy,
  msg,
  title,
  shortcutUrl,
  modalTitleInputRef,
  modalUrlInputRef,
  onClose,
  onCreateShortcut,
  onTitleChange,
  onShortcutUrlChange,
  onTitlePointerDown,
  onTitleFocus,
  onTitleBlur,
  onUrlPointerDown,
  onUrlFocus,
  onUrlBlur
}) => {
  const styles = shortcutModalStyles;
  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!busy) {
      onCreateShortcut();
    }
  };

  const containerStyle = mode === 'mobile' ? styles.modalMobile : styles.modal;
  const headerStyle = mode === 'mobile' ? styles.modalHeaderMobile : styles.modalHeader;
  const titleStyle = mode === 'mobile' ? styles.modalTitleMobile : styles.modalTitle;
  const closeButtonStyle = mode === 'mobile' ? styles.modalCloseMobile : styles.modalClose;
  const bodyStyle = mode === 'mobile' ? styles.modalBodyMobile : styles.modalBody;
  const formStyle = mode === 'mobile' ? styles.modalFormMobile : styles.modalForm;
  const fieldStyle = mode === 'mobile' ? styles.modalFieldMobile : styles.modalField;
  const labelStyle = mode === 'mobile' ? styles.modalLabelMobile : styles.modalLabel;
  const inputStyle = mode === 'mobile' ? styles.modalInputMobile : styles.modalInput;
  const actionsStyle = mode === 'mobile' ? styles.modalActionsMobile : styles.modalActions;
  const buttonStyle = mode === 'mobile' ? styles.modalButtonMobile : styles.modalButton;
  const primaryButtonStyle =
    mode === 'mobile' ? styles.modalButtonPrimaryMobile : styles.modalButtonPrimary;
  const disabledButtonStyle =
    mode === 'mobile' ? styles.modalButtonDisabledMobile : styles.modalButtonDisabled;
  const messageStyle = mode === 'mobile' ? styles.modalMsgMobile : styles.modalMsg;

  return (
    <div style={modalBackdropStyle} onClick={handleBackdropClick}>
      <div style={containerStyle} role="dialog" aria-modal="true" aria-labelledby="shortcut-modal-title">
        <div style={headerStyle}>
          <h2 id="shortcut-modal-title" style={titleStyle}>
            {shortcutCompleted ? 'Shortcut Saved' : 'Create App Shortcut'}
          </h2>

          <button type="button" aria-label="Close shortcut dialog" style={closeButtonStyle} onClick={onClose}>
            ✕
          </button>
        </div>
        {shortcutCompleted ? (
          <>
            <p style={bodyStyle}>
              {shortcutSuccessMsg ||
                'Shortcut saved successfully. You can now open your new web application from the app launcher.'}
            </p>
            <div style={actionsStyle}>
              <button
                type="button"
                style={{
                  ...buttonStyle,
                  ...primaryButtonStyle
                }}
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={bodyStyle}>
              You are about to save this page as a separate application.
              <br />
              Update the save URL for the application as needed.
            </p>
            <form style={formStyle} onSubmit={handleSubmit}>
              <div style={fieldStyle}>
                <label htmlFor="shortcut-title" style={labelStyle}>
                  Title
                </label>
                <input
                  id="shortcut-title"
                  ref={modalTitleInputRef}
                  type="text"
                  value={title}
                  onPointerDown={onTitlePointerDown}
                  onFocus={onTitleFocus}
                  onBlur={onTitleBlur}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onTitleChange(event.target.value)}
                  style={inputStyle}
                  disabled={busy}
                />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="shortcut-url" style={labelStyle}>
                  URL
                </label>
                <input
                  id="shortcut-url"
                  ref={modalUrlInputRef}
                  type="url"
                  value={shortcutUrl}
                  onPointerDown={onUrlPointerDown}
                  onFocus={onUrlFocus}
                  onBlur={onUrlBlur}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    onShortcutUrlChange(event.target.value)
                  }
                  style={inputStyle}
                  disabled={busy}
                />
              </div>

              {msg && (
                <div style={messageStyle} role="status">
                  {msg}
                </div>
              )}

              <div style={actionsStyle}>
                <button type="button" style={buttonStyle} onClick={onClose}>
                  Close
                </button>
                <button
                  type="submit"
                  style={{
                    ...buttonStyle,
                    ...primaryButtonStyle,
                    ...(busy ? disabledButtonStyle : null)
                  }}
                  disabled={busy}
                >
                  {busy ? 'Creating…' : 'Create Shortcut'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateShortcut;
