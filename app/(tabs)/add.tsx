import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ORANGE_GRADIENT = ['#FFA92E', '#FF5D1E'] as const;
const BORDER = '#E7E7EC';
const CARD = '#FFFFFF';
const BACKGROUND = '#F8F8FB';
const TEXT = '#1F2430';
const MUTED = '#7B8294';

type Pill = { label: string };

const pillsCuisine: Pill[] = [
	{ label: 'Asiatique' },
	{ label: 'Pâtisserie' },
	{ label: 'Street food' },
	{ label: 'Healthy' },
	{ label: 'BBQ' },
	{ label: 'Végétarien' },
];

const pillsLevel: Pill[] = [
	{ label: 'Débutant' },
	{ label: 'Intermédiaire' },
	{ label: 'Avancé' },
];

const pillsDuration: Pill[] = [
	{ label: '30 min' },
	{ label: '45 min' },
	{ label: '60 min' },
	{ label: '90 min' },
];

const pillsVisibility: Pill[] = [
	{ label: 'Public' },
	{ label: 'Non listé' },
	{ label: 'Privé' },
];

const pillsChat: Pill[] = [
	{ label: 'Chat activé' },
	{ label: 'Slow mode' },
	{ label: 'Abonnés seulement' },
];

const PillButton = ({ label, active }: { label: string; active?: boolean }) => (
	<View style={[styles.pill, active && styles.pillActive]}>
		<Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
	</View>
);

const InputField = ({
	label,
	placeholder,
	multiline,
}: {
	label: string;
	placeholder: string;
	multiline?: boolean;
}) => (
	<View style={styles.inputGroup}>
		<Text style={styles.inputLabel}>{label}</Text>
		<View style={[styles.inputWrapper, multiline && styles.textareaWrapper]}>
			<TextInput
				placeholder={placeholder}
				placeholderTextColor={MUTED}
				style={[styles.input, multiline && styles.textarea]}
				multiline={multiline}
				numberOfLines={multiline ? 4 : 1}
				textAlignVertical={multiline ? 'top' : 'center'}
			/>
		</View>
	</View>
);

const DropdownRow = ({
	label,
	options,
	value,
	onSelect,
}: {
	label: string;
	options: string[];
	value: string;
	onSelect: (val: string) => void;
}) => {
	const [open, setOpen] = useState(false);
	return (
		<View style={styles.dropdownRow}>
			<Text style={styles.settingLabel}>{label}</Text>
			<View style={styles.dropdownContainer}>
				<TouchableOpacity activeOpacity={0.85} style={styles.dropdownTrigger} onPress={() => setOpen((v) => !v)}>
					<Text style={styles.dropdownValue}>{value}</Text>
					<Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={MUTED} />
				</TouchableOpacity>
				{open ? (
					<View style={styles.dropdownList}>
						<ScrollView nestedScrollEnabled>
							{options.map((opt) => (
								<TouchableOpacity
									key={opt}
									activeOpacity={0.85}
									style={styles.dropdownItem}
									onPress={() => {
										onSelect(opt);
										setOpen(false);
									}}>
									<Text style={[styles.dropdownValue, opt === value && styles.dropdownValueActive]}>{opt}</Text>
								</TouchableOpacity>
							))}
						</ScrollView>
					</View>
				) : null}
			</View>
		</View>
	);
};

