import { fr as auth } from './areas/auth';
import { fr as base } from './areas/base';
import { fr as common } from './areas/common';
import { fr as home } from './areas/home';
import { fr as profile } from './areas/profile';
import { fr as settings } from './areas/settings';
import { fr as studio } from './areas/studio';
import { fr as live } from './areas/live';
import sharedFr from './shared.fr';

/**
 * Wording shared with the web (generated, see scripts/sync-i18n.mjs) overridden by
 * mobile-only keys. English lives in ./en.ts and must define exactly the same keys.
 */
const fr = {
    ...sharedFr,
    ...auth,
    ...base,
    ...common,
    ...home,
    ...profile,
    ...settings,
    ...studio,
    ...live,
} as const;

export default fr;
