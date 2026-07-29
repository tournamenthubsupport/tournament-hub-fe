import { router } from 'expo-router';
import { Calendar, Trash2, UserPlus, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/auth-context';
import { Header } from '../components/AppHeader';
import Players from '../components/players';
import { insertPlayersBulk } from '../service/playerService';
import { assignPlayersToTeam, getPlayersForTeams, getTeamsForPlayer, leaveTeam, removePlayerFromTeam } from '../service/teamPlayerService';
import { deleteTeam, fetchTeams, fetchTeamsByMobile } from '../service/teamsService';
import { fetchTournaments, fetchTournamentsByContact } from '../service/tournamentService';
import { getTournamentsForTeams } from '../service/tournamentTeamsService';

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
};

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

const SPORTS_OPTIONS = [
  { id: 'cricket', name: 'Cricket', icon: '🏏' },
  { id: 'football', name: 'Football', icon: '⚽' },
  { id: 'basketball', name: 'Basketball', icon: '🏀' },
  { id: 'volleyball', name: 'Volleyball', icon: '🏐' },
  { id: 'tennis', name: 'Tennis', icon: '🎾' },
];

export default function TeamsScreen() {
  const [mounted, setMounted] = useState(false);
  const [teamPlayersMap, setTeamPlayersMap] = useState<{ [teamId: string]: any[] }>({});
  const [teamTournamentsMap, setTeamTournamentsMap] = useState<{ [teamId: string]: any[] }>({});
  const [showPlayerScreen, setShowPlayerScreen] = useState(false);
  const [playerScreenTeam, setPlayerScreenTeam] = useState<Team | null>(null);
  const [addingPlayers, setAddingPlayers] = useState(false);
  const [leavingTeam, setLeavingTeam] = useState(false);
  const [removingPlayerId, setRemovingPlayerId] = useState<number | null>(null);

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
    } catch {
      setTeams([]);
      setCreatedTournaments([]);
      setJoinedTournaments([]);
      setTeamPlayersMap({});
      setTeamTournamentsMap({});
    } finally {
      setLoadingTeams(false);
    }
  };

  useEffect(() => {
    if (!phone) return;
    refreshTeamsAndPlayers();
  }, [phone, userId, userRole]);

  const handleAddPlayersToTeam = async (players: any[]) => {
    if (!playerScreenTeam) return;
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
      Alert.alert('Error', 'Failed to add players. Please try again.');
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
            } catch {
              Alert.alert('Error', 'Failed to delete team. Please try again.');
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
    Alert.alert(
      'Remove Player',
      `Remove ${formatPlayerName(playerName) || 'this player'} from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setRemovingPlayerId(playerId);
              await removePlayerFromTeam(String(teamId), String(playerId));
              Alert.alert('Success', 'Player removed successfully.');
              await refreshTeamsAndPlayers();
            } catch (error: any) {
              const message = error?.response?.data?.message || 'Failed to remove player. Please try again.';
              Alert.alert('Error', message);
            } finally {
              setRemovingPlayerId(null);
            }
          },
        },
      ]
    );
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
          <Image
            source={{ uri: team.image }}
            style={styles.teamAvatar}
            resizeMode="cover"
          />
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
              shadowColor: '#000',
              shadowOpacity: 0.07,
              shadowRadius: 8,
              elevation: 2,
            }}
            onPress={() => setSelectedTeam(team)}
          >
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              marginRight: 16,
              backgroundColor: '#F3F4F6',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 32 }}>
                {SPORTS_OPTIONS.find(s => s.id === 'cricket')?.icon ?? '❓'}
              </Text>
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
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, backgroundColor: '#F9FAFB' }}
            showsVerticalScrollIndicator={false}
          >

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
              />
          </ScrollView>
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
          <Image
            source={{ uri: selectedTeam.image }}
            style={styles.teamDetailImage}
            resizeMode="cover"
          />
          <View style={styles.teamDetailOverlay}>
            <Text style={styles.teamDetailName}>{selectedTeam.name}</Text>
            <Text style={styles.teamDetailSport}>{selectedTeam.sport}</Text>
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
                {isPrivileged && (
                  <TouchableOpacity
                    style={styles.removePlayerButton}
                    onPress={() => handleRemovePlayerFromSelectedTeam(selectedTeam.id, player.id, player.name)}
                    disabled={removingPlayerId === player.id}
                  >
                    <Trash2 size={16} color="#DC2626" />
                    <Text style={styles.removePlayerText}>
                      {removingPlayerId === player.id ? 'Removing...' : 'Remove'}
                    </Text>
                  </TouchableOpacity>
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
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
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
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    minWidth: 150,
    maxWidth: '48%',
  },
  teamAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 10,
    backgroundColor: '#F3F4F6',
  },
  gridTeamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
    textAlign: 'center',
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
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
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
  },
  teamDetailImage: {
    width: '100%',
    height: '100%',
  },
  teamDetailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    padding: 20,
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
    marginBottom: 16,
  },
  teamDetailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    minWidth: 76,
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