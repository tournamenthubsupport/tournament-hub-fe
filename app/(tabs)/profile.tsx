import * as SecureStore from 'expo-secure-store';
import { Award, Bell, ChevronRight, Crown, CircleHelp as HelpCircle, LogOut, Star, Target, TrendingUp, Trophy } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/auth-context';
import {
    deleteAdminNotification,
    getAdminNotifications,
    getSupportRepliesForUser,
    replyToAdminNotification,
    submitSupportRequest,
    type AdminNotification,
    type UserSupportRequest,
} from '../service/authService';
import { getPlayersForTeams, getTeamsForPlayer } from '../service/teamPlayerService';
import { fetchTeamsByMobile } from '../service/teamsService';
import { fetchTournamentsByContact } from '../service/tournamentService';
import { getTournamentsForTeams } from '../service/tournamentTeamsService';

export default function ProfileScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [profileTeams, setProfileTeams] = useState<any[]>([]);
  const [profileTournaments, setProfileTournaments] = useState<any[]>([]);
  const [recentCreatedTournaments, setRecentCreatedTournaments] = useState<any[]>([]);
  const [recentCreatedTeams, setRecentCreatedTeams] = useState<any[]>([]);
  const [upcomingJoinedTournaments, setUpcomingJoinedTournaments] = useState<any[]>([]);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSupportInboxModal, setShowSupportInboxModal] = useState(false);
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const [helpCategory, setHelpCategory] = useState('Technical Issue');
  const [helpDescription, setHelpDescription] = useState('');
  const [submittingHelp, setSubmittingHelp] = useState(false);

  const auth = useAuth();
  const user = auth?.user;
  const setUser = auth?.setUser;
  const userName = user?.name || 'User';
  const userPhone = user?.phone || 'N/A';
  const userRole = (user?.role || 'player').toLowerCase();
  const isOrganizer = userRole === 'organizer';
  const isAdmin = userRole === 'admin';

  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  const [loadingAdminNotifications, setLoadingAdminNotifications] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyTarget, setReplyTarget] = useState<AdminNotification | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [userSupportRequests, setUserSupportRequests] = useState<UserSupportRequest[]>([]);
  const [loadingUserSupportReplies, setLoadingUserSupportReplies] = useState(false);

  const stripCountryCode = (number: string, code = '91'): string => {
    const normalized = String(number || '').replace('+', '');
    return normalized.startsWith(code) ? normalized.slice(code.length) : normalized;
  };

  const uniqueTournamentsFromMap = (tournamentsByTeam: { [teamId: string]: any[] }) => {
    const tournamentMap = new Map<number, any>();
    Object.values(tournamentsByTeam || {}).forEach((items) => {
      if (!Array.isArray(items)) return;
      items.forEach((t) => {
        if (t?.id && !tournamentMap.has(t.id)) {
          tournamentMap.set(t.id, t);
        }
      });
    });
    return Array.from(tournamentMap.values());
  };

  const uniqueTournamentList = (tournaments: any[]) => {
    const tournamentMap = new Map<number, any>();
    (tournaments || []).forEach((t) => {
      if (t?.id && !tournamentMap.has(t.id)) {
        tournamentMap.set(t.id, t);
      }
    });
    return Array.from(tournamentMap.values());
  };

  const getTournamentStatus = (tournament: any) => {
    const startRaw = tournament?.start_date || tournament?.startDate;
    const endRaw = tournament?.end_date || tournament?.endDate;
    if (!startRaw && !endRaw) return 'Upcoming';

    const startDate = startRaw ? new Date(startRaw) : null;
    const endDate = endRaw ? new Date(endRaw) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate && startDate > today) return 'Upcoming';
    if (endDate && endDate < today) return 'Completed';
    return 'Active';
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const loadAdminNotifications = async () => {
    if (!isAdmin) {
      setAdminNotifications([]);
      return;
    }

    try {
      setLoadingAdminNotifications(true);
      const result = await getAdminNotifications();
      if ((result as any)?.error) {
        console.error('Failed to fetch admin notifications:', (result as any).error);
        setAdminNotifications([]);
        return;
      }

      const list = Array.isArray((result as any)?.notifications) ? (result as any).notifications : [];
      setAdminNotifications(list);
    } catch (error) {
      console.error('Failed to fetch admin notifications:', error);
      setAdminNotifications([]);
    } finally {
      setLoadingAdminNotifications(false);
    }
  };

  const handleDeleteAdminNotification = async (notificationId: number) => {
    try {
      const result = await deleteAdminNotification(notificationId);
      if ((result as any)?.error) {
        Alert.alert('Delete Failed', (result as any).error || 'Unable to delete notification.');
        return;
      }

      setAdminNotifications((prev) => prev.filter((item) => item.id !== notificationId));
    } catch {
      Alert.alert('Delete Failed', 'Unable to delete notification. Please try again.');
    }
  };

  const openReplyModal = (notification: AdminNotification) => {
    setReplyTarget(notification);
    setReplyMessage(notification.adminReply || '');
    setShowReplyModal(true);
  };

  const handleSubmitReply = async () => {
    if (!replyTarget?.id) {
      return;
    }

    const trimmedMessage = replyMessage.trim();
    if (!trimmedMessage) {
      Alert.alert('Missing Reply', 'Please enter a reply message.');
      return;
    }

    try {
      setSubmittingReply(true);
      const result = await replyToAdminNotification(replyTarget.id, trimmedMessage);
      if ((result as any)?.error) {
        Alert.alert('Reply Failed', (result as any).error || 'Unable to save reply.');
        return;
      }

      setShowReplyModal(false);
      setReplyTarget(null);
      setReplyMessage('');
      await loadAdminNotifications();
      Alert.alert('Reply Saved', 'Your reply has been saved for this support request.');
    } catch {
      Alert.alert('Reply Failed', 'Unable to save reply. Please try again.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleOpenSupportInbox = async () => {
    if (isAdmin) {
      await loadAdminNotifications();
    } else {
      await loadUserSupportReplies();
    }
    setShowSupportInboxModal(true);
  };

  const loadUserSupportReplies = async () => {
    if (isAdmin || !user?.phone) {
      setUserSupportRequests([]);
      return;
    }

    try {
      setLoadingUserSupportReplies(true);
      const result = await getSupportRepliesForUser(String(user.phone).trim());
      if ((result as any)?.error) {
        console.error('Failed to fetch support replies:', (result as any).error);
        setUserSupportRequests([]);
        return;
      }

      const list = Array.isArray((result as any)?.requests) ? (result as any).requests : [];
      setUserSupportRequests(list);
    } catch (error) {
      console.error('Failed to fetch support replies:', error);
      setUserSupportRequests([]);
    } finally {
      setLoadingUserSupportReplies(false);
    }
  };

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        if (!user?.id || !user?.phone) {
          setProfileTeams([]);
          setProfileTournaments([]);
          setRecentCreatedTournaments([]);
          setRecentCreatedTeams([]);
          setUpcomingJoinedTournaments([]);
          return;
        }

        if (isAdmin) {
          setProfileTeams([]);
          setProfileTournaments([]);
          setRecentCreatedTournaments([]);
          setRecentCreatedTeams([]);
          setUpcomingJoinedTournaments([]);
          return;
        }

        const enrichTeamsWithMemberCounts = async (teams: any[]) => {
          const teamList = Array.isArray(teams) ? teams : [];
          if (teamList.length === 0) return [];

          const teamIds = teamList
            .map((team: any) => String(team?.id || '').trim())
            .filter(Boolean);

          if (teamIds.length === 0) return teamList;

          try {
            const playersByTeam = await getPlayersForTeams(teamIds);
            const counts: Record<string, number> = {};

            Object.entries((playersByTeam || {}) as Record<string, any[]>).forEach(([teamId, players]) => {
              counts[String(teamId)] = Array.isArray(players) ? players.length : 0;
            });

            return teamList.map((team: any) => ({
              ...team,
              members: Number(counts[String(team.id)] ?? team?.members ?? 0),
            }));
          } catch {
            return teamList.map((team: any) => ({
              ...team,
              members: Number(team?.members ?? 0),
            }));
          }
        };

        if (isOrganizer) {
          const normalizedPhone = stripCountryCode(user.phone);
          const [teamsData, createdTournamentData] = await Promise.all([
            fetchTeamsByMobile(normalizedPhone),
            fetchTournamentsByContact(normalizedPhone).catch(() => ({ tournaments: [] }))
          ]);

          const teams = await enrichTeamsWithMemberCounts(teamsData?.teams || []);
          const teamIds = teams.map((team: any) => team.id.toString());
          const joinedByTeams = teamIds.length > 0
            ? await getTournamentsForTeams(teamIds as any)
            : {};

          const joinedTournaments = uniqueTournamentsFromMap(joinedByTeams as { [teamId: string]: any[] });
          const createdTournaments = createdTournamentData?.tournaments || [];
          const uniqueCreatedTournaments = uniqueTournamentList(createdTournaments);
          const createdIds = new Set(uniqueCreatedTournaments.map((t: any) => Number(t.id)));
          const upcomingJoined = joinedTournaments.filter((t: any) => {
            const status = getTournamentStatus(t);
            return status === 'Upcoming' && !createdIds.has(Number(t.id));
          });

          const byRecent = (items: any[]) =>
            [...items].sort((a, b) => {
              const aTime = new Date(a?.created_date || a?.createdAt || a?.start_date || 0).getTime();
              const bTime = new Date(b?.created_date || b?.createdAt || b?.start_date || 0).getTime();
              if (aTime !== bTime) return bTime - aTime;
              return Number(b?.id || 0) - Number(a?.id || 0);
            });

          setProfileTeams(teams);
          setProfileTournaments(uniqueTournamentList([...createdTournaments, ...joinedTournaments]));
          setRecentCreatedTournaments(byRecent(uniqueCreatedTournaments));
          setRecentCreatedTeams(byRecent(teams));
          setUpcomingJoinedTournaments(byRecent(upcomingJoined));
        } else {
          const teamsData = await getTeamsForPlayer(String(user.phone || '').trim());
          const teams = await enrichTeamsWithMemberCounts(teamsData?.teams || []);
          const teamIds = teams.map((team: any) => team.id.toString());
          const joinedByTeams = teamIds.length > 0
            ? await getTournamentsForTeams(teamIds as any)
            : {};

          setProfileTeams(teams);
          setProfileTournaments(uniqueTournamentsFromMap(joinedByTeams as { [teamId: string]: any[] }));
          setRecentCreatedTournaments([]);
          setRecentCreatedTeams([]);
          setUpcomingJoinedTournaments([]);
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
        setProfileTeams([]);
        setProfileTournaments([]);
        setRecentCreatedTournaments([]);
        setRecentCreatedTeams([]);
        setUpcomingJoinedTournaments([]);
      }
    };

    loadProfileData();
  }, [isAdmin, isOrganizer, user?.id, user?.phone]);

  useEffect(() => {
    loadAdminNotifications();
  }, [isAdmin]);

  useEffect(() => {
    loadUserSupportReplies();
  }, [isAdmin, user?.phone]);

  const profileStats = useMemo(() => {
    const activeCount = profileTournaments.filter((t) => getTournamentStatus(t) === 'Active').length;
    const upcomingCount = profileTournaments.filter((t) => getTournamentStatus(t) === 'Upcoming').length;
    const completedCount = profileTournaments.filter((t) => getTournamentStatus(t) === 'Completed').length;

    return {
      teamsCount: profileTeams.length,
      tournamentsCount: profileTournaments.length,
      activeCount,
      upcomingCount,
      completedCount,
    };
  }, [profileTeams, profileTournaments]);

  const helpCategories = ['Technical Issue', 'Feature Not Working', 'Need Improvement', 'Other'];

  const renderStatCard = (title: string, value: string | number, icon: React.ReactNode, color: string, subtitle?: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );

  const handleLogout = async () => {
    try {
      const authKeys = ['auth_token', 'auth_user_id', 'auth_user_name', 'auth_user_phone', 'auth_user_role'];

      if (Platform.OS === 'web') {
        try {
          const keys = Object.keys(window.localStorage || {}).filter((key) => key.startsWith('auth_'));
          keys.forEach((key) => window.localStorage.removeItem(key));
          authKeys.forEach((key) => window.localStorage.removeItem(key));
        } catch {
          // Ignore storage cleanup failures on web and continue logout.
        }
      } else {
        await Promise.all(authKeys.map((key) => SecureStore.deleteItemAsync(key)));
      }

      setUser?.(null);
      router.replace('/auth/auth-screen');
    } catch (error) {
      console.error('Sign out failed. Please try again.', error);
    }
  };

  const handleSubmitHelp = async () => {
    const description = helpDescription.trim();
    if (!description) {
      Alert.alert('Missing Details', 'Please explain the issue before submitting.');
      return;
    }

    try {
      setSubmittingHelp(true);
      const result = await submitSupportRequest({
        user_id: user?.id,
        user_name: userName,
        user_phone: userPhone,
        role: isAdmin ? 'admin' : isOrganizer ? 'organizer' : 'player',
        category: helpCategory,
        description,
      });

      if ((result as any)?.error) {
        Alert.alert('Submission Failed', (result as any).error || 'Unable to submit support request.');
        return;
      }

      Alert.alert('Submitted', 'Your issue has been sent to admin.');
      setHelpDescription('');
      setHelpCategory('Technical Issue');
      setShowCategoryOptions(false);
      setShowHelpModal(false);
      await loadUserSupportReplies();
    } catch (error) {
      Alert.alert('Submission Failed', 'Unable to submit support request. Please try again.');
    } finally {
      setSubmittingHelp(false);
    }
  };

  const renderMenuOption = (title: string, icon: React.ReactNode, onPress?: () => void, showSwitch?: boolean, switchValue?: boolean, onSwitchChange?: (value: boolean) => void) => (
    <TouchableOpacity style={styles.menuOption} onPress={onPress} disabled={showSwitch}>
      <View style={styles.menuOptionLeft}>
        <View style={styles.menuIcon}>
          {icon}
        </View>
        <Text style={styles.menuOptionText}>{title}</Text>
      </View>
      {showSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
          thumbColor={'#FFFFFF'}
        />
      ) : (
        <ChevronRight size={20} color="#9CA3AF" />
      )}
    </TouchableOpacity>
  );

  const renderTournamentCards = (items: any[], emptyText: string, isJoined = false) => {
    if (items.length === 0) {
      return <Text style={styles.activityDate}>{emptyText}</Text>;
    }

    return items.slice(0, 5).map((tournament, index) => {
      const status = getTournamentStatus(tournament);
      const tournamentName = tournament?.name || 'Tournament';
      const tournamentTeam = tournament?.team || (isJoined ? 'Joined with Team' : 'Organizer');

      return (
        <View key={`${tournament.id}-${index}`} style={styles.tournamentCard}>
          <View style={styles.tournamentInfo}>
            <Text style={styles.tournamentName}>{tournamentName}</Text>
            <Text style={styles.tournamentTeam}>{tournamentTeam}</Text>
            <View style={styles.tournamentMeta}>
              <View
                style={[
                  styles.statusBadge,
                  status === 'Active' && styles.statusActive,
                  status === 'Completed' && styles.statusCompleted,
                  status === 'Upcoming' && styles.statusUpcoming,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    status === 'Active' && styles.statusTextActive,
                    status === 'Completed' && styles.statusTextCompleted,
                    status === 'Upcoming' && styles.statusTextUpcoming,
                  ]}
                >
                  {status}
                </Text>
              </View>
              <Text style={styles.positionText}>#{index + 1}</Text>
            </View>
          </View>
          {!isJoined && (
            <View style={styles.captainBadge}>
              <Crown size={16} color="#F59E0B" />
            </View>
          )}
        </View>
      );
    });
  };

  const renderTeamCards = (items: any[], emptyText: string) => {
    if (items.length === 0) {
      return <Text style={styles.activityDate}>{emptyText}</Text>;
    }

    return items.slice(0, 5).map((team) => (
      <View key={team.id} style={styles.teamCard}>
        <Image
          source={{
            uri:
              team.image ||
              'https://images.pexels.com/photos/163452/cricket-bat-ball-wicket-163452.jpeg?auto=compress&cs=tinysrgb&w=400',
          }}
          style={styles.teamImage}
        />
        <View style={styles.teamInfo}>
          <View style={styles.teamHeader}>
            <Text style={styles.teamName}>{team.name}</Text>
            <View style={styles.roleBadge}>
              <Crown size={12} color="#F59E0B" />
              <Text style={[styles.roleText, styles.captainText]}>Created</Text>
            </View>
          </View>
          <View style={styles.teamStats}>
            <Text style={styles.teamStat}>{team.members ?? 0} members</Text>
            <Text style={styles.teamStat}>{team.location || 'Unknown location'}</Text>
            <Text style={styles.teamStat}>ID: {team.id}</Text>
          </View>
        </View>
      </View>
    ));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            <Image 
              source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=22C55E&color=ffffff&size=256&bold=true` }}
              style={styles.profileImage}
            />
            <TouchableOpacity style={styles.editImageButton}>
              <Text style={styles.editImageText}>✎</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>{userName}</Text>
          <Text style={styles.profileEmail}>
            {isAdmin ? 'Admin' : userRole === 'organizer' ? 'Organizer' : 'Player'}
          </Text>
          <Text style={styles.memberSince}>Contact: {userPhone}</Text>
        </View>

        {/* Cricket Stats Grid */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            {renderStatCard('Teams', profileStats.teamsCount, <Target size={20} color="#22C55E" />, '#22C55E')}
            {renderStatCard('Tournaments', profileStats.tournamentsCount, <TrendingUp size={20} color="#3B82F6" />, '#3B82F6')}
            {renderStatCard('Active', profileStats.activeCount, <Trophy size={20} color="#F97316" />, '#F97316')}
            {renderStatCard('Upcoming', profileStats.upcomingCount, <Star size={20} color="#8B5CF6" />, '#8B5CF6')}
            {renderStatCard('Completed', profileStats.completedCount, <Award size={20} color="#EF4444" />, '#EF4444')}
            {renderStatCard('Role', isAdmin ? 'Admin' : userRole === 'organizer' ? 'Organizer' : 'Player', <Target size={20} color="#06B6D4" />, '#06B6D4')}
          </View>
        </View>

         {/* Settings Menu */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          {renderMenuOption(
            'Notifications',
            <Bell size={20} color="#6B7280" />,
            undefined,
            true,
            notificationsEnabled,
            setNotificationsEnabled
          )}

          {renderMenuOption(
            'Support Inbox',
            <Bell size={20} color="#2563EB" />,
            handleOpenSupportInbox
          )}
          
          {/* {renderMenuOption(
            'Private Profile',
            <Shield size={20} color="#6B7280" />,
            undefined,
            true,
            privateProfile,
            setPrivateProfile
          )}
          
          {renderMenuOption(
            'Account Settings',
            <Settings size={20} color="#6B7280" />,
            () => {}
          )} */}
          
          {renderMenuOption(
            'Help & Support',
            <HelpCircle size={20} color="#6B7280" />,
            () => setShowHelpModal(true)
          )}

          {renderMenuOption(
            'Logout',
            <LogOut size={20} color="#EF4444" />,
            handleLogout
          )}

        </View>

        <View style={styles.bottomSpacing} />

        {isOrganizer ? (
          <>
            <View style={styles.modelSection}>
              <View style={styles.modelHeaderRow}>
                <Text style={styles.sectionTitle}>Recent Tournaments You Created</Text>
                <Text style={styles.modelCount}>{recentCreatedTournaments.length}</Text>
              </View>
              <View style={styles.modelCardWrap}>
                {renderTournamentCards(recentCreatedTournaments, 'No created tournaments yet.')}
              </View>
            </View>

            <View style={styles.modelSection}>
              <View style={styles.modelHeaderRow}>
                <Text style={styles.sectionTitle}>Recent Teams You Created</Text>
                <Text style={styles.modelCount}>{recentCreatedTeams.length}</Text>
              </View>
              <View style={styles.modelCardWrap}>
                {renderTeamCards(recentCreatedTeams, 'No created teams yet.')}
              </View>
            </View>

            <View style={styles.modelSection}>
              <View style={styles.modelHeaderRow}>
                <Text style={styles.sectionTitle}>Upcoming Tournaments Joined By Teams</Text>
                <Text style={styles.modelCount}>{upcomingJoinedTournaments.length}</Text>
              </View>
              <View style={styles.modelCardWrap}>
                {renderTournamentCards(upcomingJoinedTournaments, 'No upcoming joined tournaments.', true)}
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.tournamentsSection}>
              <Text style={styles.sectionTitle}>Joined Tournaments</Text>
              {renderTournamentCards(profileTournaments, 'No tournaments available.', true)}
            </View>

            <View style={styles.teamsSection}>
              <Text style={styles.sectionTitle}>My Teams</Text>
              {renderTeamCards(profileTeams, 'No teams available.')}
            </View>
          </>
        )}

       
      </ScrollView>

      <Modal
        visible={showSupportInboxModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSupportInboxModal(false)}
      >
        <View style={styles.helpModalOverlay}>
          <View style={[styles.helpModalCard, styles.supportInboxCard]}>
            <Text style={styles.helpModalTitle}>{isAdmin ? 'Admin Support Inbox' : 'Support Replies'}</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.supportInboxList}>
              {isAdmin ? (
                loadingAdminNotifications ? (
                  <View style={styles.adminLoadingRow}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.activityDate}>Loading notifications...</Text>
                  </View>
                ) : adminNotifications.length === 0 ? (
                  <Text style={styles.activityDate}>No admin notifications available.</Text>
                ) : (
                  adminNotifications.map((notification) => {
                    const isSupportNotification = notification.notificationType === 'support_request';
                    const showMessage = !isSupportNotification || (!notification.description && !notification.adminReply);

                    return (
                      <View key={notification.id} style={styles.adminNotificationCard}>
                        <Text style={styles.adminNotificationTitle}>{notification.title || 'Notification'}</Text>
                        {showMessage && !!notification.message ? (
                          <Text style={styles.adminNotificationText}>{notification.message}</Text>
                        ) : null}
                        {notification.userName || notification.userPhone ? (
                          <Text style={styles.adminNotificationMeta}>
                            From: {notification.userName || 'User'} ({notification.userPhone || 'N/A'})
                          </Text>
                        ) : null}
                        {notification.description ? (
                          <Text style={styles.adminNotificationMeta}>Issue: {notification.description}</Text>
                        ) : null}
                        <Text style={styles.adminNotificationMeta}>Created: {formatDateTime(notification.createdAt)}</Text>
                        {notification.adminReply ? (
                          <View style={styles.adminReplyBox}>
                            <Text style={styles.adminReplyTitle}>Reply</Text>
                            <Text style={styles.adminReplyText}>{notification.adminReply}</Text>
                          </View>
                        ) : null}
                        <View style={styles.adminActionsRow}>
                          <TouchableOpacity
                            style={[styles.adminActionButton, styles.adminReplyButton]}
                            onPress={() => openReplyModal(notification)}
                          >
                            <Text style={styles.adminReplyButtonText}>{notification.adminReply ? 'Edit Reply' : 'Reply'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.adminActionButton, styles.adminDeleteButton]}
                            onPress={() => handleDeleteAdminNotification(notification.id)}
                          >
                            <Text style={styles.adminDeleteButtonText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )
              ) : loadingUserSupportReplies ? (
                <View style={styles.adminLoadingRow}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.activityDate}>Loading support updates...</Text>
                </View>
              ) : userSupportRequests.length === 0 ? (
                <Text style={styles.activityDate}>No support requests yet.</Text>
              ) : (
                userSupportRequests.map((request) => (
                  <View key={request.id} style={styles.userReplyCard}>
                    <Text style={styles.userReplyTitle}>{request.category}</Text>
                    <Text style={styles.userReplyMeta}>Your issue: {request.description}</Text>
                    <Text style={styles.userReplyMeta}>Raised: {formatDateTime(request.createdAt)}</Text>
                    <Text style={styles.userReplyMeta}>Status: {request.status || 'open'}</Text>
                    {request.adminReply ? (
                      <View style={styles.adminReplyBox}>
                        <Text style={styles.adminReplyTitle}>Admin Reply</Text>
                        <Text style={styles.adminReplyText}>{request.adminReply}</Text>
                        <Text style={styles.adminNotificationMeta}>Replied: {formatDateTime(request.repliedAt)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.userReplyPending}>Awaiting admin response</Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.helpModalActions}>
              <TouchableOpacity
                style={styles.helpCancelButton}
                onPress={() => setShowSupportInboxModal(false)}
              >
                <Text style={styles.helpCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showHelpModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.helpModalOverlay}>
          <View style={styles.helpModalCard}>
            <Text style={styles.helpModalTitle}>Help & Support</Text>

            <Text style={styles.helpLabel}>Category</Text>
            <TouchableOpacity
              style={styles.helpCategoryPicker}
              onPress={() => setShowCategoryOptions((prev) => !prev)}
            >
              <Text style={styles.helpCategoryValue}>{helpCategory}</Text>
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>

            {showCategoryOptions && (
              <View style={styles.helpCategoryList}>
                {helpCategories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={styles.helpCategoryItem}
                    onPress={() => {
                      setHelpCategory(category);
                      setShowCategoryOptions(false);
                    }}
                  >
                    <Text style={styles.helpCategoryItemText}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.helpLabel}>Describe the issue</Text>
            <TextInput
              style={styles.helpTextArea}
              multiline
              value={helpDescription}
              onChangeText={setHelpDescription}
              placeholder="Please explain your issue or suggestion..."
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />

            <View style={styles.helpModalActions}>
              <TouchableOpacity
                style={styles.helpCancelButton}
                onPress={() => {
                  setShowHelpModal(false);
                  setShowCategoryOptions(false);
                }}
                disabled={submittingHelp}
              >
                <Text style={styles.helpCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.helpSubmitButton, submittingHelp && styles.helpSubmitButtonDisabled]}
                onPress={handleSubmitHelp}
                disabled={submittingHelp}
              >
                <Text style={styles.helpSubmitText}>{submittingHelp ? 'Submitting...' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReplyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReplyModal(false)}
      >
        <View style={styles.helpModalOverlay}>
          <View style={styles.helpModalCard}>
            <Text style={styles.helpModalTitle}>Reply to User</Text>
            <Text style={styles.helpLabel}>Reply message</Text>
            <TextInput
              style={styles.helpTextArea}
              multiline
              value={replyMessage}
              onChangeText={setReplyMessage}
              placeholder="Type your response..."
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
            <View style={styles.helpModalActions}>
              <TouchableOpacity
                style={styles.helpCancelButton}
                onPress={() => {
                  setShowReplyModal(false);
                  setReplyTarget(null);
                }}
                disabled={submittingReply}
              >
                <Text style={styles.helpCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.helpSubmitButton, submittingReply && styles.helpSubmitButtonDisabled]}
                onPress={handleSubmitReply}
                disabled={submittingReply}
              >
                <Text style={styles.helpSubmitText}>{submittingReply ? 'Saving...' : 'Save Reply'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  profileHeader: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 30,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#22C55E',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  editImageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  profileName: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  statsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statContent: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  statSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  modelSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modelCount: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modelCardWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tournamentsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  tournamentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  tournamentTeam: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
  },
  tournamentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusCompleted: {
    backgroundColor: '#DBEAFE',
  },
  statusUpcoming: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  statusTextActive: {
    color: '#22C55E',
  },
  statusTextCompleted: {
    color: '#3B82F6',
  },
  statusTextUpcoming: {
    color: '#F59E0B',
  },
  positionText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  captainBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  teamImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  teamInfo: {
    flex: 1,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  teamName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 4,
  },
  captainText: {
    color: '#F59E0B',
  },
  teamStats: {
    flexDirection: 'row',
    gap: 16,
  },
  teamStat: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  userRepliesSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  userReplyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  userReplyTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  userReplyMeta: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    marginBottom: 4,
  },
  userReplyPending: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
  },
  achievementsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  achievementsContainer: {
    paddingVertical: 8,
  },
  achievementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 140,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  achievementCardLocked: {
    backgroundColor: '#F9FAFB',
    opacity: 0.6,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementIconLocked: {
    backgroundColor: '#F3F4F6',
  },
  achievementName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementNameLocked: {
    color: '#9CA3AF',
  },
  achievementDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  achievementDescriptionLocked: {
    color: '#9CA3AF',
  },
  activitySection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginTop: 6,
    marginRight: 12,
  },
  activityDotMatch: {
    backgroundColor: '#22C55E',
  },
  activityDotTeam: {
    backgroundColor: '#3B82F6',
  },
  activityDotAchievement: {
    backgroundColor: '#F59E0B',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  menuSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  adminSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  adminLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminNotificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  adminNotificationTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 6,
  },
  adminNotificationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 8,
  },
  adminNotificationMeta: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  adminReplyBox: {
    marginTop: 8,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  adminReplyTitle: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  adminReplyText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  adminActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  adminActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  adminReplyButton: {
    backgroundColor: '#DCFCE7',
  },
  adminReplyButtonText: {
    color: '#166534',
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  adminDeleteButton: {
    backgroundColor: '#FEE2E2',
  },
  adminDeleteButtonText: {
    color: '#991B1B',
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  menuOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#EF4444',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 20,
  },
  helpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  helpModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  supportInboxCard: {
    maxHeight: '78%',
  },
  supportInboxList: {
    marginBottom: 12,
  },
  helpModalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  helpLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 6,
  },
  helpCategoryPicker: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  helpCategoryValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  helpCategoryList: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  helpCategoryItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  helpCategoryItemText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  helpTextArea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginBottom: 14,
  },
  helpModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  helpCancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  helpCancelText: {
    color: '#374151',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
  helpSubmitButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#22C55E',
  },
  helpSubmitButtonDisabled: {
    opacity: 0.7,
  },
  helpSubmitText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
});