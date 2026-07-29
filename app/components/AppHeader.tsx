import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Bell } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/auth-context';
import {
    getPlayerNotifications,
    leaveTeam,
    markPlayerNotificationsRead,
    type PlayerNotification,
} from '../service/teamPlayerService';
import {
    approveTeamInTournament,
    getPendingRequestsByOrganizer,
    rejectTeamInTournament
} from '../service/tournamentTeamsService';

type HeaderProps = {
  displayName?: string;
  organiserContact?: string;
  playerPhone?: string;
  unreadCount?: number;
  onNotificationPress?: () => void;
  onRequestsUpdated?: () => void | Promise<void>;
  onPlayerLeftTeam?: () => void | Promise<void>;
};

type JoinRequestNotification = {
  tournament_id: number;
  team_id: number;
  registered_at?: string;
  tournament_name?: string;
  tournament_location?: string;
  start_date?: string;
  end_date?: string;
  team_name?: string;
  team_location?: string;
  team_created_by?: string;
};

const formatUserName = (name?: string) =>
  name && typeof name === 'string'
    ? name.split(' ')[0].charAt(0).toUpperCase() + name.split(' ')[0].slice(1)
    : 'Player';

export const Header: React.FC<HeaderProps> = ({
  displayName,
  organiserContact,
  playerPhone,
  unreadCount = 0,
  onNotificationPress,
  onRequestsUpdated,
  onPlayerLeftTeam,
}) => {
  const auth = useAuth();
  const setUser = auth?.setUser;
  const [showModal, setShowModal] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notifications, setNotifications] = useState<JoinRequestNotification[]>([]);
  const [playerNotifications, setPlayerNotifications] = useState<PlayerNotification[]>([]);
  const [actionLoadingKey, setActionLoadingKey] = useState<string>('');
  const hasOrganizerNotifications = !!organiserContact;
  const hasPlayerNotifications = !hasOrganizerNotifications && !!playerPhone;
  const isGuest = !hasOrganizerNotifications && !hasPlayerNotifications;

  const fetchPendingNotifications = useCallback(async () => {
    if (hasOrganizerNotifications && organiserContact) {
      try {
        setLoadingNotifications(true);
        const data = await getPendingRequestsByOrganizer(organiserContact);
        setNotifications(Array.isArray(data) ? data : []);
        setPlayerNotifications([]);
      } catch (err) {
        console.error('Failed to load join-request notifications:', err);
        setNotifications([]);
      } finally {
        setLoadingNotifications(false);
      }
      return;
    }

    if (hasPlayerNotifications && playerPhone) {
      try {
        setLoadingNotifications(true);
        const data = await getPlayerNotifications(playerPhone);
        setPlayerNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
        setNotifications([]);
      } catch (err) {
        console.error('Failed to load player notifications:', err);
        setPlayerNotifications([]);
      } finally {
        setLoadingNotifications(false);
      }
      return;
    }

    setNotifications([]);
    setPlayerNotifications([]);
  }, [hasOrganizerNotifications, hasPlayerNotifications, organiserContact, playerPhone]);

  useEffect(() => {
    fetchPendingNotifications();
  }, [fetchPendingNotifications]);

  const formatDate = (value?: string) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleApprove = async (item: JoinRequestNotification) => {
    const key = `${item.tournament_id}-${item.team_id}`;
    try {
      setActionLoadingKey(key);
      await approveTeamInTournament(item.tournament_id, item.team_id);
      setNotifications((prev) => prev.filter((n) => !(n.tournament_id === item.tournament_id && n.team_id === item.team_id)));
      if (onRequestsUpdated) {
        await onRequestsUpdated();
      }
      Alert.alert('Approved', 'Team request has been approved.');
    } catch (err) {
      console.error('Approve request failed:', err);
      Alert.alert('Error', 'Failed to approve request.');
    } finally {
      setActionLoadingKey('');
    }
  };

  const handleReject = async (item: JoinRequestNotification) => {
    const key = `${item.tournament_id}-${item.team_id}`;
    try {
      setActionLoadingKey(key);
      await rejectTeamInTournament(item.tournament_id, item.team_id);
      setNotifications((prev) => prev.filter((n) => !(n.tournament_id === item.tournament_id && n.team_id === item.team_id)));
      if (onRequestsUpdated) {
        await onRequestsUpdated();
      }
      Alert.alert('Rejected', 'Team request has been rejected.');
    } catch (err) {
      console.error('Reject request failed:', err);
      Alert.alert('Error', 'Failed to reject request.');
    } finally {
      setActionLoadingKey('');
    }
  };

  const handleLeaveTeamFromNotification = async (item: PlayerNotification) => {
    const key = `leave-${item.id}`;

    if (!playerPhone || !item.teamId) {
      Alert.alert('Error', 'Team information is missing for this notification.');
      return;
    }

    try {
      setActionLoadingKey(key);
      await leaveTeam(item.teamId, playerPhone);
      setPlayerNotifications((prev) => prev.filter((notification) => notification.teamId !== item.teamId));
      if (onPlayerLeftTeam) {
        await onPlayerLeftTeam();
      }
      Alert.alert('Left Team', `You have left ${item.teamName || 'the team'}.`);
    } catch (err) {
      console.error('Leave team failed:', err);
      Alert.alert('Error', 'Failed to leave the team. Please try again.');
    } finally {
      setActionLoadingKey('');
    }
  };

  const badgeCount = hasOrganizerNotifications
    ? notifications.length
    : hasPlayerNotifications
      ? playerNotifications.filter((item) => !item.isRead).length
      : unreadCount;

  const handleBellPress = async () => {
    setShowModal(true);
    await fetchPendingNotifications();
    if (hasPlayerNotifications && playerPhone) {
      try {
        await markPlayerNotificationsRead(playerPhone);
        setPlayerNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      } catch (err) {
        console.error('Failed to mark player notifications read:', err);
      }
    }
    if (onNotificationPress) onNotificationPress();
  };

  const handleSignOut = async () => {
    try {
      const authKeys = ['auth_token', 'auth_user_id', 'auth_user_name', 'auth_user_phone', 'auth_user_role'];

      if (Platform.OS === 'web') {
        try {
          const keys = Object.keys(window.localStorage || {}).filter((key) => key.startsWith('auth_'));
          keys.forEach((key) => window.localStorage.removeItem(key));
          authKeys.forEach((key) => window.localStorage.removeItem(key));
        } catch {
          // Ignore web storage cleanup failures and continue sign out.
        }
      } else {
        await Promise.all(authKeys.map((key) => SecureStore.deleteItemAsync(key)));
      }

      setUser?.(null);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Sign out failed:', error);
      Alert.alert('Sign Out Failed', 'Unable to sign out right now. Please try again.');
    }
  };

  return (
    <View style={styles.headerModern}>
      <View style={styles.headerTopRow}>
        <Image
          source={require('../../assets/images/hub/logo-name.png')}
          style={styles.logoModernTop}
          resizeMode="contain"
        />
        <View style={styles.infoRow}>
          <View style={styles.userTextBlock}>
            <Text style={styles.greetingModern}>Hi, {formatUserName(displayName)}</Text>
            <Text style={styles.subtitleModern}>Tournaments and live updates</Text>
          </View>

          <View style={styles.headerActions}>
            {!isGuest ? (
              <View style={styles.bellContainer}>
                <TouchableOpacity style={styles.bellButton} onPress={handleBellPress}>
                  <Bell size={22} color="#16A34A" />
                  {badgeCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badgeCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {isGuest ? (
              <TouchableOpacity
                style={[styles.signInLink, styles.authCta]}
                onPress={() => router.push({ pathname: '/auth/auth-screen', params: { returnTo: '/(tabs)' } })}
              >
                <Text style={styles.signInLinkText}>Sign In</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.signOutLink, styles.authCta]} onPress={handleSignOut}>
                <Text style={styles.signOutLinkText}>Sign Out</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '80%', maxHeight: '60%' }}>
            <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 12 }}>Notifications</Text>
            {loadingNotifications ? (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#2563EB" />
              </View>
            ) : hasOrganizerNotifications ? (
              notifications.length === 0 ? (
                <Text>No pending join requests.</Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {notifications.map((n) => {
                    const requestKey = `${n.tournament_id}-${n.team_id}`;
                    const requestLoading = actionLoadingKey === requestKey;

                    return (
                      <View key={requestKey} style={styles.notificationCard}>
                        <Text style={styles.notificationTitle}>Join Request</Text>
                        <Text style={styles.notificationLine}>Tournament: {n.tournament_name || 'N/A'}</Text>
                        <Text style={styles.notificationLine}>Location: {n.tournament_location || 'N/A'}</Text>
                        <Text style={styles.notificationLine}>Dates: {formatDate(n.start_date)} - {formatDate(n.end_date)}</Text>
                        <Text style={styles.notificationLine}>Team: {n.team_name || 'N/A'}</Text>
                        <Text style={styles.notificationLine}>Team Owner: {n.team_created_by || 'N/A'}</Text>
                        <View style={styles.notificationActionsRow}>
                          <TouchableOpacity
                            style={[styles.notificationActionBtn, styles.approveBtn, requestLoading && styles.disabledActionBtn]}
                            onPress={() => handleApprove(n)}
                            disabled={requestLoading}
                          >
                            <Text style={styles.approveBtnText}>{requestLoading ? 'Processing...' : 'Approve'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.notificationActionBtn, styles.rejectBtn, requestLoading && styles.disabledActionBtn]}
                            onPress={() => handleReject(n)}
                            disabled={requestLoading}
                          >
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )
            ) : hasPlayerNotifications ? (
              playerNotifications.length === 0 ? (
                <Text>No notifications yet.</Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {playerNotifications.map((item) => {
                    const requestLoading = actionLoadingKey === `leave-${item.id}`;

                    return (
                      <View key={item.id} style={styles.notificationCard}>
                        <Text style={styles.notificationTitle}>{item.title}</Text>
                        <Text style={styles.notificationLine}>{item.message}</Text>
                        {item.teamName ? <Text style={styles.notificationLine}>Team: {item.teamName}</Text> : null}
                        {!!item.teamId && (
                          <View style={styles.notificationActionsRow}>
                            <TouchableOpacity
                              style={[styles.notificationActionBtn, styles.rejectBtn, requestLoading && styles.disabledActionBtn]}
                              onPress={() => handleLeaveTeamFromNotification(item)}
                              disabled={requestLoading}
                            >
                              <Text style={styles.rejectBtnText}>{requestLoading ? 'Leaving...' : 'Leave Team'}</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )
            ) : (
              <Text>No notifications available.</Text>
            )}
            <TouchableOpacity style={{ marginTop: 16, alignSelf: 'flex-end' }} onPress={() => setShowModal(false)}>
              <Text style={{ color: '#16A34A', fontWeight: '600', fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  headerModern: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    boxShadow: '0px 8px 18px rgba(15, 23, 42, 0.08)',
    elevation: 5,
  },
  headerTopRow: {
    minHeight: 154,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  logoModernTop: {
    width: 178,
    height: 178,
    marginBottom: -22,
  },
  infoRow: {
    marginTop: -4,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  userTextBlock: {
    flex: 1,
  },
  greetingModern: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitleModern: {
    marginTop: 3,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  bellContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  signInLink: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  signInLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  authCta: {
    minWidth: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutLink: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  signOutLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 11,
    minWidth: 20,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  notificationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 10,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  notificationLine: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 3,
  },
  notificationActionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  notificationActionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtn: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  approveBtnText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 12,
  },
  rejectBtnText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 12,
  },
  disabledActionBtn: {
    opacity: 0.6,
  },
});

export default Header;
