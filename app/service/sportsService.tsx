import axios from 'axios';
import { API_BASE_URL } from '../../constants/apiBaseUrl';
import { getApiErrorMessage } from '../../utils/apiError';

const BASE_URL = API_BASE_URL;

export const fetchSports = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/sports`);
    const data = (response.data as { sports: any }).sports;
    return data;
  } catch (error) {
    console.error('Error fetching sports:', error);
    throw new Error(getApiErrorMessage(error, 'Failed to load sports.'));
  }
};

export const fetchSportById = async (id: number) => {
  try {
    const response = await axios.get(`${BASE_URL}/sports/${id}`);
    const data = response.data as { sport: any };
    return data.sport;
  } catch (error) {
    console.error(`Error fetching sport with id ${id}:`, error);
    throw new Error(getApiErrorMessage(error, 'Failed to load sport details.'));
  }
};

export default { fetchSports, fetchSportById };