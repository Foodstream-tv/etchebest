import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useI18n } from '@/contexts/LanguageContext';
import authService from '@/services/auth';
import { formatBanMessage, onSessionTerminated } from '@/services/session';
import { toast } from '@/utils/toast';

/**
 * Mounted once in the root layout (web: SessionGuard). When the HTTP client reports
 * a revoked token or a banned account, the user is told why and sent to the login screen.
 */
export default function SessionGuard() {
    const router = useRouter();
    const { t, locale } = useI18n();
    const handledRef = useRef(false);
    const tRef = useRef({ t, locale });

    useEffect(() => {
        tRef.current = { t, locale };
    });

    useEffect(() => {
        return onSessionTerminated(async (detail) => {
            // Several requests can fail at once; only react to the first one.
            if (handledRef.current) return;
            handledRef.current = true;

            await authService.logout();

            const { t: translate, locale: currentLocale } = tRef.current;
            if (detail.reason === 'banned') {
                toast.error(`${translate('session.bannedTitle')} — ${formatBanMessage(detail.bannedUntil, currentLocale)}`, {
                    position: 'top',
                    force: true,
                });
            } else {
                toast.warning(translate('session.expiredMessage'), { position: 'top', force: true });
            }

            router.replace('/login' as never);
            // Re-arm for the next session.
            setTimeout(() => {
                handledRef.current = false;
            }, 1500);
        });
    }, [router]);

    return null;
}
