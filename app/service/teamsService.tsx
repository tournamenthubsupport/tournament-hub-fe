import { API_BASE_URL } from '../../constants/apiBaseUrl';
import { fetchApiJson } from '../../utils/apiError';

const BASE_URL = API_BASE_URL;

export const fetchTeams = async () => {
  return fetchApiJson(`${BASE_URL}/teams`, undefined, 'Failed to load teams.');
};

export const fetchTeamById = async (id: string) => {
  return fetchApiJson(`${BASE_URL}/teams/${id}`, undefined, 'Failed to load the team.');
};

export const fetchTeamsByIds = async (teamIds: number[]) => {
  return fetchApiJson(`${BASE_URL}/teams/by-ids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ teamIds }),
    }, 'Failed to load tournament teams.');
};

export const fetchTeamsByMobile = async (mobile: string) => {
  return fetchApiJson(`${BASE_URL}/teams/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mobile }),
    }, 'Failed to load your teams.');
};

export const fetchTeamsByMobileAndSport = async (mobile: string, sportId: string) => {
  return fetchApiJson(
    `${BASE_URL}/teams/search/${mobile}?sportId=${sportId}`,
    undefined,
    'Failed to load teams for this sport.',
  );
};

export const createTeam = async (teamData: { name: string; location: string; sportId: number; createdBy: string }) => {
  return fetchApiJson(`${BASE_URL}/teams/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(teamData),
    }, 'Failed to create the team.');
};

export const updateTeam = async (id: string, teamData: { name: string }) => {
  return fetchApiJson(`${BASE_URL}/teams/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(teamData),
    }, 'Failed to update the team.');
};

export const deleteTeam = async (id: string) => {
  return fetchApiJson(`${BASE_URL}/teams/${id}`, {
      method: 'DELETE',
    }, 'Failed to delete the team.');
};

export default {
  fetchTeams,
  fetchTeamById,
  fetchTeamsByIds,
  fetchTeamsByMobile,
  fetchTeamsByMobileAndSport,
  createTeam,
  updateTeam,
  deleteTeam
};