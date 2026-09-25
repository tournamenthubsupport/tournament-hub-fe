// services/tournamentService.ts

import { API_BASE_URL } from '../../constants/apiBaseUrl';
import { fetchApiJson, throwApiResponseError } from '../../utils/apiError';

const BASE_URL = API_BASE_URL;

type TournamentQuery = {
  city?: string;
  status?: 'upcoming' | 'active' | 'completed';
};

type TournamentCacheEntry = {
  value: any;
  createdAt: number;
};

const TOURNAMENT_CACHE_TTL_MS = 45 * 1000;
const tournamentsCache = new Map<string, TournamentCacheEntry>();

const toTournamentCacheKey = (options?: TournamentQuery) => {
  const city = String(options?.city || '').trim().toLowerCase();
  const status = String(options?.status || '').trim().toLowerCase();
  return `city:${city}|status:${status}`;
};

const getCachedTournaments = (options?: TournamentQuery) => {
  const key = toTournamentCacheKey(options);
  const existing = tournamentsCache.get(key);
  if (!existing) return null;

  const isFresh = Date.now() - existing.createdAt < TOURNAMENT_CACHE_TTL_MS;
  if (!isFresh) {
    tournamentsCache.delete(key);
    return null;
  }

  return existing.value;
};

const setCachedTournaments = (options: TournamentQuery | undefined, value: any) => {
  const key = toTournamentCacheKey(options);
  tournamentsCache.set(key, {
    value,
    createdAt: Date.now(),
  });
};

export const fetchTournaments = async (
  options?: TournamentQuery,
  requestOptions?: { forceRefresh?: boolean },
) => {
  try {
    if (!requestOptions?.forceRefresh) {
      const cached = getCachedTournaments(options);
      if (cached) return cached;
    }

    const params = new URLSearchParams();
    if (options?.city?.trim()) {
      params.set('city', options.city.trim());
    }
    if (options?.status) {
      params.set('status', options.status);
    }

    const query = params.toString();
    const data = await fetchApiJson(
      `${BASE_URL}/tournaments${query ? `?${query}` : ''}`,
      undefined,
      'Failed to load tournaments.',
    );
    setCachedTournaments(options, data);
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const prefetchHomeInitialData = async (city = 'Chennai') => {
  const normalizedCity = String(city || 'Chennai').trim() || 'Chennai';
  try {
    await Promise.all([
      fetchTournaments({ city: normalizedCity, status: 'upcoming' }),
      fetchTournaments({ city: normalizedCity, status: 'active' }),
    ]);
  } catch {
    // Prefetch is best-effort. Home screen will fetch on demand if this fails.
  }
};

export const fetchTournamentsById = async (id: number) => {
    return fetchApiJson(`${BASE_URL}/tournaments/id/${id}`, undefined, 'Failed to load tournament details.');
  };

export const fetchTournamentsByContact = async (organiserContact: string) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/contact/${encodeURIComponent(organiserContact)}`);
    if (res.status === 404) {
      return { tournaments: [] };
    }
    if (!res.ok) return await throwApiResponseError(res, 'Failed to load organizer tournaments.');
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const fetchGroundSuggestions = async (query: string) => {
  return fetchApiJson(
    `${BASE_URL}/tournaments/ground-suggestions?q=${encodeURIComponent(query)}`,
    undefined,
    'Ground suggestions are unavailable.',
  );
};

export const fetchTournamentMatches = async (tournamentId: number) => {
  return fetchApiJson(
    `${BASE_URL}/tournaments/${tournamentId}/matches`,
    undefined,
    'Failed to load the match schedule.',
  );
};

export const scheduleTournamentMatches = async (tournamentId: number, organiserContact: string) => {
  return fetchApiJson(`${BASE_URL}/tournaments/${tournamentId}/matches/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organiser_contact: organiserContact }),
    }, 'Failed to schedule tournament matches.');
};

export const resetTournamentMatches = async (tournamentId: number, organiserContact: string) => {
  return fetchApiJson(`${BASE_URL}/tournaments/${tournamentId}/matches/reset`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organiser_contact: organiserContact }),
    }, 'Failed to reset tournament matches.');
};

export const startTournamentMatch = async (matchId: number, organiserContact: string) => {
  return fetchApiJson(`${BASE_URL}/tournaments/matches/${matchId}/start`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organiser_contact: organiserContact }),
    }, 'Failed to start the match.');
};

