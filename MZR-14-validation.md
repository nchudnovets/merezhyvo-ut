# MZR-14 Validation Note

## Automated coverage search
- Command: `rg --files src test tests | rg "SettingsModal|PasswordSettings|settingsModal|password"`
- Result: no `test`/`tests` directory exists; repo search found no existing automated Settings/Passwords test file.
- Explicit finding: `No existing automated Settings/Passwords coverage found in repo search`.

## Manual evidence (three required states)
1. New user (`hasMaster=false`)
- Evidence note: In `src/components/modals/settingsModal/PasswordSettings.tsx`, `showCreateMasterAction` is computed as `statusInfo?.hasMaster === false` and rendered independently from protected controls.
- Expected UI result: `Create master password` button is visible.
- Action/result: Clicking this button calls `handleChangeMasterPassword`, sets `modalVariant` to `create`, and opens `ChangeMasterPasswordModal`.

2. Existing user, locked (`hasMaster=true`, `locked=true`)
- Evidence note: `showUnlockAction` is `hasMaster && isPasswordsLocked`; protected controls require `showProtectedControls = hasMaster && !isPasswordsLocked` and therefore stay hidden when locked.
- Expected UI result: unlock path remains visible, create action is not shown.

3. Existing user, unlocked (`hasMaster=true`, `locked=false`)
- Evidence note: `showProtectedControls = true`, so existing password toggles, change-master action, lock-now action, and manage-passwords entry remain available.
- Expected UI result: existing unlocked behavior remains unchanged.

## Scope confirmation
- Fix remains local to Settings Passwords UI.
- No IPC/storage/contracts changed.
