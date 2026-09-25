import axios from 'axios';
import { API_BASE_URL } from '../../constants/apiBaseUrl';
import { getApiErrorMessage } from '../../utils/apiError';

const BASE_URL = API_BASE_URL;

export const insertPlayer = async (playerData: any) => {
    try {
      const response = await axios.post(`${BASE_URL}/players/add`, playerData);
      return response.data;
    } catch (error) {
      console.error('Error inserting player:', error);
      throw new Error(getApiErrorMessage(error, 'Failed to add the player.'));
    }
  };

export const insertPlayersBulk = async (players: any[]) => {
  try {
    const response = await axios.post(`${BASE_URL}/players/bulk-add`, { players });
    return response.data;
  } catch (error) {
    console.error('Error bulk inserting players:', error);
    throw new Error(getApiErrorMessage(error, 'Failed to add players.'));
  }
};


  export const searchPlayers = async (searchTerm: string) => {
    try {
      const response = await axios.get(`${BASE_URL}/players/search?query=${searchTerm}`);
      const data = response.data as { players: any[] };
      return data.players;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Player search is unavailable. Please try again.'));
    }
  };
export default { insertPlayer, insertPlayersBulk, searchPlayers };