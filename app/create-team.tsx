import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  /*
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create Your Team</Text>
      <Text style={styles.stepDescription}>Add the team details now. Players can be added after creation.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Team Name</Text>
        <TextInput
          style={[styles.textInput, duplicateTeam && styles.duplicateInput]}
          value={teamName}
          onChangeText={(value) => {
            setTeamName(value);
            setShowTeamSuggestions(true);
          }}
          onFocus={() => setShowTeamSuggestions(true)}
          placeholder="Enter your team name"
          placeholderTextColor="#9CA3AF"
        />
        {showTeamSuggestions && teamNameSuggestions.length > 0 && (
          <View style={styles.teamSuggestions}>
            {teamNameSuggestions.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={styles.teamSuggestionItem}
                onPress={() => {
                  setTeamName(team.name);
                  setShowTeamSuggestions(false);
                }}
              >
                <TeamInitialsLogo name={team.name} size={34} />
                <View style={styles.teamSuggestionCopy}>
                  <Text style={styles.teamSuggestionName}>{team.name}</Text>
                  <Text style={styles.teamSuggestionLocation}>
                    {[team.location, team.city].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {!!duplicateTeam && (
          <Text style={styles.duplicateText}>
            This team already exists in the selected city and location. Choose another name.
          </Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>State / Union Territory</Text>
        <DropDownPicker
          open={openState}
          value={selectedState}
          items={stateList}
          setOpen={setOpenState}
          setValue={setSelectedState}
          setItems={setStateList}
          searchable
          listMode="MODAL"
          searchPlaceholder="Search states"
          placeholder="Select state"
          style={styles.dropdownField}
          dropDownContainerStyle={styles.dropdownMenu}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>City</Text>
        <DropDownPicker
          open={openCity}
          value={selectedCity}
          items={cityList}
          setOpen={setOpenCity}
          setValue={setSelectedCity}
          setItems={setCityList}
          searchable
          listMode="MODAL"
          searchPlaceholder="Search cities"
          placeholder={selectedState ? 'Select city' : 'Select state first'}
          disabled={!selectedState}
          style={styles.dropdownField}
          dropDownContainerStyle={styles.dropdownMenu}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Location / Area</Text>
        <TextInput
          style={styles.textInput}
          value={teamLocation}
          onChangeText={setTeamLocation}
          placeholder="Enter your location name"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.teamPreview}>
        <TeamInitialsLogo name={teamName} size={64} />
        <Text style={styles.previewTitle}>{teamName || 'Your Team Name'}</Text>
        <Text style={styles.previewSubtitle}>
          {[teamLocation, selectedCity].filter(Boolean).join(', ') || 'Your Team Location'}
        </Text>
        <Text style={styles.previewMeta}>Created by: {organizerDisplayName}</Text>
      </View>
    </View>
  );

  */
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './auth/auth-context';
import TeamInitialsLogo from './components/TeamInitialsLogo';
import { createTeam, fetchTeams } from './service/teamsService';
import { getCityItemsForState, INDIAN_STATE_OPTIONS } from '../constants/indianLocations';
import { getApiErrorMessage } from '../utils/apiError';

const buildStateItems = () => INDIAN_STATE_OPTIONS.map((state) => ({
  label: state,
  value: state,
}));

type ExistingTeam = {
  id: number;
  name: string;
  state?: string;
  city?: string;
  location: string;
};

