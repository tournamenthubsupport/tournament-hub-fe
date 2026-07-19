import DateTimePicker from '@react-native-community/datetimepicker';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Calendar,
    CheckCircle2,
    MapPinned,
    MessageCircle,
    Phone,
    Trash2,
    Trophy,
    XCircle
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './auth/auth-context';
import { getCityItemsForState, INDIAN_STATE_OPTIONS } from './constants/indianLocations';
import { fetchSportById } from './service/sportsService';
import { getPlayersForTeams } from './service/teamPlayerService';
import { fetchTeamsByIds, fetchTeamsByMobile } from './service/teamsService';
import {
    completeTournamentMatch,
    deleteTournamentById,
    fetchTournamentMatches,
    fetchTournamentsById,
    resetTournamentMatches,
    scheduleTournamentMatches,
    setTournamentMatchToss,
    startTournamentMatch,
    updateTournament
} from './service/tournamentService';
import { addTeamToTournament, approveTeamInTournament, getTeamsByTournament, rejectTeamInTournament } from './service/tournamentTeamsService';

type Team = {
  id: number;
  name: string;
  location: string;
  created_by: string;
};

type TournamentMatch = {
  id: number;
  tournamentId: number;
  homeTeamId: number | null;
  homeTeamName: string | null;
  awayTeamId: number | null;
  awayTeamName: string | null;
  winnerTeamId: number | null;
  winnerTeamName: string | null;
  matchDate: string;
  venue: string | null;
  status: string;
  round: string;
  nextMatchId: number | null;
  nextSlot: string | null;
  homeFromMatchId?: number | null;
  awayFromMatchId?: number | null;
  tossResult?: string | null;
  tossWinnerTeamId?: number | null;
  tossWinnerTeamName?: string | null;
  tossDecision?: string | null;
  battingTeamId?: number | null;
  battingTeamName?: string | null;
  fieldingTeamId?: number | null;
  fieldingTeamName?: string | null;
};

const buildStateItems = () =>
  (Array.isArray(INDIAN_STATE_OPTIONS) ? INDIAN_STATE_OPTIONS : []).map((state) => ({
    label: state,
    value: state,
  }));

