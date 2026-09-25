import axios from 'axios';
import { API_BASE_URL } from '../../constants/apiBaseUrl';
import { getApiErrorMessage } from '../../utils/apiError';

const API_URL = API_BASE_URL;

export interface TeamPlayerAssignment {
  playerId: string;
  is_captain?: boolean;
  is_vicecaptain?: boolean;
}

export interface PlayerNotification {
  id: number;
  title: string;
  message: string;
  isRead?: boolean;
  createdAt?: string;
  teamId?: number;
  teamName?: string;
}

export const getPlayersForTeams = async (teamIds: string[]) => {
  try {
    const response = await axios.post(`${API_URL}/team-players/list`, { teamIds });
    return response.data;
  } catch (error) {
    console.error('Error fetching players for teams:', error);
    throw new Error(getApiErrorMessage(error, 'Failed to load team players.'));
  }
};

export const getTeamsForPlayer = async (playerId: string | number) => {
  try {
    const response = await axios.get(`${API_URL}/team-players/player/${playerId}/teams`);
    return response.data;
  } catch (error) {
    console.error('Error fetching teams for player:', error);
    throw new Error(getApiErrorMessage(error, 'Failed to load player teams.'));
  }
};

export const getPlayerNotifications = async (mobile: string | number) => {
  try {
    const response = await axios.get(`${API_URL}/team-players/player/${mobile}/notifications`);
    return response.data;
  } catch (error) {
    console.error('Error fetching player notifications:', error);
    throw new Error(getApiErrorMessage(error, 'Failed to load notifications.'));
  }
};

export const markPlayerNotificationsRead = async (mobile: string | number) => {
  try {
    const response = await axios.put(`${API_URL}/team-players/player/${mobile}/notifications/read`);
    return response.data;
  } catch (error) {
    console.error('Error marking player notifications read:', error);
    throw new Error(getApiErrorMessage(error, 'Failed to mark notifications as read.'));
  }
};

export const assignPlayersToTeam = async (teamId: string, players: TeamPlayerAssignment[]) => {
  try {
    const response = await axios.post(`${API_URL}/team-players/assign`, { teamId, players });
    return response.data;
  } catch (error) {
    console.error('Error assigning players to team:', error);
    throw new Error(getApiErrorMessage(error, 'Failed to assign players to the team.'));
  }
};

export const leaveTeam = async (teamId: string | number, mobile: string | number) => {
  try {
    const response = await axios.delete(`${API_URL}/team-players/leave/${teamId}/${mobile}`);
    return response.data;
  } catch (error) {
    console.error('Error leaving team:', error);
    throw new Error(getApiErrorMessage(error, 'Failed to leave the team.'));
  }
};
export const removePlayerFromTeam = async (teamId: string | number, playerId: string | number) => {
  try {
    const response = await axios.delete(`${API_URL}/team-players/remove/${teamId}/${playerId}`);
    return response.data;
  } catch (error) {
    console.error('Error removing player from team:', error);
    throw new Error(getApiErrorMessage(error, 'Failed to remove the player from the team.'));
  }
};

export default {
  getPlayersForTeams,
  getTeamsForPlayer,
  getPlayerNotifications,
  markPlayerNotificationsRead,
  assignPlayersToTeam,
  leaveTeam,
  removePlayerFromTeam
};