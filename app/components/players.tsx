import { debounce } from 'lodash';
import { Check, Crown, Shield, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { searchPlayers } from '../service/playerService';
import { getApiErrorMessage } from '../../utils/apiError';
// import { playerSearchStyles } from './players'; // adjust the import path if needed

const minTeamMembers = 11;
const maxTeamMembers = 15;

export interface Player {
  id: string;
  name: string;
  mobile: string;
  role: string;
  isExists?: boolean;
  isOrganizerSelf?: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

interface PlayersProps {
  PLAYER_ROLES: any[];
  onSquadChange: (players: Player[]) => void;
  squad: Player[];
  styles?: any;
  onSave?: (players: Player[]) => void; // <-- Add this
  saving?: boolean; // <-- Optional, for loading state
  organizer?: { name: string; mobile: string };
  existingPlayerMobiles?: string[];
}

const Players = ({
  PLAYER_ROLES,
  onSquadChange,
  squad = [],
  styles = {},
  onSave,
  saving = false,
  organizer,
  existingPlayerMobiles = [],
}: PlayersProps) => {
  const [players, setPlayers] = useState<Player[]>(squad);
  const organizerMobile = String(organizer?.mobile || '').replace(/\D/g, '').slice(-10);
  const organizerAlreadyOnTeam = existingPlayerMobiles.some(
    (mobile) => String(mobile || '').replace(/\D/g, '').slice(-10) === organizerMobile,
  );
  const [organizerAdded, setOrganizerAdded] = useState(
    organizerAlreadyOnTeam || squad.some((player) => player.isOrganizerSelf),
  );
  const [newPlayer, setNewPlayer] = useState<Omit<Player, 'id' | 'isExists'>>({
    name: '',
    mobile: '',
    role: '',
    isCaptain: false,
    isViceCaptain: false,
  });
  const [selectedExistingPlayer, setSelectedExistingPlayer] = useState<Player | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  const normalizePlayerName = (value: string) =>
    value.replace(/[^A-Za-z\s]/g, '').replace(/\s{2,}/g, ' ').slice(0, 40);

  const normalizeMobile = (value: string) => value.replace(/\D/g, '').slice(0, 10);
  const normalizedExistingMobiles = new Set(existingPlayerMobiles.map(normalizeMobile).filter(Boolean));
  const remainingSlots = Math.max(maxTeamMembers - normalizedExistingMobiles.size, 0);
  const stagedMobileExists = (mobile: string) =>
    players.some((player) => normalizeMobile(player.mobile) === normalizeMobile(mobile));
  const isAlreadyOnTeam = (mobile: string) => normalizedExistingMobiles.has(normalizeMobile(mobile));

  const debouncedSearchPlayers = React.useRef(
    debounce(async (term, setResults) => {
      try {
        const results = await searchPlayers(term);
        setSearchError('');
        setResults(results);
      } catch (error) {
        setSearchError(getApiErrorMessage(error, 'Player search is unavailable. Please try again.'));
      }
    }, 300)
  ).current;

  useEffect(() => {
    // Always provide isCaptain and isViceCaptain as booleans
    onSquadChange(players.map(p => ({
      ...p,
      isCaptain: !!p.isCaptain,
      isViceCaptain: !!p.isViceCaptain,
    })));
  }, [players]);

  useEffect(() => {
    if (searchTerm.trim().length >= 3) {
      debouncedSearchPlayers(searchTerm, setSearchResults);
    } else {
      setSearchResults([]);
      setSearchError('');
    }
  }, [searchTerm]);

  useEffect(() => {
    const availableResults = searchResults.filter(
      (player) => !isAlreadyOnTeam(player.mobile) && !stagedMobileExists(player.mobile),
    );
    setSearchModalVisible(searchTerm.trim().length >= 3 && availableResults.length > 0);
  }, [searchResults]);

  const selectExistingPlayerByMobile = (player: Player) => {
    if (isAlreadyOnTeam(player.mobile)) {
      Alert.alert('Already on Team', 'This player is already a member of this team.');
      setSearchModalVisible(false);
      return;
    }
    if (stagedMobileExists(player.mobile)) {
      Alert.alert('Already Selected', 'This player is already selected in the current batch.');
      return;
    }

    setSelectedExistingPlayer(player);
    setNewPlayer({
      name: normalizePlayerName(player.name || ''),
      mobile: normalizeMobile(player.mobile || ''),
      role: player.role || '',
      isCaptain: false,
      isViceCaptain: false,
    });
    setSearchModalVisible(false);
    setSearchResults([]);
  };

  const addPlayer = () => {
    const cleanedName = newPlayer.name.trim();
    const cleanedMobile = normalizeMobile(newPlayer.mobile);

    if (!cleanedName || !cleanedMobile || !newPlayer.role) {
      Alert.alert('Error', 'Please fill in all player details');
      return;
    }
    if (!/^[A-Za-z ]+$/.test(cleanedName)) {
      Alert.alert('Error', 'Player name should contain only letters and spaces');
      return;
    }
    if (!/^\d{10}$/.test(cleanedMobile)) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    if (isAlreadyOnTeam(cleanedMobile)) {
      Alert.alert('Already on Team', 'A player with this mobile number is already a member of this team.');
      return;
    }
    if (stagedMobileExists(cleanedMobile)) {
      Alert.alert('Already Selected', 'A player with this mobile number is already selected.');
      return;
    }
    if (remainingSlots === 0 || players.length >= remainingSlots) {
      Alert.alert(
        'Squad Limit Reached',
        `This team can have only ${maxTeamMembers} players. You can add ${remainingSlots} more player${remainingSlots === 1 ? '' : 's'}.`
      );
      return;
    }
    const player: Player = {
      id: selectedExistingPlayer ? selectedExistingPlayer.id : generatePlayerId(),
      name: cleanedName,
      mobile: cleanedMobile,
      role: newPlayer.role,
      isExists: !!selectedExistingPlayer,
      isCaptain: false,
      isViceCaptain: false,
    };
    setPlayers([...players, player]);
    setNewPlayer({ name: '', mobile: '', role: '', isCaptain: false, isViceCaptain: false });
    setSelectedExistingPlayer(null);
  };

  const removePlayer = (playerId: string) => {
    setPlayers(players.filter(p => p.id !== playerId));
  };

  const setCaptain = (playerId: string) => {
    setPlayers(players.map(p => ({
      ...p,
      isCaptain: p.id === playerId,
      isViceCaptain: p.id === playerId ? false : p.isViceCaptain,
    })));
  };

  const setViceCaptain = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (player?.isCaptain) {
      Alert.alert('Error', 'Captain cannot be vice-captain');
      return;
    }
    const shouldSelect = !player?.isViceCaptain;
    setPlayers(players.map(p => ({
      ...p,
      isViceCaptain: p.id === playerId ? shouldSelect : false,
    })));
  };

  const generatePlayerId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const getSixDigitRandom = () => {
      const cryptoRef = (globalThis as any).crypto;
      if (cryptoRef?.getRandomValues) {
        const arr = new Uint32Array(1);
        cryptoRef.getRandomValues(arr);
        return String(arr[0] % 1000000).padStart(6, '0');
      }
      return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    };

    // Retry a few times to avoid collisions in the current squad.
    let candidate = '';
    for (let i = 0; i < 5; i += 1) {
      candidate = `${year}${month}${day}${getSixDigitRandom()}`;
      if (!players.some((p) => p.id === candidate)) {
        return candidate;
      }
    }

    // Last-resort fallback adds current milliseconds for extra uniqueness.
    return `${year}${month}${day}${getSixDigitRandom()}${String(now.getMilliseconds()).padStart(3, '0')}`;
  };

  const addOrganizerPlayer = () => {
    const organizerName = normalizePlayerName(organizer?.name || '').trim();
    const normalizedOrganizerMobile = normalizeMobile(organizer?.mobile || '');
    if (!organizerName || !/^\d{10}$/.test(normalizedOrganizerMobile)) {
      Alert.alert('Organizer details unavailable', 'A valid organizer name and mobile number are required.');
      return;
    }
    if (players.some((player) => normalizeMobile(player.mobile) === normalizedOrganizerMobile)) {
      Alert.alert('Already in squad', 'The organizer is already included as a player in this team.');
      setOrganizerAdded(true);
      return;
    }
    if (remainingSlots === 0 || players.length >= remainingSlots) {
      Alert.alert('Squad Full', `This team already has ${maxTeamMembers} selected or saved players.`);
      return;
    }

    setPlayers((currentPlayers) => [
      ...currentPlayers,
      {
        id: generatePlayerId(),
        name: organizerName,
        mobile: normalizedOrganizerMobile,
        role: 'allrounder',
        isExists: false,
        isOrganizerSelf: true,
        isCaptain: false,
        isViceCaptain: false,
      },
    ]);
    setOrganizerAdded(true);
  };

  return (
    <View style={[styles.stepContent, playerSearchStyles.screenContainer]}>
      <ScrollView
        style={playerSearchStyles.screenScroll}
        contentContainerStyle={playerSearchStyles.screenScrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        nestedScrollEnabled
      >
        <Text style={styles.stepTitle}>Add or Search Players</Text>
        <Text style={styles.stepDescription}>Enter mobile number to find existing player, or add a new player below.</Text>
        <View style={playerSearchStyles.capacityBanner}>
          <Text style={playerSearchStyles.capacityTitle}>
            {normalizedExistingMobiles.size + players.length} / {maxTeamMembers} players
          </Text>
          <Text style={playerSearchStyles.capacityText}>
            {Math.max(remainingSlots - players.length, 0)} slots remaining
          </Text>
        </View>
        {!!organizer && !organizerAdded && !organizerAlreadyOnTeam && (
        <View style={playerSearchStyles.organizerPlayerCard}>
          <TouchableOpacity
            style={playerSearchStyles.organizerCheckboxRow}
            onPress={addOrganizerPlayer}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: false }}
            accessibilityLabel="Add yourself as a player"
          >
            <View style={playerSearchStyles.checkbox}>
              <Check size={16} color="transparent" />
            </View>
            <View style={playerSearchStyles.organizerCheckboxCopy}>
              <Text style={playerSearchStyles.organizerCheckboxTitle}>Add yourself as a player</Text>
              <Text style={playerSearchStyles.organizerCheckboxSubtitle}>
                {organizer?.name || 'Organizer'} will be included in this squad.
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        )}
        <View style={styles.playersSection}>
          <View style={[styles.inputGroup, styles.inputHalf, { position: 'relative', zIndex: 100 }]}>
            <Text style={styles.inputLabel}>Mobile Number</Text>
            <View style={{ position: 'relative', width: '100%' }}>
              <TextInput
                style={styles.textInput}
                value={newPlayer.mobile}
                onChangeText={(value) => {
                  const normalizedMobile = normalizeMobile(value);
                  setNewPlayer({ ...newPlayer, mobile: normalizedMobile });
                  setSelectedExistingPlayer(null);
                  setSearchTerm(normalizedMobile);
                }}
                placeholder="10-digit number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                maxLength={10}
                editable={true}
              />
              {!!searchError && (
                <Text style={{ color: '#B91C1C', fontSize: 12, marginTop: 6 }}>{searchError}</Text>
              )}
              {searchModalVisible && (
                <View style={[playerSearchStyles.searchResultsContainer, { maxHeight: 300, width: '100%', zIndex: 2002, elevation: 10, position: 'absolute' }]}>
                  <ScrollView
                    style={{ maxHeight: 300 }}
                    contentContainerStyle={{ flexGrow: 0 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {searchResults
                      .filter(player => !isAlreadyOnTeam(player.mobile) && !stagedMobileExists(player.mobile))
                      .map((player) => {
                        return (
                          <TouchableOpacity
                            key={player.id}
                            style={playerSearchStyles.searchResultItem}
                            onPress={() => selectExistingPlayerByMobile(player)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={playerSearchStyles.searchResultText}>
                                {player.mobile} - {player.name}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    {searchResults.filter(player => !isAlreadyOnTeam(player.mobile) && !stagedMobileExists(player.mobile)).length === 0 && (
                      <Text style={{ padding: 12, color: '#6B7280', textAlign: 'center' }}>No available players found</Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.inputGroup, styles.inputHalf, { position: 'relative', zIndex: 90 }]}> 
            <Text style={styles.inputLabel}>Player Name</Text>
            <View style={{ position: 'relative', width: '100%' }}>
              <TextInput
                style={styles.textInput}
                value={newPlayer.name}
                onChangeText={async (value) => {
                  const normalizedName = normalizePlayerName(value);
                  setNewPlayer({ ...newPlayer, name: normalizedName });
                  setSelectedExistingPlayer(null);
                }}
                placeholder="Full name"
                placeholderTextColor="#9CA3AF"
                editable={true}
              />
            </View>
          </View>
          <View style={[styles.inputGroup]}>
            <Text style={styles.inputLabel}>Player Role</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rolesContainer}>
              {PLAYER_ROLES.map((role) => (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.roleOption,
                    newPlayer.role === role.id && styles.roleOptionActive
                  ]}
                  onPress={() => setNewPlayer({ ...newPlayer, role: role.id })}
                >
                  <Text style={styles.roleIcon}>{role.icon}</Text>
                  <Text style={[
                    styles.roleName,
                    newPlayer.role === role.id && styles.roleNameActive
                  ]}>{role.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity
            style={[styles.addButton, players.length >= remainingSlots && playerSearchStyles.disabledAddButton]}
            onPress={addPlayer}
            disabled={players.length >= remainingSlots}
          >
            <Text style={styles.addButtonText}>Add Player</Text>
          </TouchableOpacity>
          <View style={{ marginTop: 30 }}>
            {players.length > 0 && (
              <Text style={styles.sectionTitle}>
                New Players ({players.length}/{remainingSlots})
              </Text>
            )}
            {/* Use .map instead of FlatList */}
            {players.map((player) => (
              <View key={player.id} style={playerSearchStyles.stagedPlayerCard}>
                <View style={styles.playerInfo}>
                  <View style={styles.playerHeader}>
                    <Text style={styles.playerName}>{player.name}</Text>
                    <View style={styles.playerBadges}>
                      {player.isCaptain && (
                        <View style={styles.captainBadge}>
                          <Crown size={12} color="#F59E0B" />
                          <Text style={styles.captainText}>C</Text>
                        </View>
                      )}
                      {player.isViceCaptain && (
                        <View style={styles.viceCaptainBadge}>
                          <Shield size={12} color="#3B82F6" />
                          <Text style={styles.viceCaptainText}>VC</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.playerRole}>
                    {PLAYER_ROLES.find(r => r.id === player.role)?.name} • {player.mobile}
                  </Text>
                </View>
                <View style={playerSearchStyles.playerActionGrid}>
                  <TouchableOpacity
                    style={[
                      playerSearchStyles.playerActionButton,
                      player.isCaptain && playerSearchStyles.captainActionActive,
                    ]}
                    onPress={() => setCaptain(player.id)}
                    accessibilityLabel={`Set ${player.name} as captain`}
                  >
                    <Crown size={18} color={player.isCaptain ? '#92400E' : '#475569'} />
                    <Text style={playerSearchStyles.playerActionText}>Captain</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      playerSearchStyles.playerActionButton,
                      player.isViceCaptain && playerSearchStyles.viceActionActive,
                    ]}
                    onPress={() => setViceCaptain(player.id)}
                    accessibilityLabel={`Set ${player.name} as vice captain`}
                  >
                    <Shield size={18} color={player.isViceCaptain ? '#1D4ED8' : '#475569'} />
                    <Text style={playerSearchStyles.playerActionText}>Vice Captain</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[playerSearchStyles.playerActionButton, playerSearchStyles.removeAction]}
                    onPress={() => removePlayer(player.id)}
                    accessibilityLabel={`Remove ${player.name}`}
                  >
                    <Trash2 size={18} color="#B91C1C" />
                    <Text style={[playerSearchStyles.playerActionText, playerSearchStyles.removeActionText]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
          {players.length > 0 && onSave && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: saving ? '#9CA3AF' : '#22C55E', marginTop: 16 }]}
              onPress={() => onSave(players)}
              disabled={saving}
            >
              <Text style={styles.addButtonText}>{saving ? 'Saving...' : 'Save Players'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default Players;

export const playerSearchStyles = StyleSheet.create({
  capacityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  capacityTitle: {
    color: '#1E3A8A',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  capacityText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  disabledAddButton: {
    backgroundColor: '#94A3B8',
    opacity: 0.7,
  },
  screenContainer: {
    flex: 1,
    minHeight: 0,
  },
  screenScroll: {
    flex: 1,
  },
  screenScrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  stagedPlayerCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  playerActionGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  playerActionButton: {
    minWidth: 104,
    minHeight: 44,
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  captainActionActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  viceActionActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#DBEAFE',
  },
  removeAction: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  playerActionText: {
    color: '#334155',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  removeActionText: {
    color: '#B91C1C',
  },
  organizerPlayerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  organizerCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  organizerCheckboxCopy: {
    flex: 1,
  },
  organizerCheckboxTitle: {
    color: '#111827',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  organizerCheckboxSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  organizerRoles: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  organizerRoleLabel: {
    color: '#374151',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  organizerRoleOption: {
    minWidth: 92,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  organizerRoleOptionActive: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  organizerRoleIcon: {
    fontSize: 18,
    marginBottom: 3,
  },
  organizerRoleText: {
    color: '#475569',
    fontSize: 11,
    fontFamily: 'Inter-Medium',
  },
  organizerRoleTextActive: {
    color: '#166534',
    fontFamily: 'Inter-SemiBold',
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
    zIndex: 1002,
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
