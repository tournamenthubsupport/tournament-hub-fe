// services/tournamentService.ts

import { API_BASE_URL } from '../constants/apiBaseUrl';

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
    const res = await fetch(`${BASE_URL}/tournaments${query ? `?${query}` : ''}`);
    if (!res.ok) throw new Error('Failed to fetch tournaments');
    const data = await res.json();
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
    try {
      const res = await fetch(`${BASE_URL}/tournaments/id/${id}`);
      if (!res.ok) throw new Error('Failed to fetch tournament details');
      return await res.json();
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  };

export const fetchTournamentsByContact = async (organiserContact: string) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/contact/${encodeURIComponent(organiserContact)}`);
    if (res.status === 404) {
      return { tournaments: [] };
    }
    if (!res.ok) throw new Error('Failed to fetch organizer tournaments');
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const fetchGroundSuggestions = async (query: string) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/ground-suggestions?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Failed to fetch ground suggestions');
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const fetchTournamentMatches = async (tournamentId: number) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/${tournamentId}/matches`);
    if (!res.ok) {
      return { matches: [] };
    }
    return await res.json();
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('Failed to fetch tournament matches')) {
      console.error('API Error:', err);
    }
    return { matches: [] };
  }
};

export const scheduleTournamentMatches = async (tournamentId: number, organiserContact: string) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/${tournamentId}/matches/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organiser_contact: organiserContact }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to schedule tournament matches: ${errorText}`);
    }
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const resetTournamentMatches = async (tournamentId: number, organiserContact: string) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/${tournamentId}/matches/reset`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organiser_contact: organiserContact }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to reset tournament matches: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const startTournamentMatch = async (matchId: number, organiserContact: string) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/matches/${matchId}/start`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organiser_contact: organiserContact }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to start match: ${errorText}`);
    }
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
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
  try {
    const res = await fetch(`${BASE_URL}/tournaments/matches/${matchId}/toss`, {
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
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to save toss: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const completeTournamentMatch = async (
  matchId: number,
  organiserContact: string,
  winnerTeamId: number,
) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/matches/${matchId}/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
        winner_team_id: winnerTeamId,
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to complete match: ${errorText}`);
    }
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const fetchMatchScorecard = async (matchId: number, viewerContact?: string) => {
  try {
    const query = viewerContact
      ? `?viewer_contact=${encodeURIComponent(viewerContact)}`
      : '';
    const res = await fetch(`${BASE_URL}/tournaments/matches/${matchId}/scorecard${query}`);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch scorecard: ${errorText}`);
    }
    return await res.json();
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
  try {
    const res = await fetch(`${BASE_URL}/tournaments/matches/${matchId}/scorecard/setup`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
        overs_limit: oversLimit,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to setup scorecard: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const addMatchBallEvent = async (
  matchId: number,
  organiserContact: string,
  token: string,
) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/matches/${matchId}/scorecard/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
        token,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to add ball event: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const undoLastMatchBallEvent = async (matchId: number, organiserContact: string) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/matches/${matchId}/scorecard/events/undo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to undo last ball: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const replaceLastMatchBallEvent = async (
  matchId: number,
  organiserContact: string,
  token: string,
) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/matches/${matchId}/scorecard/events/last`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
        token,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to edit last ball: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const completeMatchScorecard = async (matchId: number, organiserContact: string) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/matches/${matchId}/scorecard/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to complete scorecard: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const resetMatchScorecard = async (matchId: number, organiserContact: string) => {
  try {
    const res = await fetch(`${BASE_URL}/tournaments/matches/${matchId}/scorecard`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organiser_contact: organiserContact,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to reset scorecard: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

  export const createTournament = async (payload: any) => {
    try {
      const response = await fetch(`${BASE_URL}/tournaments/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Create Tournament failed: ${errorText}`);
      }
  
      return await response.json();
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  };

export const updateTournament = async (id: number, payload: any) => {
  try {
    const response = await fetch(`${BASE_URL}/tournaments/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Update Tournament failed: ${errorText}`);
    }
    return await response.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};

export const deleteTournamentById = async (id: number, requesterContact: string) => {
  try {
    const response = await fetch(`${BASE_URL}/tournaments/id/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requester_contact: requesterContact,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Delete Tournament failed: ${errorText}`);
    }
    return await response.json();
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
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

