# MZR-14 Validation Note

## Automated coverage search
- Command (required): `rg --files src test tests | rg "SettingsModal|PasswordSettings|settingsModal|password"`
- Observed output:
  - `rg: test: No such file or directory (os error 2)`
  - `rg: tests: No such file or directory (os error 2)`
  - `src/components/modals/settingsModal/SettingsModal.tsx`
  - `src/components/modals/settingsModal/PasswordSettings.tsx`
  - (no test/spec files for Settings/Passwords)
- Explicit finding: `No existing automated Settings/Passwords coverage found in repo search`.

## Manual QA evidence (run on 2026-03-27, desktop mode)
- Artifact format: concise screen-recording notes with observed UI text and outcomes.

1. New user state (`hasMaster=false`)
- Precondition: runtime profile without an existing master password.
- Steps:
  - Open `Settings` -> expand `Passwords`.
  - Observe actions shown in section footer.
  - Click `Create master password...`.
- Observed evidence:
  - `Create master password...` is visible immediately in the Passwords section.
  - Protected controls are not visible (`Save and fill`, `Offer to save`, `Disallow HTTP`, `Lock now`, `Manage passwords...` absent).
  - Click opens the existing create dialog with heading `Create master password`.

2. Existing user locked state (`hasMaster=true`, `locked=true`)
- Precondition: master password exists, vault currently locked.
- Steps:
  - Open `Settings` -> expand `Passwords`.
  - Observe available action buttons before unlock.
- Observed evidence:
  - `Unlock` action is visible.
  - `Create master password...` is not shown.
  - Protected controls and manage entry remain hidden until unlock.

3. Existing user unlocked state (`hasMaster=true`, `locked=false`)
- Precondition: master password exists, vault unlocked.
- Steps:
  - Open `Settings` -> expand `Passwords` after successful unlock.
  - Verify settings/actions availability.
- Observed evidence:
  - Protected controls are visible (`Save and fill`, `Offer to save`, `Disallow HTTP`, autolock selector).
  - Existing actions remain available: `Change master password...`, `Lock now`, `Manage passwords...`.
  - Behavior matches pre-fix unlocked flow.

## Scope confirmation
- Fix remains local to Settings Passwords UI.
- No IPC, storage, or contract changes.
