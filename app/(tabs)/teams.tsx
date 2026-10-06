import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Check, Pencil, Trash2, UserPlus, Users, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/auth-context';
import { Header } from '../components/AppHeader';
import Players from '../components/players';
import TeamInitialsLogo from '../components/TeamInitialsLogo';
import { insertPlayersBulk, updatePlayer } from '../service/playerService';
import { assignPlayersToTeam, getPlayersForTeams, getTeamsForPlayer, leaveTeam, removePlayerFromTeam } from '../service/teamPlayerService';
import { deleteTeam, fetchTeams, fetchTeamsByMobile, updateTeam } from '../service/teamsService';
import { fetchTournaments, fetchTournamentsByContact } from '../service/tournamentService';
import { getTournamentsForTeams } from '../service/tournamentTeamsService';
import { getApiErrorMessage } from '../../utils/apiError';
import { getCityItemsForState, INDIAN_STATE_OPTIONS } from '../../constants/indianLocations';

type Team = {
  id: number;
  name: string;
  sport: string;
  members: number;
  role: string;
  image: string;
  tournaments: number;
  wins: number;
  founded: string;
  createdBy: string;
  state?: string;
  city?: string;
  location: string;
};

const PLAYER_ROLES = [
  { id: 'batsman', name: 'Batsman' },
  { id: 'bowler', name: 'Bowler' },
  { id: 'allrounder', name: 'All-rounder' },
  { id: 'wicketkeeper', name: 'Wicket Keeper' },
];

const buildStateItems = () => INDIAN_STATE_OPTIONS.map((state) => ({ label: state, value: state }));

type Tournament = {
  id: number;
  name: string;
  sport?: string;
  teams?: number;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  image?: string;
};

