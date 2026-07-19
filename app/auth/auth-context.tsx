import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

type AuthContextType = {
  user: any | null;
  setUser: React.Dispatch<React.SetStateAction<any | null>>;
  authHydrated: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [authHydrated, setAuthHydrated] = useState(false);

  useEffect(() => {
    const hydrateAuthUser = async () => {
      try {
        if (Platform.OS === 'web') {
          const token = window.localStorage.getItem('auth_token') || '';
          const id = window.localStorage.getItem('auth_user_id') || '';
          const name = window.localStorage.getItem('auth_user_name') || '';
          const phone = window.localStorage.getItem('auth_user_phone') || '';
          const role = window.localStorage.getItem('auth_user_role') || 'player';

          if (token && id && name && phone) {
            setUser({ id: Number(id) || id, name, phone, role });
          }
        } else {
          const [token, id, name, phone, role] = await Promise.all([
            SecureStore.getItemAsync('auth_token'),
            SecureStore.getItemAsync('auth_user_id'),
            SecureStore.getItemAsync('auth_user_name'),
            SecureStore.getItemAsync('auth_user_phone'),
            SecureStore.getItemAsync('auth_user_role')
          ]);

          if (token && id && name && phone) {
            setUser({ id: Number(id) || id, name, phone, role: role || 'player' });
          }
        }
      } catch {
        setUser(null);
      } finally {
        setAuthHydrated(true);
      }
    };

    hydrateAuthUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, authHydrated }}>
      {children}
    </AuthContext.Provider>
  );
}; 

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;