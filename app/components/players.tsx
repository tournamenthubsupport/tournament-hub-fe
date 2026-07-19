import { debounce } from 'lodash';
import { Crown, Shield, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Player } from '../create-team'; // <-- Import Player type
import { searchPlayers } from '../service/playerService';
// import { playerSearchStyles } from './players'; // adjust the import path if needed

const minTeamMembers = 11;
const maxTeamMembers = 15;

interface PlayersProps {
  PLAYER_ROLES: any[];
  onSquadChange: (players: Player[]) => void;
  squad: Player[];
  styles?: any;
  onSave?: (players: Player[]) => void; // <-- Add this
  saving?: boolean; // <-- Optional, for loading state
}

const Players = ({
  PLAYER_ROLES,
  onSquadChange,
  squad = [],
  styles = {},
  onSave,
  saving = false,
}: PlayersProps) => {
  const [players, setPlayers] = useState<Player[]>(squad);
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
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  const normalizePlayerName = (value: string) =>
    value.replace(/[^A-Za-z\s]/g, '').replace(/\s{2,}/g, ' ').slice(0, 40);

  const normalizeMobile = (value: string) => value.replace(/\D/g, '').slice(0, 10);

  const debouncedSearchPlayers = React.useRef(
    debounce(async (term, setResults) => {
      try {
        const results = await searchPlayers(term);
        setResults(results);
      } catch {
        setResults([]);
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
    }
  }, [searchTerm]);

  useEffect(() => {
    setSearchModalVisible(searchTerm.trim().length >= 3 && searchResults.length > 0);
  }, [searchResults]);

  const selectExistingPlayerByMobile = (player: Player) => {
    if (players.some((p) => p.mobile === player.mobile)) {
      Alert.alert('Error', 'This player is already in the team');
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
    if (players.some(p => p.mobile === cleanedMobile)) {
      Alert.alert('Error', 'A player with this mobile number already exists');
      return;
    }
    if (players.length >= maxTeamMembers) {
      Alert.alert(
        'Error',
        `Players already max added (${maxTeamMembers}). Please delete some players and add again.`
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
      isViceCaptain: p.isCaptain ? false : p.isViceCaptain,
    })));
  };

  const setViceCaptain = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (player?.isCaptain) {
      Alert.alert('Error', 'Captain cannot be vice-captain');
      return;
    }
    setPlayers(players.map(p => ({
      ...p,
      isViceCaptain: p.id === playerId ? !p.isViceCaptain : p.isViceCaptain,
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

  return (
    <View style={styles.stepContent}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} pointerEvents="box-none">
        <Text style={styles.stepTitle}>Add or Search Players</Text>
        <Text style={styles.stepDescription}>Enter mobile number to find existing player, or add a new player below.</Text>
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
              {searchModalVisible && (
                <View style={[playerSearchStyles.searchResultsContainer, { maxHeight: 300, width: '100%', zIndex: 2002, elevation: 10, position: 'absolute' }]}>
                  <ScrollView
                    style={{ maxHeight: 300 }}
                    contentContainerStyle={{ flexGrow: 0 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {searchResults
                      .filter(player => !players.some(p => p.mobile === player.mobile))
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
                    {searchResults.filter(player => !players.some(p => p.mobile === player.mobile)).length === 0 && (
                      <Text style={{ padding: 12, color: '#6B7280', textAlign: 'center' }}>No players found</Text>
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
          <TouchableOpacity style={styles.addButton} onPress={addPlayer}>
            <Text style={styles.addButtonText}>Add Player</Text>
          </TouchableOpacity>
          <View style={{ marginTop: 30 }}>
            {players.length > 0 && (
              <Text style={styles.sectionTitle}>Squad ({players.length}/15)</Text>
            )}
            {/* Use .map instead of FlatList */}
            {players.map((player) => (
              <View key={player.id} style={styles.playerCard}>
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
                <View style={styles.playerActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setCaptain(player.id)}
                  >
                    <Crown size={16} color={player.isCaptain ? "#F59E0B" : "#9CA3AF"} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setViceCaptain(player.id)}
                  >
                    <Shield size={16} color={player.isViceCaptain ? "#3B82F6" : "#9CA3AF"} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => removePlayer(player.id)}
                  >
                    <Trash2 size={16} color="#EF4444" />
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
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
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
