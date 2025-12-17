import { useCallback, useEffect, useState } from 'react';
import type {
  PasswordStatus,
  PasswordPromptPayload,
  PasswordCaptureAction
} from '../types/models';
import type { PasswordUnlockPayload } from '../components/modals/PasswordUnlockModal';

type UsePasswordFlowsParams = {
  t: (key: string) => string;
  showGlobalToast: (msg: string) => void;
  closeSettingsModal: () => void;
  openSettingsModal: () => void;
  setSettingsScrollTarget: (target: 'passwords' | null) => void;
};

export const usePasswordFlows = ({
  t,
  showGlobalToast,
  closeSettingsModal,
  openSettingsModal,
  setSettingsScrollTarget
}: UsePasswordFlowsParams) => {
  const [passwordStatus, setPasswordStatus] = useState<PasswordStatus | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<PasswordPromptPayload | null>(null);
  const [passwordPromptBusy, setPasswordPromptBusy] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [unlockPayload, setUnlockPayload] = useState<PasswordUnlockPayload | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);
  const [pendingSettingsReopen, setPendingSettingsReopen] = useState(false);

  const fetchPasswordStatus = useCallback(async (): Promise<PasswordStatus | null> => {
    const api = window.merezhyvo?.passwords;
    if (!api) {
      setPasswordStatus(null);
      return null;
    }
    try {
      const info = await api.status();
      setPasswordStatus(info);
      return info;
    } catch {
      setPasswordStatus(null);
      return null;
    }
  }, []);

  const requestPasswordUnlock = useCallback(
    (fromSettings = false) => {
      closeSettingsModal();
      void fetchPasswordStatus();
      setUnlockPayload(null);
      setUnlockError(null);
      setShowUnlockModal(true);
      setPendingSettingsReopen(fromSettings);
    },
    [closeSettingsModal, fetchPasswordStatus]
  );

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      const detail = (event as CustomEvent<PasswordPromptPayload>).detail;
      setPasswordPrompt(detail);
    };
    window.addEventListener('merezhyvo:pw:prompt', handlePrompt as EventListener);
    return () => window.removeEventListener('merezhyvo:pw:prompt', handlePrompt as EventListener);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PasswordUnlockPayload>).detail ?? null;
      void fetchPasswordStatus();
      setUnlockPayload(detail);
      setUnlockError(null);
      setShowUnlockModal(true);
    };
    window.addEventListener('merezhyvo:pw:unlock-required', handler as EventListener);
    return () => window.removeEventListener('merezhyvo:pw:unlock-required', handler as EventListener);
  }, [fetchPasswordStatus]);

  useEffect(() => {
    void fetchPasswordStatus();
  }, [fetchPasswordStatus]);

  const handlePasswordPromptAction = useCallback(
    async (action: PasswordCaptureAction) => {
      if (!passwordPrompt) return;
      const api = window.merezhyvo?.passwords;
      if (!api) {
        showGlobalToast('Unable to reach passwords service');
        return;
      }
      setPasswordPromptBusy(true);
      try {
        const result = await api.captureAction({
          captureId: passwordPrompt.captureId,
          action,
          entryId: passwordPrompt.entryId
        });
        if (result?.ok) {
          if (action === 'update') {
            showGlobalToast('Password updated');
          } else if (action === 'never') {
            showGlobalToast('This site will not ask again');
          } else {
            showGlobalToast('Password saved');
          }
          setPasswordPrompt(null);
        } else {
          showGlobalToast(result?.error ?? 'Unable to save password');
        }
      } catch {
        showGlobalToast('Unable to save password');
      } finally {
        setPasswordPromptBusy(false);
      }
    },
    [passwordPrompt, showGlobalToast]
  );

  const handlePasswordPromptClose = useCallback(() => {
    setPasswordPrompt(null);
    setPasswordPromptBusy(false);
  }, []);

  const closeUnlockModal = useCallback(() => {
    setShowUnlockModal(false);
    setUnlockError(null);
  }, []);

  const handlePasswordUnlock = useCallback(
    async (master: string, durationMinutes?: number) => {
      const api = window.merezhyvo?.passwords;
      if (!api) {
        setUnlockError(t('passwordUnlock.error.unavailable'));
        return false;
      }
      setUnlockSubmitting(true);
      setUnlockError(null);
      try {
        const result = await api.unlock(master, durationMinutes);
        if (result?.ok) {
          await fetchPasswordStatus();
          setShowUnlockModal(false);
          setUnlockPayload(null);
          if (pendingSettingsReopen) {
            setPendingSettingsReopen(false);
            setSettingsScrollTarget('passwords');
            setTimeout(() => {
              openSettingsModal();
            }, 0);
          }
          window.dispatchEvent(new CustomEvent('merezhyvo:pw:unlocked'));
          return true;
        }
        setUnlockError(t('passwordUnlock.error.invalid'));
        return false;
      } catch {
        setUnlockError(t('passwordUnlock.error.generic'));
        return false;
      } finally {
        setUnlockSubmitting(false);
      }
    },
    [fetchPasswordStatus, openSettingsModal, pendingSettingsReopen, setSettingsScrollTarget, t]
  );

  return {
    passwordStatus,
    passwordPrompt,
    passwordPromptBusy,
    showUnlockModal,
    unlockPayload,
    unlockError,
    unlockSubmitting,
    requestPasswordUnlock,
    handlePasswordPromptAction,
    handlePasswordPromptClose,
    handlePasswordUnlock,
    closeUnlockModal
  };
};
