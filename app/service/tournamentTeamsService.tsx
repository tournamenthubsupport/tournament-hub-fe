import axios from 'axios';
import { API_BASE_URL } from '../constants/apiBaseUrl';

export async function addTeamToTournament(tournament_id: number, team_id: number, fee_paid: boolean = false) {
  try {
    const res = await axios.post(`${API_BASE_URL}/tournament-teams/add`, { tournament_id, team_id, fee_paid });
    return res.data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

export async function updateTeamInTournament(tournament_id: number, team_id: number, fee_paid: boolean) {
  try {
    const res = await axios.put(`${API_BASE_URL}/update`, { tournament_id, team_id, fee_paid });
    return res.data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

export async function getTeamsByTournament(tournament_id: number) {
  try {
    const res = await axios.get(`${API_BASE_URL}/tournament-teams/${tournament_id}`);
    return res.data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

export async function getPendingRequestsByOrganizer(organiser_contact: string) {
  try {
    const res = await axios.get(
      `${API_BASE_URL}/tournament-teams/pending/${encodeURIComponent(organiser_contact)}`
    );
    return res.data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

export async function getTournamentsForTeams(team_ids: number[]) {
    try {
      const res = await axios.post(`${API_BASE_URL}/tournament-teams/list`, { team_ids });
      return res.data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }

export async function getTeamsByTournamentAndTeamIds(tournament_id: number, team_ids: number[]) {
  try {
    const res = await axios.post(`${API_BASE_URL}/${tournament_id}/teams`, { team_ids });
    return res.data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

export async function deleteTeamFromTournament(tournament_id: number, team_id: number) {
    try {
      const res = await axios.delete(`${API_BASE_URL}/remove`, {
        // @ts-ignore: 'data' is valid for Axios but not in some type definitions
        data: { tournament_id, team_id }
      } as any);
      return res.data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }

  export async function approveTeamInTournament(tournament_id: number, team_id: number) {
    try {
      const res = await axios.put(`${API_BASE_URL}/tournament-teams/approve`, { tournament_id, team_id });
      return res.data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }
  
  export async function rejectTeamInTournament(tournament_id: number, team_id: number) {
    try {
      const res = await axios.delete(`${API_BASE_URL}/tournament-teams/reject`, {
        // @ts-ignore
        data: { tournament_id, team_id }
      } as any);
      return res.data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }

  export async function getTeamByTournamentAndTeamId(tournament_id: number, team_id: number) {
    try {
      const res = await axios.get(`${API_BASE_URL}/tournament-teams/${tournament_id}/team/${team_id}`);
      return res.data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }

export default {
  addTeamToTournament,
  updateTeamInTournament,
  getTeamsByTournament,
  getPendingRequestsByOrganizer,
  getTeamsByTournamentAndTeamIds,
  deleteTeamFromTournament,
  approveTeamInTournament,
  rejectTeamInTournament,
  getTeamByTournamentAndTeamId
};