/**
 * localStorage Key Migration
 *
 * One-time migration from legacy `ysl-*` keys to `oft-*` keys.
 * Runs on app startup. Copies data to new keys, removes old keys,
 * then sets a flag so it never runs again.
 *
 * Safe to delete this file after a few months once all users have migrated.
 */

const MIGRATION_FLAG = 'oft-ls-migration-done';

const KEY_MAP: Record<string, string> = {
  'ysl-exit-plans': 'oft-exit-plans',
  'ysl-plan-basis-configs': 'oft-plan-basis-configs',
  'ysl-logo-cache': 'oft-logo-cache',
  'ysl-active-tab': 'oft-active-tab',
  'ysl-strategy-templates': 'oft-strategy-templates',
  'ysl-name-prompt-skipped': 'oft-name-prompt-skipped',
  'ysl-local-profile': 'oft-local-profile',
  'ysl-logo-images-seeded-v1': 'oft-logo-images-seeded-v1',
};

/** Prefix-based migrations for dynamic keys like `yslfolio:categoryState:*` */
const PREFIX_MAP: Array<{ oldPrefix: string; newPrefix: string }> = [
  { oldPrefix: 'yslfolio:categoryState', newPrefix: 'oft:categoryState' },
];

export function runLocalStorageMigration(): void {
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return;

    let migrated = 0;

    // Exact-key migrations
    for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
      const value = localStorage.getItem(oldKey);
      if (value !== null) {
        localStorage.setItem(newKey, value);
        localStorage.removeItem(oldKey);
        migrated++;
      }
    }

    // Prefix-based migrations
    for (const { oldPrefix, newPrefix } of PREFIX_MAP) {
      const keysToMigrate: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(oldPrefix)) {
          keysToMigrate.push(key);
        }
      }
      for (const oldKey of keysToMigrate) {
        const suffix = oldKey.slice(oldPrefix.length);
        const newKey = newPrefix + suffix;
        const value = localStorage.getItem(oldKey);
        if (value !== null) {
          localStorage.setItem(newKey, value);
          localStorage.removeItem(oldKey);
          migrated++;
        }
      }
    }

    localStorage.setItem(MIGRATION_FLAG, '1');

    if (migrated > 0) {
      console.log(`[Migration] Migrated ${migrated} localStorage key(s) from ysl-* to oft-*`);
    }
  } catch (e) {
    console.warn('[Migration] localStorage migration failed:', e);
  }
}
