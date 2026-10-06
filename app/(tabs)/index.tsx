import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { ArrowRight, Calendar, IndianRupee, MapPin, Search, SlidersHorizontal, Trophy, Users, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
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
import TeamInitialsLogo from '../components/TeamInitialsLogo';
import { fetchMatchScorecard, fetchTournamentMatches, fetchTournaments } from '../service/tournamentService';
import { INDIAN_CITY_OPTIONS } from '../../constants/indianLocations';
import { getApiErrorMessage } from '../../utils/apiError';

const CITY_OPTIONS = [...new Set(Object.values(INDIAN_CITY_OPTIONS).flat())];

const isWithinChennaiMetro = (latitude: number, longitude: number) =>
  latitude >= 12.8 &&
  latitude <= 13.25 &&
  longitude >= 80.05 &&
  longitude <= 80.35;

const reverseGeocodeCity = async (latitude: number, longitude: number) => {
  if (isWithinChennaiMetro(latitude, longitude)) {
    return 'Chennai';
  }

  if (Platform.OS !== 'web') {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = places[0];
    return String(
      place?.city || place?.district || place?.subregion || place?.region || '',
    ).trim();
  }

  const query = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '10',
    addressdetails: '1',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`);
  if (!response.ok) {
    throw new Error('Web reverse geocoding failed.');
  }

  const result = await response.json();
  const address = result?.address || {};
  return String(
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    address.state_district ||
    address.state ||
    '',
  ).trim();
};

type LiveMatchSummary = {
  matchId: number;
  battingTeamName: string;
  bowlingTeamName: string;
  runs: number;
  wickets: number;
  overs: string;
  unavailable?: boolean;
  errorMessage?: string;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const auth = useAuth();
  const user = auth?.user;
  const displayName = user?.name || '';
  const userRole = (user?.role || 'player').toLowerCase();
  const isOrganizer = userRole === 'organizer';
  const isAdmin = userRole === 'admin';
  const canManage = isOrganizer || isAdmin;

  const [searchQuery, setSearchQuery] = useState('');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus] = useState<'upcoming' | 'active' | 'completed'>('upcoming');
  const [showFilters, setShowFilters] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cityScope, setCityScope] = useState('');
  const [isResolvingDefaultCity, setIsResolvingDefaultCity] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [liveScoresByTournament, setLiveScoresByTournament] = useState<Record<number, LiveMatchSummary[]>>({});
  const tournamentRequestId = useRef(0);
  const hasManualCitySelection = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const resolveDefaultCity = async () => {
      let detectedCity = '';

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          detectedCity = await reverseGeocodeCity(
            position.coords.latitude,
            position.coords.longitude,
          );
        } else {
          setLocationError('Allow location access in your browser to use your current city.');
        }
      } catch (error) {
        console.warn('Unable to detect the current city:', error);
        setLocationError('Current city could not be detected. Search for a city below.');
      }

      if (!isMounted) return;
      if (!hasManualCitySelection.current) {
        setFilterLocation(detectedCity);
        setCityScope(detectedCity);
      }
      setIsResolvingDefaultCity(false);
    };

    resolveDefaultCity();
    return () => {
      isMounted = false;
    };
  }, []);

  const applyCityFilter = () => {
    const nextCity = (filterLocation || '').trim();
    hasManualCitySelection.current = true;
    setCityScope(nextCity);
    setLocationError('');
    setShowCitySuggestions(false);
  };

  const selectCity = (city: string) => {
    hasManualCitySelection.current = true;
    setFilterLocation(city);
    setCityScope(city);
    setLocationError('');
    setShowCitySuggestions(false);
  };

  const clearSearchFilter = () => setSearchQuery('');

  const clearDateFilter = () => setFilterDate(null);

  const clearCityFilter = () => {
    hasManualCitySelection.current = true;
    setFilterLocation('');
    setCityScope('');
    setShowCitySuggestions(false);
  };

  const clearAllFilters = () => {
    clearSearchFilter();
    clearDateFilter();
    clearCityFilter();
    setShowDatePicker(false);
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

  const loadLiveScores = async (tournamentList: any[], requestId?: number) => {
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
                } catch (error) {
                  return {
                    matchId: Number(match.id),
                    battingTeamName: String(match?.battingTeamName || match?.homeTeamName || 'Batting Team'),
                    bowlingTeamName: String(match?.fieldingTeamName || match?.awayTeamName || 'Fielding Team'),
                    runs: 0,
                    wickets: 0,
                    overs: '0.0',
                    unavailable: true,
                    errorMessage: getApiErrorMessage(error, 'Live score is temporarily unavailable.'),
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

      if (requestId === undefined || requestId === tournamentRequestId.current) {
        setLiveScoresByTournament(Object.fromEntries(liveScoreEntries));
      }
    } catch {
      setLiveScoresByTournament({});
    }
  };

  const loadTournaments = async (forceRefresh = false) => {
    const requestId = ++tournamentRequestId.current;
    const requestCity = cityScope;
    const requestStatus = filterStatus;
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchTournaments(
        { city: requestCity, status: requestStatus },
        { forceRefresh },
      );
      if (requestId !== tournamentRequestId.current) return;

      const tournamentList = data.tournaments || [];
      setTournaments(tournamentList);

      if (requestStatus === 'active') {
        await loadLiveScores(tournamentList, requestId);
      } else {
        setLiveScoresByTournament({});
      }
    } catch (err) {
      if (requestId !== tournamentRequestId.current) return;
      console.error('Error loading tournaments:', err);
      setLoadError(getApiErrorMessage(err, 'Unable to load tournaments. Please try again.'));
    } finally {
      if (requestId === tournamentRequestId.current) {
        setLoading(false);
      }
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (isResolvingDefaultCity) return;
      loadTournaments(true);
    }, [filterStatus, cityScope, isResolvingDefaultCity])
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
    await loadTournaments(true);
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
  const citySearch = filterLocation.trim().toLowerCase();
  const citySuggestions = CITY_OPTIONS
    .filter((city) => !citySearch || city.toLowerCase().includes(citySearch))
    .sort((cityA, cityB) => {
      const cityAStartsWithSearch = cityA.toLowerCase().startsWith(citySearch);
      const cityBStartsWithSearch = cityB.toLowerCase().startsWith(citySearch);
      if (cityAStartsWithSearch !== cityBStartsWithSearch) return cityAStartsWithSearch ? -1 : 1;
      return cityA.localeCompare(cityB);
    })
    .slice(0, 8);
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
    const matchesLocation = cityScope
      ? String(tournament.location || '').toLowerCase().includes(cityScope.toLowerCase()) ||
        String(tournament.city || '').toLowerCase().includes(cityScope.toLowerCase())
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
    contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
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
            <View style={styles.searchInputShell}>
              <Search size={18} color="#7C8EA6" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search tournaments or city"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#94A3B8"
              />
            </View>
            <TouchableOpacity
              style={[styles.filterToggleButton, showFilters && styles.filterToggleButtonActive]}
              onPress={() => setShowFilters(prev => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showFilters ? 'Close filters' : 'Open filters'}
            >
              {showFilters ? <X size={18} color="#FFFFFF" /> : <SlidersHorizontal size={18} color="#166534" />}
            </TouchableOpacity>
          </View>
          {showFilters && (
            <View style={styles.filtersModal}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowDatePicker(true)}
              >
                    <Calendar size={18} color="#16A34A" />
                <Text style={styles.filterText}>
                  {filterDate ? formatDate(filterDate.toISOString()) : 'Date'}
                </Text>
              </TouchableOpacity>

              <View style={styles.filterInputWrap}>
                <MapPin size={18} color="#16A34A" />
                <TextInput
                  style={styles.filterInput}
                  placeholder="Search cities"
                  value={filterLocation}
                  onChangeText={(value) => {
                    setFilterLocation(value);
                    setShowCitySuggestions(true);
                  }}
                  onFocus={() => setShowCitySuggestions(true)}
                  onSubmitEditing={applyCityFilter}
                  selectTextOnFocus
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {!!locationError && (
                <Text style={styles.locationErrorText}>{locationError}</Text>
              )}

              {showCitySuggestions && citySuggestions.length > 0 && (
                <View style={styles.citySuggestionsList}>
                  {citySuggestions.map((city) => (
                    <TouchableOpacity
                      key={city}
                      style={styles.citySuggestionItem}
                      onPress={() => selectCity(city)}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${city} city filter`}
                    >
                      <MapPin size={15} color="#64748B" />
                      <Text style={styles.citySuggestionText}>{city}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.applyFilterButton} onPress={applyCityFilter}>
                <Text style={styles.applyFilterText}>Apply Location</Text>
              </TouchableOpacity>

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
          {(searchQuery.trim() || cityScope || filterDate) && (
            <View style={styles.appliedFiltersSection}>
              <View style={styles.appliedFiltersHeader}>
                <Text style={styles.appliedFiltersTitle}>Applied filters</Text>
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={clearAllFilters}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all filters"
                >
                  <X size={16} color="#B91C1C" />
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.appliedFiltersRow}>
                {!!searchQuery.trim() && (
                  <View style={styles.appliedFilterChip}>
                    <Text style={styles.appliedFilterText}>Search: {searchQuery.trim()}</Text>
                    <TouchableOpacity onPress={clearSearchFilter} accessibilityLabel="Clear search filter">
                      <X size={14} color="#166534" />
                    </TouchableOpacity>
                  </View>
                )}
                {!!cityScope && (
                  <View style={styles.appliedFilterChip}>
                    <MapPin size={14} color="#166534" />
                    <Text style={styles.appliedFilterText}>City: {cityScope}</Text>
                    <TouchableOpacity onPress={clearCityFilter} accessibilityLabel="Clear city filter">
                      <X size={14} color="#166534" />
                    </TouchableOpacity>
                  </View>
                )}
                {!!filterDate && (
                  <View style={styles.appliedFilterChip}>
                    <Text style={styles.appliedFilterText}>Date: {formatDate(filterDate.toISOString())}</Text>
                    <TouchableOpacity onPress={clearDateFilter} accessibilityLabel="Clear date filter">
                      <X size={14} color="#166534" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
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
          {!!loadError && (
            <View style={styles.errorState}>
              <Text style={styles.errorStateText}>{loadError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadTournaments(true)}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
          {!loadError && filteredTournaments.length === 0 && (
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
                style={[
                  styles.simpleCard,
                  statusLabel === 'Active' && styles.simpleCardActive,
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/tournament-details',
                    params: { id: tournament.id }
                  })
                }
              >
                <View style={[
                  styles.cardAccent,
                  statusLabel === 'Active' && styles.cardAccentActive,
                  statusLabel === 'Completed' && styles.cardAccentCompleted,
                ]} />
                <View style={styles.cardHeading}>
                  <View style={styles.headingLeft}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{tournament.name}</Text>
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

                <View style={styles.cardMetaBlock}>
                  <View style={styles.cardMetaRow}>
                    <Calendar size={15} color="#15803D" />
                    <Text style={styles.cardDateText} numberOfLines={1}>
                      {renderDateRange(tournament.start_date, tournament.end_date)}
                    </Text>
                  </View>
                  <View style={styles.cardMetaRow}>
                    <MapPin size={15} color="#64748B" />
                    <Text style={styles.cardLocationText} numberOfLines={1} ellipsizeMode="tail">
                      {tournament.location}
                    </Text>
                  </View>
                </View>

                <View style={styles.mainStatsRow}>
                  <View style={styles.mainStatBox}>
                    <Users size={17} color="#2563EB" />
                    <Text style={styles.mainStatNumber}>{teamsDisplay}</Text>
                    <Text style={styles.mainStatLabel}>Teams</Text>
                  </View>
                  <View style={styles.statsVerticalDivider} />
                  <View style={styles.mainStatBox}>
                    <Trophy size={17} color="#16A34A" />
                    <Text style={styles.mainStatNumberGreen}>{formatPrizeAmount(tournament.prize)}</Text>
                    <Text style={styles.mainStatLabel}>Prize</Text>
                  </View>
                  <View style={styles.statsVerticalDivider} />
                  <View style={styles.mainStatBox}>
                    <IndianRupee size={17} color="#EA580C" />
                    <Text style={styles.mainStatNumberOrange}>{tournament.entry_fees}</Text>
                    <Text style={styles.mainStatLabel}>Entry</Text>
                  </View>
                </View>

                <View style={styles.formatChipsRow}>
                  <View style={styles.formatChip} accessibilityLabel={`Match format ${tournament.match_type || 'Not available'}`}>
                    <Text style={styles.formatChipIcon}>🏏</Text>
                    <Text style={styles.formatChipText}>{tournament.match_type || 'N/A'}</Text>
                  </View>
                  <View style={styles.formatChip} accessibilityLabel={`Ball type ${tournament.ball_type || 'Not available'}`}>
                    <Text style={styles.formatChipIcon}>●</Text>
                    <Text style={styles.formatChipText}>{tournament.ball_type || 'N/A'}</Text>
                  </View>
                  <View style={[styles.formatChip, styles.formatChipWide]} accessibilityLabel={`Ground ${tournament.ground || 'Not available'}`}>
                    <Text style={styles.formatChipIcon}>🏟️</Text>
                    <Text style={styles.formatChipText} numberOfLines={1}>{tournament.ground || 'N/A'}</Text>
                  </View>
                  <View style={styles.formatChip} accessibilityLabel={`Ground type ${tournament.tournament_type || 'Not available'}`}>
                    <Text style={styles.formatChipIcon}>{getTournamentTypeIcon(tournament.tournament_type)}</Text>
                    <Text style={styles.formatChipText}>{tournament.tournament_type || 'N/A'}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  {statusLabel === 'Upcoming' ? (
                    <Text
                      style={[
                        styles.spotsLeftText,
                        { color: spotsLeftTextColor, backgroundColor: spotsLeftBgColor }
                      ]}
                    >
                      {spotsLeftLabel}
                    </Text>
                  ) : <View />}
                  <View style={styles.viewDetailsAction}>
                    <Text style={styles.viewDetailsText}>View details</Text>
                    <View style={styles.viewDetailsIcon}>
                      <ArrowRight size={14} color="#FFFFFF" />
                    </View>
                  </View>
                </View>

                {filterStatus === 'active' && liveMatches.length > 0 && (
                  <View style={styles.liveScoreSection}>
                    <Text style={styles.liveScoreTitle}>Live Score</Text>
                    {liveMatches.map((liveMatch) => (
                      <View key={`${tournament.id}-${liveMatch.matchId}`} style={styles.liveScoreCard}>
                        {liveMatch.unavailable ? (
                          <Text style={styles.errorStateText}>{liveMatch.errorMessage}</Text>
                        ) : (
                          <>
                        <View style={styles.liveScoreTopRow}>
                          <Text style={styles.liveScoreBadge}>LIVE</Text>
                          <Text style={styles.liveOversText}>Ov {liveMatch.overs}</Text>
                        </View>
                        <View style={styles.liveTeamRow}>
                          <TeamInitialsLogo name={liveMatch.battingTeamName} size={34} />
                          <Text style={styles.liveBattingTeam}>{liveMatch.battingTeamName}</Text>
                        </View>
                        <Text style={styles.liveRunsText}>{liveMatch.runs}/{liveMatch.wickets}</Text>
                        <Text style={styles.liveBowlingText}>Bowling: {liveMatch.bowlingTeamName}</Text>
                          </>
                        )}
                      </View>
                    ))}
                  </View>
                )}

              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>
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
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0px 8px 18px rgba(15, 23, 42, 0.08)',
    elevation: 4,
  },
  searchBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInputShell: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E2EE',
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A' },
  filterToggleButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#86EFAC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterToggleButtonActive: {
    backgroundColor: '#22C55E',
    borderColor: '#16A34A',
  },
  filtersModal: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBE7F5',
    padding: 12,
    boxShadow: '0px 6px 14px rgba(37, 99, 235, 0.08)',
    elevation: 2,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  filterText: { marginLeft: 8, color: '#166534', fontWeight: '600', fontSize: 13 },
  filterInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    minHeight: 44,
  },
  filterInput: {
    marginLeft: 8,
    flex: 1,
    color: '#0F172A',
    fontWeight: '500',
    fontSize: 14,
  },
  citySuggestionsList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  citySuggestionItem: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  citySuggestionText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '500',
  },
  locationErrorText: {
    marginTop: 6,
    color: '#B45309',
    fontSize: 12,
    lineHeight: 17,
  },
  applyFilterButton: {
    marginTop: 10,
    alignSelf: 'flex-end',
    borderRadius: 10,
    backgroundColor: '#22C55E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  applyFilterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  appliedFiltersSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  appliedFiltersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  appliedFiltersTitle: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  clearAllText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  appliedFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  appliedFilterChip: {
    maxWidth: '100%',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#ECFDF5',
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
  },
  appliedFilterText: {
    flexShrink: 1,
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
  },
  statusChipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  statusChip: {
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  statusChipActive: { backgroundColor: '#22C55E' },
  statusChipText: { color: '#374151', fontWeight: '500', fontSize: 13 },
  statusChipTextActive: { color: '#fff', fontWeight: '700' },

  tournamentsSection: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 },
  noResultsText: { textAlign: 'center', color: '#888', fontStyle: 'italic', marginVertical: 20 },
  errorState: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  errorStateText: { color: '#B91C1C', textAlign: 'center', fontFamily: 'Inter-Regular' },
  retryButton: { backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  retryButtonText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold' },

  simpleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    boxShadow: '0px 6px 16px rgba(15, 23, 42, 0.09)',
    elevation: 4,
  },
  simpleCardActive: {
    borderColor: '#86EFAC',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#F59E0B',
  },
  cardAccentActive: {
    backgroundColor: '#16A34A',
  },
  cardAccentCompleted: {
    backgroundColor: '#94A3B8',
  },

  cardHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },

  headingLeft: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'capitalize',
    lineHeight: 25,
  },
  cardMetaBlock: {
    gap: 7,
    marginBottom: 14,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDateText: {
    flex: 1,
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  cardLocationText: {
    flex: 1,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    textTransform: 'uppercase',
  },

  statusBadgeUpcoming: { backgroundColor: '#FEF3C7', color: '#92400E' },
  statusBadgeActive: { backgroundColor: '#DCFCE7', color: '#166534' },
  statusBadgeCompleted: { backgroundColor: '#F3F4F6', color: '#6B7280' },

  mainStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 11,
    marginBottom: 13,
  },

  mainStatBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 67,
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
    height: 42,
    backgroundColor: '#E2E8F0',
  },
  formatChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  formatChip: {
    maxWidth: '100%',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDE7F1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  formatChipWide: {
    flexShrink: 1,
  },
  formatChipIcon: {
    fontSize: 13,
    color: '#DC2626',
  },
  formatChipText: {
    flexShrink: 1,
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cardFooter: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
    paddingTop: 12,
  },

  spotsLeftText: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    overflow: 'hidden',
  },
  viewDetailsAction: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewDetailsText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  viewDetailsIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
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
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  liveTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

  statusChipsRowOuter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 0,
  },
});