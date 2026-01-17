import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const ORANGE_GRADIENT = ['#FFA92E', '#FF5D1E'] as const;
const BORDER = '#E7E7EC';
const CARD = '#FFFFFF';
const BACKGROUND = '#F8F8FB';
const MUTED = '#7B8294';
const TEXT = '#1F2430';

type Tag = { label: string };
type Recipe = {
    title: string;
    image: any;
    badge?: string;
    time: string;
    cuisine: string;
    level: string;
    rating: number;
    type: 'Live' | 'Replay';
};

const filters: Tag[] = [
    { label: 'Rapide (< 30 min)' },
    { label: 'Confort food' },
    { label: 'Healthy' },
    { label: 'Sucré' },
    { label: 'Pour les invités' },
];

const recipes: Recipe[] = [
    {
        title: 'Ramen Tonkotsu en 30 minutes',
        image: require('@/assets/images/food-iphone.jpg'),
        badge: 'Favori',
        time: '45 min',
        cuisine: 'Asiatique',
        level: 'Intermédiaire',
        rating: 4.9,
        type: 'Live',
    },
    {
        title: 'Bibimbap croustillant maison',
        image: require('@/assets/images/food-iphone.jpg'),
        time: '35 min',
        cuisine: 'Coréen',
        level: 'Débutant',
        rating: 4.8,
        type: 'Live',
    },
    {
        title: 'Tacos Birria ultra fondants',
        image: require('@/assets/images/food-iphone.jpg'),
        time: '40 min',
        cuisine: 'Street food',
        level: 'Intermédiaire',
        rating: 4.7,
        type: 'Replay',
    },
    {
        title: 'Macarons framboise & rose',
        image: require('@/assets/images/food-iphone.jpg'),
        time: '50 min',
        cuisine: 'Pâtisserie',
        level: 'Avancé',
        rating: 4.9,
        type: 'Replay',
    },
    {
        title: 'Mezzés libanais express',
        image: require('@/assets/images/food-iphone.jpg'),
        time: '30 min',
        cuisine: 'Partage',
        level: 'Débutant',
        rating: 4.6,
        type: 'Replay',
    },
    {
        title: 'Granola healthy au four',
        image: require('@/assets/images/food-iphone.jpg'),
        time: '20 min',
        cuisine: 'Healthy',
        level: 'Débutant',
        rating: 4.5,
        type: 'Replay',
    },
];

const TagPill = ({ label, active }: { label: string; active?: boolean }) => (
    <View style={[styles.tagPill, active && styles.tagPillActive]}>
        <Text style={[styles.tagText, active && styles.tagTextActive]}>{label}</Text>
    </View>
);

const FilterChip = ({ label, active }: { label: string; active?: boolean }) => (
    <View style={[styles.filterChip, active && styles.filterChipActive]}>
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </View>
);

const StatCard = ({ title, value, helper }: { title: string; value: string; helper: string }) => (
    <View style={styles.statCard}>
        <View style={styles.statHeader}>
            <Ionicons name="flame-outline" size={16} color="#FF7A00" />
            <Text style={styles.statTitle}>{title}</Text>
        </View>
        <Text style={styles.statHelper}>{helper}</Text>
        <Text style={styles.statValue}>{value}</Text>
    </View>
);

const TipCard = () => (
    <View style={styles.tipCard}>
        <View style={styles.tipHeader}>
            <Ionicons name="bulb-outline" size={16} color="#FF7A00" />
            <Text style={styles.tipTitle}>Idées d&apos;usage</Text>
        </View>
        <View style={styles.tipList}>
            <Text style={styles.tipBullet}>• Crée une routine : un plat favori par soir de semaine.</Text>
            <Text style={styles.tipBullet}>• Prépare un menu complet en combinant entrée, plat, dessert.</Text>
            <Text style={styles.tipBullet}>• Utilise tes favoris pour planifier tes prochaines courses.</Text>
        </View>
    </View>
);

const RecipeCard = ({ recipe }: { recipe: Recipe }) => (
    <View style={styles.recipeCard}>
        <View style={styles.recipeImageWrapper}>
            <Image source={recipe.image} style={styles.recipeImage} resizeMode="cover" />
            <View style={styles.recipeOverlay}>
                <View style={styles.recipeMetaRow}>
                    {recipe.badge ? (
                        <LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.metaBadge}>
                            <Ionicons name="heart-outline" size={12} color="#fff" />
                            <Text style={styles.metaBadgeText}>{recipe.badge}</Text>
                        </LinearGradient>
                    ) : (
                        <View />
                    )}
                    <View style={styles.metaTag}>
                        <Ionicons name="time-outline" size={12} color="#fff" />
                        <Text style={styles.metaTagText}>{recipe.time}</Text>
                    </View>
                </View>
                <View style={styles.metaTagRow}>
                    <TagPill label={recipe.cuisine} />
                    <TagPill label={recipe.level} />
                </View>
            </View>
        </View>
        <View style={styles.recipeBody}>
            <Text style={styles.recipeTitle}>{recipe.title}</Text>
            <View style={styles.recipeFooter}>
                <View style={styles.ratingRow}>
                    <Ionicons name="star-outline" size={14} color="#FF7A00" />
                    <Text style={styles.ratingText}>{recipe.rating.toFixed(1)}</Text>
                </View>
                <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>{recipe.type}</Text>
                </View>
            </View>
        </View>
    </View>
);

