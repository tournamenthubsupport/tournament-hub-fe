import { Tabs } from 'expo-router';
import { Home, User, Users } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/auth-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const user = auth?.user;

  return (
    <Tabs
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        display: user ? 'flex' : 'none',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingBottom: insets.bottom || 12,
        paddingTop: 8,
        height: 84 + (insets.bottom || 0),
        zIndex: 10,
        elevation: 10,
      },
      tabBarActiveTintColor: '#22C55E',
      tabBarInactiveTintColor: '#9CA3AF',
      tabBarLabelStyle: styles.tabLabel,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: 'Manage',
          tabBarIcon: ({ size, color }) => (
            <Users size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
});
