import { brandTheme } from '@/constants/brandTheme';
import { useI18n } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ToastManager from 'toastify-react-native';
import apiService, { DiscoverData } from '../../services/api';
import toast from '../../utils/toast';

const DISCOVER_COPY = {
  fr: {
    loadError: 'Impossible de charger les donnees',
    title: 'Decouvrir',
    subtitle: 'Trouve ton prochain live, une idee de plat et une categorie a explorer.',
    heroTitle: 'Ton inspiration du jour',
    heroButtonLives: 'Voir les lives',
    heroButtonCategories: 'Explorer',
    quickStats: 'En un coup d oeil',
    statLives: 'Lives actifs',
    statCategories: 'Categories',
    statDishes: 'Plats tendance',
    trendingCountry: 'Pays tendance 🔥',
    categories: 'Categories',
    seeAll: 'Voir tout',
    topDishes: 'Plats populaires 🍲',
    quickPicks: 'Acces rapide',
    openCategory: 'Ouvrir la categorie',
    liveLabel: 'LIVE',
  },
  en: {
    loadError: 'Unable to load data',
    title: 'Discover',
    subtitle: 'Find your next live stream, dish idea, and category to explore.',
    heroTitle: 'Your daily inspiration',
    heroButtonLives: 'See live rooms',
    heroButtonCategories: 'Explore',
    quickStats: 'At a glance',
    statLives: 'Active lives',
    statCategories: 'Categories',
    statDishes: 'Trending dishes',
    trendingCountry: 'Trending country 🔥',
    categories: 'Categories',
    seeAll: 'See all',
    topDishes: 'Popular dishes 🍲',
    quickPicks: 'Quick picks',
    openCategory: 'Open category',
    liveLabel: 'LIVE',
  },
} as const;

