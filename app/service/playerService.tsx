import axios from 'axios';
import { API_BASE_URL } from '../constants/apiBaseUrl';

const BASE_URL = API_BASE_URL;

export const insertPlayer = async (playerData: any) => {
    try {
      const response = await axios.post(`${BASE_URL}/players/add`, playerData);
      return response.data;
    } catch (error) {
      console.error('Error inserting player:', error);
      throw error;
    }
  };

export const insertPlayersBulk = async (players: any[]) => {
  try {
    const response = await axios.post(`${BASE_URL}/players/bulk-add`, { players });
    return response.data;
  } catch (error) {
    console.error('Error bulk inserting players:', error);
    throw error;
  }
};


  export const searchPlayers = async (searchTerm: string) => {
    try {
      const response = await axios.get(`${BASE_URL}/players/search?query=${searchTerm}`);
      const data = response.data as { players: any[] };
      return data.players;
    } catch (error) {
      return [];
    }
  };
export default { insertPlayer, insertPlayersBulk, searchPlayers };