export default function AddScreen(): JSX.Element {
	const [cuisineSelected, setCuisineSelected] = useState('Asiatique');
	const [levelSelected, setLevelSelected] = useState('Débutant');
	const [durationSelected, setDurationSelected] = useState('60 min');
	const [visibilitySelected, setVisibilitySelected] = useState('Public');
	const [chatSelected, setChatSelected] = useState('Chat activé');
	const [latence, setLatence] = useState('Normale');
	const [qualite, setQualite] = useState('Auto (1080p)');
	const [replays, setReplays] = useState('Replays activés');

	return (
		<SafeAreaView edges={['top']} style={styles.safeArea}>
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.hero}>
					<View style={styles.heroIcon}>
						<LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.heroIconBg}>
							<Ionicons name="radio-outline" size={18} color="#fff" />
						</LinearGradient>
					</View>
					<View style={styles.heroText}>
						<Text style={styles.heroEyebrow}>FOODSTREAM STUDIO</Text>
						<Text style={styles.heroTitle}>Créer un nouveau live</Text>
					</View>
				</View>

				<View style={styles.previewCard}>
					<View style={styles.cardHeader}>
						<Ionicons name="camera-outline" size={18} color="#FF7A00" />
						<Text style={styles.cardTitle}>Aperçu / Photo</Text>
					</View>
					<View style={styles.previewBox}>
						<Text style={styles.helperText}>Prends une photo ou ajoute une image pour ton live</Text>
						<View style={styles.previewButtons}>
							<TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9}>
								<Text style={styles.secondaryButtonText}>Prendre une photo</Text>
							</TouchableOpacity>
							<TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9}>
								<Text style={styles.secondaryButtonText}>Depuis la galerie</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>

				<View style={styles.secondaryCard}>
					<View style={styles.cardHeader}>
						<Ionicons name="sparkles-outline" size={18} color="#FF7A00" />
						<Text style={styles.cardTitle}>Réglages rapides</Text>
					</View>
					<DropdownRow label="Latence" value={latence} onSelect={setLatence} options={['Normale', 'Faible', 'Ultra']} />
					<DropdownRow label="Qualité" value={qualite} onSelect={setQualite} options={['Auto (1080p)', '720p', '4K']} />
					<DropdownRow label="Enregistrement" value={replays} onSelect={setReplays} options={['Replays activés', 'Replays désactivés']} />
				</View>

				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons name="settings-outline" size={18} color="#FF7A00" />
						<Text style={styles.cardTitle}>Paramètres du live</Text>
					</View>

					<InputField label="Titre du live" placeholder='Ex : Ramen Tonkotsu en 30 minutes' />
					<InputField label="Description" placeholder="Présente ton live, les étapes, le niveau de difficulté, les ustensiles à prévoir..." multiline />

					<View style={styles.sectionRow}>
						<View style={styles.sectionColumn}>
							<Text style={styles.settingLabel}>Cuisine / catégorie</Text>
							<View style={styles.pillRow}>
								{pillsCuisine.map((pill) => (
									<TouchableOpacity key={pill.label} activeOpacity={0.85} onPress={() => setCuisineSelected(pill.label)}>
										<PillButton label={pill.label} active={cuisineSelected === pill.label} />
									</TouchableOpacity>
								))}
							</View>
						</View>
						<View style={styles.sectionColumn}>
							<Text style={styles.settingLabel}>Niveau</Text>
							<View style={styles.pillRow}>
								{pillsLevel.map((pill) => (
									<TouchableOpacity key={pill.label} activeOpacity={0.85} onPress={() => setLevelSelected(pill.label)}>
										<PillButton label={pill.label} active={levelSelected === pill.label} />
									</TouchableOpacity>
								))}
							</View>
							<Text style={styles.helperText}>Le niveau s&apos;affichera sur la carte de ton live.</Text>
						</View>
					</View>

					<View style={styles.sectionRow}>
						<View style={styles.sectionColumn}>
							<Text style={styles.settingLabel}>Date</Text>
							<View style={styles.inputWrapper}>
								<View style={styles.inlineInput}>
									<Ionicons name="calendar-outline" size={16} color={MUTED} />
									<TextInput placeholder="jj/mm/aaaa" placeholderTextColor={MUTED} style={styles.input} />
									<Ionicons name="chevron-down" size={16} color={MUTED} />
								</View>
							</View>
						</View>
						<View style={styles.sectionColumn}>
							<Text style={styles.settingLabel}>Heure (heure locale)</Text>
							<View style={styles.inputWrapper}>
								<View style={styles.inlineInput}>
									<Ionicons name="time-outline" size={16} color={MUTED} />
									<TextInput placeholder="--:--" placeholderTextColor={MUTED} style={styles.input} />
									<Ionicons name="chevron-down" size={16} color={MUTED} />
								</View>
							</View>
						</View>
					</View>

					<View style={styles.sectionRow}>
						<View style={styles.sectionColumn}>
							<Text style={styles.settingLabel}>Durée du live</Text>
							<View style={styles.inlinePillRow}>
								<TextInput
									placeholder="60"
									placeholderTextColor={MUTED}
									style={[styles.input, styles.durationInput]}
									keyboardType="numeric"
								/>
								<Text style={styles.settingLabel}>minutes</Text>
							</View>
							<View style={styles.pillRow}>
								{pillsDuration.map((pill) => (
									<TouchableOpacity key={pill.label} activeOpacity={0.85} onPress={() => setDurationSelected(pill.label)}>
										<PillButton label={pill.label} active={durationSelected === pill.label} />
									</TouchableOpacity>
								))}
							</View>
						</View>
						<View style={styles.sectionColumn}>
							<Text style={styles.settingLabel}>Image du live</Text>
							<View style={styles.inputWrapper}>
								<TextInput placeholder="URL de l'image (optionnel)" placeholderTextColor={MUTED} style={styles.input} />
							</View>
							<View style={[styles.inputWrapper, styles.uploadBox]}>
								<Text style={styles.uploadText}>Choisir un fichier</Text>
								<Text style={styles.helperText}>JPG ou PNG, format 16:9 recommandé.</Text>
							</View>
						</View>
					</View>

					<View style={styles.sectionRow}>
						<View style={styles.sectionColumn}>
							<Text style={styles.settingLabel}>Visibilité</Text>
							<View style={styles.pillRow}>
								{pillsVisibility.map((pill) => (
									<TouchableOpacity key={pill.label} activeOpacity={0.85} onPress={() => setVisibilitySelected(pill.label)}>
										<PillButton label={pill.label} active={visibilitySelected === pill.label} />
									</TouchableOpacity>
								))}
							</View>
						</View>
						<View style={styles.sectionColumn}>
							<Text style={styles.settingLabel}>Chat & interaction</Text>
							<View style={styles.pillRow}>
								{pillsChat.map((pill) => (
									<TouchableOpacity key={pill.label} activeOpacity={0.85} onPress={() => setChatSelected(pill.label)}>
										<PillButton label={pill.label} active={chatSelected === pill.label} />
									</TouchableOpacity>
								))}
							</View>
						</View>
					</View>

					<Text style={styles.helperText}>Durée estimée : 45-90 min</Text>

					<View style={styles.ctaRow}>
						<TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9}>
							<Text style={styles.secondaryButtonText}>Enregistrer le brouillon</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.primaryButton} activeOpacity={0.9}>
							<LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.primaryGradient}>
								<Ionicons name="radio-outline" size={16} color="#fff" />
								<Text style={styles.primaryText}>Planifier le live</Text>
							</LinearGradient>
						</TouchableOpacity>
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
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
	previewCard: {
		backgroundColor: CARD,
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: BORDER,
		shadowColor: '#00000010',
		shadowOpacity: 0.1,
		shadowOffset: { width: 0, height: 6 },
		shadowRadius: 10,
		elevation: 2,
		gap: 12,
	},
	previewBox: {
		borderWidth: 1,
		borderColor: BORDER,
		borderRadius: 14,
		backgroundColor: '#FAFAFC',
		padding: 14,
		gap: 12,
		alignItems: 'center',
	},
	previewButtons: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		justifyContent: 'center',
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
		gap: 4,
	},
	heroEyebrow: {
		fontSize: 12,
		fontWeight: '700',
		color: MUTED,
		letterSpacing: 0.3,
	},
	heroTitle: {
		fontSize: 20,
		fontWeight: '700',
		color: TEXT,
	},
	card: {
		backgroundColor: CARD,
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: BORDER,
		shadowColor: '#00000010',
		shadowOpacity: 0.1,
		shadowOffset: { width: 0, height: 6 },
		shadowRadius: 10,
		elevation: 2,
		gap: 14,
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	cardTitle: {
		fontWeight: '700',
		color: TEXT,
	},
	inputGroup: {
		gap: 6,
	},
	inputLabel: {
		fontWeight: '700',
		color: TEXT,
	},
	inputWrapper: {
		borderWidth: 1,
		borderColor: BORDER,
		borderRadius: 12,
		backgroundColor: '#FAFAFC',
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	textareaWrapper: {
		height: 140,
		paddingVertical: 12,
	},
	input: {
		color: TEXT,
		fontWeight: '600',
	},
	textarea: {
		height: '100%',
		textAlignVertical: 'top',
	},
	sectionRow: {
		flexDirection: 'row',
		gap: 12,
		flexWrap: 'wrap',
	},
	sectionColumn: {
		flex: 1,
		minWidth: '100%',
		gap: 8,
	},
	pillRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	pill: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: BORDER,
		backgroundColor: '#f5f5f7',
	},
	pillActive: {
		backgroundColor: '#FFF6EC',
		borderColor: '#FF7A00',
	},
	pillText: {
		color: MUTED,
		fontWeight: '700',
	},
	pillTextActive: {
		color: '#FF7A00',
	},
	helperText: {
		color: MUTED,
		fontSize: 12,
	},
	inlineInput: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	inlinePillRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	durationInput: {
		width: 80,
	},
	uploadBox: {
		borderStyle: 'dashed',
		alignItems: 'flex-start',
		gap: 4,
	},
	uploadText: {
		color: TEXT,
		fontWeight: '700',
	},
	settingLabel: {
		fontWeight: '700',
		color: TEXT,
	},
	toggleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	toggleWrapper: {
		padding: 2,
	},
	toggleTrack: {
		width: 52,
		height: 30,
		borderRadius: 16,
		padding: 3,
		justifyContent: 'center',
	},
	toggleTrackOff: {
		borderWidth: 1,
		borderColor: '#d2d4db',
	},
	toggleThumb: {
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: '#fff',
		shadowColor: '#00000020',
		shadowOpacity: 0.2,
		shadowOffset: { width: 0, height: 1 },
		shadowRadius: 2,
	},
	toggleThumbOn: {
		alignSelf: 'flex-end',
	},
	toggleThumbOff: {
		alignSelf: 'flex-start',
	},
	ctaRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
	},
	secondaryButton: {
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#D0D1D5',
		paddingHorizontal: 14,
		paddingVertical: 12,
		backgroundColor: '#fff',
		flex: 1,
		alignItems: 'center',
	},
	secondaryButtonText: {
		color: '#2c2f38',
		fontWeight: '700',
	},
	primaryButton: {
		borderRadius: 12,
		overflow: 'hidden',
		flex: 1,
	},
	primaryGradient: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		paddingHorizontal: 14,
		paddingVertical: 12,
		borderRadius: 12,
	},
	primaryText: {
		color: '#fff',
		fontWeight: '700',
	},
	dropdownRow: {
		gap: 6,
	},
	dropdownContainer: {
		position: 'relative',
		zIndex: 20,
	},
	dropdownTrigger: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderWidth: 1,
		borderColor: BORDER,
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
		backgroundColor: '#FAFAFC',
	},
	dropdownValue: {
		color: TEXT,
		fontWeight: '700',
	},
	dropdownValueActive: {
		color: '#FF7A00',
	},
	dropdownList: {
		width: '100%',
		marginTop: 6,
		backgroundColor: CARD,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: BORDER,
		shadowColor: '#00000015',
		shadowOpacity: 0.12,
		shadowOffset: { width: 0, height: 4 },
		shadowRadius: 8,
		elevation: 4,
		zIndex: 30,
		maxHeight: 200,
	},
	dropdownItem: {
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	secondaryCard: {
		backgroundColor: CARD,
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: BORDER,
		shadowColor: '#00000010',
		shadowOpacity: 0.1,
		shadowOffset: { width: 0, height: 6 },
		shadowRadius: 10,
		elevation: 2,
		gap: 14,
	},
});
