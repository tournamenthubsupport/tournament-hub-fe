import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { Calendar, IndianRupee, MapPin, Search, Trophy, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform, RefreshControl, ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/auth-context';
import { Header } from '../components/AppHeader';
import { fetchMatchScorecard, fetchTournamentMatches, fetchTournaments } from '../service/tournamentService';

type LiveMatchSummary = {
  matchId: number;
  battingTeamName: string;
  bowlingTeamName: string;
  runs: number;
  wickets: number;
  overs: string;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const auth = useAuth();
  const user = auth?.user;
  const authHydrated = auth?.authHydrated;
  const userId = user?.id;
  const displayName = user?.name || '';
  const userRole = (user?.role || 'player').toLowerCase();
  const isOrganizer = userRole === 'organizer';
  const isAdmin = userRole === 'admin';
  const canManage = isOrganizer || isAdmin;

  const [searchQuery, setSearchQuery] = useState('');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filterLocation, setFilterLocation] = useState('Chennai');
  const [filterStatus, setFilterStatus] = useState<'upcoming' | 'active' | 'completed'>('upcoming');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cityScope, setCityScope] = useState('Chennai');
  const [citySource, setCitySource] = useState<'default' | 'saved' | 'gps' | 'manual'>('default');
  const [liveScoresByTournament, setLiveScoresByTournament] = useState<Record<number, LiveMatchSummary[]>>({});

  const resolveCityFromDeviceLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const places = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const primary = Array.isArray(places) ? places[0] : null;
      const detectedCity = String(
        primary?.city || primary?.district || primary?.subregion || primary?.region || '',
      ).trim();

      if (!detectedCity) {
        return;
      }

      setCityScope(detectedCity);
      setFilterLocation(detectedCity);
      setCitySource('gps');

      if (Platform.OS === 'web') {
        try {
          window.localStorage.setItem('th_current_city', detectedCity);
        } catch {
          // Ignore storage failures.
        }
      }
    } catch {
      // Ignore GPS/reverse geocode failures and keep manual fallback.
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        const savedCity = window.localStorage.getItem('th_current_city') || '';
        if (savedCity.trim()) {
          setCityScope(savedCity.trim());
          setFilterLocation(savedCity.trim());
          setCitySource('saved');
          return;
        }
      } catch {
        // Ignore localStorage read failures.
      }
    }

    resolveCityFromDeviceLocation();
  }, []);

  const applyCityFilter = () => {
    const nextCity = (filterLocation || '').trim() || 'Chennai';
    setCityScope(nextCity);
    setCitySource('manual');
    if (Platform.OS === 'web') {
      try {
        window.localStorage.setItem('th_current_city', nextCity);
      } catch {
        // Ignore localStorage write failures.
      }
    }
  };

  const getInningsField = (scorecard: any) => {
    const inningsNo = Number(scorecard?.currentInnings || 1) === 2 ? 2 : 1;
    return inningsNo === 2 ? scorecard?.inningsTwo : scorecard?.inningsOne;
  };

  const sumRuns = (events: any[]) =>
    events.reduce((sum, event) => sum + Number(event?.runs || 0), 0);

  const sumWickets = (events: any[]) =>
    events.reduce((sum, event) => sum + (event?.wicket ? 1 : 0), 0);

  const legalBalls = (events: any[]) =>
    events.filter((event) => !['wide', 'no_ball'].includes(String(event?.extraType || '').toLowerCase())).length;

  const toOvers = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

  const loadLiveScores = async (tournamentList: any[]) => {
    try {
      const activeTournaments = tournamentList.filter((tournament: any) => {
        const status = String(tournament?.status || '').toLowerCase();
        const startDate = new Date(tournament?.start_date);
        const endDate = new Date(tournament?.end_date);
        const today = new Date();
        return (
          status === 'active' ||
          (startDate <= today && endDate > today) ||
          isSameDay(startDate, today) ||
          isSameDay(endDate, today)
        );
      });

      const liveScoreEntries = await Promise.all(
        activeTournaments.map(async (tournament: any) => {
          try {
            const matchesResponse = await fetchTournamentMatches(Number(tournament.id));
            const matches = Array.isArray(matchesResponse?.matches) ? matchesResponse.matches : [];
            const inProgressMatches = matches.filter(
              (match: any) => String(match?.status || '').toLowerCase() === 'in_progress',
            );

            if (inProgressMatches.length === 0) {
              return [Number(tournament.id), []] as const;
            }

            const scoreRows = await Promise.all(
              inProgressMatches.map(async (match: any) => {
                try {
                  const scorecardResponse = await fetchMatchScorecard(Number(match.id));
                  const scorecard = scorecardResponse?.scorecard;
                  const inningsState = getInningsField(scorecard) || {};
                  const events = Array.isArray(inningsState?.events) ? inningsState.events : [];

                  const runs = Number.isFinite(Number(inningsState?.runs))
                    ? Number(inningsState.runs)
                    : sumRuns(events);
                  const wickets = Number.isFinite(Number(inningsState?.wickets))
                    ? Number(inningsState.wickets)
                    : sumWickets(events);
                  const balls = Number.isFinite(Number(inningsState?.legalBalls))
                    ? Number(inningsState.legalBalls)
                    : legalBalls(events);
                  const overs = typeof inningsState?.overs === 'string'
                    ? inningsState.overs
                    : toOvers(balls);

                  const battingTeamName =
                    inningsState?.battingTeamName ||
                    scorecardResponse?.match?.battingTeamName ||
                    match?.battingTeamName ||
                    match?.homeTeamName ||
                    'Batting Team';
                  const bowlingTeamName =
                    inningsState?.fieldingTeamName ||
                    scorecardResponse?.match?.fieldingTeamName ||
                    match?.fieldingTeamName ||
                    match?.awayTeamName ||
                    'Fielding Team';

                  return {
                    matchId: Number(match.id),
                    battingTeamName: String(battingTeamName),
                    bowlingTeamName: String(bowlingTeamName),
                    runs,
                    wickets,
                    overs,
                  } as LiveMatchSummary;
                } catch {
                  return {
                    matchId: Number(match.id),
                    battingTeamName: String(match?.battingTeamName || match?.homeTeamName || 'Batting Team'),
                    bowlingTeamName: String(match?.fieldingTeamName || match?.awayTeamName || 'Fielding Team'),
                    runs: 0,
                    wickets: 0,
                    overs: '0.0',
                  } as LiveMatchSummary;
                }
              }),
            );

            return [Number(tournament.id), scoreRows] as const;
          } catch {
            return [Number(tournament.id), []] as const;
          }
        }),
      );

      setLiveScoresByTournament(Object.fromEntries(liveScoreEntries));
    } catch {
      setLiveScoresByTournament({});
    }
  };

  const loadTournaments = async () => {
    setLoading(true);
    try {
      const data = await fetchTournaments({ city: cityScope, status: filterStatus });
      setTournaments(data.tournaments || []);

      const tournamentList = data.tournaments || [];
      if (filterStatus === 'active') {
        await loadLiveScores(tournamentList);
      } else {
        setLiveScoresByTournament({});
      }
    } catch (err) {
      console.error('Error loading tournaments:', err);
    }
    setLoading(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadTournaments();
    }, [filterStatus, cityScope])
  );

  useFocusEffect(
    React.useCallback(() => {
      if (filterStatus !== 'active' || tournaments.length === 0) return;

      const timer = setInterval(() => {
        loadLiveScores(tournaments);
      }, 10000);

      return () => clearInterval(timer);
    }, [tournaments, filterStatus])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTournaments();
    setRefreshing(false);
  };
  
  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    };
    return new Date(dateStr).toLocaleDateString('en-IN', options);
  };

  const renderDateRange = (start: string, end: string) => {
    if (start === end) return formatDate(start);
    return `${formatDate(start)} → ${formatDate(end)}`;
  };

  const formatPrizeAmount = (prize: string | number) => {
    const numericPrize = Number(prize);
    if (!Number.isFinite(numericPrize)) return 'N/A';

    const formatCompact = (value: number) => value.toFixed(1).replace(/\.0$/, '');

    if (numericPrize >= 100000) {
      return `₹${formatCompact(numericPrize / 100000)}L`;
    }

    return `₹${formatCompact(numericPrize / 1000)}K`;
  };

  const getTournamentTypeIcon = (type: string) => {
    const value = (type || '').toLowerCase();

    if (value.includes('turf')) return '🌱';
    if (value.includes('open') || value.includes('outdoor')) return '🌤️';
    if (value.includes('indoor')) return '🏟️';

    return '📍';
  };

  const isSameDay = (dateA: Date, dateB: Date) =>
    dateA.getDate() === dateB.getDate() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getFullYear() === dateB.getFullYear();

  const todayIST = new Date();
  todayIST.setHours(todayIST.getHours() + 5, todayIST.getMinutes() + 30, 0, 0);
  todayIST.setHours(0, 0, 0, 0);
  const filteredTournaments = tournaments
  .filter(tournament => {
    const sportName = String(tournament?.sport_name || '').toLowerCase();
    return sportName === 'cricket' || Number(tournament?.sport_id) === 1;
  })
  .filter(tournament => {
    // Search by name/location
    const matchesSearch =
      tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tournament.location.toLowerCase().includes(searchQuery.toLowerCase());
    // Filter by location
    const matchesLocation = filterLocation
      ? String(tournament.location || '').toLowerCase().includes(filterLocation.toLowerCase()) ||
        String(tournament.city || '').toLowerCase().includes(filterLocation.toLowerCase())
      : true;
    // Filter by date
    const matchesDate = filterDate
      ? new Date(tournament.start_date) <= filterDate && new Date(tournament.end_date) >= filterDate
      : true;

    return matchesSearch && matchesLocation && matchesDate;
  });
  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    ) : (
      <>
     <ScrollView
  showsVerticalScrollIndicator={false}
    contentContainerStyle={[styles.scrollContent, { paddingBottom: 230 + insets.bottom }]}
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  }
>
        {/* Header */}
        <Header
          displayName={displayName || 'Guest'}
          organiserContact={canManage ? String(user?.phone || '').trim() : undefined}
          playerPhone={!canManage ? String(user?.phone || '').trim() : undefined}
          unreadCount={0}
          onRequestsUpdated={loadTournaments}
        />

        {/* Redesigned Search & Filter */}
        <View style={styles.advancedSearchContainer}>
          <View style={styles.searchBarRow}>
            <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tournaments..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              style={styles.filterToggleButton}
              onPress={() => setShowFilters(prev => !prev)}
            >
              <Text style={styles.filterToggleText}>Filter</Text>
            </TouchableOpacity>
          </View>
          {showFilters && (
            <View style={styles.filtersModal}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={18} color="#2563EB" />
                <Text style={styles.filterText}>
                  {filterDate ? formatDate(filterDate.toISOString()) : 'Date'}
                </Text>
              </TouchableOpacity>
              <View style={styles.filterButton}>
                <MapPin size={18} color="#2563EB" />
                <TextInput
                  style={styles.filterInput}
                  placeholder="Location"
                  value={filterLocation}
                  onChangeText={setFilterLocation}
                  onBlur={applyCityFilter}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={filterDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setFilterDate(date);
                  }}
                />
              )}
            </View>
          )}
        </View>
        <View style={styles.statusChipsRowOuter}>
  {['upcoming', 'active', 'completed'].map(status => (
    <TouchableOpacity
      key={status}
      style={[
        styles.statusChip,
        filterStatus === status && styles.statusChipActive
      ]}
      onPress={() => setFilterStatus(status as any)}
    >
      <Text style={[
        styles.statusChipText,
        filterStatus === status && styles.statusChipTextActive
      ]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </TouchableOpacity>
  ))}
</View>
        {/* Tournaments List with updated status */}
        <View style={styles.tournamentsSection}>
          <Text style={styles.sectionTitle}>Cricket Tournaments</Text>
          {filteredTournaments.length === 0 && (
            <Text style={styles.noResultsText}>No tournaments found.</Text>
          )}
          {filteredTournaments.map((tournament) => {
            // Determine status for badge


            const startDate = new Date(tournament.start_date);
            const endDate = new Date(tournament.end_date);
            const today = new Date();

            let statusLabel = '';
            if (startDate > today) {
              statusLabel = 'Upcoming';
            } else if (
              (startDate <= today && endDate > today) ||
              isSameDay(startDate, today) ||
              isSameDay(endDate, today)
            ) {
              statusLabel = 'Active';
            } else if (endDate < today && !isSameDay(endDate, today)) {
              statusLabel = 'Completed';
            }

            const totalTeams = Number(tournament.teams) || 0;
            const joinedTeamsCount = Number(tournament.approved_teams_count) || 0;
            const spotsLeft = Math.max(totalTeams - joinedTeamsCount, 0);
            const spotsLeftLabel = spotsLeft === 0 ? 'Full' : `${spotsLeft} spots left`;
            const teamsDisplay = joinedTeamsCount > 0 ? `${joinedTeamsCount}/${totalTeams}` : `${totalTeams}`;
            const spotsLeftPercent = totalTeams > 0 ? (spotsLeft / totalTeams) * 100 : 0;
            const liveMatches = liveScoresByTournament[tournament.id] || [];

            let spotsLeftTextColor = '#EA580C';
            let spotsLeftBgColor = '#FFEDD5';
            if (spotsLeft === 0) {
              spotsLeftTextColor = '#DC2626';
              spotsLeftBgColor = '#FEE2E2';
            } else if (spotsLeft === 1) {
              spotsLeftTextColor = '#DC2626';
              spotsLeftBgColor = '#FEE2E2';
            } else if (spotsLeftPercent >= 80) {
              spotsLeftTextColor = '#15803D';
              spotsLeftBgColor = '#DCFCE7';
            }

            return (
              <TouchableOpacity
                key={tournament.id}
                style={styles.simpleCard}
                onPress={() =>
                  router.push({
                    pathname: '/tournament-details',
                    params: { id: tournament.id }
                  })
                }
              >
                {/* Header */}
                <View style={styles.cardHeading}>
                  <View style={styles.headingLeft}>
                    <View style={styles.titleWithBatBall}>
                      <Text style={styles.cardTitle}>{tournament.name}</Text>
                    </View>
                    <Text
                      style={[styles.cardSubtitle, styles.cardSubtitleStrong]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      📅 {renderDateRange(tournament.start_date, tournament.end_date)}
                    </Text>
                    <Text style={styles.cardSubtitle}>📍 {tournament.location}</Text>
                  </View>
                  <Text style={[
                    styles.statusBadge,
                    statusLabel === 'Upcoming' && styles.statusBadgeUpcoming,
                    statusLabel === 'Active' && styles.statusBadgeActive,
                    statusLabel === 'Completed' && styles.statusBadgeCompleted
                  ]}>
                    {statusLabel}
                  </Text>
                </View>

                {/* Main Stats */}
                <View style={styles.mainStatsRow}>
                    <View style={styles.mainStatBox}>
                      <Text style={styles.mainStatEmoji}>👥</Text>
                      <Text style={styles.mainStatNumber}>{teamsDisplay}</Text>
                      <Text style={styles.mainStatLabel}>Teams</Text>
                    </View>
                  <View style={styles.statsVerticalDivider} />
                    <View style={styles.mainStatBox}>
                      <Text style={styles.mainStatEmoji}>🏆</Text>
                      <Text style={styles.mainStatNumberGreen}>{formatPrizeAmount(tournament.prize)}</Text>
                      <Text style={styles.mainStatLabel}>Prize</Text>
                    </View>
                  <View style={styles.statsVerticalDivider} />
                    <View style={styles.mainStatBox}>
                      <IndianRupee size={18} color="#F97316" />
                      <Text style={styles.mainStatNumberOrange}>{tournament.entry_fees}</Text>
                      <Text style={styles.mainStatLabel}>Entry</Text>
                    </View>
                </View>

                {/* Details Listed Down */}
                <View style={styles.detailsWithArtRow}>
                  <View style={styles.detailsList}>
                    <Text style={styles.detailItem}>🔥 Match: {tournament.match_type || 'N/A'}</Text>
                    <Text style={styles.detailItem}>💨 Ball: {tournament.ball_type || 'N/A'}</Text>
                    <Text style={styles.detailItem}>🏟️  Ground: {tournament.ground || 'N/A'}</Text>
                    <Text style={styles.detailItem}>{getTournamentTypeIcon(tournament.tournament_type)} Ground Type: {tournament.tournament_type || 'N/A'}</Text>
                  </View>
                  <View style={styles.cricketVisualWrap}>
                    <View style={styles.cricketVisualBgCircle} />

                    <View style={styles.cricketStumpsRow}>
                      <View style={styles.cricketStump} />
                      <View style={styles.cricketStump} />
                      <View style={styles.cricketStump} />
                    </View>
                    <View style={styles.cricketBailsRow}>
                      <View style={styles.cricketBail} />
                      <View style={styles.cricketBail} />
                    </View>

                    <View style={styles.cricketBat}>
                      <View style={styles.cricketBatHandle} />
                      <View style={styles.cricketBatBlade} />
                    </View>

                    <View style={styles.cricketBall}>
                      <View style={styles.cricketBallSeam} />
                    </View>

                    <View style={styles.cricketTrailOne} />
                    <View style={styles.cricketTrailTwo} />

                  </View>
                </View>

                {statusLabel === 'Upcoming' && (
                  <View style={styles.spotsLeftRow}>
                    <Text
                      style={[
                        styles.spotsLeftText,
                        { color: spotsLeftTextColor, backgroundColor: spotsLeftBgColor }
                      ]}
                    >
                      {spotsLeftLabel}
                    </Text>
                  </View>
                )}

                {filterStatus === 'active' && liveMatches.length > 0 && (
                  <View style={styles.liveScoreSection}>
                    <Text style={styles.liveScoreTitle}>Live Score</Text>
                    {liveMatches.map((liveMatch) => (
                      <View key={`${tournament.id}-${liveMatch.matchId}`} style={styles.liveScoreCard}>
                        <View style={styles.liveScoreTopRow}>
                          <Text style={styles.liveScoreBadge}>LIVE</Text>
                          <Text style={styles.liveOversText}>Ov {liveMatch.overs}</Text>
                        </View>
                        <Text style={styles.liveBattingTeam}>{liveMatch.battingTeamName}</Text>
                        <Text style={styles.liveRunsText}>{liveMatch.runs}/{liveMatch.wickets}</Text>
                        <Text style={styles.liveBowlingText}>Bowling: {liveMatch.bowlingTeamName}</Text>
                      </View>
                    ))}
                  </View>
                )}

              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>
              {canManage && (
                <View style={[styles.quickActionsFixedWrapper, { bottom: Math.max(insets.bottom, 12) }]}>
                  <View style={styles.quickActionsSection}>
                    <Text style={styles.quickActionsHeader}>Quick Actions</Text>
                    <View style={styles.quickActions}>
                      <TouchableOpacity
                        style={styles.quickActionCard}
                        onPress={() => router.push('/create-team')}
                      >
                        <View style={styles.quickActionIcon}>
                          <Users size={16} color="#16A34A" />
                        </View>
                        <View style={styles.quickActionTextGroup}>
                          <Text style={styles.quickActionTitle}>Create Team</Text>
                          <Text style={styles.quickActionSubtitle}>Build squad</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.quickActionCard, styles.quickActionSecondary]}
                        onPress={() => router.push('/create-tournament')}
                      >
                        <View style={[styles.quickActionIcon, styles.quickActionIconSecondary]}>
                          <Trophy size={16} color="#2563EB" />
                        </View>
                        <View style={styles.quickActionTextGroup}>
                          <Text style={styles.quickActionTitle}>Create Tournament</Text>
                          <Text style={styles.quickActionSubtitle}>Host event</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
              </>
       )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scrollContent: {
    paddingBottom: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  advancedSearchContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 16,
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.15)',
    elevation: 8,                          // increased elevation for Android
  },
  searchBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#111827' },
  filterToggleButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterToggleText: { color: '#22C55E', fontWeight: '600', fontSize: 15 },
  filtersModal: {
    marginTop: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.07)',
    elevation: 2,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  filterText: { marginLeft: 6, color: '#2563EB', fontWeight: '500' },
  filterInput: { marginLeft: 6, minWidth: 80, color: '#2563EB', fontWeight: '500' },
  statusChipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  statusChip: {
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  statusChipActive: { backgroundColor: '#2563EB' },
  statusChipText: { color: '#374151', fontWeight: '500', fontSize: 13 },
  statusChipTextActive: { color: '#fff', fontWeight: '700' },

  tournamentsSection: { paddingHorizontal: 16, paddingBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 },
  noResultsText: { textAlign: 'center', color: '#888', fontStyle: 'italic', marginVertical: 20 },

  simpleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },

  cardHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },

  headingLeft: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'capitalize',
  },

  cardSubtitle: {
    fontSize: 14,
    fontWeight: '300',
    color: '#6B7280',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  cardSubtitleStrong: {
    fontWeight: '700',
    color: '#374151',
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },

  statusBadgeUpcoming: { backgroundColor: '#FEF3C7', color: '#92400E' },
  statusBadgeActive: { backgroundColor: '#DCFCE7', color: '#166534' },
  statusBadgeCompleted: { backgroundColor: '#F3F4F6', color: '#6B7280' },

  mainStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFB',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  mainStatBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

    mainStatEmoji: {
      fontSize: 20,
      marginBottom: 4,
    },

  mainStatNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
  },

  mainStatNumberGreen: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22C55E',
  },

  mainStatNumberOrange: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F97316',
  },

  mainStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    fontWeight: '500',
  },

  statsVerticalDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#D1D5DB',
  },

  detailsWithArtRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },

  detailsList: {
    flex: 1,
    gap: 6,
    marginBottom: 10,
  },

  detailItem: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },

  spotsLeftRow: {
    marginTop: 2,
    alignItems: 'flex-end',
  },

  spotsLeftText: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },

  liveScoreSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    gap: 8,
  },
  liveScoreTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
  },
  liveScoreCard: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  liveScoreTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveScoreBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: '#DC2626',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  liveOversText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7F1D1D',
  },
  liveBattingTeam: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  liveRunsText: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  liveBowlingText: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },

  cricketVisualWrap: {
    width: 74,
    height: 86,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },

  cricketVisualBgCircle: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#DCFCE7',
    top: 8,
    right: -8,
  },

  cricketStumpsRow: {
    position: 'absolute',
    bottom: 17,
    left: 11,
    flexDirection: 'row',
    gap: 3,
  },

  cricketStump: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#92400E',
  },

  cricketBailsRow: {
    position: 'absolute',
    bottom: 36,
    left: 13,
    flexDirection: 'row',
    gap: 8,
  },

  cricketBail: {
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#78350F',
  },

  cricketBat: {
    position: 'absolute',
    right: 15,
    bottom: 18,
    alignItems: 'center',
    transform: [{ rotate: '-22deg' }],
  },

  cricketBatHandle: {
    width: 4,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#065F46',
    marginBottom: 1,
  },

  cricketBatBlade: {
    width: 10,
    height: 26,
    borderRadius: 4,
    backgroundColor: '#A16207',
    borderWidth: 1,
    borderColor: '#92400E',
  },

  cricketBall: {
    position: 'absolute',
    top: 16,
    left: 18,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },

  cricketBallSeam: {
    width: 1,
    height: 10,
    backgroundColor: '#FCA5A5',
    transform: [{ rotate: '22deg' }],
  },

  cricketTrailOne: {
    position: 'absolute',
    top: 19,
    left: 9,
    width: 7,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FCA5A5',
    opacity: 0.8,
    transform: [{ rotate: '-12deg' }],
  },

  cricketTrailTwo: {
    position: 'absolute',
    top: 24,
    left: 7,
    width: 5,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FECACA',
    opacity: 0.8,
    transform: [{ rotate: '-12deg' }],
  },

  cricketVisualTag: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    fontSize: 8,
    fontWeight: '700',
    color: '#166534',
    letterSpacing: 0.4,
  },

  cardLink: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    textAlign: 'right',
  },

    titleWithBatBall: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    batBallDecorator: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },

    decoratorEmoji: {
      fontSize: 18,
    },

  quickActionsSection: { marginBottom: 0, paddingHorizontal: 16, paddingBottom: 6 },
  quickActionsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  quickActionsFixedWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    boxShadow: '0px -2px 6px rgba(0, 0, 0, 0.08)',
    elevation: 12,
  },
  quickActions: { flexDirection: 'row', gap: 12 },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#86EFAC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22C55E',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionSecondary: { backgroundColor: '#93C5FD', borderColor: '#3B82F6' },
  quickActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  quickActionIconSecondary: { backgroundColor: '#EFF6FF' },
  quickActionTextGroup: {
    flex: 1,
  },
  quickActionTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A', marginBottom: 1 },
  quickActionSubtitle: { fontSize: 10, color: '#6B7280' },
  quickActionCta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    marginLeft: 6,
  },
  quickActionCtaSecondary: {
    color: '#2563EB',
  },
  statusChipsRowOuter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 0,
  },
  citySourceText: {
    marginHorizontal: 16,
    marginBottom: 8,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});