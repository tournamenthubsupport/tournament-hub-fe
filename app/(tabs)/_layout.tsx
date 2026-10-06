import { router, Tabs } from 'expo-router';
import { Home, Trophy, User, UserPlus, Users, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/auth-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const user = auth?.user;
  const userRole = String(user?.role || 'player').toLowerCase();
  const canCreate = userRole === 'organizer' || userRole === 'admin';
  const [showManageActions, setShowManageActions] = useState(false);

  const openRoute = (pathname: '/create-team' | '/create-tournament' | '/(tabs)/teams') => {
    setShowManageActions(false);
    router.push(pathname);
  };

  return (
    <>
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
          listeners={{
            tabPress: (event) => {
              if (!canCreate) return;
              event.preventDefault();
              setShowManageActions(true);
            },
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

      <Modal
        visible={showManageActions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManageActions(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowManageActions(false)}>
          <Pressable
            style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Quick manage</Text>
                <Text style={styles.sheetSubtitle}>What would you like to create?</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowManageActions(false)}
                accessibilityLabel="Close manage actions"
              >
                <X size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.actionItem} onPress={() => openRoute('/create-team')}>
              <View style={[styles.actionIcon, styles.teamActionIcon]}>
                <UserPlus size={22} color="#15803D" />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Create Team</Text>
                <Text style={styles.actionSubtitle}>Build a squad and add players</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={() => openRoute('/create-tournament')}>
              <View style={[styles.actionIcon, styles.tournamentActionIcon]}>
                <Trophy size={22} color="#1D4ED8" />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Create Tournament</Text>
                <Text style={styles.actionSubtitle}>Set up and publish a new event</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dashboardButton}
              onPress={() => openRoute('/(tabs)/teams')}
            >
              <Users size={18} color="#334155" />
              <Text style={styles.dashboardButtonText}>Open Manage Dashboard</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  actionSheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetTitle: {
    color: '#0F172A',
    fontSize: 21,
    fontFamily: 'Poppins-SemiBold',
  },
  sheetSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  actionItem: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  teamActionIcon: {
    backgroundColor: '#DCFCE7',
  },
  tournamentActionIcon: {
    backgroundColor: '#DBEAFE',
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  actionSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 3,
  },
  dashboardButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginTop: 4,
  },
  dashboardButtonText: {
    color: '#334155',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
});
