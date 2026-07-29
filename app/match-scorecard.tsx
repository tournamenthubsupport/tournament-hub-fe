import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './auth/auth-context';
import {
  addMatchBallEvent,
  completeMatchScorecard,
  completeTournamentMatch,
  fetchMatchScorecard,
  replaceLastMatchBallEvent,
  resetMatchScorecard,
  setupMatchScorecard,
  undoLastMatchBallEvent,
} from './service/tournamentService';

type ScoreEvent = {
  token: string;
  label?: string;
  runs: number;
  wicket?: boolean;
  extraType?: string | null;
  over?: number;
  ballInOver?: number;
};

type MatchScorecardResponse = {
  match: {
    id: number;
    status: string;
    homeTeamId?: number;
    homeTeamName: string;
    awayTeamId?: number;
    awayTeamName: string;
    battingTeamName: string;
    fieldingTeamName: string;
  };
  scorecard: {
    currentInnings?: number;
    oversLimit?: number;
    status?: string;
    resultSummary?: {
      winnerTeamId?: number | null;
      winnerTeamName?: string | null;
      loserTeamId?: number | null;
      loserTeamName?: string | null;
      margin?: string | null;
      resultType?: string | null;
      inningsOneRuns?: number;
      inningsTwoRuns?: number;
    } | null;
    inningsOne?: {
      battingTeamName?: string | null;
      fieldingTeamName?: string | null;
      runs?: number;
      wickets?: number;
      legalBalls?: number;
      overs?: string;
      events?: ScoreEvent[];
    };
    inningsTwo?: {
      battingTeamName?: string | null;
      fieldingTeamName?: string | null;
      runs?: number;
      wickets?: number;
      legalBalls?: number;
      overs?: string;
      events?: ScoreEvent[];
    };
  } | null;
  permissions?: {
    canEdit?: boolean;
  };
};

type ActionOption = {
  token: string;
  label: string;
  tone: 'run' | 'boundary' | 'extra' | 'wicket';
};

const OVER_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 50];
const ACTION_OPTIONS: ActionOption[] = [
  { token: '0', label: 'DOT', tone: 'run' },
  { token: '1', label: '1', tone: 'run' },
  { token: '2', label: '2', tone: 'run' },
  { token: '3', label: '3', tone: 'run' },
  { token: '4', label: '4', tone: 'boundary' },
  { token: '6', label: '6', tone: 'boundary' },
  { token: 'wk', label: 'W', tone: 'wicket' },
  { token: 'runout', label: 'Runout', tone: 'wicket' },
  { token: 'wd', label: 'WD', tone: 'extra' },
  { token: 'wd+1', label: 'WD+1', tone: 'extra' },
  { token: 'wd+2', label: 'WD+2', tone: 'extra' },
  { token: 'wd+3', label: 'WD+3', tone: 'extra' },
  { token: 'wd+4', label: 'WD+4', tone: 'extra' },
  { token: 'wd+5', label: 'WD+5', tone: 'extra' },
  { token: 'nb', label: 'NB', tone: 'extra' },
  { token: 'nb+1', label: 'NB+1', tone: 'extra' },
  { token: 'nb+2', label: 'NB+2', tone: 'extra' },
  { token: 'nb+3', label: 'NB+3', tone: 'extra' },
  { token: 'nb+4', label: 'NB+4', tone: 'extra' },
  { token: 'nb+5', label: 'NB+5', tone: 'extra' },
  { token: 'nb+6', label: 'NB+6', tone: 'extra' },
];

const sumRuns = (events: ScoreEvent[]) =>
  events.reduce((sum, event) => sum + Number(event.runs || 0), 0);

const legalBalls = (events: ScoreEvent[]) =>
  events.filter((event) => !['wide', 'no_ball'].includes(String(event.extraType || '').toLowerCase())).length;

const wickets = (events: ScoreEvent[]) =>
  events.reduce((sum, event) => sum + (event.wicket ? 1 : 0), 0);

