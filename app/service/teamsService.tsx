import { API_BASE_URL } from '../constants/apiBaseUrl';

const BASE_URL = API_BASE_URL;

export const fetchTeams = async () => {
  try {
    const response = await fetch(`${BASE_URL}/teams`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
};

export const fetchTeamById = async (id: string) => {
  try {
    const response = await fetch(`${BASE_URL}/teams/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching team with id ${id}:`, error);
    throw error;
  }
};

export const fetchTeamsByIds = async (teamIds: number[]) => {
  try {
    const response = await fetch(`${BASE_URL}/teams/by-ids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ teamIds }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data; // Should be an array of teams with name, location, etc.
  } catch (error) {
    console.error('Error fetching teams by IDs:', error);
    throw error;
  }
};

export const fetchTeamsByMobile = async (mobile: string) => {
  try {
    const response = await fetch(`${BASE_URL}/teams/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mobile }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching teams with mobile ${mobile}:`, error);
    throw error;
  }
};

export const fetchTeamsByMobileAndSport = async (mobile: string, sportId: string) => {
  try {
    const response = await fetch(`${BASE_URL}/teams/search/${mobile}?sportId=${sportId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching teams with mobile ${mobile} and sportId ${sportId}:`, error);
    throw error;
  }
};

export const createTeam = async (teamData: { name: string; location: string; sportId: number; createdBy: string }) => {
  try {
    const response = await fetch(`${BASE_URL}/teams/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(teamData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating team:', error);
    throw error;
  }
};

export const updateTeam = async (id: string, teamData: { name: string }) => {
  try {
    const response = await fetch(`${BASE_URL}/teams/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(teamData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error updating team with id ${id}:`, error);
    throw error;
  }
};

export const deleteTeam = async (id: string) => {
  try {
    const response = await fetch(`${BASE_URL}/teams/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error deleting team with id ${id}:`, error);
    throw error;
  }
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