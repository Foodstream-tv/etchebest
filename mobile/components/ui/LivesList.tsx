import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { LivesFeed } from '@/hooks/useLivesFeed';
import { LiveDTO } from '@/services/lives';

import Button from './Button';
import Card from './Card';
import LiveCard from './LiveCard';
import Skeleton from './Skeleton';
import { EmptyState, ErrorState } from './States';

type LivesListProps = {
    feed: LivesFeed;
    onOpen: (live: LiveDTO) => void;
    header: React.ReactElement;
    emptyTitle: string;
    emptyDescription: string;
    emptyIcon?: React.ComponentProps<typeof EmptyState>['icon'];
    /** Bottom padding to clear a floating element */
    testID?: string;
};

/** Shared list body of the Lives and Replays tabs: skeletons, error, empty, pagination, pull-to-refresh. */
export default function LivesList({ feed, onOpen, header, emptyTitle, emptyDescription, emptyIcon, testID }: Readonly<LivesListProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();

    let body: React.ReactElement | null = null;
    if (feed.loading) {
        body = (
            <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
                {[0, 1, 2].map((key) => (
                    <Card key={key}>
                        <Skeleton height={170} radius={0} />
                        <View style={styles.skeletonBody}>
                            <Skeleton height={16} width="70%" />
                            <Skeleton height={12} width="40%" />
                        </View>
                    </Card>
                ))}
            </View>
        );
    } else if (feed.error && feed.lives.length === 0) {
        body = (
            <Card>
                <ErrorState title={t('watch.loadError')} error={feed.errorCause ?? feed.error} onRetry={() => void feed.refresh()} testID="feed-error" />
            </Card>
        );
    } else if (feed.lives.length === 0) {
        body = (
            <Card>
                <EmptyState icon={emptyIcon ?? 'videocam-outline'} title={emptyTitle} description={emptyDescription} testID="feed-empty" />
            </Card>
        );
    }

    return (
        <FlatList
            testID={testID}
            data={body ? [] : feed.lives}
            keyExtractor={(live) => String(live.id)}
            renderItem={({ item }) => <LiveCard live={item} onPress={onOpen} />}
            ListHeaderComponent={
                <>
                    {header}
                    {body ? <View style={styles.body}>{body}</View> : null}
                </>
            }
            ListFooterComponent={
                feed.lives.length > 0 && !body ? (
                    <View style={styles.footer}>
                        {feed.loadingMore ? <ActivityIndicator color={colors.orange} /> : null}
                        {feed.loadMoreError ? <Text style={styles.footerError}>{t('lives.loadMoreError')}</Text> : null}
                        {feed.hasMore && !feed.loadingMore ? (
                            <Button
                                label={feed.loadMoreError ? t('common.retry') : t('watch.loadMore')}
                                variant="secondary"
                                size="sm"
                                onPress={() => void feed.loadMore()}
                                testID="feed-load-more"
                            />
                        ) : null}
                    </View>
                ) : null
            }
            ItemSeparatorComponent={Separator}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReachedThreshold={0.4}
            onEndReached={() => {
                if (feed.hasMore && !feed.loadingMore && !feed.loadMoreError) void feed.loadMore();
            }}
            refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={() => void feed.refresh()} tintColor={colors.orange} />}
        />
    );
}

function Separator() {
    return <View style={separatorStyle.gap} />;
}

const separatorStyle = StyleSheet.create({ gap: { height: 16 } });

const useStyles = makeStyles(({ colors }) => ({
    content: {
        paddingHorizontal: 20,
        paddingBottom: 32,
    },
    body: {
        marginTop: 4,
    },
    skeletons: {
        gap: 16,
    },
    skeletonBody: {
        padding: 16,
        gap: 10,
    },
    footer: {
        alignItems: 'center',
        gap: 10,
        paddingTop: 20,
    },
    footerError: {
        color: colors.danger,
        fontSize: 13,
    },
}));
