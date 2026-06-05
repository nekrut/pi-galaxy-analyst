# Releasing Orbit

This repo ships Orbit as platform-specific installer artifacts via electron-forge,
triggered by pushing a git tag.

## Quick path

```bash
# 1. Bump the version in app/package.json (semver).
#    Use `0.1.0-alpha.N` while the app is in alpha.
$EDITOR app/package.json

# 2. Commit + tag + push.
git add app/package.json
git commit -m "release: v0.1.0-alpha.1"
git tag v0.1.0-alpha.1
git push origin main
git push origin v0.1.0-alpha.1
```

The `release` workflow (`.github/workflows/release.yml`) fires on any pushed
`v*` tag. It runs `electron-forge make` on a macOS arm64 runner and a macOS
x64 runner, then attaches both DMGs (and matching `.zip` archives) to a
**draft** GitHub Release. Review the draft and publish manually when ready.

## What gets built

| Runner         | Arch  | Artifacts                                                                                  |
| -------------- | ----- | ------------------------------------------------------------------------------------------ |
| macos-latest   | arm64 | `Orbit-<version>-arm64.dmg`, `Orbit-darwin-arm64-<version>.zip`                            |
| macos-26-intel | x64   | `Orbit-<version>-x64.dmg`, `Orbit-darwin-x64-<version>.zip`                                |
| ubuntu-latest  | x64   | `orbit_<version>_amd64.deb`, `orbit-<version>.x86_64.rpm`, `Orbit-linux-x64-<version>.zip` |
| windows-latest | x64   | `Orbit-<version> Setup.exe`                                                                |

The macOS builds run on native GitHub runners -- no cross-compilation, no universal binary.
The Linux build produces `.deb`, `.rpm`, and `.zip` for x64.
The Windows build produces a Squirrel installer (`Setup.exe`) -- it runs **remote-only**:
all execution routes to Galaxy and there is no local bash shell. WSL2 with WSLg
remains the path for local execution on Windows until a native local power mode lands.

## Code signing

**Current state: unsigned.** Both DMGs ship without an Apple Developer ID
signature, so first-launch on a tester's Mac triggers Gatekeeper:

> "Orbit can't be opened because Apple cannot check it for malicious software."

Workaround documented in [INSTALL.md](INSTALL.md): right-click the app in
Applications → Open → confirm. Gatekeeper then remembers the choice.

This is acceptable for alpha distribution. When the project takes on an
Apple Developer ID ($99/yr), we will wire `osxSign` + `osxNotarize` blocks
into `app/forge.config.ts` and add the matching secrets to the release
workflow.

## Local make (developer sanity check)

To produce a DMG locally on macOS without going through CI:

```bash
cd app
npm ci
npx electron-forge make --arch=arm64    # or --arch=x64
```

Output lands in `app/out/make/`. The DMG is not signed by this path either.

## Version-check banner

Orbit reads `https://api.github.com/repos/galaxyproject/loom/releases/latest`
on startup, caches the result for 24h in `~/.orbit/version-check.json`, and
shows a non-blocking banner if the latest tag is newer than
`app.getVersion()`. The banner has a per-version dismiss that clears once a
newer release lands.

Cutting a new release therefore automatically prompts existing users to
upgrade — no auto-install (unsigned macOS apps can't be patched by
Squirrel.Mac), just a link to the Releases page.

## Cutting a test release

To exercise the release workflow without burning a real version, push a tag
on a throwaway pattern and delete it after:

```bash
git tag v0.0.0-mac-test
git push origin v0.0.0-mac-test
# Watch .github/workflows/release.yml run. Verify both DMGs attach to the
# draft Release.
git tag -d v0.0.0-mac-test
git push origin :refs/tags/v0.0.0-mac-test
# Then delete the draft Release in the GitHub UI.
```