const toOvers = (ballCount: number) => `${Math.floor(ballCount / 6)}.${ballCount % 6}`;

const toRate = (runs: number, balls: number) => {
  if (balls <= 0) return '0.00';
  return (runs / (balls / 6)).toFixed(2);
};

const toUserFacingScorecardError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  if (message.toLowerCase().includes('scorecard service unavailable')) {
    return 'Scorecard service is temporarily unavailable. Please try again in a few minutes.';
  }

  return message || fallback;
};

export default function MatchScorecardScreen() {
  const auth = useAuth();
  const params = useLocalSearchParams();
  const router = useRouter();
  const matchId = Number(Array.isArray(params.matchId) ? params.matchId[0] : params.matchId);
  const tournamentId = Number(Array.isArray(params.tournamentId) ? params.tournamentId[0] : params.tournamentId);
  const organiserContact = String(auth?.user?.phone || '').replace('+91', '').replace('+', '').trim();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<MatchScorecardResponse | null>(null);
  const [selectedOvers, setSelectedOvers] = useState<number>(5);
  const [editingLastBall, setEditingLastBall] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [showWinnerPicker, setShowWinnerPicker] = useState(false);
  const [winnerSubmitting, setWinnerSubmitting] = useState(false);

  const loadScorecard = async (options?: { silent?: boolean }) => {
    if (!Number.isInteger(matchId) || matchId <= 0) {
      Alert.alert('Invalid match', 'Unable to open scorecard for this match.');
      return;
    }

    if (!options?.silent || !hasLoadedOnce) {
      setLoading(true);
    }

    try {
      const response = (await fetchMatchScorecard(matchId, organiserContact)) as MatchScorecardResponse;
      setData(response);

      if (response.scorecard?.oversLimit) {
        setSelectedOvers(Number(response.scorecard.oversLimit));
      }
      setHasLoadedOnce(true);
    } catch (error) {
      Alert.alert('Error', toUserFacingScorecardError(error, 'Failed to load scorecard. Please try again.'));
    } finally {
      if (!options?.silent || !hasLoadedOnce) {
        setLoading(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadScorecard();
    }, [matchId]),
  );

  const scorecardStatus = String(data?.scorecard?.status || '').toLowerCase();
  const matchStatus = String(data?.match?.status || '').toLowerCase();
  const isCompleted = matchStatus === 'completed';
  const isInningsBreak = !isCompleted && scorecardStatus === 'innings_break';
  const oversLimit = Number(data?.scorecard?.oversLimit || selectedOvers);
  const oversLocked = !!data?.scorecard?.oversLimit;
  const currentInnings = Number(data?.scorecard?.currentInnings || 1) === 2 ? 2 : 1;

  const inningsOneState = data?.scorecard?.inningsOne || {};
  const inningsTwoState = data?.scorecard?.inningsTwo || {};
  const inningsOneEvents = inningsOneState?.events || [];
  const inningsTwoEvents = inningsTwoState?.events || [];
  const currentEvents = currentInnings === 2 ? inningsTwoEvents : inningsOneEvents;

  const inningsOneRuns = Number.isFinite(Number(inningsOneState?.runs))
    ? Number(inningsOneState.runs)
    : sumRuns(inningsOneEvents);
  const inningsOneWickets = Number.isFinite(Number(inningsOneState?.wickets))
    ? Number(inningsOneState.wickets)
    : wickets(inningsOneEvents);
  const inningsOneBalls = Number.isFinite(Number(inningsOneState?.legalBalls))
    ? Number(inningsOneState.legalBalls)
    : legalBalls(inningsOneEvents);

  const inningsTwoRuns = Number.isFinite(Number(inningsTwoState?.runs))
    ? Number(inningsTwoState.runs)
    : sumRuns(inningsTwoEvents);
  const inningsTwoWickets = Number.isFinite(Number(inningsTwoState?.wickets))
    ? Number(inningsTwoState.wickets)
    : wickets(inningsTwoEvents);
  const inningsTwoBalls = Number.isFinite(Number(inningsTwoState?.legalBalls))
    ? Number(inningsTwoState.legalBalls)
    : legalBalls(inningsTwoEvents);

  const currentRuns = currentInnings === 2 ? inningsTwoRuns : inningsOneRuns;
  const currentWickets = currentInnings === 2 ? inningsTwoWickets : inningsOneWickets;
  const currentBalls = currentInnings === 2 ? inningsTwoBalls : inningsOneBalls;
  const currentOvers = toOvers(currentBalls);

  const currentOverNumber = currentEvents.length > 0 ? currentEvents[currentEvents.length - 1]?.over || 1 : 1;
  const currentOverEvents = currentEvents.filter((event) => (event.over || 1) === currentOverNumber).slice(-8);

  const firstTeamName =
    data?.scorecard?.inningsOne?.battingTeamName || data?.match?.battingTeamName || data?.match?.homeTeamName || 'Team 1';
  const secondTeamName =
    data?.scorecard?.inningsTwo?.battingTeamName ||
    (firstTeamName === data?.match?.homeTeamName ? data?.match?.awayTeamName : data?.match?.homeTeamName) ||
    data?.match?.awayTeamName ||
    'Team 2';

  const inningsOneBatting = firstTeamName;
  const inningsOneFielding =
    data?.scorecard?.inningsOne?.fieldingTeamName ||
    (inningsOneBatting === data?.match?.homeTeamName ? data?.match?.awayTeamName : data?.match?.homeTeamName) ||
    'Team 2';
  const inningsTwoBatting = secondTeamName;
  const inningsTwoFielding =
    data?.scorecard?.inningsTwo?.fieldingTeamName ||
    (inningsTwoBatting === data?.match?.homeTeamName ? data?.match?.awayTeamName : data?.match?.homeTeamName) ||
    'Team 1';

  const target = inningsOneRuns > 0 ? inningsOneRuns + 1 : null;
  const crr = toRate(currentRuns, currentBalls);
  const reqRuns = target ? Math.max(0, target - inningsTwoRuns) : 0;
  const ballsLeft = Math.max(0, oversLimit * 6 - inningsTwoBalls);
  const reqRate = ballsLeft > 0 ? toRate(reqRuns, ballsLeft) : '0.00';

  const resultSummary = data?.scorecard?.resultSummary;
  const officialResultMessage = (() => {
    if (!resultSummary) return null;

    const resultType = String(resultSummary.resultType || '').toLowerCase();
    const winnerName = String(resultSummary.winnerTeamName || '').trim();
    const margin = String(resultSummary.margin || '').trim();

    if (resultType === 'tie' || !winnerName) {
      return 'Match tied';
    }

    if (!margin) {
      return `${winnerName} won`;
    }

    return `${winnerName} won by ${margin}`;
  })();
  const hasWinnerSet = Number(resultSummary?.winnerTeamId || 0) > 0;
  const isTieOrDraw =
    isCompleted && (
      ['tie', 'draw'].includes(String(resultSummary?.resultType || '').toLowerCase()) ||
      officialResultMessage === 'Match tied' ||
      (inningsOneRuns > 0 && inningsOneRuns === inningsTwoRuns)
    );

  const setupButtonLabel = isCompleted
    ? 'Scorecard Completed'
    : isInningsBreak
      ? 'Start Second Innings'
      : data?.scorecard
        ? 'Update Overs'
        : 'Start Live Score';

  const canEditScorecard = !!data?.permissions?.canEdit;
  const showWinnerAction = canEditScorecard && isTieOrDraw && !hasWinnerSet;
  const heroEyebrowLabel = isCompleted ? 'Scorecard' : 'Live Score';

  const canSaveSetup = canEditScorecard && !saving && !isCompleted;
  const canScoreBall = canEditScorecard && !saving && !isCompleted && !isInningsBreak && !!data?.scorecard;
  const canCompleteMatch = canEditScorecard && !saving && !isCompleted && !!data?.scorecard;

  const submitWinner = async (teamId: number) => {
    if (!organiserContact) {
      Alert.alert('Missing organiser', 'Unable to find organiser contact in session.');
      return;
    }

    try {
      setWinnerSubmitting(true);
      await completeTournamentMatch(matchId, organiserContact, teamId);
      setShowWinnerPicker(false);
      await loadScorecard({ silent: true });
      navigateToTournamentSchedule();
    } catch (error) {
      const message = toUserFacingScorecardError(error, 'Failed to set winner');
      Alert.alert('Error', message);
    } finally {
      setWinnerSubmitting(false);
    }
  };

  const handleSetupScorecard = async () => {
    if (!organiserContact) {
      Alert.alert('Missing organiser', 'Unable to find organiser contact in session.');
      return;
    }

    setSaving(true);
    try {
      await setupMatchScorecard(matchId, organiserContact, selectedOvers);
      await loadScorecard({ silent: true });
      Alert.alert('Live scoring ready', 'Overs saved. You can update ball-by-ball now.');
    } catch (error) {
      const message = toUserFacingScorecardError(error, 'Failed to setup scorecard');
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleBallEvent = async (token: string) => {
    if (!organiserContact) {
      Alert.alert('Missing organiser', 'Unable to find organiser contact in session.');
      return;
    }

    if (!canScoreBall) {
      Alert.alert('Setup required', 'Start innings setup first.');
      return;
    }

    setSaving(true);
    try {
      if (editingLastBall) {
        await replaceLastMatchBallEvent(matchId, organiserContact, token);
        setEditingLastBall(false);
      } else {
        await addMatchBallEvent(matchId, organiserContact, token);
      }
      await loadScorecard({ silent: true });
    } catch (error) {
      const message = toUserFacingScorecardError(error, 'Failed to add ball event');
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleUndoLastBall = async () => {
    if (!organiserContact) {
      Alert.alert('Missing organiser', 'Unable to find organiser contact in session.');
      return;
    }

    setSaving(true);
    try {
      await undoLastMatchBallEvent(matchId, organiserContact);
      setEditingLastBall(false);
      await loadScorecard({ silent: true });
    } catch (error) {
      const message = toUserFacingScorecardError(error, 'Failed to undo last ball');
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteScorecard = async () => {
    if (!organiserContact) {
      Alert.alert('Missing organiser', 'Unable to find organiser contact in session.');
      return;
    }

    Alert.alert(
      'Complete Match Scorecard?',
      'This will finalize the match now and disable further score updates until you reset the scorecard.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await completeMatchScorecard(matchId, organiserContact);
              await loadScorecard({ silent: true });
              navigateToTournamentSchedule();
            } catch (error) {
              const message = toUserFacingScorecardError(error, 'Failed to complete scorecard');
              Alert.alert('Error', message);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleResetScorecard = async () => {
    if (!organiserContact) {
      Alert.alert('Missing organiser', 'Unable to find organiser contact in session.');
      return;
    }

    Alert.alert(
      'Reset Scorecard',
      'This will clear all innings data for this match and start from setup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await resetMatchScorecard(matchId, organiserContact);
              setSelectedOvers(5);
              setEditingLastBall(false);
              await loadScorecard({ silent: true });
              Alert.alert('Reset complete', 'Scorecard has been cleared.');
            } catch (error) {
              const message = toUserFacingScorecardError(error, 'Failed to reset scorecard');
              Alert.alert('Error', message);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleBackNavigation = () => {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }

    if (Number.isInteger(tournamentId) && tournamentId > 0) {
      router.replace({
        pathname: '/tournament-details',
        params: { id: String(tournamentId) },
      });
      return;
    }

    router.replace('/(tabs)');
  };

  const navigateToTournamentSchedule = () => {
    if (Number.isInteger(tournamentId) && tournamentId > 0) {
      router.replace({
        pathname: '/tournament-details',
        params: { id: String(tournamentId) },
      });
      return;
    }

    handleBackNavigation();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#0F766E" />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.loaderWrap}>
        <Text style={styles.errorText}>Unable to load scorecard.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackNavigation}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Match Scorecard</Text>
        <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.homeButtonText}>Home</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{heroEyebrowLabel}</Text>
          <Text style={styles.heroTitle}>{data.match.homeTeamName}</Text>
          <Text style={styles.heroVs}>vs</Text>
          <Text style={styles.heroTitle}>{data.match.awayTeamName}</Text>
          <Text style={styles.heroMeta}>Innings {currentInnings}</Text>
        </View>

        <View style={styles.teamSummaryCard}>
          <View style={styles.teamRow}>
            <Text style={styles.teamName}>{firstTeamName}</Text>
            <Text style={styles.teamScore}>{inningsOneRuns}-{inningsOneWickets} ({toOvers(inningsOneBalls)})</Text>
          </View>
          <View style={styles.teamRow}>
            <Text style={styles.teamName}>{secondTeamName}</Text>
            <Text style={styles.teamScore}>{inningsTwoRuns}-{inningsTwoWickets} ({toOvers(inningsTwoBalls)})</Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricText}>CRR: {crr}</Text>
            {currentInnings === 2 && !isCompleted && target ? <Text style={styles.metricText}>REQ: {reqRate}</Text> : null}
          </View>

          {currentInnings === 2 && !isCompleted && target ? (
            <Text style={styles.needText}>
              {reqRuns > 0
                ? `${secondTeamName} need ${reqRuns} runs in ${ballsLeft} balls`
                : `${secondTeamName} have chased the target`}
            </Text>
          ) : null}

          {officialResultMessage ? (
            <View style={styles.resultBanner}>
              <Text style={styles.resultTitle}>{officialResultMessage}</Text>
              <Text style={styles.resultMargin}>
                {inningsOneBatting} {resultSummary?.inningsOneRuns ?? inningsOneRuns}/{inningsOneWickets} ({toOvers(inningsOneBalls)}) • {inningsTwoBatting} {resultSummary?.inningsTwoRuns ?? inningsTwoRuns}/{inningsTwoWickets} ({toOvers(inningsTwoBalls)})
              </Text>
            </View>
          ) : null}

        </View>

          {showWinnerAction && !isCompleted ? (
            <View style={styles.tieActionBanner}>
              <Text style={styles.tieActionTitle}>Match is tied</Text>
              <Text style={styles.tieActionText}>You can choose the winning team from here.</Text>
              <TouchableOpacity
                style={[styles.setWinnerButton, winnerSubmitting && styles.disabledButton]}
                onPress={() => setShowWinnerPicker(true)}
                disabled={winnerSubmitting}
              >
                <Text style={styles.setWinnerButtonText}>Set Winner</Text>
              </TouchableOpacity>
            </View>
          ) : null}

        {!canEditScorecard ? (
          <View style={styles.breakBanner}>
            <Text style={styles.breakBannerTitle}>Read-Only Scorecard</Text>
            <Text style={styles.breakBannerText}>
              You can view live score updates, but only tournament organiser/captain/vice-captain can edit this match.
            </Text>
          </View>
        ) : null}

        {canEditScorecard ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Overs</Text>
            {oversLocked ? (
              <View style={styles.lockedInfoCard}>
                <Text style={styles.lockedInfoLabel}>Match Overs Finalized</Text>
                <Text style={styles.lockedInfoValue}>
                  {oversLimit} Over{oversLimit > 1 ? 's' : ''}
                </Text>
              </View>
            ) : (
              <View style={styles.optionGrid}>
                {OVER_OPTIONS.map((over) => (
                  <TouchableOpacity
                    key={over}
                    style={[styles.overChip, selectedOvers === over && styles.overChipActive]}
                    onPress={() => setSelectedOvers(over)}
                  >
                    <Text style={[styles.overChipText, selectedOvers === over && styles.overChipTextActive]}>{over}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {isInningsBreak ? (
          <View style={styles.breakBanner}>
            <Text style={styles.breakBannerTitle}>First Innings Completed</Text>
            <Text style={styles.breakBannerText}>Tap Start Second Innings to continue chase scoring.</Text>
          </View>
        ) : null}

        {!isCompleted && canEditScorecard ? (
          <>
            <TouchableOpacity
              style={[styles.setupButton, (!canSaveSetup || isCompleted) && styles.disabledButton]}
              onPress={handleSetupScorecard}
              disabled={!canSaveSetup || isCompleted}
            >
              <Text style={styles.setupButtonText}>{setupButtonLabel}</Text>
            </TouchableOpacity>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Ball-by-Ball</Text>
              <View style={styles.actionToolbar}>
                <TouchableOpacity
                  style={[styles.toolbarButton, editingLastBall && styles.toolbarButtonActive, saving && styles.disabledButton]}
                  onPress={() => setEditingLastBall((prev) => !prev)}
                  disabled={saving || currentEvents.length === 0}
                >
                  <Text style={[styles.toolbarButtonText, editingLastBall && styles.toolbarButtonTextActive]}>
                    {editingLastBall ? 'Editing Last Ball' : 'Edit Last Ball'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolbarButton, saving && styles.disabledButton]}
                  onPress={handleUndoLastBall}
                  disabled={saving || currentEvents.length === 0}
                >
                  <Text style={styles.toolbarButtonText}>Undo Last Ball</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionGrid}>
                {ACTION_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.token}
                    style={[
                      styles.actionChip,
                      option.tone === 'boundary' && styles.actionChipBoundary,
                      option.tone === 'extra' && styles.actionChipExtra,
                      option.tone === 'wicket' && styles.actionChipWicket,
                      (!canScoreBall || saving) && styles.disabledButton,
                    ]}
                    onPress={() => handleBallEvent(option.token)}
                    disabled={!canScoreBall || saving}
                  >
                    <Text style={styles.actionChipText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : isCompleted ? (
          <View style={styles.breakBanner}>
            <Text style={styles.breakBannerTitle}>Match Completed</Text>
            <Text style={styles.breakBannerText}>
              {officialResultMessage ? `${officialResultMessage}.` : 'Score entry is hidden after completion.'} This page is now view-only scorecard.
            </Text>
            {showWinnerAction ? (
              <TouchableOpacity
                style={[styles.setWinnerButton, winnerSubmitting && styles.disabledButton]}
                onPress={() => setShowWinnerPicker(true)}
                disabled={winnerSubmitting}
              >
                <Text style={styles.setWinnerButtonText}>Set Winner</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {!isCompleted && canEditScorecard ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Current Over</Text>
            <View style={styles.recentBallsWrap}>
              {currentOverEvents.length > 0 ? (
                currentOverEvents.map((event, index) => (
                  <View key={`${event.label || event.token}_${index}`} style={styles.recentBallChip}>
                    <Text style={styles.recentBallText}>{event.label || event.token.toUpperCase()}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No balls recorded yet.</Text>
              )}
            </View>
            <Text style={styles.overMeta}>Now: {currentRuns}/{currentWickets} ({currentOvers})</Text>
          </View>
        ) : null}

        {!isCompleted && canEditScorecard ? (
          <>
            <TouchableOpacity
              style={[styles.completeButton, !canCompleteMatch && styles.disabledButton]}
              onPress={handleCompleteScorecard}
              disabled={!canCompleteMatch}
            >
              <Text style={styles.completeButtonText}>{isCompleted ? 'Scorecard Completed' : 'Complete Match Scorecard'}</Text>
            </TouchableOpacity>
            <Text style={styles.completeHintText}>
              Use Complete Match Scorecard only when match is finished. It locks score updates.
            </Text>

            <TouchableOpacity style={[styles.resetButton, saving && styles.disabledButton]} onPress={handleResetScorecard} disabled={saving}>
              <Text style={styles.resetButtonText}>Reset Scorecard</Text>
            </TouchableOpacity>
          </>
        ) : null}

        <Modal visible={showWinnerPicker} animationType="fade" transparent>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  if (!winnerSubmitting) setShowWinnerPicker(false);
                }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.modalTitle}>Set Winner</Text>
              <Text style={styles.winnerPickerSubtitle}>Select the team to award the match</Text>

              <TouchableOpacity
                style={[styles.winnerOptionButton, (!data.match.homeTeamId || winnerSubmitting) && styles.disabledButton]}
                disabled={winnerSubmitting || !data.match.homeTeamId}
                onPress={() => submitWinner(Number(data.match.homeTeamId || 0))}
              >
                <Text style={styles.winnerOptionText}>{data.match.homeTeamName}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.winnerOptionButton, styles.winnerOptionButtonSecondary, (!data.match.awayTeamId || winnerSubmitting) && styles.disabledButton]}
                disabled={winnerSubmitting || !data.match.awayTeamId}
                onPress={() => submitWinner(Number(data.match.awayTeamId || 0))}
              >
                <Text style={styles.winnerOptionText}>{data.match.awayTeamName}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.winnerCancelButton}
                onPress={() => {
                  if (!winnerSubmitting) setShowWinnerPicker(false);
                }}
                disabled={winnerSubmitting}
              >
                <Text style={styles.winnerCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F7FB',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  backButtonText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  topBarTitle: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '800',
  },
  topBarSpacer: {
    width: 52,
  },
  homeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    borderWidth: 1,
    borderColor: '#16A34A',
    minWidth: 52,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  container: {
    padding: 16,
    paddingBottom: 36,
    backgroundColor: '#F3F7FB',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FB',
  },
  heroCard: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroTitle: {
    color: '#064E3B',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    textAlign: 'center',
  },
  heroVs: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 6,
  },
  heroMeta: {
    marginTop: 14,
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  teamSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  teamName: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
    maxWidth: '50%',
  },
  teamScore: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
  },
  metricRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  needText: {
    marginTop: 10,
    color: '#0F766E',
    fontSize: 14,
    fontWeight: '800',
  },
  resultBanner: {
    marginTop: 12,
    backgroundColor: '#DBEAFE',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  resultTitle: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  resultMargin: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  tieActionBanner: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C4B5FD',
  },
  tieActionTitle: {
    color: '#5B21B6',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  tieActionText: {
    color: '#6D28D9',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 18,
  },
  inningsMetaCard: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  inningsMetaTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  inningsMetaSecondTitle: {
    marginTop: 8,
  },
  inningsMetaText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    color: '#0F172A',
    fontWeight: '800',
    marginBottom: 10,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  overChip: {
    minWidth: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  overChipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  overChipText: {
    color: '#0F172A',
    fontWeight: '800',
  },
  overChipTextActive: {
    color: '#FFFFFF',
  },
  lockedInfoCard: {
    backgroundColor: '#E0F2FE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  lockedInfoLabel: {
    color: '#075985',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  lockedInfoValue: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  breakBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  breakBannerTitle: {
    color: '#92400E',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  breakBannerText: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  setupButton: {
    backgroundColor: '#22C55E',
    borderWidth: 1,
    borderColor: '#16A34A',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  setupButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  actionToolbar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  toolbarButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toolbarButtonActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  toolbarButtonText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
  },
  toolbarButtonTextActive: {
    color: '#92400E',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    minWidth: '22%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  actionChipBoundary: {
    backgroundColor: '#ECFCCB',
    borderColor: '#84CC16',
  },
  actionChipExtra: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  actionChipWicket: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  actionChipText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  recentBallsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recentBallChip: {
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recentBallText: {
    color: '#0C4A6E',
    fontSize: 12,
    fontWeight: '800',
  },
  overMeta: {
    marginTop: 10,
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: '#16A34A',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  setWinnerButton: {
    marginTop: 10,
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  setWinnerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  completeHintText: {
    marginTop: 8,
    marginBottom: 8,
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  resetButton: {
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  resetButtonText: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  errorText: {
    fontSize: 15,
    color: '#DC2626',
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
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
  winnerPickerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
  },
  winnerOptionButton: {
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  winnerOptionButtonSecondary: {
    backgroundColor: '#2563EB',
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
});
