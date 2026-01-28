# NPM DevDependencies Issue - RESOLVED

## Root Cause
The npm installation was skipping devDependencies (including Vite) due to:

1. **`NODE_ENV=production`** was set in the shell environment
2. **`npm config get omit`** returned `dev` - meaning npm was configured to omit devDependencies

### Evidence (from diagnostic commands):
```
NODE_ENV=production
npm config get omit → dev
npm config list -l | grep omit → omit = ["dev"]
```

This caused `npm install` to only install 59 packages (dependencies only) instead of ~160 packages (deps + devDeps).

## How to Reproduce the Failure
```bash
cd /Users/robertripley/coding/YSLfolioTracker/frontend
export NODE_ENV=production
rm -rf node_modules package-lock.json .npmrc
npm install
ls node_modules/vite  # Will show "No such file or directory"
npm run build         # Will fail with "Cannot find module 'vite'"
```

## The Fix
Created `/Users/robertripley/coding/YSLfolioTracker/frontend/.npmrc` with:
```
# Ensure devDependencies are always installed regardless of NODE_ENV
include=dev
```

This forces npm to always include devDependencies during install, regardless of NODE_ENV.

## Verification Steps (all must pass)
```bash
cd /Users/robertripley/coding/YSLfolioTracker/frontend
rm -rf node_modules package-lock.json
NODE_ENV=production npm install
ls node_modules/vite/package.json   # Should exist
npx vite --version                   # Should show vite/5.4.21
npm run build                        # Should succeed
```

## Prevention Notes
- **Always check**: If builds fail with "Cannot find module X" where X is a devDependency, check:
  - `echo $NODE_ENV`
  - `npm config get omit`
  - Whether `.npmrc` exists with proper settings
- **Keep the `.npmrc`**: Don't delete it - it's part of the project configuration
- **CI/CD**: Ensure CI environments also have `include=dev` in `.npmrc` or use `npm install --include=dev` explicitly

## Date Resolved
January 28, 2025
