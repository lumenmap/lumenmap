# Main Branch Protection

The `main` branch is protected by an active branch protection rule.

## Policy

- All changes to `main` must arrive through a pull request.
- At least one approving review is required.
- Review threads must be resolved before merge.
- Required status checks must pass and must be current with `main`.
- Force pushes and branch deletion are blocked.
- Administrators follow the same rules. `enforce_admins` is enabled.

Emergency recovery requires temporarily editing branch protection in GitHub repository settings, recording the reason in the incident or maintenance issue, restoring branch protection immediately after recovery, and linking the audit-log entry in the follow-up.

## Required Checks

The deterministic check from issue #9 is required by exact check context name:

- `quality`

If issue #9 renames the workflow job, update the `REQUIRED_CHECKS` value before applying branch protection so the name matches the active GitHub Checks context.

## Apply

Use a token with repository `Administration: write` permission.

```powershell
$env:GITHUB_TOKEN = "<token>"
npm run protect:main
```

For forks or renamed repositories:

```powershell
$env:GITHUB_OWNER = "lumenmap"
$env:GITHUB_REPO = "lumenmap"
$env:PROTECTED_BRANCH = "main"
$env:REQUIRED_CHECKS = "quality"
npm run protect:main
```

Preview the payload without contacting GitHub:

```powershell
npm run protect:main -- --dry-run
```

## Verification

After applying branch protection, inspect the active GitHub response printed by the script. It should show required status checks, `enforce_admins.enabled: true`, pull request review requirements, `allow_force_pushes.enabled: false`, and `allow_deletions.enabled: false` for `main`.

Then use a test pull request:

- Push a branch with a deliberately failing required check and confirm GitHub blocks merge.
- Push a branch with all required checks passing and confirm merge is available through the normal review path.
- Confirm direct pushes to `main`, force pushes, and branch deletion are rejected by normal maintainer credentials.


