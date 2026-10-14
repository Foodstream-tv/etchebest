import { en as auth } from './areas/auth';
import { en as base } from './areas/base';
import { en as common } from './areas/common';
import { en as home } from './areas/home';
import { en as profile } from './areas/profile';
import { en as settings } from './areas/settings';
import { en as studio } from './areas/studio';
import { en as live } from './areas/live';
import fr from './fr';
import sharedEn from './shared.en';

type TranslationMessages = {
    [K in keyof typeof fr]: string;
};

const en: TranslationMessages = {
    ...sharedEn,
    ...auth,
    ...base,
    ...common,
    ...home,
    ...profile,
    ...settings,
    ...studio,
    ...live,
};

export default en;