export default function TeamsScreen() {
  const params = useLocalSearchParams<{ teamId?: string | string[] }>();
  const requestedTeamId = Array.isArray(params.teamId) ? params.teamId[0] : params.teamId;
  const directOpenHandledRef = useRef('');
  const [mounted, setMounted] = useState(false);
  const [teamPlayersMap, setTeamPlayersMap] = useState<{ [teamId: string]: any[] }>({});
  const [teamTournamentsMap, setTeamTournamentsMap] = useState<{ [teamId: string]: any[] }>({});
  const [showPlayerScreen, setShowPlayerScreen] = useState(false);
  const [playerScreenTeam, setPlayerScreenTeam] = useState<Team | null>(null);
  const [addingPlayers, setAddingPlayers] = useState(false);
  const [leavingTeam, setLeavingTeam] = useState(false);
  const [removingPlayerId, setRemovingPlayerId] = useState<number | null>(null);
  const [showTeamEditModal, setShowTeamEditModal] = useState(false);
  const [teamEditDraft, setTeamEditDraft] = useState({ name: '', state: '', city: '', location: '' });
  const [teamStateOpen, setTeamStateOpen] = useState(false);
  const [teamCityOpen, setTeamCityOpen] = useState(false);
  const [teamStateItems, setTeamStateItems] = useState<{ label: string; value: string }[]>(buildStateItems());
  const [teamCityItems, setTeamCityItems] = useState<{ label: string; value: string }[]>([]);
  const [savingTeamDetails, setSavingTeamDetails] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
  const [playerEditDraft, setPlayerEditDraft] = useState({ name: '', mobile: '', role: '' });
  const [savingPlayer, setSavingPlayer] = useState(false);

  const user = useAuth()?.user;
  const userId = user?.id;
  const phone = user?.phone || '';
  const userRole = (user?.role || 'player').toLowerCase();
  const isAdmin = userRole === 'admin';
  const isOrganizer = userRole === 'organizer';
  const isPrivileged = isOrganizer || isAdmin;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !userId) {
      router.replace({ pathname: '/auth/auth-screen', params: { returnTo: '/(tabs)/teams' } });
    }
  }, [mounted, userId]);

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [createdTournaments, setCreatedTournaments] = useState<Tournament[]>([]);
  const [joinedTournaments, setJoinedTournaments] = useState<Tournament[]>([]);

  const myTeams = teams;

  const playerLookupKey = String(phone || '').trim();
  const normalizeContact = (value: unknown) => String(value || '').replace(/\D/g, '').slice(-10);

  const uniqueTournamentsFromMap = (tournamentsByTeam: { [teamId: string]: any[] }) => {
    const tournamentMap = new Map<number, any>();
    Object.values(tournamentsByTeam || {}).forEach((items) => {
      if (!Array.isArray(items)) return;
      items.forEach((t) => {
        if (t?.id && !tournamentMap.has(t.id)) {
          tournamentMap.set(t.id, t);
        }
      });
    });
    return Array.from(tournamentMap.values());
  };

  const formatPlayerName = (value?: string) =>
    String(value || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');

  const getPlayerInitials = (value?: string) => {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }

    const first = parts[0] || '';
    return first.slice(0, 2).toUpperCase();
  };

  const refreshTeamsAndPlayers = async () => {
    try {
      setLoadingTeams(true);

      if (isAdmin) {
        const [teamsData, tournamentsData] = await Promise.all([
          fetchTeams(),
          fetchTournaments().catch(() => ({ tournaments: [] }))
        ]);

        const allTeams = (teamsData?.teams || []) as Team[];
        setTeams(allTeams);
        setCreatedTournaments((tournamentsData?.tournaments || []) as Tournament[]);

        const allTeamIds = allTeams.map((team: Team) => team.id.toString());

        if (allTeamIds.length > 0) {
          const [tournamentsByTeam, playersData] = await Promise.all([
            getTournamentsForTeams(allTeamIds as any),
            getPlayersForTeams(allTeamIds)
          ]);

          setTeamTournamentsMap((tournamentsByTeam || {}) as { [teamId: string]: any[] });
          const map: { [teamId: string]: any[] } = {};
          Object.entries((playersData || {}) as { [key: string]: any[] }).forEach(([teamId, players]) => {
            map[teamId] = Array.isArray(players) ? players : [];
          });
          setTeamPlayersMap(map);
          setJoinedTournaments(uniqueTournamentsFromMap((tournamentsByTeam || {}) as { [teamId: string]: any[] }));
        } else {
          setTeamPlayersMap({});
          setTeamTournamentsMap({});
          setJoinedTournaments([]);
        }
      } else if (isOrganizer) {
        const normalizedPhone = String(phone || '').trim();
        const [teamsData, createdTournamentData] = await Promise.all([
          fetchTeamsByMobile(normalizedPhone),
          fetchTournamentsByContact(normalizedPhone).catch(() => ({ tournaments: [] }))
        ]);

        const organizerTeams = (teamsData?.teams || []) as Team[];
        setTeams(organizerTeams);
        setCreatedTournaments((createdTournamentData?.tournaments || []) as Tournament[]);

        const organizerTeamIds = organizerTeams.map((team: Team) => team.id.toString());

        if (organizerTeamIds.length > 0) {
          const [tournamentsByTeam, playersData] = await Promise.all([
            getTournamentsForTeams(organizerTeamIds as any),
            getPlayersForTeams(organizerTeamIds)
          ]);

          setTeamTournamentsMap((tournamentsByTeam || {}) as { [teamId: string]: any[] });
          const map: { [teamId: string]: any[] } = {};
          Object.entries((playersData || {}) as { [key: string]: any[] }).forEach(([teamId, players]) => {
            map[teamId] = Array.isArray(players) ? players : [];
          });
          setTeamPlayersMap(map);
          setJoinedTournaments(uniqueTournamentsFromMap((tournamentsByTeam || {}) as { [teamId: string]: any[] }));
        } else {
          setTeamPlayersMap({});
          setTeamTournamentsMap({});
          setJoinedTournaments([]);
        }
      } else {
        const teamsData = await getTeamsForPlayer(playerLookupKey || String(userId || ''));
        const playerTeams = (teamsData?.teams || []) as Team[];
        setTeams(playerTeams);
        setCreatedTournaments([]);

        const playerTeamIds = playerTeams.map((team: Team) => team.id.toString());

        if (playerTeamIds.length > 0) {
          const [tournamentsByTeam, playersData] = await Promise.all([
            getTournamentsForTeams(playerTeamIds as any),
            getPlayersForTeams(playerTeamIds)
          ]);

          setTeamTournamentsMap((tournamentsByTeam || {}) as { [teamId: string]: any[] });
          const map: { [teamId: string]: any[] } = {};
          Object.entries((playersData || {}) as { [key: string]: any[] }).forEach(([teamId, players]) => {
            map[teamId] = Array.isArray(players) ? players : [];
          });
          setTeamPlayersMap(map);
          setJoinedTournaments(uniqueTournamentsFromMap((tournamentsByTeam || {}) as { [teamId: string]: any[] }));
        } else {
          setTeamPlayersMap({});
          setTeamTournamentsMap({});
          setJoinedTournaments([]);
        }
      }
    } catch (error) {
      setTeams([]);
      setCreatedTournaments([]);
      setJoinedTournaments([]);
      setTeamPlayersMap({});
      setTeamTournamentsMap({});
      Alert.alert('Unable to Load Teams', getApiErrorMessage(error, 'Could not load your teams. Pull down to try again.'));
    } finally {
      setLoadingTeams(false);
    }
  };

  useEffect(() => {
    if (!phone) return;
    refreshTeamsAndPlayers();
  }, [phone, userId, userRole]);

  useEffect(() => {
    const normalizedTeamId = String(requestedTeamId || '').trim();
    if (!normalizedTeamId || loadingTeams || directOpenHandledRef.current === normalizedTeamId) return;

    const requestedTeam = teams.find((team) => String(team.id) === normalizedTeamId);
    if (requestedTeam) {
      directOpenHandledRef.current = normalizedTeamId;
      setSelectedTeam(requestedTeam);
    }
  }, [loadingTeams, requestedTeamId, teams]);

  useEffect(() => {
    const cities = getCityItemsForState(teamEditDraft.state);
    setTeamCityItems(cities);
    if (teamEditDraft.city && !cities.some((city) => city.value === teamEditDraft.city)) {
      setTeamEditDraft((current) => ({ ...current, city: '' }));
    }
  }, [teamEditDraft.state]);

  const openTeamDetailsEditor = () => {
    if (!selectedTeam) return;
    const state = String(selectedTeam.state || 'Tamil Nadu');
    const cities = getCityItemsForState(state);
    const normalizedLocation = String(selectedTeam.location || '').trim().toLowerCase();
    const cityFromLocation = cities.find((item) =>
      normalizedLocation === item.value.toLowerCase() ||
      normalizedLocation.includes(item.value.toLowerCase()),
    )?.value;
    const city = String(
      selectedTeam.city ||
      cityFromLocation ||
      (state === 'Tamil Nadu' ? 'Chennai' : ''),
    );
    setTeamEditDraft({
      name: String(selectedTeam.name || ''),
      state,
      city,
      location: String(selectedTeam.location || ''),
    });
    setTeamCityItems(cities);
    setShowTeamEditModal(true);
  };

  const saveTeamDetails = async () => {
    if (!selectedTeam || savingTeamDetails) return;
    const payload = {
      name: teamEditDraft.name.trim(),
      state: teamEditDraft.state.trim(),
      city: teamEditDraft.city.trim(),
      location: teamEditDraft.location.trim(),
    };
    if (!payload.name || !payload.state || !payload.city || !payload.location) {
      Alert.alert('Complete Team Details', 'Team name, state, city, and location are required.');
      return;
    }
    try {
      setSavingTeamDetails(true);
      const response = await updateTeam(String(selectedTeam.id), payload);
      const updated = { ...selectedTeam, ...response.team, ...payload };
      setSelectedTeam(updated);
      setTeams((current) => current.map((team) => team.id === selectedTeam.id ? { ...team, ...updated } : team));
      setShowTeamEditModal(false);
      Alert.alert('Team Updated', 'Team details were updated successfully.');
    } catch (error) {
      Alert.alert('Unable to Update Team', getApiErrorMessage(error, 'Failed to update team details.'));
    } finally {
      setSavingTeamDetails(false);
    }
  };

  const openPlayerEditor = (player: any) => {
    setEditingPlayer(player);
    setPlayerEditDraft({
      name: String(player?.name || ''),
      mobile: String(player?.mobile || '').replace(/\D/g, '').slice(-10),
      role: String(player?.role || ''),
    });
  };

  const savePlayerDetails = async () => {
    if (!selectedTeam || !editingPlayer || savingPlayer) return;
    const payload = {
      name: playerEditDraft.name.trim(),
      mobile: playerEditDraft.mobile.replace(/\D/g, '').slice(0, 10),
      role: playerEditDraft.role,
    };
    if (!payload.name || !/^\d{10}$/.test(payload.mobile) || !payload.role) {
      Alert.alert('Complete Player Details', 'Enter a valid name, 10-digit mobile number, and role.');
      return;
    }
    try {
      setSavingPlayer(true);
      const response = await updatePlayer(editingPlayer.id, payload);
      setTeamPlayersMap((current) => ({
        ...current,
        [selectedTeam.id]: (current[selectedTeam.id] || []).map((player) =>
          Number(player.id) === Number(editingPlayer.id)
            ? { ...player, ...response.player, ...payload }
            : player
        ),
      }));
      setEditingPlayer(null);
      Alert.alert('Player Updated', 'Player details were updated successfully.');
    } catch (error) {
      Alert.alert('Unable to Update Player', getApiErrorMessage(error, 'Failed to update player details.'));
    } finally {
      setSavingPlayer(false);
    }
  };

  const handleAddPlayersToTeam = async (players: any[]) => {
    if (!playerScreenTeam) return;
    const currentRoster = teamPlayersMap[playerScreenTeam.id] || [];
    const normalizeMobile = (value: unknown) => String(value || '').replace(/\D/g, '').slice(-10);
    const existingMobiles = new Set(currentRoster.map((player: any) => normalizeMobile(player?.mobile)));
    const requestedMobiles = players.map((player) => normalizeMobile(player?.mobile));
    const duplicateRequestedMobile = requestedMobiles.find(
      (mobile, index) => !!mobile && requestedMobiles.indexOf(mobile) !== index,
    );
    const alreadyAssignedPlayer = players.find((player) => existingMobiles.has(normalizeMobile(player?.mobile)));

    if (alreadyAssignedPlayer) {
      Alert.alert('Already on Team', `${alreadyAssignedPlayer.name || 'This player'} is already a member of this team.`);
      return;
    }
    if (duplicateRequestedMobile) {
      Alert.alert('Duplicate Player', 'The same player is selected more than once.');
      return;
    }
    if (currentRoster.length + players.length > 15) {
      Alert.alert(
        'Squad Limit Reached',
        `This team already has ${currentRoster.length} players. You can add only ${Math.max(15 - currentRoster.length, 0)} more.`,
      );
      return;
    }

    setAddingPlayers(true);
    try {
      // Separate existing and new players
      const existingPlayers = [];
      const newPlayers = [];
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

      const processedNewPlayers = newPlayers.map((player) => {
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

      // Combine all players
      const allPlayers = [...existingPlayers, ...processedNewPlayers];

      await assignPlayersToTeam(
        playerScreenTeam.id.toString(),
        allPlayers.map(p => ({
          playerId: p.id,
          is_captain: p.isCaptain,
          is_vicecaptain: p.isViceCaptain,
        }))
      );
      Alert.alert('Success', 'Players added to team!');
      setShowPlayerScreen(false);
      setPlayerScreenTeam(null);
      // Refresh teams and players after successful assignment
      refreshTeamsAndPlayers();
    } catch (error) {
      Alert.alert('Unable to Add Players', getApiErrorMessage(error, 'Failed to add players. Please try again.'));
    } finally {
      setAddingPlayers(false);
    }
  };

  const handleDeleteTeam = (teamId: number) => {
    Alert.alert(
      'Delete Team',
      'Are you sure you want to delete this team? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTeam(String(teamId));
              Alert.alert('Success', 'Team deleted successfully.');
              setSelectedTeam(null);
              await refreshTeamsAndPlayers();
            } catch (error) {
              Alert.alert('Unable to Delete Team', getApiErrorMessage(error, 'Failed to delete team. Please try again.'));
            }
          },
        },
      ]
    );
  };

  const handleLeaveSelectedTeam = (teamId: number) => {
    if (!playerLookupKey) {
      Alert.alert('Error', 'Unable to identify this player account. Please sign in again.');
      return;
    }

    Alert.alert(
      'Leave Team',
      'Are you sure you want to leave this team?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              setLeavingTeam(true);
              await leaveTeam(String(teamId), playerLookupKey);
              Alert.alert('Success', 'You left the team successfully.');
              setSelectedTeam(null);
              await refreshTeamsAndPlayers();
            } catch (error: any) {
              const message = error?.response?.data?.message || 'Failed to leave the team. Please try again.';
              Alert.alert('Error', message);
            } finally {
              setLeavingTeam(false);
            }
          },
        },
      ]
    );
  };

  const handleRemovePlayerFromSelectedTeam = (teamId: number, playerId: number, playerName: string) => {
    const playerLabel = formatPlayerName(playerName) || 'this player';
    const removePlayer = async () => {
      try {
        setRemovingPlayerId(playerId);
        await removePlayerFromTeam(String(teamId), String(playerId));
        await refreshTeamsAndPlayers();
        Alert.alert('Success', 'Player removed successfully.');
      } catch (error) {
        Alert.alert('Unable to Remove Player', getApiErrorMessage(error, 'Failed to remove player. Please try again.'));
      } finally {
        setRemovingPlayerId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${playerLabel} from the team?`)) {
        void removePlayer();
      }
      return;
    }

    Alert.alert('Remove Player', `Remove ${playerLabel} from the team?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: removePlayer },
    ]);
  };

  const renderGridTeams = (teamsList: Team[]) => (
    <FlatList
      data={teamsList}
      keyExtractor={item => item.id.toString()}
      numColumns={2}
      contentContainerStyle={styles.gridContainer}
      ListEmptyComponent={
        loadingTeams
          ? <Text style={{ textAlign: 'center', marginTop: 20 }}>Loading teams...</Text>
          : <Text style={{ textAlign: 'center', marginTop: 20 }}>No teams found.</Text>
      }
      renderItem={({ item: team }) => (
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => setSelectedTeam(team)}
        >
          <TeamInitialsLogo name={team.name} size={64} />
          <Text style={styles.gridTeamName}>{team.name}</Text>
          <Text style={styles.gridTeamSport}>{team.sport}</Text>
          <Text style={styles.gridTeamMembers}>{teamPlayersMap[team.id]?.length ?? team.members ?? 0} members</Text>
        </TouchableOpacity>
      )}
    />
  );

  const renderJoinedTeamsRows = (teamsList: Team[]) => (
    <View style={{ paddingHorizontal: 12, paddingBottom: 24 }}>
      {teamsList.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 20 }}>No teams found.</Text>
      ) : (
        teamsList.map(team => (
          <TouchableOpacity
            key={team.id}
            style={{
              flexDirection: 'row',
              backgroundColor: '#fff',
              borderRadius: 16,
              alignItems: 'center',
              marginVertical: 8,
              padding: 16,
              ...(Platform.OS === 'web'
                ? { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.07)' }
                : { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8 }),
              elevation: 2,
            }}
            onPress={() => setSelectedTeam(team)}
          >
            <View style={styles.joinedTeamLogoWrap}>
              <TeamInitialsLogo name={team.name} size={56} />
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 2 }}>
                  {team.name}
                </Text>
                <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 2 }}>
                  {team.sport}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontSize: 14, color: '#22C55E', marginRight: 30 }}>
                    Members: {teamPlayersMap[team.id]?.length ?? team.members ?? 0}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#22C55E'}}>
                    Tournaments: {teamTournamentsMap[team.id]?.length ?? 0}
                </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const formatTournamentDate = (value?: string) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDateRangeLabel = (tournament: Tournament) => {
    const start = tournament.startDate || tournament.start_date;
    const end = tournament.endDate || tournament.end_date;
    if (!start && !end) return 'N/A';
    if (start && end) return `${formatTournamentDate(start)} - ${formatTournamentDate(end)}`;
    return formatTournamentDate(start || end);
  };

  const renderTournamentsList = (list: Tournament[], emptyText = 'No tournaments found.') => (
    <View style={styles.teamContainer}>
      {loadingTeams ? (
        <Text style={{ textAlign: 'center', marginTop: 20 }}>Loading tournaments...</Text>
      ) : list.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 20 }}>{emptyText}</Text>
      ) : (
        list.map(tournament => (
          <TouchableOpacity
            key={tournament.id}
            style={styles.teamCard}
            onPress={() =>
              router.push({
                pathname: '/tournament-details',
                params: { id: tournament.id }
              })
            }
          >
            <View style={styles.teamContent}>
              <View style={styles.teamHeader}>
                <Text style={styles.teamName}>{tournament.name}</Text>
              </View>
              <Text style={styles.teamSport}>{tournament.sport || 'Cricket'}</Text>
              <View style={styles.teamStats}>
                <View style={styles.stat}>
                  <Users size={16} color="#22C55E" />
                  <Text style={styles.statText}>{tournament.teams ?? 0} teams</Text>
                </View>
                <View style={styles.stat}>
                  <Calendar size={16} color="#22C55E" />
                  <Text style={styles.statText}>{getDateRangeLabel(tournament)}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderTeamDetails = () => {
    if (!selectedTeam) return null;
    const players = teamPlayersMap[selectedTeam.id?.toString()] || [];
    const selectedTeamTournamentsCount = teamTournamentsMap[selectedTeam.id?.toString()]?.length ?? selectedTeam.tournaments ?? 0;
    const canEditTeam = isAdmin || normalizeContact(selectedTeam.createdBy) === normalizeContact(phone);

    if (showPlayerScreen && playerScreenTeam) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={[styles.header, { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setShowPlayerScreen(false);
                setPlayerScreenTeam(null);
              }}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: '#111827', fontSize: 18 }]}>Add Players</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
              <Players
                PLAYER_ROLES={[
                  { id: 'batsman', name: 'Batsman', icon: '🏏', color: '#22C55E' },
                  { id: 'bowler', name: 'Bowler', icon: '🥎', color: '#3B82F6' },
                  { id: 'allrounder', name: 'All-rounder', icon: '🏏🥎', color: '#F59E0B' },
                  { id: 'wicketkeeper', name: 'Wicket Keeper', icon: '🧤', color: '#8B5CF6' },
                ]}
                onSquadChange={() => {}}
                squad={[]}
                styles={styles}
                onSave={handleAddPlayersToTeam}
                saving={addingPlayers}
                organizer={{
                  name: String(user?.name || 'Organizer'),
                  mobile: normalizeContact(phone),
                }}
                existingPlayerMobiles={(teamPlayersMap[playerScreenTeam.id] || []).map(
                  (player: any) => String(player?.mobile || ''),
                )}
              />
          </View>
        </SafeAreaView>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={true}>
        <View style={styles.teamDetailHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedTeam(null)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton}>
          </TouchableOpacity>
        </View>
        <View style={styles.teamDetailCard}>
          <View style={styles.teamDetailOverlay}>
            <View style={styles.teamDetailIdentityRow}>
              <TeamInitialsLogo name={selectedTeam.name} size={64} />
              <View style={styles.teamDetailIdentityCopy}>
                <Text style={styles.teamDetailName}>{selectedTeam.name}</Text>
                <Text style={styles.teamDetailSport}>{selectedTeam.sport || 'Cricket'}</Text>
              </View>
            </View>
            <View style={styles.teamDetailStats}>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatNumber}>{players.length}</Text>
                <Text style={styles.detailStatLabel}>Members</Text>
              </View>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatNumber}>{selectedTeamTournamentsCount}</Text>
                <Text style={styles.detailStatLabel}>Tournaments</Text>
              </View>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatNumber}>{selectedTeam.wins ?? 0}</Text>
                <Text style={styles.detailStatLabel}>Wins</Text>
              </View>
            </View>
          </View>
        </View>
        {canEditTeam && (
          <View style={styles.editTeamNameSection}>
            <View style={styles.editTeamNameHeader}>
              <View>
                <Text style={styles.editTeamNameLabel}>Team details</Text>
                <Text style={styles.editTeamDetailsSummary}>
                  {[selectedTeam.location, selectedTeam.city, selectedTeam.state].filter(Boolean).join(', ')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editTeamNameButton}
                onPress={openTeamDetailsEditor}
                accessibilityRole="button"
                accessibilityLabel="Edit team details"
              >
                <Pencil size={15} color="#166534" />
                <Text style={styles.editTeamNameButtonText}>Edit Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={styles.playersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Players</Text>
            {isPrivileged && (
              <TouchableOpacity
                style={styles.addPlayerButton}
                onPress={() => {
                  setPlayerScreenTeam(selectedTeam);
                  setShowPlayerScreen(true);
                }}
              >
                <UserPlus size={16} color="#22C55E" />
                <Text style={styles.addPlayerText}>Add Player</Text>
              </TouchableOpacity>
            )}
          </View>
          {players.length === 0 ? (
            <Text style={{ textAlign: 'center', marginTop: 20 }}>No players found.</Text>
          ) : (
            players.map((player: { id: number; name: string; role: string; mobile: string }) => (
              <View key={player.id} style={styles.playerCard}>
                <View style={styles.playerAvatar}>
                  <Text style={styles.playerInitials}>
                    {getPlayerInitials(player.name)}
                  </Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{formatPlayerName(player.name)}</Text>
                  <Text style={styles.playerPosition}>{player.role}</Text>
                  <Text style={styles.playerStat}>{player.mobile}</Text>
                </View>
                {canEditTeam && (
                  <View style={styles.playerManageActions}>
                    <TouchableOpacity
                      style={styles.editPlayerButton}
                      onPress={() => openPlayerEditor(player)}
                      accessibilityLabel={`Edit ${player.name}`}
                    >
                      <Pencil size={16} color="#1D4ED8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removePlayerButton}
                      onPress={() => handleRemovePlayerFromSelectedTeam(selectedTeam.id, player.id, player.name)}
                      disabled={removingPlayerId === player.id}
                    >
                      <Trash2 size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {isAdmin && (
          <TouchableOpacity
            style={styles.deleteTeamButton}
            onPress={() => handleDeleteTeam(selectedTeam.id)}
          >
            <Text style={styles.deleteTeamButtonText}>Delete Team</Text>
          </TouchableOpacity>
        )}

        {!isPrivileged && (
          <TouchableOpacity
            style={[styles.leaveTeamButton, leavingTeam && styles.leaveTeamButtonDisabled]}
            onPress={() => handleLeaveSelectedTeam(selectedTeam.id)}
            disabled={leavingTeam}
          >
            <Text style={styles.leaveTeamButtonText}>{leavingTeam ? 'Leaving...' : 'Leave Team'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {!selectedTeam && (
        <Header
          displayName={user?.name}
          organiserContact={isPrivileged ? String(phone || '').trim() : undefined}
          playerPhone={!isPrivileged ? String(phone || '').trim() : undefined}
          unreadCount={0}
          onPlayerLeftTeam={async () => {
            setSelectedTeam(null);
            await refreshTeamsAndPlayers();
          }}
        />
      )}
      {selectedTeam ? (
        renderTeamDetails()
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => 'dummy'}
          ListHeaderComponent={
            <>
              {isPrivileged ? (
                <>
                  <Text style={styles.sectionGridTitle}>{isAdmin ? 'All Teams' : 'Created Teams'}</Text>
                  {renderGridTeams(myTeams)}
                  <Text style={styles.sectionGridTitle}>Tournaments Joined </Text>
                  {renderTournamentsList(joinedTournaments, 'No joined tournaments found for your teams.')}
                  <Text style={styles.sectionGridTitle}>{isAdmin ? 'All Tournaments' : 'Created Tournaments'}</Text>
                  {renderTournamentsList(createdTournaments, 'No created tournaments found.')}
                </>
              ) : (
                <>
                  <Text style={styles.sectionGridTitle}>My Teams</Text>
                  {renderJoinedTeamsRows(myTeams)}
                  <Text style={styles.sectionGridTitle}>Tournaments I Joined</Text>
                  {renderTournamentsList(joinedTournaments, 'No joined tournaments found.')}
                </>
              )}
            </>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={null}
        />
      )}

      <Modal
        visible={showTeamEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTeamEditModal(false)}
      >
        <View style={styles.editModalBackdrop}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Team Details</Text>
              <TouchableOpacity style={styles.editModalClose} onPress={() => setShowTeamEditModal(false)}>
                <X size={20} color="#475569" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.editModalForm}>
              <Text style={styles.editFieldLabel}>Team Name</Text>
              <TextInput
                style={styles.editFieldInput}
                value={teamEditDraft.name}
                onChangeText={(name) => setTeamEditDraft((current) => ({ ...current, name }))}
                placeholder="Team name"
              />
              <Text style={styles.editFieldLabel}>State / Union Territory</Text>
              <DropDownPicker
                open={teamStateOpen}
                value={teamEditDraft.state}
                items={teamStateItems}
                setOpen={setTeamStateOpen}
                setValue={(callback) => setTeamEditDraft((current) => ({
                  ...current,
                  state: typeof callback === 'function' ? callback(current.state) : callback,
                }))}
                setItems={setTeamStateItems}
                searchable
                listMode="MODAL"
                searchPlaceholder="Search states"
                style={styles.editDropdownField}
              />
              <Text style={styles.editFieldLabel}>City</Text>
              <DropDownPicker
                open={teamCityOpen}
                value={teamEditDraft.city}
                items={teamCityItems}
                setOpen={setTeamCityOpen}
                setValue={(callback) => setTeamEditDraft((current) => ({
                  ...current,
                  city: typeof callback === 'function' ? callback(current.city) : callback,
                }))}
                setItems={setTeamCityItems}
                searchable
                listMode="MODAL"
                searchPlaceholder="Search cities"
                style={styles.editDropdownField}
              />
              <Text style={styles.editFieldLabel}>Location / Area</Text>
              <TextInput
                style={styles.editFieldInput}
                value={teamEditDraft.location}
                onChangeText={(location) => setTeamEditDraft((current) => ({ ...current, location }))}
                placeholder="Location or area"
              />
              <TouchableOpacity
                style={[styles.editSaveButton, savingTeamDetails && styles.editSaveButtonDisabled]}
                onPress={saveTeamDetails}
                disabled={savingTeamDetails}
              >
                <Text style={styles.editSaveButtonText}>{savingTeamDetails ? 'Saving...' : 'Save Team Details'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!editingPlayer}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingPlayer(null)}
      >
        <View style={styles.editModalBackdrop}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Player</Text>
              <TouchableOpacity style={styles.editModalClose} onPress={() => setEditingPlayer(null)}>
                <X size={20} color="#475569" />
              </TouchableOpacity>
            </View>
            <Text style={styles.editFieldLabel}>Player Name</Text>
            <TextInput
              style={styles.editFieldInput}
              value={playerEditDraft.name}
              onChangeText={(name) => setPlayerEditDraft((current) => ({ ...current, name }))}
              placeholder="Player name"
              autoCapitalize="words"
            />
            <Text style={styles.editFieldLabel}>Mobile Number</Text>
            <TextInput
              style={styles.editFieldInput}
              value={playerEditDraft.mobile}
              onChangeText={(mobile) => setPlayerEditDraft((current) => ({
                ...current,
                mobile: mobile.replace(/\D/g, '').slice(0, 10),
              }))}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Text style={styles.editFieldLabel}>Playing Role</Text>
            <View style={styles.playerRoleOptions}>
              {PLAYER_ROLES.map((role) => (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.playerRoleOption,
                    playerEditDraft.role === role.id && styles.playerRoleOptionActive,
                  ]}
                  onPress={() => setPlayerEditDraft((current) => ({ ...current, role: role.id }))}
                >
                  <Text style={[
                    styles.playerRoleOptionText,
                    playerEditDraft.role === role.id && styles.playerRoleOptionTextActive,
                  ]}>
                    {role.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.editSaveButton, savingPlayer && styles.editSaveButtonDisabled]}
              onPress={savePlayerDetails}
              disabled={savingPlayer}
            >
              <Text style={styles.editSaveButtonText}>{savingPlayer ? 'Saving...' : 'Save Player'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  teamContainer: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  teamStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  teamName: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  teamSport: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
    textAlign: 'left',
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginVertical: 8,
    marginHorizontal: 4,
    padding: 16,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.07)' }
      : { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8 }),
    elevation: 2,
  },
  teamContent: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  appHeader: {
    paddingTop: 32,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#22C55E',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 8,
  },
  appHeaderTitle: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#fff',
    marginBottom: 4,
  },
  appHeaderSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#F0FDF4',
  },
  sectionGridTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    marginLeft: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  gridContainer: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    margin: 8,
    paddingVertical: 18,
    paddingHorizontal: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.07)' }
      : { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8 }),
    elevation: 2,
    minWidth: 150,
    maxWidth: '48%',
  },
  gridTeamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
    textAlign: 'center',
    marginTop: 10,
  },
  gridTeamSport: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
    textAlign: 'center',
  },
  gridTeamMembers: {
    fontSize: 12,
    color: '#22C55E',
    marginBottom: 2,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    backgroundColor: '#22C55E',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)' }
      : { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 }),
    elevation: 4,
    zIndex: 10,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
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
  sportOption: {
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    minWidth: 80,
  },
  sportOptionActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  sportIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  sportName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  sportNameActive: {
    color: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  modalCreateButton: {
    flex: 1,
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCreateText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  teamDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#22C55E',
  },
  settingsButton: {
    padding: 8,
  },
  teamDetailCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    height: 200,
    position: 'relative',
    marginBottom: 24,
    backgroundColor: '#0F172A',
  },
  joinedTeamLogoWrap: {
    marginRight: 16,
  },
  teamDetailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    justifyContent: 'flex-end',
    padding: 20,
  },
  teamDetailIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  teamDetailIdentityCopy: {
    flex: 1,
  },
  teamDetailName: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  teamDetailSport: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    marginBottom: 0,
  },
  teamDetailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  editTeamNameSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
  },
  editTeamNameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editTeamNameLabel: {
    color: '#166534',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  editTeamDetailsSummary: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  editTeamNameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  editTeamNameButtonText: {
    color: '#166534',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  editTeamNameControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  editTeamNameInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
  },
  teamNameSaveButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
  },
  teamNameCancelButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  detailStat: {
    alignItems: 'center',
  },
  detailStatNumber: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
  },
  detailStatLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    marginTop: 2,
  },
  playersSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
  },
  addPlayerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addPlayerText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#22C55E',
    marginLeft: 4,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }),
    elevation: 1,
  },
  playerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerInitials: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  playerInfo: {
    flex: 1,
  },
  removePlayerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  playerManageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: 8,
  },
  editPlayerButton: {
    width: 42,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  removePlayerText: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
  },
  playerName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  playerPosition: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  playerStats: {
    flexDirection: 'row',
    gap: 12,
  },
  playerStat: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  statText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#22C55E',
    marginLeft: 4,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#22C55E',
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  deleteTeamButton: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteTeamButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  leaveTeamButton: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  leaveTeamButtonDisabled: {
    opacity: 0.6,
  },
  leaveTeamButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  editModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  editModalContent: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    alignSelf: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  editModalTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
  },
  editModalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  editModalForm: {
    paddingBottom: 20,
  },
  editFieldLabel: {
    color: '#334155',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 7,
    marginTop: 10,
  },
  editFieldInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    color: '#0F172A',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
  },
  editDropdownField: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  playerRoleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  playerRoleOption: {
    minHeight: 42,
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
  },
  playerRoleOptionActive: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  playerRoleOptionText: {
    color: '#475569',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  playerRoleOptionTextActive: {
    color: '#166534',
  },
  editSaveButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#16A34A',
    marginTop: 20,
  },
  editSaveButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  editSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
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
  rolesContainer: {
    paddingVertical: 8,
    flexDirection: 'row',
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
  }
});