export const setTournamentMatchToss = async (
  matchId: number,
  organiserContact: string,
  battingTeamId: number,
  fieldingTeamId: number,
  tossResult?: 'head' | 'tail',
  tossWinnerTeamId?: number,
  tossDecision?: 'batting' | 'fielding',
) => {
  return fetchApiJson(`${BASE_URL}/tournaments/matches/${matchId}/toss`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
        batting_team_id: battingTeamId,
        fielding_team_id: fieldingTeamId,
        toss_result: tossResult,
        toss_winner_team_id: tossWinnerTeamId,
        toss_decision: tossDecision,
      }),
    }, 'Failed to save the toss.');
};

export const completeTournamentMatch = async (
  matchId: number,
  organiserContact: string,
  winnerTeamId: number,
) => {
  return fetchApiJson(`${BASE_URL}/tournaments/matches/${matchId}/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
        winner_team_id: winnerTeamId,
      }),
    }, 'Failed to complete the match.');
};

export const fetchMatchScorecard = async (matchId: number, viewerContact?: string) => {
  try {
    const query = viewerContact
      ? `?viewer_contact=${encodeURIComponent(viewerContact)}`
      : '';
    return await fetchApiJson(
      `${BASE_URL}/tournaments/matches/${matchId}/scorecard${query}`,
      undefined,
      'Failed to load the scorecard.',
    );
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const setupMatchScorecard = async (
  matchId: number,
  organiserContact: string,
  oversLimit: number,
) => {
  return fetchApiJson(`${BASE_URL}/tournaments/matches/${matchId}/scorecard/setup`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
        overs_limit: oversLimit,
      }),
    }, 'Failed to set up the scorecard.');
};

export const addMatchBallEvent = async (
  matchId: number,
  organiserContact: string,
  token: string,
) => {
  return fetchApiJson(`${BASE_URL}/tournaments/matches/${matchId}/scorecard/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
        token,
      }),
    }, 'Failed to update the score.');
};

export const undoLastMatchBallEvent = async (matchId: number, organiserContact: string) => {
  return fetchApiJson(`${BASE_URL}/tournaments/matches/${matchId}/scorecard/events/undo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
      }),
    }, 'Failed to undo the last ball.');
};

export const replaceLastMatchBallEvent = async (
  matchId: number,
  organiserContact: string,
  token: string,
) => {
  return fetchApiJson(`${BASE_URL}/tournaments/matches/${matchId}/scorecard/events/last`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
        token,
      }),
    }, 'Failed to edit the last ball.');
};

export const completeMatchScorecard = async (matchId: number, organiserContact: string) => {
  return fetchApiJson(`${BASE_URL}/tournaments/matches/${matchId}/scorecard/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
      }),
    }, 'Failed to complete the scorecard.');
};

export const resetMatchScorecard = async (matchId: number, organiserContact: string) => {
  return fetchApiJson(`${BASE_URL}/tournaments/matches/${matchId}/scorecard`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
      }),
    }, 'Failed to reset the scorecard.');
};

export const createTournament = async (payload: any) => {
    return fetchApiJson(`${BASE_URL}/tournaments/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }, 'Failed to create the tournament.');
  };

export const updateTournament = async (id: number, payload: any) => {
  return fetchApiJson(`${BASE_URL}/tournaments/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }, 'Failed to update the tournament.');
};

export const deleteTournamentById = async (id: number, requesterContact: string) => {
  return fetchApiJson(`${BASE_URL}/tournaments/id/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requester_contact: requesterContact,
      }),
    }, 'Failed to delete the tournament.');
};

export default {
  fetchTournaments,
  fetchTournamentsById,
  fetchTournamentsByContact,
  fetchGroundSuggestions,
  fetchTournamentMatches,
  scheduleTournamentMatches,
  resetTournamentMatches,
  startTournamentMatch,
  setTournamentMatchToss,
  completeTournamentMatch,
  fetchMatchScorecard,
  setupMatchScorecard,
  addMatchBallEvent,
  undoLastMatchBallEvent,
  replaceLastMatchBallEvent,
  completeMatchScorecard,
  resetMatchScorecard,
  createTournament,
  updateTournament,
  deleteTournamentById,
};

