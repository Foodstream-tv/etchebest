import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
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

export default function DiscoverScreen() {
  const [data, setData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchData = async () => {
    try {
      const result = await apiService.getDiscover();
      setData(result);
    } catch (error) {
      console.error('Discover load error:', error);
      toast.error('Impossible de charger les données');
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
        <ActivityIndicator size="large" color="#FF8A00" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8A00" />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Découvrir</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color="#111" />
        </TouchableOpacity>
      </View>

      {/* Trending Country Section */}
      {data?.trending_country && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pays Tendance 🔥</Text>
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
                      {data.trending_country.live_count || 0} LIVE
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
          <Text style={styles.sectionTitle}>Catégories</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>Voir tout</Text>
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
        <Text style={styles.sectionTitle}>Plats Populaires 🍲</Text>
        <View style={styles.dishesGrid}>
          {/* STATIC TEST ELEMENT */}
          <TouchableOpacity style={styles.dishCard}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c' }} // Example food image
              style={styles.dishImage}
            />
            <View style={styles.dishInfo}>
              <Text style={styles.dishName} numberOfLines={1}>
                Test Element
              </Text>
              <Text style={styles.dishCountry} numberOfLines={1}>
                Debug Mode
              </Text>
              <View style={styles.dishStats}>
                <Ionicons name="eye-outline" size={14} color="#666" />
                <Text style={styles.dishStatText}>99k</Text>
              </View>
            </View>
          </TouchableOpacity>

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
                  <Ionicons name="eye-outline" size={14} color="#666" />
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
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
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
    color: '#1a1a1a',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: '#FF8A00',
    fontWeight: '600',
  },
  trendingCard: {
    borderRadius: 24,
    overflow: 'hidden',
    height: 220,
    elevation: 4,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    backgroundColor: '#fff',
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
    textShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)',
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
    borderColor: '#fff',
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
    color: '#444',
    textAlign: 'center',
  },
  dishesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dishCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  dishImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#eee',
  },
  dishInfo: {
    padding: 12,
  },
  dishName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  dishCountry: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  dishStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dishStatText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
});