export default function CreateTeamScreen() {
  const auth = useAuth();

  if (!auth) {
    return <Text>Loading auth context...</Text>;
  }

  const { user } = auth;
  const userRole = String(user?.role || 'player').toLowerCase();
  const canManage = userRole === 'organizer' || userRole === 'admin';
  const currentUserMobile = String(user?.phone || '');
  const organizerDisplayName = String(user?.name || '').trim() || 'Organizer';
  const [teamName, setTeamName] = useState('');
  const [selectedState, setSelectedState] = useState('Tamil Nadu');
  const [selectedCity, setSelectedCity] = useState('Chennai');
  const [teamLocation, setTeamLocation] = useState('');
  const [openState, setOpenState] = useState(false);
  const [openCity, setOpenCity] = useState(false);
  const [stateList, setStateList] = useState<{ label: string; value: string }[]>(buildStateItems());
  const [cityList, setCityList] = useState<{ label: string; value: string }[]>(getCityItemsForState('Tamil Nadu'));
  const [existingTeams, setExistingTeams] = useState<ExistingTeam[]>([]);
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSport] = useState(1);
  const submissionLockedRef = useRef(false);

  const stripCountryCode = (number: string, code = '91') => {
    const digitsOnly = String(number || '').replace(/\D/g, '');
    return digitsOnly.startsWith(code) && digitsOnly.length > 10
      ? digitsOnly.slice(code.length)
      : digitsOnly;
  };

  useEffect(() => {
    const nextCities = getCityItemsForState(selectedState);
    setCityList(nextCities);
    if (!nextCities.some((city) => city.value === selectedCity)) {
      setSelectedCity('');
    }
  }, [selectedState]);

  useEffect(() => {
    if (!canManage || !currentUserMobile) return;

    const loadExistingTeams = async () => {
      try {
        const response = await fetchTeams();
        setExistingTeams(Array.isArray(response?.teams) ? response.teams : []);
      } catch {
        setExistingTeams([]);
      }
    };

    loadExistingTeams();
  }, [canManage, currentUserMobile]);

  useEffect(() => {
    if (!canManage) {
      Alert.alert('Access Denied', 'Only organizers or admins can create and manage teams.');
      router.replace('/(tabs)');
    }
  }, [canManage]);

  const normalizeComparison = (value: unknown) =>
    String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const duplicateTeam = existingTeams.find((team) =>
    normalizeComparison(team.name) === normalizeComparison(teamName) &&
    normalizeComparison(team.city) === normalizeComparison(selectedCity) &&
    normalizeComparison(team.location) === normalizeComparison(teamLocation)
  );
  const teamNameSuggestions = teamName.trim()
    ? existingTeams
        .filter((team) => normalizeComparison(team.name).includes(normalizeComparison(teamName)))
        .slice(0, 5)
    : [];

  const canProceed = () => {
    return !!(
      teamName.trim() &&
      selectedState &&
      selectedCity &&
      teamLocation.trim() &&
      !duplicateTeam
    );
  };

  const handleCreateTeam = async () => {
    if (submissionLockedRef.current) return;

    if (duplicateTeam) {
      Alert.alert(
        'Team Already Exists',
        `${duplicateTeam.name} already exists in ${duplicateTeam.location}, ${duplicateTeam.city}. Please choose another team name.`,
      );
      return;
    }

    if (!canProceed()) {
      Alert.alert(
        'Complete Team Details',
        'Enter a team name, state, city, and location before creating the team.'
      );
      return;
    }

    submissionLockedRef.current = true;
    setLoading(true);
    let createdTeamId: string | number | null = null;
    try {
      const payload = {
        name: teamName,
        state: selectedState,
        city: selectedCity,
        location: teamLocation,
        sportId: selectedSport,
        createdBy: stripCountryCode(currentUserMobile),
      };

      const teamData = await createTeam(payload);
      if (teamData?.alreadyExisted) {
        Alert.alert(
          'Team Already Exists',
          `${teamData.team.name} already exists in ${teamData.team.location}, ${teamData.team.city}. Please choose another team name.`,
        );
        return;
      }
      const teamId = teamData?.team?.id;
      createdTeamId = teamId || null;

      if (!teamId) {
        throw new Error('Team creation failed. No team ID returned.');
      }

      router.replace({
        pathname: '/teams',
        params: { teamId: String(teamId) },
      });
      Alert.alert('Team Created!', `${teamName} was created. Add players from the team details screen.`);
    } catch (error) {
      Alert.alert('Unable to Create Team', getApiErrorMessage(error, 'Failed to create the team. Please try again.'));
    } finally {
      if (!createdTeamId) {
        submissionLockedRef.current = false;
        setLoading(false);
      }
    }
  };
  
  /*
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Location / Area</Text>
        <TextInput
          style={styles.textInput}
          value={teamLocation}
          onChangeText={setTeamLocation}
          placeholder="Enter your location name"
          placeholderTextColor="#9CA3AF"
        />
      </View>


      <View style={styles.teamPreview}>
        <TeamInitialsLogo name={teamName} size={64} />
        <Text style={styles.previewTitle}>{teamName || 'Your Team Name'}</Text>
        <Text style={styles.previewSubtitle}>
          {[teamLocation, selectedCity].filter(Boolean).join(', ') || 'Your Team Location'}
        </Text>
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
      organizer={{
        name: organizerDisplayName,
        mobile: stripCountryCode(currentUserMobile),
      }}
    />
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Squad Summary</Text>
      <Text style={styles.stepDescription}>Review your team before creating</Text>

      <View style={styles.summaryCard}>
        <TeamInitialsLogo name={teamName} size={58} />
        <Text style={styles.summaryTeamName}>{teamName}</Text>
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

  */

  const renderTeamForm = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create Your Team</Text>
      <Text style={styles.stepDescription}>Add the team details now. Players can be added after creation.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Team Name</Text>
        <TextInput
          style={[styles.textInput, duplicateTeam && styles.duplicateInput]}
          value={teamName}
          onChangeText={(value) => {
            setTeamName(value);
            setShowTeamSuggestions(true);
          }}
          onFocus={() => setShowTeamSuggestions(true)}
          placeholder="Enter your team name"
          placeholderTextColor="#9CA3AF"
        />
        {showTeamSuggestions && teamNameSuggestions.length > 0 && (
          <View style={styles.teamSuggestions}>
            {teamNameSuggestions.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={styles.teamSuggestionItem}
                onPress={() => {
                  setTeamName(team.name);
                  setShowTeamSuggestions(false);
                }}
              >
                <TeamInitialsLogo name={team.name} size={34} />
                <View style={styles.teamSuggestionCopy}>
                  <Text style={styles.teamSuggestionName}>{team.name}</Text>
                  <Text style={styles.teamSuggestionLocation}>
                    {[team.location, team.city].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {!!duplicateTeam && (
          <Text style={styles.duplicateText}>
            This team already exists in the selected city and location. Choose another name.
          </Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>State / Union Territory</Text>
        <DropDownPicker
          open={openState}
          value={selectedState}
          items={stateList}
          setOpen={setOpenState}
          setValue={setSelectedState}
          setItems={setStateList}
          searchable
          listMode="MODAL"
          searchPlaceholder="Search states"
          placeholder="Select state"
          style={styles.dropdownField}
          dropDownContainerStyle={styles.dropdownMenu}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>City</Text>
        <DropDownPicker
          open={openCity}
          value={selectedCity}
          items={cityList}
          setOpen={setOpenCity}
          setValue={setSelectedCity}
          setItems={setCityList}
          searchable
          listMode="MODAL"
          searchPlaceholder="Search cities"
          placeholder={selectedState ? 'Select city' : 'Select state first'}
          disabled={!selectedState}
          style={styles.dropdownField}
          dropDownContainerStyle={styles.dropdownMenu}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Location / Area</Text>
        <TextInput
          style={styles.textInput}
          value={teamLocation}
          onChangeText={setTeamLocation}
          placeholder="Enter your location name"
          placeholderTextColor="#9CA3AF"
        />
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

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.formScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderTeamForm()}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.nextButton,
                !canProceed() && styles.nextButtonDisabled,
                loading && styles.nextButtonDisabled
              ]}
              onPress={() => {
                if (duplicateTeam) {
                  Alert.alert(
                    'Team Already Exists',
                    `${duplicateTeam.name} already exists in ${duplicateTeam.location}, ${duplicateTeam.city}. Please choose another team name.`,
                  );
                  return;
                }
                handleCreateTeam();
              }}
              disabled={!canProceed() || loading}
            >
              <Text style={styles.nextButtonText}>
                {loading ? 'Creating...' : 'Create Team'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  formScrollContent: {
    paddingBottom: 24,
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
  duplicateInput: {
    borderColor: '#DC2626',
  },
  duplicateText: {
    marginTop: 6,
    color: '#B91C1C',
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    lineHeight: 17,
  },
  teamSuggestions: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  teamSuggestionItem: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  teamSuggestionCopy: {
    flex: 1,
  },
  teamSuggestionName: {
    color: '#0F172A',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  teamSuggestionLocation: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  dropdownField: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
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
    marginTop: 12,
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
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 12,
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
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 }),
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
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(37, 99, 235, 0.06)' }
      : { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 }),
    elevation: 1,
    transitionProperty: 'background-color',
    transitionDuration: '200ms',
  },
  searchResultItemSelected: {
    backgroundColor: '#E0F2FE',
    borderColor: '#22C55E',
    borderWidth: 1,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(34, 197, 94, 0.12)' }
      : { shadowColor: '#22C55E', shadowOpacity: 0.12 }),
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