export default function FavoritesScreen(): JSX.Element {
    return (
        <View style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                </View>

                <Text style={styles.searchTitle}>Mes favoris</Text>
                <View style={styles.searchWrapper}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search-outline" size={14} color={MUTED} />
                        <TextInput
                            placeholder="Rechercher dans tes favoris (ramen, tacos, sucré...)"
                            placeholderTextColor={MUTED}
                            style={styles.searchInput}
                        />
                    </View>
                    <View style={styles.filterRow}>
                        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.9}>
                            <Ionicons name="funnel-outline" size={16} color={TEXT} />
                            <Text style={styles.filterBtnText}>Filtres</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.9}>
                            <Ionicons name="time-outline" size={16} color={TEXT} />
                            <Text style={styles.filterBtnText}>Derniers ajoutés</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.filtersRow}>
                    {filters.map((tag, idx) => (
                        <FilterChip key={tag.label} label={tag.label} active={idx === 0} />
                    ))}
                </View>

                <View style={styles.cardsGrid}>
                    {recipes.map((recipe) => (
                        <RecipeCard key={recipe.title} recipe={recipe} />
                    ))}
                </View>

                <View style={styles.sidebar}>
                    <StatCard title="Ta sélection du moment" helper="Carnet de recettes que tu veux refaire souvent ou montrer à tes amis." value="" />
                    <View style={styles.statsList}>
                        <View style={styles.statLine}>
                            <Text style={styles.statLabel}>Nombre total de favoris</Text>
                            <Text style={styles.statNumber}>6</Text>
                        </View>
                        <View style={styles.statLine}>
                            <Text style={styles.statLabel}>Temps moyen</Text>
                            <Text style={styles.statNumber}>~ 37 min</Text>
                        </View>
                        <View style={styles.statLine}>
                            <Text style={styles.statLabel}>Plats rapides (&lt; 30 min)</Text>
                            <Text style={styles.statNumber}>2</Text>
                        </View>
                    </View>

                    <TipCard />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: BACKGROUND,
    },
    content: {
        padding: 16,
        gap: 14,
    },
    hero: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    heroIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#FFEFE0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroIconBg: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroText: {
        flex: 1,
        gap: 6,
    },
    heroEyebrow: {
        fontSize: 12,
        fontWeight: '700',
        color: MUTED,
        letterSpacing: 0.3,
    },
    heroTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: TEXT,
    },
    recipeCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FFF6EC',
    },
    recipeCountText: {
        fontWeight: '700',
        color: '#FF7A00',
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FFF6EC',
    },
    heroBadgeText: {
        color: '#FF7A00',
        fontWeight: '700',
    },
    searchWrapper: {
        gap: 10,
        marginTop: 8,
    },
    searchTitle: {
        marginTop: 32,
        fontSize: 24,
        fontWeight: '700',
        color: TEXT,
        textAlign: 'center',
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: CARD,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    searchInput: {
        flex: 1,
        color: TEXT,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
    },
    filterButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: CARD,
        borderWidth: 1,
        borderColor: BORDER,
    },
    filterBtnText: {
        color: TEXT,
        fontWeight: '700',
    },
    filtersRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: '#f5f5f7',
    },
    filterChipActive: {
        backgroundColor: '#FFF6EC',
        borderColor: '#FF7A00',
    },
    filterChipText: {
        color: MUTED,
        fontWeight: '700',
    },
    filterChipTextActive: {
        color: '#FF7A00',
    },
    cardsGrid: {
        gap: 12,
    },
    sidebar: {
        gap: 12,
    },
    statCard: {
        backgroundColor: CARD,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 14,
        gap: 6,
        shadowColor: '#00000010',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 2,
    },
    statHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statTitle: {
        fontWeight: '700',
        color: TEXT,
    },
    statHelper: {
        fontSize: 12,
        color: MUTED,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        color: TEXT,
    },
    statsList: {
        backgroundColor: CARD,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 14,
        gap: 10,
        shadowColor: '#00000010',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 2,
    },
    statLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statLabel: {
        color: MUTED,
        fontSize: 12,
    },
    statNumber: {
        color: TEXT,
        fontWeight: '700',
    },
    tipCard: {
        backgroundColor: CARD,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 14,
        gap: 10,
        shadowColor: '#00000010',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 2,
    },
    tipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tipTitle: {
        fontWeight: '700',
        color: TEXT,
    },
    tipList: {
        gap: 6,
    },
    tipBullet: {
        color: TEXT,
        fontSize: 13,
    },
    recipeCard: {
        width: '100%',
        backgroundColor: CARD,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER,
        shadowColor: '#00000010',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden',
    },
    recipeImageWrapper: {
        position: 'relative',
        height: 190,
    },
    recipeImage: {
        width: '100%',
        height: '100%',
    },
    recipeOverlay: {
        position: 'absolute',
        left: 8,
        right: 8,
        top: 8,
        bottom: 8,
        justifyContent: 'space-between',
    },
    recipeMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    metaBadgeText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },
    metaTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: '#00000070',
    },
    metaTagText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 11,
    },
    metaTagRow: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
    },
    tagPill: {
        backgroundColor: '#00000070',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    tagPillActive: {},
    tagText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 11,
    },
    tagTextActive: {},
    recipeBody: {
        padding: 12,
        gap: 8,
    },
    recipeTitle: {
        fontWeight: '700',
        color: TEXT,
    },
    recipeFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingText: {
        fontWeight: '700',
        color: TEXT,
    },
    liveBadge: {
        borderRadius: 10,
        backgroundColor: '#f0f1f3',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    liveBadgeText: {
        color: MUTED,
        fontWeight: '700',
        fontSize: 12,
    },
});