export default function TournamentDetailsScreen() {

  const auth = useAuth();

  if (!auth) {
    console.error('Auth context is not available');
    <Text>Loading auth context...</Text>;
    return false;
  }

  const { user } = auth;
  const currentUserMobile = user?.phone?.toString() || '';
  const userRole = (user?.role || 'player').toLowerCase();
  const isAdmin = userRole === 'admin';
  const isOrganizer = userRole === 'organizer';
  const isPrivileged = isOrganizer || isAdmin;
  const isGuestUser = !user?.id;
  const params = useLocalSearchParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<{
    id: number;
    name: string;
    sport_id: number;
    location: string;
    ground: string;
    organiser_name: string;
    organiser_contact: string;
    start_date: string;
    end_date: string;
    ball_type: string;
    tournament_type: string;
    match_type: string;
    teams: number;
    prize: string;
    image: string;
    status: string;
    entry_fees: number;
    state: string;
    city: string;
    created_date: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [sportNames, setSportNames] = useState<{ [key: number]: string }>({});
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [joinedTeams, setJoinedTeams] = useState<Team[]>([]);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [approvedStatus, setApprovedStatus] = useState<{ [teamId: number]: boolean }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editTournament, setEditTournament] = useState<any>(null);
  const [openState, setOpenState] = useState(false);
  const [openCity, setOpenCity] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [isLocationChanged, setIsLocationChanged] = useState(false);
  const [stateList, setStateList] = useState<{ label: string; value: string }[]>(buildStateItems());
  const [cityList, setCityList] = useState<{ label: string; value: string }[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [resetMatchesLoading, setResetMatchesLoading] = useState(false);
  const [showTournamentDetails, setShowTournamentDetails] = useState(true);
  const [winnerPickerMatch, setWinnerPickerMatch] = useState<TournamentMatch | null>(null);
  const [winnerSubmitting, setWinnerSubmitting] = useState(false);
  const [tossModalMatch, setTossModalMatch] = useState<TournamentMatch | null>(null);
  const [tossSpinning, setTossSpinning] = useState(false);
  const [tossSpinDone, setTossSpinDone] = useState(false);
  const [tossFaceResult, setTossFaceResult] = useState<'head' | 'tail' | null>(null);
  const [tossSubmitting, setTossSubmitting] = useState(false);
  const detailsScrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const tossSpinValue = useRef(new Animated.Value(0)).current;
  const tossSpinAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const tossFaceSwapRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const FIVE_RUPEE_COIN_FRONT_IMAGE = require('../assets/images/hub/image-right.png');
  const FIVE_RUPEE_COIN_BACK_IMAGE = require('../assets/images/hub/image-left.png');

  const normalizeContact = (number: string, countryCode = '91'): string => {
    const digitsOnly = String(number || '').replace(/\D/g, '');
    return digitsOnly.startsWith(countryCode) && digitsOnly.length > 10
      ? digitsOnly.slice(countryCode.length)
      : digitsOnly;
  };
  const formatDateForInput = (value?: string) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const parseInputDate = (value: string): Date | null => {
    const trimmed = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const parsed = new Date(`${trimmed}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };
  const stripCountryCode = (number: string, code = "91"): string => normalizeContact(number, code);
  const isSameDay = (dateA: Date, dateB: Date) => dateA.toDateString() === dateB.toDateString();
  const isTournamentOwner = normalizeContact(tournament?.organiser_contact || '') === normalizeContact(currentUserMobile);
  const canManageTournament = isAdmin || isTournamentOwner;
  const tournamentStartDate = tournament?.start_date ? new Date(tournament.start_date) : null;
  const tournamentEndDate = tournament?.end_date ? new Date(tournament.end_date) : null;
  const today = new Date();
  const isDateActive =
    !!tournamentStartDate &&
    !!tournamentEndDate &&
    ((tournamentStartDate <= today && tournamentEndDate > today) ||
      isSameDay(tournamentStartDate, today) ||
      isSameDay(tournamentEndDate, today));
  const isDateCompleted = !!tournamentEndDate && tournamentEndDate < today && !isSameDay(tournamentEndDate, today);
  const isStatusActive = (tournament?.status || '').toLowerCase() === 'active';
  const isStatusCompleted = (tournament?.status || '').toLowerCase() === 'completed';
  const isTournamentActive = isDateActive || isStatusActive;
  const isTournamentCompleted = isDateCompleted || isStatusCompleted;
  const approvedTeamsCount = Object.values(approvedStatus).filter(Boolean).length;
  const pendingTeamsCount = Math.max(teamCount - approvedTeamsCount, 0);
  const tournamentSlots = Number(tournament?.teams || 0);
  const isTournamentFullApproved = tournamentSlots > 0 && approvedTeamsCount >= tournamentSlots;
  const hasScheduledMatches = matches.length > 0;
  const finalMatch = matches.find((match) => String(match.round || '').toLowerCase() === 'final') || null;
  const isFinalCompleted = !!finalMatch && String(finalMatch.status || '').toLowerCase() === 'completed' && !!finalMatch.winnerTeamId;
  const championName = finalMatch?.winnerTeamName || 'Champion';
  const runnerUpName = finalMatch
    ? (finalMatch.homeTeamId === finalMatch.winnerTeamId ? finalMatch.awayTeamName : finalMatch.homeTeamName) || 'Runner Up'
    : 'Runner Up';
  const showTopDetails = !hasScheduledMatches || showTournamentDetails;

  useEffect(() => {
    if (hasScheduledMatches) {
      setShowTournamentDetails(false);
    } else {
      setShowTournamentDetails(true);
    }
  }, [hasScheduledMatches]);

  useEffect(() => {
    setCityList(getCityItemsForState(selectedState));
    setSelectedCity('');
  }, [selectedState]);

  const getTournamentTypeIcon = (type: string) => {
    const value = (type || '').toLowerCase();

    if (value.includes('turf')) return '🌱';
    if (value.includes('open') || value.includes('outdoor')) return '🌤️';
    if (value.includes('indoor')) return '🏟️';

    return '📍';
  };

  useEffect(() => {
    const loadTournaments = async () => {
      setLoading(true);
      try {
        const id = Array.isArray(params.id) ? params.id[0] : params.id;
        const data = await fetchTournamentsById(parseInt(id, 10));
        setTournament(data.tournament || {});

        const sportId = Number((data.tournament || {}).sport_id);
        const sportNameMap: { [key: number]: string } = {};

        try {
          const sport = await fetchSportById(sportId);
          const sportObj = sport as { name: string };
          sportNameMap[sportId] = sportObj.name;
        } catch {
          sportNameMap[sportId] = 'Unknown Sport';
        }

        setSportNames(sportNameMap);
      } catch (err) {
        console.error('Error loading tournaments:', err);
      } finally {
        setLoading(false); 
      }
    };
    loadTournaments();
  }, []);

  const fetchJoinedTeams = async () => {
    if (tournament?.id) {
      try {
        const data = await getTeamsByTournament(tournament.id);
        const rows = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.rows)
            ? (data as any).rows
            : [];

        if (rows.length > 0) {
          setTeamCount(rows.length);
  
          // Map team_id to is_approved
          const statusMap: { [teamId: number]: boolean } = {};
          rows.forEach((item: { team_id: number; is_approved: boolean }) => {
            statusMap[item.team_id] = item.is_approved;
          });
          setApprovedStatus(statusMap);
  
          // ...rest of your code for joinedTeams...
          const teamIds = rows.map((item: { team_id: number }) => item.team_id);
          setLoading(true);
          const teamsDetails = await fetchTeamsByIds(teamIds);
          setJoinedTeams(teamsDetails);
          setLoading(false);
        } else {
          setTeamCount(0);
          setJoinedTeams([]);
          setApprovedStatus({});
          setLoading(false);
        }
      } catch (err) {
        Alert.alert('Error fetching joined teams. Please try again later.');
      }
    }
  };

  const loadMatches = async (tournamentId: number) => {
    setMatchesLoading(true);
    try {
      const response = await fetchTournamentMatches(tournamentId);
      const rows = Array.isArray(response?.matches) ? response.matches : [];
      setMatches(rows);
    } catch {
      setMatches([]);
    } finally {
      setMatchesLoading(false);
      requestAnimationFrame(() => {
        detailsScrollRef.current?.scrollTo({ y: scrollOffsetRef.current, animated: false });
      });
    }
  };

  const handleScheduleMatches = async () => {
    if (!tournament?.id) return;

    try {
      setScheduleLoading(true);
      await scheduleTournamentMatches(tournament.id, stripCountryCode(currentUserMobile));
      await loadMatches(tournament.id);
      Alert.alert('Success', 'Tournament matches scheduled successfully.');
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message?: string }).message || 'Failed to schedule matches')
        : 'Failed to schedule matches';
      Alert.alert('Error', message);
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleResetMatches = () => {
    if (!tournament?.id) return;

    Alert.alert(
      'Reset Tournament Matches',
      'This will delete all scheduled matches and related scorecards for this tournament. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setResetMatchesLoading(true);
              await resetTournamentMatches(tournament.id, stripCountryCode(currentUserMobile));
              await loadMatches(tournament.id);
              Alert.alert('Success', 'All tournament matches and scorecards were reset.');
            } catch (err) {
              const message = typeof err === 'object' && err !== null && 'message' in err
                ? String((err as { message?: string }).message || 'Failed to reset matches')
                : 'Failed to reset matches';
              Alert.alert('Error', message);
            } finally {
              setResetMatchesLoading(false);
            }
          },
        },
      ],
    );
  };

  const openStartMatchModal = (match: TournamentMatch) => {
    setTossModalMatch(match);
    setTossSpinDone(!!match.battingTeamId && !!match.fieldingTeamId);
    setTossFaceResult('tail');
  };

  const runTossAnimation = async () => {
    if (!tossModalMatch || tossSpinning || tossSubmitting) return;

    const hasHome = Number(tossModalMatch.homeTeamId || 0) > 0;
    const hasAway = Number(tossModalMatch.awayTeamId || 0) > 0;
    if (!hasHome || !hasAway) {
      Alert.alert('Cannot toss', 'Both teams must be ready before toss.');
      return;
    }

    const homeTeamId = String(tossModalMatch.homeTeamId);
    const awayTeamId = String(tossModalMatch.awayTeamId);

    try {
      const playersByTeam = await getPlayersForTeams([homeTeamId, awayTeamId]);
      const homePlayers = Array.isArray((playersByTeam as Record<string, any[]>)[homeTeamId])
        ? (playersByTeam as Record<string, any[]>)[homeTeamId]
        : [];
      const awayPlayers = Array.isArray((playersByTeam as Record<string, any[]>)[awayTeamId])
        ? (playersByTeam as Record<string, any[]>)[awayTeamId]
        : [];

      const hasValidSquad = (players: any[]) => {
        if (players.length !== 11) return false;
        const hasCaptain = players.some((p) => p?.isCaptain === true);
        const hasViceCaptain = players.some((p) => p?.isViceCaptain === true);
        return hasCaptain && hasViceCaptain;
      };

      if (!hasValidSquad(homePlayers) || !hasValidSquad(awayPlayers)) {
        Alert.alert(
          'Cannot toss',
          'Before toss, both teams must have exactly 11 players with one captain and one vice-captain.',
        );
        return;
      }
    } catch {
      Alert.alert('Cannot toss', 'Unable to verify team players right now. Please try again.');
      return;
    }

    setTossSpinDone(false);
    setTossFaceResult('tail');
    setTossSpinning(true);
    tossSpinValue.setValue(0);

    if (tossFaceSwapRef.current) {
      clearInterval(tossFaceSwapRef.current);
    }
    tossFaceSwapRef.current = setInterval(() => {
      setTossFaceResult((prev) => (prev === 'head' ? 'tail' : 'head'));
    }, 120);

    const spinAnimation = Animated.timing(tossSpinValue, {
      toValue: 1,
      duration: 5000,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    tossSpinAnimationRef.current = spinAnimation;
    spinAnimation.start(({ finished }) => {
      if (tossFaceSwapRef.current) {
        clearInterval(tossFaceSwapRef.current);
        tossFaceSwapRef.current = null;
      }

      if (finished) {
        setTossSpinning(false);
        setTossFaceResult(Math.random() < 0.5 ? 'tail' : 'head');
        setTossSpinDone(true);
      }
    });
  };

  useEffect(() => {
    return () => {
      if (tossFaceSwapRef.current) {
        clearInterval(tossFaceSwapRef.current);
      }
    };
  }, []);

  const saveTossTeams = async (battingTeamId: number, fieldingTeamId: number) => {
    if (!tossModalMatch) {
      return;
    }

    if (!tossSpinDone) {
      Alert.alert('Toss pending', 'Spin the coin first.');
      return;
    }

    try {
      setTossSubmitting(true);
      await startTournamentMatch(tossModalMatch.id, stripCountryCode(currentUserMobile));
      await setTournamentMatchToss(
        tossModalMatch.id,
        stripCountryCode(currentUserMobile),
        battingTeamId,
        fieldingTeamId,
      );

      if (tournament?.id) {
        await loadMatches(tournament.id);
      }
      setTossModalMatch(null);
      Alert.alert('Success', 'Toss completed and saved.');
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message?: string }).message || 'Failed to save toss')
        : 'Failed to save toss';
      Alert.alert('Error', message);
    } finally {
      setTossSubmitting(false);
    }
  };

  const openMatchScorecard = (match: TournamentMatch) => {
    router.push({
      pathname: '/match-scorecard',
      params: {
        matchId: String(match.id),
        tournamentId: String(match.tournamentId),
      },
    });
  };

  const handleCompleteMatch = async (match: TournamentMatch) => {
    const hasHome = Number(match.homeTeamId) > 0 && !!match.homeTeamName;
    const hasAway = Number(match.awayTeamId) > 0 && !!match.awayTeamName;

    if (!hasHome && !hasAway) {
      Alert.alert('Cannot complete', 'Both teams are not ready for this match yet.');
      return;
    }

    setWinnerPickerMatch(match);
  };

  const submitWinner = async (teamId: number, teamName: string) => {
    if (!winnerPickerMatch) return;
    try {
      setWinnerSubmitting(true);
      await completeTournamentMatch(winnerPickerMatch.id, stripCountryCode(currentUserMobile), teamId);
      if (tournament?.id) {
        await loadMatches(tournament.id);
      }
      setWinnerPickerMatch(null);
      Alert.alert('Success', `${teamName} marked as winner.`);
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message?: string }).message || 'Failed to complete match')
        : 'Failed to complete match';
      Alert.alert('Error', message);
    } finally {
      setWinnerSubmitting(false);
    }
  };

  useEffect(() => {
    fetchJoinedTeams();
  }, [tournament]);

  useEffect(() => {
    if (tournament?.id) {
      loadMatches(tournament.id);
    }
  }, [tournament?.id]);

  const loadTeams = async () => {
    try {
      const mobile = stripCountryCode(currentUserMobile);
      if (mobile) {
        const data = await fetchTeamsByMobile(mobile);
        setUserTeams(data.teams);
      }
      } catch {
    }
  };
  const joinTeam = async () => {
    try {
      if (!tournament || !selectedTeam) {
        Alert.alert('Tournament or selected team is not available.');
        return;
      }
      const teamId = selectedTeam.id;
      const tournamentId = tournament.id;
      const feePaid = true;
      await addTeamToTournament(tournamentId, teamId, feePaid);
      fetchJoinedTeams();
      Alert.alert('✅ Success', 'Joined the Tournament Successfully!');
    } catch (error) {
      console.error('Error joining team:', error);
    }
  }

  const handleShare = () => {
    if (isGuestUser) {
      router.push({ pathname: '/auth/auth-screen', params: { returnTo: '/tournament-details', returnId: String(tournament?.id || '') } });
      return;
    }

    if (!tournament) {
      Alert.alert('Tournament data is not available.');
      return;
    }
  
    const message = `Message from Tournament Hub\n\n` +
    `🏆 ${tournament.name}\n` +
    `📍 ${tournament.location} - ${tournament.ground}\n` +
    `🗺️ ${tournament.state || 'State'} / ${tournament.city || 'City'}\n` +
    `📅 ${renderDateRange(tournament.start_date, tournament.end_date)}\n` +
    `🎯 Match Type: ${tournament.match_type}\n` +
    `🎾 Ball Type: ${tournament.ball_type}\n` +
    `📱 Organiser: ${tournament.organiser_name} (${tournament.organiser_contact})`;
  
    Share.share({
      message,
      title: `Tournament: ${tournament.name}`,
    });
  };

  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    return new Date(dateStr).toLocaleDateString('en-IN', options);
  };

  const renderDateRange = (start: string, end: string) => {
    if (start === end) return formatDate(start);
    return `${formatDate(start)} → ${formatDate(end)}`;
  };

  const handleCall = () => {
    const phone = tournament?.organiser_contact;
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = () => {
    const phone = tournament?.organiser_contact.replace('+', '');
    const url = `https://wa.me/${phone}`; // WhatsApp link
    Linking.openURL(url);
  };

  const openInMaps = async () => {
    const parts = [
      tournament?.ground,
      tournament?.location,
      tournament?.city,
      tournament?.state,
    ]
      .map((part) => (part || '').trim())
      .filter(Boolean);

    const query = parts.length > 0 ? parts.join(', ') : (tournament?.name || 'Tournament location');
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Map unavailable', 'Unable to open maps on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Map unavailable', 'Unable to open the map right now. Please try again.');
    }
  };

  const handleJoin = () => {
    if (isGuestUser) {
      router.push({ pathname: '/auth/auth-screen', params: { returnTo: '/tournament-details', returnId: String(tournament?.id || '') } });
      return;
    }

    loadTeams();
    setShowJoinModal(true);
  };

  const handleDeleteTournament = () => {
    if (!tournament?.id) return;

    Alert.alert(
      'Delete Tournament',
      'Are you sure you want to delete this tournament? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTournamentById(tournament.id, stripCountryCode(currentUserMobile));
              Alert.alert('Success', 'Tournament deleted successfully.');
              router.replace('/(tabs)');
            } catch {
              Alert.alert('Error', 'Failed to delete tournament. Please try again.');
            }
          },
        },
      ]
    );
  };

  function showConfirmDialog(title: string, message: string, onConfirm: () => void) {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes', onPress: onConfirm }
        ]
      );
    }
    else { onConfirm() }
  }

  const approveTeam = async (id: number) => {
    if (!tournament) return;
    try {
      await approveTeamInTournament(tournament.id, id);
      fetchJoinedTeams();
  
      // Find the team to get the creator's WhatsApp number
      const team = joinedTeams.find((team: any) => team.id === id);
      if (team && team.created_by) {
        const message = `Subject: Message from Tournament HUB\n\nCongratulations! Organiser approved your team "${team.name}" for the tournament "${tournament.name}".`;
        const whatsappUrl = `https://wa.me/${team.created_by}?text=${encodeURIComponent(message)}`;
        Linking.openURL(whatsappUrl);
      }
    } catch (error) {
      console.error('Approve team error:', error);
    }
  };

  const rejectTeam = async (id: number) => {
    if (!tournament) return;
    try {
      await rejectTeamInTournament(tournament.id, id);
      fetchJoinedTeams();
  
      // Find the team to get the creator's WhatsApp number
      const team = joinedTeams.find((team: any) => team.id === id);
      if (team && team.created_by) {
        const message = `Subject: Message from Tournament HUB\n\nFYI: Organiser rejected your team "${team.name}" from the tournament "${tournament.name}".`;
        const whatsappUrl = `https://wa.me/${team.created_by}?text=${encodeURIComponent(message)}`;
        Linking.openURL(whatsappUrl);
      }
    } catch (error) {
      console.error('Reject team error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tournament Details</Text>
          <View style={styles.placeholder} />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                 <ActivityIndicator size="large" color="#22C55E" />
               </View>
        ) : (
          <ScrollView
            ref={detailsScrollRef}
            contentContainerStyle={styles.container}
            onScroll={(event) => {
              scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            {tournament && showTopDetails && !isFinalCompleted && (
              <View style={styles.heroCard}>
                {canManageTournament && !isTournamentActive && !isTournamentCompleted && (
                  <TouchableOpacity
                    style={styles.heroEditChip}
                    onPress={() => {
                      setEditTournament(tournament);
                      setSelectedState(tournament?.state || '');
                      setSelectedCity(tournament?.city || '');
                      setIsLocationChanged(false);
                      setIsEditing(true);
                    }}
                  >
                    <Text style={styles.heroEditChipText}>Edit</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.heroGlowOne} />
                <View style={styles.heroGlowTwo} />

                <View style={styles.heroContentRow}>
                  <View style={styles.heroCopy}>
                    <Text style={styles.heroTitle}>{tournament.name}</Text>
                    <Text style={styles.heroSubtitle}>
                      {sportNames[tournament.sport_id] || 'Cricket'} • {tournament.state || 'State'} • {tournament.city || tournament.location}
                    </Text>

                    <View style={styles.heroMetaRow}>
                      <View style={styles.heroMetaChip}>
                        <Text style={styles.heroMetaChipText}>{getTournamentTypeIcon(tournament.tournament_type)} {tournament.tournament_type || 'Ground'}</Text>
                      </View>
                      <View style={styles.heroMetaChip}>
                        <Text style={styles.heroMetaChipText}>🏏 {tournament.match_type || 'Match'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.heroArtWrap}>
                    <View style={styles.heroArtCard}>
                      <View style={styles.heroArtField} />
                      <View style={styles.heroStumpsRow}>
                        <View style={styles.heroStump} />
                        <View style={styles.heroStump} />
                        <View style={styles.heroStump} />
                      </View>
                      <View style={styles.heroBailsRow}>
                        <View style={styles.heroBail} />
                        <View style={styles.heroBail} />
                      </View>
                      <View style={styles.heroBat} />
                      <View style={styles.heroBall} />
                      <View style={styles.heroArcOne} />
                      <View style={styles.heroArcTwo} />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {tournament && (
              <View style={styles.contentContainer}>
                {hasScheduledMatches && !isFinalCompleted && (
                  <TouchableOpacity
                    style={styles.detailsToggleButton}
                    onPress={() => setShowTournamentDetails((prev) => !prev)}
                  >
                    <Text style={styles.detailsToggleButtonText}>
                      {showTopDetails ? 'Hide Tournament Details' : 'Show Tournament Details'}
                    </Text>
                  </TouchableOpacity>
                )}

                {showTopDetails && !isFinalCompleted && (
                <>
                <View style={styles.infoSection}>
                  <InfoRow label="🏟️ Ground" value={tournament.ground} preserveCase />
                  <InfoRow label="📌 Location" value={tournament.location} preserveCase />
                  <InfoRow label="🗺️ State" value={tournament.state || 'N/A'} preserveCase />
                  <InfoRow label="🏙️ City" value={tournament.city || 'N/A'} preserveCase />
                  <InfoRow label="📅 Dates" value={renderDateRange(tournament.start_date, tournament.end_date)} />
                  <InfoRow label="🎮 Match Type" value={tournament.match_type} />
                  <InfoRow label="🏏 Ball Type" value={tournament.ball_type} />
                  <InfoRow
                    label="👥 Teams"
                    value={
                      <TouchableOpacity onPress={() => setShowTeamsModal(true)}>
                      <Text style={{
                        color: approvedTeamsCount >= (tournament?.teams ?? 0) ? '#DC2626' : '#2563EB',
                        textDecorationLine: 'underline',
                        fontWeight: approvedTeamsCount >= (tournament?.teams ?? 0) ? 'bold' : 'normal'
                      }}>
                        {teamCount} / {tournament.teams}
                        {pendingTeamsCount > 0 ? ` (${pendingTeamsCount} pending)` : ''}
                        {approvedTeamsCount >= (tournament?.teams ?? 0) && ' (Full)'}
                      </Text>
                    </TouchableOpacity>
                    }
                  />
                  <InfoRow label="💰 Entry Fees" value={tournament.entry_fees.toString()} />
                  <InfoRow label="🏆 Prize" value={tournament.prize} />
                </View>

                {canManageTournament && (
                  <View style={styles.organiserSection}>
                    <Text style={styles.sectionTitle}>Organiser Details</Text>
                    <InfoRow label="👤 Organiser" value={tournament.organiser_name} />
                    <View style={styles.contactRow}>
                      <ContactButton
                        icon={<Phone size={22} color="#1E90FF" />}
                        label="Call"
                        onPress={handleCall}
                        color="#1E90FF"
                      />
                      <ContactButton
                        icon={<MessageCircle size={22} color="#25D366" />}
                        label="WhatsApp"
                        onPress={handleWhatsApp}
                        color="#25D366"
                      />
                       <ContactButton
                      icon={<MapPinned size={22} color="#1E90FF" />}
                      label="Map"
                      onPress={openInMaps}
                      color="#1E90FF"
                    />
                    </View>
                  </View>
                )}

              {!canManageTournament && (
                <View style={styles.organiserSection}>
                 <ContactButton
                      icon={<MapPinned size={22} color="#1E90FF" />}
                      label="Map"
                      onPress={openInMaps}
                      color="#1E90FF"
                    />
                </View>
          )}

                {!isTournamentCompleted && (
                  <View style={styles.actionButtons}>
                    {!isTournamentFullApproved && (
                      <TouchableOpacity
                        onPress={handleJoin}
                        style={styles.joinButton}
                      >
                        <Text style={styles.buttonText}>Join Team</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
                      <Text style={styles.buttonText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {canManageTournament && !isTournamentCompleted && (
                  <View style={styles.actionButtons}>
                    {canManageTournament && isTournamentActive && isTournamentFullApproved && matches.length === 0 && (
                      <TouchableOpacity
                        onPress={handleScheduleMatches}
                        style={[styles.joinButton, scheduleLoading && styles.disabledButton]}
                        disabled={scheduleLoading}
                      >
                        <Text style={styles.buttonText}>{scheduleLoading ? 'Scheduling...' : 'Schedule Matches'}</Text>
                      </TouchableOpacity>
                    )}
                    {canManageTournament && matches.length > 0 && (
                      <View style={styles.resetActionWrap}>
                        <TouchableOpacity
                          onPress={handleResetMatches}
                          style={[styles.resetButton, resetMatchesLoading && styles.disabledButton]}
                          disabled={resetMatchesLoading}
                        >
                          <Text style={styles.buttonText}>{resetMatchesLoading ? 'Resetting...' : 'Reset Matches'}</Text>
                        </TouchableOpacity>
                        <Text style={styles.resetHintText}>Removes all scheduled matches and scorecards.</Text>
                      </View>
                    )}
                  </View>
                )}

                {isAdmin && (
                  <TouchableOpacity onPress={handleDeleteTournament} style={styles.deleteButton}>
                    <Trash2 size={18} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Delete Tournament</Text>
                  </TouchableOpacity>
                )}
                </>
                )}

                {matches.length > 0 && !isFinalCompleted && (
                  <View style={styles.matchSection}>
                    <Text style={styles.sectionTitle}>Match Schedule</Text>
                    {matchesLoading ? (
                      <ActivityIndicator size="small" color="#22C55E" />
                    ) : (
                      Object.entries(
                        matches.reduce((acc: { [key: string]: TournamentMatch[] }, match) => {
                          if (!acc[match.round]) acc[match.round] = [];
                          acc[match.round].push(match);
                          return acc;
                        }, {})
                      ).map(([roundName, roundMatches]) => (
                        <View key={roundName} style={styles.roundCard}>
                          <Text style={styles.roundTitle}>{roundName}</Text>
                          {roundMatches.map((match) => {
                            const statusValue = String(match.status || '').toLowerCase();
                            const tossDone = !!match.battingTeamId && !!match.fieldingTeamId;
                            const canStart = isTournamentOwner &&
                              !match.winnerTeamId &&
                              !tossDone &&
                              !!match.homeTeamId &&
                              !!match.awayTeamId;
                            const canViewScorecard = tossDone && !!match.homeTeamId && !!match.awayTeamId;
                            const canComplete = isTournamentOwner &&
                              (statusValue === 'scheduled' || statusValue === 'in_progress') &&
                              tossDone &&
                              !!match.homeTeamId &&
                              !!match.awayTeamId;

                            return (
                              <View key={match.id} style={styles.matchCard}>
                                <View style={styles.matchTeamsRow}>
                                  <Text style={styles.matchTeamText}>{match.homeTeamName || 'TBD'}</Text>
                                  <Text style={styles.matchVsText}>vs</Text>
                                  <Text style={styles.matchTeamText}>{match.awayTeamName || 'TBD'}</Text>
                                </View>
                                <Text style={styles.matchStatusText}>Status: {match.status}</Text>
                                {match.battingTeamName && match.fieldingTeamName ? (
                                  <Text style={styles.matchTossText}>
                                    Batting: {match.battingTeamName} | Fielding: {match.fieldingTeamName}
                                  </Text>
                                ) : (
                                  <Text style={styles.matchTossPendingText}>Toss pending</Text>
                                )}
                                {match.winnerTeamName ? (
                                  <Text style={styles.matchWinnerText}>Winner: {match.winnerTeamName}</Text>
                                ) : null}

                                {(canStart || canViewScorecard || canComplete) && (
                                  <View style={styles.matchActionRow}>
                                    {canStart && (
                                      <TouchableOpacity
                                        style={styles.matchActionButton}
                                        onPress={() => openStartMatchModal(match)}
                                      >
                                        <Text style={styles.matchActionButtonText}>Start Match</Text>
                                      </TouchableOpacity>
                                    )}
                                    {canViewScorecard && (
                                      <TouchableOpacity
                                        style={[styles.matchActionButton, styles.matchScorecardButton]}
                                        onPress={() => openMatchScorecard(match)}
                                      >
                                        <Text style={styles.matchActionButtonText}>
                                          {String(match.status || '').toLowerCase() === 'in_progress' ? 'Live Score' : 'Scorecard'}
                                        </Text>
                                      </TouchableOpacity>
                                    )}
                                    {canComplete && (
                                      <TouchableOpacity
                                        style={[styles.matchActionButton, styles.matchCompleteButton]}
                                        onPress={() => handleCompleteMatch(match)}
                                      >
                                        <Text style={styles.matchActionButtonText}>{match.winnerTeamId ? 'Change Winner' : 'Set Winner'}</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      ))
                    )}
                  </View>
                )}

                {isFinalCompleted && tournament && (
                  <View style={styles.championShowcaseSection}>
                    <Text style={styles.championSectionTitle}>Tournament Champions</Text>
                    <Text style={styles.championSectionSubtitle}>{tournament.name}</Text>

                    <View style={styles.championCard}>
                      <View style={[styles.cupIconWrap, styles.winnerCupWrap]}>
                        <Text style={styles.cupEmoji}>🏆</Text>
                      </View>
                      <Text style={styles.championLabel}>Winner</Text>
                      <Text style={styles.championTeamName}>{championName}</Text>
                      <Text style={styles.prizeAmountText}>Prize: ₹{String(tournament.prize || '0')}</Text>
                    </View>

                    <View style={styles.runnerCard}>
                      <View style={[styles.cupIconWrap, styles.runnerCupWrap]}>
                        <Text style={styles.cupEmoji}>🥈</Text>
                      </View>
                      <Text style={styles.runnerLabel}>Runner Up</Text>
                      <Text style={styles.runnerTeamName}>{runnerUpName}</Text>
                      <Text style={styles.runnerSubText}>Great run to the final</Text>
                    </View>

                    <View style={styles.championBadgeRow}>
                      <Trophy size={18} color="#F59E0B" />
                      <Text style={styles.championBadgeText}>Season Completed</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            <Modal visible={!!tossModalMatch} animationType="fade" transparent>
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => {
                      if (!tossSpinning && !tossSubmitting) setTossModalMatch(null);
                    }}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>

                  <Text style={styles.modalTitle}>Match Toss</Text>
                  <Text style={styles.winnerPickerSubtitle}>{tossModalMatch?.round || 'Match'}</Text>

                  <View style={styles.coinStage}>
                    <Animated.View
                      style={[
                        styles.coinWrap,
                        {
                          transform: [
                            {
                              rotateY: tossSpinValue.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '21600deg'],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Image
                        source={tossFaceResult === 'head' ? FIVE_RUPEE_COIN_BACK_IMAGE : FIVE_RUPEE_COIN_FRONT_IMAGE}
                        style={styles.coinImage}
                        resizeMode="cover"
                      />
                    </Animated.View>
                  </View>

                  <TouchableOpacity
                    style={[styles.winnerOptionButton, (tossSpinning || tossSubmitting) && styles.disabledButton]}
                    disabled={tossSpinning || tossSubmitting}
                    onPress={runTossAnimation}
                  >
                    <Text style={styles.winnerOptionText}>{tossSpinning ? 'Flipping...' : 'Flip Coin'}</Text>
                  </TouchableOpacity>

                  {tossSpinDone && tossModalMatch && (
                    <View style={styles.tossResultPanel}>
                      <Text style={styles.tossResultText}>
                        Toss Result: {tossFaceResult === 'head' ? 'Head' : 'Tail'}
                      </Text>
                      <Text style={styles.tossResultText}>Select which team is batting</Text>
                      <Text style={styles.tossResultSubText}>Manual toss update by organizer</Text>
                      <View style={styles.tossDecisionRow}>
                        <TouchableOpacity
                          style={[styles.tossDecisionButton, tossSubmitting && styles.disabledButton]}
                          disabled={tossSubmitting}
                          onPress={() => saveTossTeams(Number(tossModalMatch.homeTeamId), Number(tossModalMatch.awayTeamId))}
                        >
                          <Text style={styles.tossDecisionText}>{tossModalMatch.homeTeamName} Batting</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.tossDecisionButton, tossSubmitting && styles.disabledButton]}
                          disabled={tossSubmitting}
                          onPress={() => saveTossTeams(Number(tossModalMatch.awayTeamId), Number(tossModalMatch.homeTeamId))}
                        >
                          <Text style={styles.tossDecisionText}>{tossModalMatch.awayTeamName} Batting</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </Modal>

            <Modal visible={!!winnerPickerMatch} animationType="fade" transparent>
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => {
                      if (!winnerSubmitting) setWinnerPickerMatch(null);
                    }}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>

                  <Text style={styles.modalTitle}>Select Winner</Text>
                  <Text style={styles.winnerPickerSubtitle}>
                    {winnerPickerMatch?.round || 'Match'}
                  </Text>

                  {!!winnerPickerMatch?.homeTeamId && !!winnerPickerMatch?.homeTeamName && (
                    <TouchableOpacity
                      style={[styles.winnerOptionButton, winnerSubmitting && styles.disabledButton]}
                      disabled={winnerSubmitting}
                      onPress={() => submitWinner(Number(winnerPickerMatch.homeTeamId), String(winnerPickerMatch.homeTeamName))}
                    >
                      <Text style={styles.winnerOptionText}>{winnerPickerMatch.homeTeamName}</Text>
                    </TouchableOpacity>
                  )}

                  {!!winnerPickerMatch?.awayTeamId && !!winnerPickerMatch?.awayTeamName && (
                    <TouchableOpacity
                      style={[styles.winnerOptionButton, winnerSubmitting && styles.disabledButton]}
                      disabled={winnerSubmitting}
                      onPress={() => submitWinner(Number(winnerPickerMatch.awayTeamId), String(winnerPickerMatch.awayTeamName))}
                    >
                      <Text style={styles.winnerOptionText}>{winnerPickerMatch.awayTeamName}</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.winnerCancelButton}
                    onPress={() => {
                      if (!winnerSubmitting) setWinnerPickerMatch(null);
                    }}
                    disabled={winnerSubmitting}
                  >
                    <Text style={styles.winnerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            <Modal visible={showJoinModal} animationType="slide" transparent>
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  {/* Close Button */}
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowJoinModal(false)}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                  {/* Modal Title */}
                  <Text style={styles.modalTitle}>Join Tournament</Text>

                  {/* Search Input */}
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search your team"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />

                  {/* Team List */}

                  <FlatList<Team>
                    data={userTeams
                      .filter((team: Team) =>
                        // Filter out teams already joined in this tournament
                        !joinedTeams.some((joined: Team) => joined.id === team.id) &&
                        team.name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                    }
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.teamItem,
                          selectedTeam?.id === item.id && styles.selectedTeam,
                        ]}
                        onPress={() => setSelectedTeam(item)}
                      >
                        <Text style={styles.teamName}>{item.name}</Text>
                        <Text style={styles.teamLocation}>{item.location}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <Text style={styles.noResultsText}>No teams found.</Text>
                    }
                  />


                  {/* Confirm Join Button */}
                  <TouchableOpacity
                    style={[
                      styles.confirmJoinButton,
                      (!selectedTeam || userTeams.filter(
                        team => !joinedTeams.some((joined: Team) => joined.id === team.id) &&
                          team.name.toLowerCase().includes(searchQuery.toLowerCase())
                      ).length === 0) && styles.disabledButton,
                    ]}
                    onPress={() => {
                      joinTeam();
                      setShowJoinModal(false);
                    }}
                    disabled={
                      !selectedTeam ||
                      userTeams.filter(
                        team => !joinedTeams.some((joined: Team) => joined.id === team.id) &&
                          team.name.toLowerCase().includes(searchQuery.toLowerCase())
                      ).length === 0
                    }
                  >
                    <Text style={styles.confirmJoinText}>Join with Selected Team</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.createTeamButton}
                    onPress={() => {
                      setShowJoinModal(false);
                      router.push('/create-team');
                    }}
                  >
                    <Text style={styles.createTeamText}>+ Create New Team</Text>
                  </TouchableOpacity>

                </View>
              </View>
            </Modal>

            <Modal visible={showTeamsModal} animationType="slide" transparent>
  <View style={styles.modalContainer}>
    <View style={styles.modalContent}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => setShowTeamsModal(false)}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>
      <Text style={styles.modalTitle}>Joined Teams ({teamCount} / {tournament?.teams})</Text>
      <FlatList<Team>
        data={joinedTeams}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.teamItem}>
            <Text style={styles.teamName}>{item.name}</Text>
            <Text style={styles.teamLocation}>{item.location}</Text>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              {/* Show Approve/Reject only if not approved */}
              {canManageTournament && !approvedStatus[item.id] && (
                <>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}
                    onPress={() => {
                      showConfirmDialog(
                        'Approve Team',
                        'Are you sure you want to approve this team?',
                        () => approveTeam(item.id)
                      )
                    }}
                  >
                    <CheckCircle2 size={24} color="#16A34A" />
                    <Text style={{ marginLeft: 4, color: '#16A34A', fontWeight: '600' }}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}
                    onPress={() => showConfirmDialog(
                      'Reject Team',
                      'Are you sure you want to reject this team?',
                      () => rejectTeam(item.id)
                    )}
                  >
                    <XCircle size={24} color="#DC2626" />
                    <Text style={{ marginLeft: 4, color: '#DC2626', fontWeight: '600' }}>Reject</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Show pending approval message for user's own team if not approved */}
              {!canManageTournament && !approvedStatus[item.id] && (
                <Text style={{ marginLeft: 8, color: '#F59E42', fontWeight: 'bold' }}>
                  Pending Approval
                </Text>
              )}

              {/* Optionally, show a badge if approved */}
              {approvedStatus[item.id]  && (
                <Text style={{ marginLeft: 8, color: '#16A34A', fontWeight: 'bold' }}>Approved</Text>
              )}

              {/* WhatsApp icon */}
              {/* {tournament?.organiser_contact === stripCountryCode(currentUserMobile) && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://wa.me/${item.created_by}`)}
                >
                  <MessageCircle size={20} color="#25D366" />
                </TouchableOpacity>
              )} */}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.noResultsText}>No teams have joined yet.</Text>
        }
      />
    </View>
  </View>
</Modal>

            {isEditing && (
              <Modal visible={isEditing} animationType="slide" transparent>
                <View style={styles.modalContainer}>
                  <View style={styles.editModalContent}>
                    <TouchableOpacity style={styles.closeButton} onPress={() => setIsEditing(false)}>
                      <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.editModalTitle}>Edit Tournament</Text>
                    <Text style={styles.editModalSubtitle}>Update your tournament details and save changes.</Text>
                    <ScrollView contentContainerStyle={styles.editFormContent}>
                      <Text style={styles.editFieldLabel}>Tournament Name</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editTournament?.name || ''}
                        onChangeText={name => setEditTournament({ ...editTournament, name })}
                        placeholder="Tournament Name"
                      />
                      <Text style={styles.editFieldLabel}>Location</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editTournament?.location || ''}
                        onChangeText={location => setEditTournament({ ...editTournament, location })}
                        placeholder="Location"
                      />
                      <Text style={styles.editFieldLabel}>Ground</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editTournament?.ground || ''}
                        onChangeText={ground => setEditTournament({ ...editTournament, ground })}
                        placeholder="Ground"
                      />
                      <Text style={styles.editFieldLabel}>State / Union Territory</Text>
                      <DropDownPicker
        open={openState}
        value={selectedState ? selectedState : (tournament?.state || '')}
        items={stateList}
        setOpen={setOpenState}
        setValue={val => {
          setIsLocationChanged(true)
          setSelectedState(val);
          setEditTournament({ ...editTournament, state: val, city: '' });
        }}
        setItems={setStateList}
        placeholder="Select a State / UT"
        listMode="MODAL"
        searchable={true}
        searchPlaceholder="Search states or union territories"
        placeholderStyle={styles.dropdownPlaceholder}
        textStyle={styles.dropdownText}
        listItemContainerStyle={styles.dropdownItem}
        selectedItemContainerStyle={styles.dropdownItemSelected}
        searchContainerStyle={styles.dropdownSearchContainer}
        searchTextInputStyle={styles.dropdownSearchInput}
        modalProps={{ animationType: 'slide', presentationStyle: 'pageSheet' }}
        modalTitle="Choose a State / UT"
        style={styles.dropdownField}
        modalContentContainerStyle={styles.dropdownModalContent}
        dropDownContainerStyle={styles.dropdownMenu}
/>
                      <Text style={styles.editFieldLabel}>City</Text>
                      <DropDownPicker
        open={openCity}
        value={selectedCity ? selectedCity : (tournament?.city || '')}
        items={cityList}
        setOpen={setOpenCity}
        setValue={val => {
          setIsLocationChanged(true)
          setSelectedCity(val);
          setEditTournament({ ...editTournament, city: val });
        }}
        setItems={setCityList}
        placeholder={selectedState ? 'Select a City' : 'Select a State first'}
        listMode="MODAL"
        searchable={true}
        searchPlaceholder="Search cities"
        placeholderStyle={styles.dropdownPlaceholder}
        textStyle={styles.dropdownText}
        listItemContainerStyle={styles.dropdownItem}
        selectedItemContainerStyle={styles.dropdownItemSelected}
        searchContainerStyle={styles.dropdownSearchContainer}
        searchTextInputStyle={styles.dropdownSearchInput}
        disabled={!selectedState}
        modalProps={{ animationType: 'slide', presentationStyle: 'pageSheet' }}
        modalTitle="Choose a City"
        style={styles.dropdownField}
        modalContentContainerStyle={styles.dropdownModalContent}
        dropDownContainerStyle={styles.dropdownMenu}
/>
                      <Text style={styles.editFieldLabel}>Prize</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editTournament?.prize || ''}
                        onChangeText={prize => setEditTournament({ ...editTournament, prize })}
                        placeholder="Prize"
                      />
                      <Text style={styles.editFieldLabel}>Entry Fees</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editTournament?.entry_fees?.toString() || ''}
                        onChangeText={entry_fees => setEditTournament({ ...editTournament, entry_fees: Number(entry_fees) })}
                        placeholder="Entry Fees"
                        keyboardType="numeric"
                      />
                      <Text style={styles.editFieldLabel}>Tournament Type</Text>
                      <View style={styles.optionsContainer}>
                        {['Turf', 'Open Ground'].map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[styles.optionButton, editTournament?.tournament_type === type && styles.selectedButton]}
                            onPress={() => setEditTournament({ ...editTournament, tournament_type: type })}
                          >
                            <Text style={styles.optionText}>{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.editFieldLabel}>Match Type</Text>
                      <View style={styles.optionsContainer}>
                        {['Limited Overs', 'One Day', 'Test Match'].map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[styles.optionButton, editTournament?.match_type === type && styles.selectedButton]}
                            onPress={() => setEditTournament({ ...editTournament, match_type: type })}
                          >
                            <Text style={styles.optionText}>{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.editFieldLabel}>Ball Type</Text>
                      <View style={styles.optionsContainer}>
                        {['Tennis', 'Rubber', 'Leather'].map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[styles.optionButton, editTournament?.ball_type === type && styles.selectedButton]}
                            onPress={() => setEditTournament({ ...editTournament, ball_type: type })}
                          >
                            <Text style={styles.optionText}>{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.editFieldLabel}>Start Date</Text>
                      {Platform.OS === 'web' ? (
                        <input
                          type="date"
                          value={formatDateForInput(editTournament?.start_date)}
                          onChange={(event: any) => {
                            const parsed = parseInputDate(event?.target?.value || '');
                            if (!parsed) return;

                            const currentEnd = editTournament?.end_date ? new Date(editTournament.end_date) : null;
                            if (currentEnd && parsed.getTime() > currentEnd.getTime()) {
                              setEditTournament({
                                ...editTournament,
                                start_date: parsed.toISOString(),
                                end_date: parsed.toISOString(),
                              });
                              return;
                            }

                            setEditTournament({ ...editTournament, start_date: parsed.toISOString() });
                          }}
                          style={{
                            width: '100%',
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderStyle: 'solid',
                            borderColor: '#E5E7EB',
                            borderRadius: 12,
                            padding: '12px 16px',
                            fontSize: 16,
                            fontFamily: 'Inter-Regular',
                            color: '#111827',
                          }}
                        />
                      ) : (
                        <>
                          <TouchableOpacity onPress={() => setEditTournament({ ...editTournament, showStartPicker: true })} style={styles.dateButton}>
                            <Calendar size={16} color="#555" />
                            <Text style={styles.dateText}>{editTournament?.start_date ? new Date(editTournament.start_date).toDateString() : 'Select Start Date'}</Text>
                          </TouchableOpacity>
                          {editTournament?.showStartPicker && (
                            <DateTimePicker
                              value={editTournament?.start_date ? new Date(editTournament.start_date) : new Date()}
                              mode="date"
                              display="default"
                              onChange={(event, selectedDate) => {
                                setEditTournament({ ...editTournament, showStartPicker: false });
                                if (selectedDate) setEditTournament({ ...editTournament, start_date: selectedDate.toISOString() });
                              }}
                            />
                          )}
                        </>
                      )}
                      <Text style={styles.editFieldLabel}>End Date</Text>
                      {Platform.OS === 'web' ? (
                        <input
                          type="date"
                          value={formatDateForInput(editTournament?.end_date)}
                          min={formatDateForInput(editTournament?.start_date)}
                          onChange={(event: any) => {
                            const parsed = parseInputDate(event?.target?.value || '');
                            if (!parsed) return;

                            const currentStart = editTournament?.start_date ? new Date(editTournament.start_date) : null;
                            if (currentStart && parsed.getTime() < currentStart.getTime()) {
                              setEditTournament({ ...editTournament, end_date: currentStart.toISOString() });
                              return;
                            }

                            setEditTournament({ ...editTournament, end_date: parsed.toISOString() });
                          }}
                          style={{
                            width: '100%',
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderStyle: 'solid',
                            borderColor: '#E5E7EB',
                            borderRadius: 12,
                            padding: '12px 16px',
                            fontSize: 16,
                            fontFamily: 'Inter-Regular',
                            color: '#111827',
                          }}
                        />
                      ) : (
                        <>
                          <TouchableOpacity onPress={() => setEditTournament({ ...editTournament, showEndPicker: true })} style={styles.dateButton}>
                            <Calendar size={16} color="#555" />
                            <Text style={styles.dateText}>{editTournament?.end_date ? new Date(editTournament.end_date).toDateString() : 'Select End Date'}</Text>
                          </TouchableOpacity>
                          {editTournament?.showEndPicker && (
                            <DateTimePicker
                              value={editTournament?.end_date ? new Date(editTournament.end_date) : new Date()}
                              mode="date"
                              display="default"
                              onChange={(event, selectedDate) => {
                                setEditTournament({ ...editTournament, showEndPicker: false });
                                if (selectedDate) setEditTournament({ ...editTournament, end_date: selectedDate.toISOString() });
                              }}
                            />
                          )}
                        </>
                      )}
                    </ScrollView>
                    <View style={styles.editActionsRow}>
                      <TouchableOpacity
                        style={styles.editCancelButton}
                        onPress={() => setIsEditing(false)}
                      >
                        <Text style={styles.editCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editSaveButton}
                        onPress={async () => {
                          try {
                            if (!isLocationChanged) {
                              setSelectedState(tournament?.state || '');
                              setSelectedCity(tournament?.city || '');
                            }
                            editTournament.state = selectedState;
                            editTournament.city = selectedCity;
                            await updateTournament(editTournament.id, editTournament);
                            setTournament(editTournament);
                            setIsEditing(false);
                            Alert.alert('Success', 'Tournament details updated!');
                          } catch (err) {
                            const errorMessage = typeof err === 'object' && err !== null && 'message' in err ? (err as { message?: string }).message : 'Failed to update tournament';
                            Alert.alert('Error', errorMessage || 'Failed to update tournament');
                          }
                        }}
                      >
                        <Text style={styles.editSaveText}>Save Changes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            )}

          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const InfoRow = ({
  label,
  value,
  preserveCase = false,
}: {
  label: string;
  value: React.ReactNode;
  preserveCase?: boolean;
}) => (
  <View style={styles.detailRow}>
    <Text style={[styles.label, preserveCase && styles.labelNoTransform]}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const ContactButton = ({ icon, label, onPress, color }: { icon: React.ReactNode; label: string; onPress: () => void; color: string }) => (
  <TouchableOpacity onPress={onPress} style={styles.contactButton}>
    <View style={styles.contactIconWrap}>
      {typeof icon === 'string' ? (
        <Text style={[styles.contactIcon, { color }]}>{icon}</Text>
      ) : (
        icon
      )}
    </View>
    <Text style={[styles.contactLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    padding: 5,
    paddingBottom: 20,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  dropdownField: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  dropdownModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#F8FAFC',
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 20,
    maxHeight: 700,
  },
  dropdownPlaceholder: {
    color: '#94A3B8',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
  },
  dropdownText: {
    color: '#111827',
    fontSize: 15,
    fontFamily: 'Inter-Medium',
  },
  dropdownItem: {
    borderRadius: 14,
    marginHorizontal: 8,
    marginVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  dropdownItemSelected: {
    backgroundColor: '#DCFCE7',
  },
  dropdownSearchContainer: {
    borderBottomWidth: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#F8FAFC',
  },
  dropdownSearchInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 15,
  },
  dropdownTick: {
    tintColor: '#16A34A',
  },
  dropdownArrow: {
    tintColor: '#6B7280',
  },
  dateText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  safeArea: {
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
    paddingVertical: 25,
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
  editButton: {
    marginRight: 10,
  },
  heroEditChip: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 3,
    backgroundColor: 'rgba(37,99,235,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  heroEditChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroCard: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 18,
    backgroundColor: '#0F172A',
    padding: 18,
    minHeight: 200,
    position: 'relative',
  },
  heroGlowOne: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(34,197,94,0.18)',
    top: -28,
    right: -24,
  },
  heroGlowTwo: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(37,99,235,0.18)',
    bottom: -18,
    left: -18,
  },
  heroContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    zIndex: 2,
  },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  heroPillText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 12,
    fontWeight: '500',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroMetaChip: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  heroMetaChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  heroArtWrap: {
    width: 132,
    height: 132,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  heroArtCard: {
    width: 132,
    height: 132,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    position: 'relative',
    overflow: 'hidden',
  },
  heroArtField: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#14532D',
    opacity: 0.95,
  },
  heroStumpsRow: {
    position: 'absolute',
    bottom: 36,
    left: 24,
    flexDirection: 'row',
    gap: 4,
  },
  heroStump: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: '#FDE68A',
  },
  heroBailsRow: {
    position: 'absolute',
    bottom: 58,
    left: 25,
    flexDirection: 'row',
    gap: 8,
  },
  heroBail: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FBBF24',
  },
  heroBat: {
    position: 'absolute',
    width: 12,
    height: 42,
    borderRadius: 6,
    backgroundColor: '#D97706',
    right: 28,
    top: 34,
    transform: [{ rotate: '-28deg' }],
  },
  heroBall: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    right: 54,
    top: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  heroArcOne: {
    position: 'absolute',
    width: 70,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.32)',
    top: 48,
    left: 26,
    transform: [{ rotate: '-18deg' }],
  },
  heroArcTwo: {
    position: 'absolute',
    width: 52,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    top: 60,
    left: 40,
    transform: [{ rotate: '-18deg' }],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'left',
  },
  infoSection: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4B5563',
    width: 140,
    textTransform: 'capitalize',
  },
  labelNoTransform: {
    textTransform: 'none',
  },
  value: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  organiserSection: {
    marginBottom: 0,
    marginTop: 20,
  },
  detailsToggleButton: {
    marginBottom: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#E0E7FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailsToggleButtonText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  matchSection: {
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 18,
  },
  roundCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  roundTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  matchTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  matchTeamText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  matchTossText: {
    marginTop: 4,
    fontSize: 12,
    color: '#334155',
  },
  matchTossPendingText: {
    marginTop: 4,
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
  },
  matchVsText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  coinStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  coinWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  coinFaceText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.7,
  },
  tossResultPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 10,
  },
  tossResultText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '700',
    textAlign: 'center',
  },
  tossResultCoinImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },
  tossResultSubText: {
    marginTop: 6,
    fontSize: 12,
    color: '#047857',
    textAlign: 'center',
  },
  tossDecisionRow: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 10,
  },
  tossTeamLine: {
    marginTop: 6,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    textAlign: 'center',
  },
  tossDecisionButton: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  tossDecisionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  matchStatusText: {
    marginTop: 6,
    fontSize: 12,
    color: '#475569',
  },
  matchWinnerText: {
    marginTop: 4,
    fontSize: 13,
    color: '#166534',
    fontWeight: '700',
  },
  matchActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  matchActionButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  matchCompleteButton: {
    backgroundColor: '#16A34A',
  },
  matchScorecardButton: {
    backgroundColor: '#0EA5E9',
  },
  matchActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  championShowcaseSection: {
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  championSectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  championSectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  championCard: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    alignItems: 'center',
    marginBottom: 12,
  },
  runnerCard: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  cupIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  winnerCupWrap: {
    backgroundColor: '#FEF3C7',
  },
  runnerCupWrap: {
    backgroundColor: '#E2E8F0',
  },
  cupEmoji: {
    fontSize: 26,
  },
  championLabel: {
    fontSize: 13,
    color: '#B45309',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  championTeamName: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  prizeAmountText: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  runnerLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  runnerTeamName: {
    marginTop: 5,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  runnerSubText: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748B',
  },
  championBadgeRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  championBadgeText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '700',
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  contactButton: {
    alignItems: 'center',
  },
  contactIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  contactIconWrap: {
    width: 28,
    height: 28,
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactLabel: {
    fontSize: 14,
    color: '#4B5563',
    textTransform: 'capitalize',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  joinButton: {
    flex: 1,
    marginInlineEnd: 10,
    padding: 15,
    backgroundColor: '#16A34A',
    borderRadius: 12,
  },
  shareButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#2563EB',
    borderRadius: 12,
  },
  resetButton: {
    width: '100%',
    padding: 15,
    backgroundColor: '#B45309',
    borderRadius: 12,
  },
  resetActionWrap: {
    flex: 1,
    marginInlineEnd: 10,
  },
  resetHintText: {
    marginTop: 6,
    color: '#92400E',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: 12,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // semi-transparent backdrop
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  editModalContent: {
    width: '94%',
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 14,
    elevation: 6,
  },
  editModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  editModalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 14,
  },
  editFormContent: {
    paddingBottom: 12,
  },
  editFieldLabel: {
    fontWeight: '700',
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 7,
    marginTop: 4,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: '#111827',
  },
  editDropdown: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    minHeight: 48,
    marginBottom: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  editCancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  editCancelText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
  },
  editSaveButton: {
    flex: 1.4,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  editSaveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
  winnerPickerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  winnerOptionButton: {
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  winnerOptionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  winnerCancelButton: {
    marginTop: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  winnerCancelText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  teamItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedTeam: {
    borderColor: '#1E90FF',
    backgroundColor: '#e6f0ff',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  teamLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  createTeamButton: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#1E90FF',
  },
  createTeamText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  confirmJoinButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#25D366',
  },
  confirmJoinText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  noResultsText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#888',
    fontStyle: 'italic',
  },

  disabledButton: {
    backgroundColor: '#ccc',
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  selectedButton: {
    borderColor: '#2563EB',
    backgroundColor: '#e6f0ff',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    backgroundColor: '#eee',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
});