export default function DiscoverScreen() {
  const { locale } = useI18n();
  const copy = DISCOVER_COPY[locale];

  const [data, setData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const totalLiveCount =
    data?.categories?.reduce((sum, category) => sum + (category.live_count || 0), 0) ??
    data?.trending_country?.live_count ??
    0;

  const fetchData = async () => {
    try {
      const result = await apiService.getDiscover();
      setData(result);
    } catch (error) {
      console.error('Discover load error:', error);
      toast.error(copy.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={brandTheme.colors.orange} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brandTheme.colors.orange} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{copy.title}</Text>
          <Text style={styles.headerSubtitle}>{copy.subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color={brandTheme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.heroSection}>
        <LinearGradient
          colors={['rgba(249, 115, 22, 0.2)', 'rgba(255, 255, 255, 0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroTitle}>{copy.heroTitle}</Text>
          <Text style={styles.heroDescription}>
            {data?.trending_country
              ? `${data.trending_country.name} attire ${data.trending_country.live_count || 0} ${copy.liveLabel.toLowerCase()} actuellement.`
              : copy.subtitle}
          </Text>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={[styles.heroButton, styles.heroButtonPrimary]}
              onPress={() => router.push('/live-rooms')}
              activeOpacity={0.9}
            >
              <Ionicons name="play-circle-outline" size={16} color={brandTheme.colors.text} />
              <Text style={styles.heroButtonText}>{copy.heroButtonLives}</Text>
            </TouchableOpacity>

            {data?.trending_country && (
              <TouchableOpacity
                style={styles.heroButton}
                onPress={() => router.push(`/category/${data.trending_country.id}`)}
                activeOpacity={0.9}
              >
                <Ionicons name="grid-outline" size={16} color={brandTheme.colors.text} />
                <Text style={styles.heroButtonText}>{copy.heroButtonCategories}</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{copy.quickStats}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="radio-outline" size={16} color={brandTheme.colors.orange} />
            <Text style={styles.statValue}>{totalLiveCount}</Text>
            <Text style={styles.statLabel}>{copy.statLives}</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="layers-outline" size={16} color={brandTheme.colors.orange} />
            <Text style={styles.statValue}>{data?.categories?.length ?? 0}</Text>
            <Text style={styles.statLabel}>{copy.statCategories}</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="flame-outline" size={16} color={brandTheme.colors.orange} />
            <Text style={styles.statValue}>{data?.top_dishes?.length ?? 0}</Text>
            <Text style={styles.statLabel}>{copy.statDishes}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{copy.quickPicks}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPicksList}>
          {data?.categories?.slice(0, 5).map((category) => (
            <TouchableOpacity
              key={`pick-${category.id}`}
              style={styles.quickPickCard}
              onPress={() => router.push(`/category/${category.id}`)}
              activeOpacity={0.9}
            >
              <Text style={styles.quickPickTitle}>{category.name}</Text>
              <Text style={styles.quickPickMeta}>{category.live_count || 0} {copy.liveLabel}</Text>
              <Text style={styles.quickPickCta}>{copy.openCategory}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Trending Country Section */}
      {data?.trending_country && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.trendingCountry}</Text>
          <TouchableOpacity
            style={styles.trendingCard}
            onPress={() => {
              // Navigate to category details
              if (data.trending_country) {
                router.push(`/category/${data.trending_country.id}`);
              }
            }}
          >
            <ImageBackground
              source={{ uri: data.trending_country.image_url || 'https://via.placeholder.com/400x200' }}
              style={styles.trendingImage}
              imageStyle={{ borderRadius: 24 }}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.trendingGradient}
              >
                <View style={styles.trendingContent}>
                  <Text style={styles.trendingName}>{data.trending_country.name}</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>
                      {data.trending_country.live_count || 0} {copy.liveLabel}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        </View>
      )}

      {/* Categories Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{copy.categories}</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>{copy.seeAll}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList}>
          {data?.categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => router.push(`/category/${category.id}`)}
            >
              <View style={styles.categoryImageContainer}>
                <Image
                  source={{ uri: category.image_url || 'https://via.placeholder.com/100' }}
                  style={styles.categoryImage}
                />
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Top Dishes Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{copy.topDishes}</Text>
        <View style={styles.dishesGrid}>
          {data?.top_dishes.map((dish) => (
            <TouchableOpacity key={dish.id} style={styles.dishCard}>
              <Image
                source={{ uri: dish.image_url || 'https://via.placeholder.com/150' }}
                style={styles.dishImage}
              />
              <View style={styles.dishInfo}>
                <Text style={styles.dishName} numberOfLines={1}>
                  {dish.name}
                </Text>
                <Text style={styles.dishCountry} numberOfLines={1}>
                  {dish.country?.name}
                </Text>
                <View style={styles.dishStats}>
                  <Ionicons name="eye-outline" size={14} color={brandTheme.colors.muted} />
                  <Text style={styles.dishStatText}>{dish.total_views}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ height: 100 }} />
      <ToastManager />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandTheme.colors.bg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: brandTheme.colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#120c08',
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: brandTheme.colors.text,
  },
  headerSubtitle: {
    marginTop: 6,
    color: brandTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: brandTheme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: brandTheme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandTheme.colors.border,
    backgroundColor: brandTheme.colors.surface,
    padding: 16,
  },
  heroTitle: {
    color: brandTheme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  heroDescription: {
    marginTop: 8,
    color: brandTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  heroActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandTheme.colors.border,
    backgroundColor: brandTheme.colors.surfaceStrong,
  },
  heroButtonPrimary: {
    borderColor: 'rgba(249, 115, 22, 0.42)',
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
  },
  heroButtonText: {
    color: brandTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: brandTheme.colors.border,
    borderRadius: 14,
    backgroundColor: brandTheme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
    gap: 4,
  },
  statValue: {
    color: brandTheme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: brandTheme.colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  quickPicksList: {
    paddingRight: 20,
  },
  quickPickCard: {
    width: 170,
    marginRight: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brandTheme.colors.border,
    backgroundColor: brandTheme.colors.surface,
    padding: 12,
  },
  quickPickTitle: {
    color: brandTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  quickPickMeta: {
    marginTop: 6,
    color: brandTheme.colors.orange,
    fontSize: 12,
    fontWeight: '700',
  },
  quickPickCta: {
    marginTop: 10,
    color: brandTheme.colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: brandTheme.colors.text,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: brandTheme.colors.orange,
    fontWeight: '600',
  },
  trendingCard: {
    borderRadius: 24,
    overflow: 'hidden',
    height: 220,
    elevation: 4,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    backgroundColor: brandTheme.colors.surface,
  },
  trendingImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  trendingGradient: {
    height: '100%',
    justifyContent: 'flex-end',
    padding: 20,
  },
  trendingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  trendingName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    ...(Platform.OS === 'web'
      ? ({ textShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)' } as any)
      : {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
      }),
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  categoriesList: {
    paddingRight: 20,
  },
  categoryCard: {
    marginRight: 16,
    alignItems: 'center',
    width: 80,
  },
  categoryImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: brandTheme.colors.border,
    elevation: 2,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: brandTheme.colors.muted,
    textAlign: 'center',
  },
  dishesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dishCard: {
    width: '48%',
    backgroundColor: brandTheme.colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  dishImage: {
    width: '100%',
    height: 120,
    backgroundColor: brandTheme.colors.surfaceStrong,
  },
  dishInfo: {
    padding: 12,
  },
  dishName: {
    fontSize: 14,
    fontWeight: '700',
    color: brandTheme.colors.text,
    marginBottom: 4,
  },
  dishCountry: {
    fontSize: 12,
    color: brandTheme.colors.muted,
    marginBottom: 8,
  },
  dishStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dishStatText: {
    fontSize: 12,
    color: brandTheme.colors.muted,
    marginLeft: 4,
  },
});
