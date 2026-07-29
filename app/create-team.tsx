import { router } from 'expo-router';
import { ArrowLeft, Crown, Shield } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './auth/auth-context';
import Players from './components/players';
import { insertPlayersBulk } from './service/playerService';
import { assignPlayersToTeam } from './service/teamPlayerService';
import { createTeam } from './service/teamsService';

const PLAYER_ROLES = [
  { id: 'batsman', name: 'Batsman', icon: '🏏', color: '#22C55E' },
  { id: 'bowler', name: 'Bowler', icon: '⚡', color: '#3B82F6' },
  { id: 'allrounder', name: 'All-rounder', icon: '🌟', color: '#F59E0B' },
  { id: 'wicketkeeper', name: 'Wicket Keeper', icon: '🥅', color: '#8B5CF6' },
];

export interface Player {
  id: string;
  name: string;
  mobile: string;
  role: string;
  isExists?: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

export default function CreateTeamScreen() {

  const auth = useAuth();

  if (!auth) {
    console.error('Auth context is not available');
    return <Text>Loading auth context...</Text>;
  }
  const { user } = auth;
  const userRole = (user?.role || 'player').toLowerCase();
  const canManage = userRole === 'organizer' || userRole === 'admin';
  const currentUserMobile = (user?.phone  || '').toString();
  const organizerDisplayName = (user?.name || '').trim() || 'Organizer';
  const [currentStep, setCurrentStep] = useState(1);
  const [teamName, setTeamName] = useState('');
  const [teamLocation, setTeamLocation] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const minTeamMembers = 5;
  const [loading, setLoading] = useState(false);
  const [selectedSport, setSelectedSport] = useState<number>(1);

  useEffect(() => {
    setSelectedSport(1);
  }, []);

  useEffect(() => {
    if (!canManage) {
      Alert.alert('Access Denied', 'Only organizers or admins can create and manage teams.');
      router.replace('/(tabs)');
    }
  }, [canManage]);

  const getPlayersByRole = (roleId: string) => {
    return players.filter(p => p.role === roleId);
  };

  const canProceed = () => {
    return teamName.trim() && teamLocation.trim() && players.length >= minTeamMembers && 
           players.some(p => p.isCaptain) && 
           players.some(p => p.isViceCaptain);
  };

  const stripCountryCode = (number: string, code = "91"): string => {
    const digitsOnly = String(number || '').replace(/\D/g, '');
    return digitsOnly.startsWith(code) && digitsOnly.length > 10
      ? digitsOnly.slice(code.length)
      : digitsOnly;
  };
  

  const handleCreateTeam = async () => {
    if (!canProceed()) {
      Alert.alert(
        'Error',
        `Please complete all requirements:\n• Team name\n• Minimum ${minTeamMembers} players\n• Select captain and vice-captain`
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: teamName,
        location: teamLocation,
        sportId: selectedSport,
        createdBy: stripCountryCode(currentUserMobile),
      };

      const teamData = await createTeam(payload);
      const teamId = teamData?.team?.id;

      if (!teamId) {
        throw new Error('Team creation failed. No team ID returned.');
      }

      // Separate existing and new players
      const existingPlayers: Player[] = [];
      const newPlayers: Player[] = [];

      for (const player of players) {
        if (player.isExists) {
          existingPlayers.push(player);
        } else {
          newPlayers.push(player);
        }
      }

      let createdPlayersByMobile = new Map<string, any>();
      let existingPlayersByMobile = new Map<string, any>();

      if (newPlayers.length > 0) {
        const bulkResponse = await insertPlayersBulk(
          newPlayers.map((player) => ({
            id: player.id,
            name: player.name,
            mobile: player.mobile,
            role: player.role,
          })),
        );

        const invalidPlayers = Array.isArray((bulkResponse as any)?.invalidPlayers)
          ? (bulkResponse as any).invalidPlayers
          : [];

        if (invalidPlayers.length > 0) {
          const errorPreview = invalidPlayers
            .slice(0, 3)
            .map((item: any) => `${item.mobile || 'unknown'} (${item.reason || 'invalid'})`)
            .join(', ');
          Alert.alert('Player Validation Error', `Please fix invalid players: ${errorPreview}`);
          return;
        }

        const createdPlayers = Array.isArray((bulkResponse as any)?.createdPlayers)
          ? (bulkResponse as any).createdPlayers
          : [];
        const existingPlayersFromBulk = Array.isArray((bulkResponse as any)?.existingPlayers)
          ? (bulkResponse as any).existingPlayers
          : [];

        createdPlayersByMobile = new Map(
          createdPlayers.map((player: any) => [String(player.mobile || ''), player]),
        );
        existingPlayersByMobile = new Map(
          existingPlayersFromBulk.map((player: any) => [String(player.mobile || ''), player]),
        );
      }

      const mergedNewPlayers = newPlayers.map((player) => {
        const mobileKey = String(player.mobile || '');
        const matched = createdPlayersByMobile.get(mobileKey) || existingPlayersByMobile.get(mobileKey);

        if (!matched) {
          throw new Error(`Unable to process player ${player.name} (${player.mobile}). Please try again.`);
        }

        return {
          ...matched,
          isCaptain: !!player.isCaptain,
          isViceCaptain: !!player.isViceCaptain,
        };
      });

      // Combine IDs of existing and processed new players
      const allPlayers = [...existingPlayers, ...mergedNewPlayers];

      const playerAssignments = allPlayers.map(p => ({
        playerId: p.id,
        is_captain: p.isCaptain,
        is_vicecaptain: p.isViceCaptain,
      }));

      await assignPlayersToTeam(String(teamId), playerAssignments);

      Alert.alert(
        'Team Created!',
        `${teamName} has been created successfully with ${players.length} players.`,
        [{ text: 'OK', onPress: () => router.replace('/teams') }],
      );
    } catch (error) {
      let errorMessage = 'Failed to create team. Please try again.';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string') {
        errorMessage = (error as any).message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create Your Team</Text>
      <Text style={styles.stepDescription}>Let's start by naming your team</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Team Name</Text>
        <TextInput
          style={styles.textInput}
          value={teamName}
          onChangeText={setTeamName}
          placeholder="Enter your team name"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Location</Text>
        <TextInput
          style={styles.textInput}
          value={teamLocation}
          onChangeText={setTeamLocation}
          placeholder="Enter your location name"
          placeholderTextColor="#9CA3AF"
        />
      </View>


      <View style={styles.teamPreview}>
        <Text style={styles.previewTitle}>{teamName || 'Your Team Name'}</Text>
        <Text style={styles.previewSubtitle}>{teamLocation || 'Your Team Location'}</Text>
        <Text style={styles.previewMeta}>Created by: {organizerDisplayName}</Text>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <Players
      PLAYER_ROLES={PLAYER_ROLES}
      onSquadChange={(players: Player[]) => setPlayers(players.map(p => ({
        ...p,
        isCaptain: typeof p.isCaptain === 'boolean' ? p.isCaptain : false,
        isViceCaptain: typeof p.isViceCaptain === 'boolean' ? p.isViceCaptain : false,
      })))}
      squad={players}
      styles={styles}
    />
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Squad Summary</Text>
      <Text style={styles.stepDescription}>Review your team before creating</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTeamName}>🏏 {teamName}</Text>
        <Text style={styles.summaryPlayers}>{players.length} Players</Text>
        
        <View style={styles.roleDistribution}>
          {PLAYER_ROLES.map((role) => {
            const count = getPlayersByRole(role.id).length;
            return (
              <View key={role.id} style={styles.roleCount}>
                <Text style={styles.roleCountIcon}>{role.icon}</Text>
                <Text style={styles.roleCountText}>{count}</Text>
                <Text style={styles.roleCountLabel}>{role.name}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.leadership}>
          <View style={styles.leadershipItem}>
            <Crown size={16} color="#F59E0B" />
            <Text style={styles.leadershipText}>
              Captain: {players.find(p => p.isCaptain)?.name || 'Not selected'}
            </Text>
          </View>
          <View style={styles.leadershipItem}>
            <Shield size={16} color="#3B82F6" />
            <Text style={styles.leadershipText}>
              Vice-Captain: {players.find(p => p.isViceCaptain)?.name || 'Not selected'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.requirements}>
        <Text style={styles.requirementsTitle}>Requirements Check</Text>
        <View style={styles.requirement}>
          <Text style={players.length >= 5 ? styles.checkmark : styles.cross}>
            {players.length >= 5 ? '✓' : '✗'}
          </Text>
          <Text style={styles.requirementText}>Minimum 5 players ({players.length}/5)</Text>
        </View>
        <View style={styles.requirement}>
          <Text style={players.some(p => p.isCaptain) ? styles.checkmark : styles.cross}>
            {players.some(p => p.isCaptain) ? '✓' : '✗'}
          </Text>
          <Text style={styles.requirementText}>Captain selected</Text>
        </View>
        <View style={styles.requirement}>
          <Text style={players.some(p => p.isViceCaptain) ? styles.checkmark : styles.cross}>
            {players.some(p => p.isViceCaptain) ? '✓' : '✗'}
          </Text>
          <Text style={styles.requirementText}>Vice-Captain selected</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Team</Text>
          <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.homeButtonText}>Home</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stepIndicator}>
          {[1, 2, 3].map((step) => (
            <View key={step} style={styles.stepRow}>
              <View style={[
                styles.stepCircle,
                currentStep >= step && styles.stepCircleActive
              ]}>
                <Text style={[
                  styles.stepNumber,
                  currentStep >= step && styles.stepNumberActive
                ]}>{step}</Text>
              </View>
              {step < 3 && (
                <View style={[
                  styles.stepLine,
                  currentStep > step && styles.stepLineActive
                ]} />
              )}
            </View>
          ))}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </ScrollView>


        <View style={styles.footer}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.backStepButton}
              onPress={() => setCurrentStep(currentStep - 1)}
            >
              <Text style={styles.backStepText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.nextButton,
              (currentStep === 1 && (!teamName.trim() || !teamLocation.trim())) && styles.nextButtonDisabled,
              (currentStep === 3 && !canProceed()) && styles.nextButtonDisabled,
              loading && styles.nextButtonDisabled
            ]}
            onPress={() => {
              if (currentStep < 3) {
                setCurrentStep(currentStep + 1);
              } else {
                handleCreateTeam();
              }
            }}
            disabled={
              (currentStep === 1 && (!teamName.trim() || !teamLocation.trim())) ||
              (currentStep === 3 && !canProceed()) ||
              loading
            }
          >
            <Text style={styles.nextButtonText}>
              {currentStep === 3 ? (loading ? 'Creating...' : 'Create Team') : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  homeButton: {
    minWidth: 48,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#22C55E',
  },
  stepNumber: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#9CA3AF',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#22C55E',
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'column',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  teamPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  previewMeta: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    marginTop: 6,
  },
  addPlayerForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rolesContainer: {
    paddingVertical: 8,
  },
  roleOption: {
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    minWidth: 100,
  },
  roleOptionActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  roleIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  roleName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  roleNameActive: {
    color: '#FFFFFF',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 16,
    zIndex: 1,
    position: 'relative',
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  playersSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  playerInfo: {
    flex: 1,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  playerName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  playerBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  captainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  captainText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#F59E0B',
    marginLeft: 2,
  },
  viceCaptainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  viceCaptainText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#3B82F6',
    marginLeft: 2,
  },
  playerRole: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  playerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryTeamName: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  summaryPlayers: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  roleDistribution: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  roleCount: {
    alignItems: 'center',
  },
  roleCountIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  roleCountText: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  roleCountLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  leadership: {
    gap: 12,
  },
  leadershipItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadershipText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginLeft: 8,
  },
  requirements: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requirementsTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkmark: {
    fontSize: 16,
    color: '#22C55E',
    marginRight: 12,
    width: 20,
  },
  cross: {
    fontSize: 16,
    color: '#EF4444',
    marginRight: 12,
    width: 20,
  },
  requirementText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  backStepButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  backStepText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
   searchPlayerForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchResultsContainer: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22C55E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    paddingVertical: 4,
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 1001,
  },
  addPlayerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 16,
  },
  addPlayerButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  dropdown: {
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
    zIndex: 100,
    marginTop: 4
  },
  dropdownContainer: {
    borderColor: '#ccc',
    overflow: 'scroll'
  },

  searchResultItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    transitionProperty: 'background-color',
    transitionDuration: '200ms',
  },
  searchResultItemSelected: {
    backgroundColor: '#E0F2FE',
    borderColor: '#22C55E',
    borderWidth: 1,
    shadowColor: '#22C55E',
    shadowOpacity: 0.12,
  },
  searchResultText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#2563EB',
    letterSpacing: 0.2,
    textTransform: 'capitalize',
    flex: 1,
  },
  searchResultTextSelected: {
    color: '#22C55E',
    fontWeight: 'bold',
  },
  searchResultCheck: {
    color: '#22C55E',
    fontSize: 18,
    marginLeft: 10,
    fontWeight: 'bold',
  },
});