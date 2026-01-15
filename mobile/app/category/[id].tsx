import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ToastManager from 'toastify-react-native';
import apiService, { Category, Live } from '../../services/api';
import toast from '../../utils/toast';

interface CategoryLivesData {
  lives: Live[];
  category: Category;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export default function CategoryLivesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<CategoryLivesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);


  const fetchLives = async () => {
    if (!id) return;
    try {
      const result = await apiService.getCategoryLives(Number(id));
      setData(result);
    } catch (error) {
      console.error('Category lives load error:', error);
      toast.error('Impossible de charger les lives');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLives();
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLives();
  };

  const renderLiveItem = ({ item }: { item: Live }) => (
    <TouchableOpacity
      style={styles.liveCard}
      onPress={() => {
        // Navigate to live stream (to be implemented)
        // router.push(`/live/${item.id}`);
        toast.info(`Joining live: ${item.title}`);
      }}
    >
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: item.thumbnail_url || 'https://via.placeholder.com/400x225' }}
          style={styles.thumbnail}
        />
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
        <View style={styles.viewerBadge}>
          <Ionicons name="eye" size={12} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.viewerText}>{item.current_viewers}</Text>
        </View>
      </View>
      <View style={styles.liveInfo}>
        <Image
          source={{ uri: item.user?.profile_image_url || 'https://via.placeholder.com/40' }}
          style={styles.avatar}
        />
        <View style={styles.textContainer}>
          <Text style={styles.liveTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.streamerName}>{item.user?.username || 'Chef'}</Text>
          <Text style={styles.dishName}>{item.dish_name}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF8A00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: data?.category?.name || 'Category' }} />
      
      <FlatList
        data={data?.lives || []}
        renderItem={renderLiveItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8A00" />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Ionicons name="videocam-off-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Aucun live en cours pour cette catégorie</Text>
            </View>
          )
        }
      />
      <ToastManager />
    </View>
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
  listContent: {
    padding: 16,
  },
  liveCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  viewerBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  viewerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  liveInfo: {
    flexDirection: 'row',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  liveTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    lineHeight: 22,
  },
  streamerName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
    fontWeight: '500',
  },
  dishName: {
    fontSize: 12,
    color: '#FF8A00',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
});
