import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Phone, Shield, User } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
    Image, KeyboardAvoidingView, Platform,
    ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authenticateUser, createUser } from '../service/authService';
import { useAuth } from './auth-context';

const AuthScreen = () => {
  const params = useLocalSearchParams<{ returnTo?: string; returnId?: string }>();
  const [formData, setFormData] = useState({ name: '', phone: '', mpin: '', confirmMpin: '', role: '' as '' | 'organizer' | 'player' });
  const [loading, setLoading] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [errors, setErrors] = useState({ name: '', phone: '', mpin: '', confirmMpin: '', role: '', general: '' });
  const [message, setMessage] = useState('');
  const { setUser } = useAuth() || { setUser: () => {} } as any;
  const mpinInputRef = useRef<TextInput | null>(null);
  const confirmMpinInputRef = useRef<TextInput | null>(null);

  const navigateAfterAuth = () => {
    const returnTo = typeof params.returnTo === 'string' ? params.returnTo : '';
    const returnId = typeof params.returnId === 'string' ? params.returnId : '';

    if (returnTo === '/tournament-details' && returnId) {
      router.replace({ pathname: '/tournament-details', params: { id: returnId } });
      return;
    }

    if (returnTo) {
      router.replace(returnTo as any);
      return;
    }

    router.replace('/(tabs)');
  };

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '', general: '' }));
  };

  const normalizePhone = (value: string) => value.replace(/\D/g, '');
  const normalizePhoneInput = (value: string) => normalizePhone(value).slice(0, 10);
  const normalizeMpin = (value: string) => value.replace(/\D/g, '').slice(0, 6);

  const getStoredAuthToken = async () => {
    try {
      if (Platform.OS === 'web') {
        return window.localStorage.getItem('auth_token') || '';
      }
      return (await SecureStore.getItemAsync('auth_token')) || '';
    } catch {
      return '';
    }
  };

  const getStoredAuthUser = async () => {
    try {
      if (Platform.OS === 'web') {
        const id = window.localStorage.getItem('auth_user_id') || '';
        const name = window.localStorage.getItem('auth_user_name') || '';
        const phone = window.localStorage.getItem('auth_user_phone') || '';
        const role = window.localStorage.getItem('auth_user_role') || 'player';
        return { id, name, phone, role };
      }

      const [id, name, phone, role] = await Promise.all([
        SecureStore.getItemAsync('auth_user_id'),
        SecureStore.getItemAsync('auth_user_name'),
        SecureStore.getItemAsync('auth_user_phone'),
        SecureStore.getItemAsync('auth_user_role')
      ]);

      return {
        id: id || '',
        name: name || '',
        phone: phone || '',
        role: role || 'player'
      };
    } catch {
      return { id: '', name: '', phone: '', role: 'player' };
    }
  };

  const validateForm = () => {
    const newErrors = { name: '', phone: '', mpin: '', confirmMpin: '', role: '', general: '' };
    let isValid = true;
    if (isSignUpMode && !formData.name.trim()) {
      newErrors.name = 'Name is required';
      isValid = false;
    }
    if (isSignUpMode && !formData.role) {
      newErrors.role = 'Please choose Organizer or Player';
      isValid = false;
    }
    const normalizedPhone = normalizePhone(formData.phone);
    if (!normalizedPhone) {
      newErrors.phone = 'Phone number is required';
      isValid = false;
    } else if (!/^[0-9]{10}$/.test(normalizedPhone)) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
      isValid = false;
    }
    if (formData.mpin.length !== 6) {
      newErrors.mpin = 'MPIN must be exactly 6 digits';
      isValid = false;
    }
    if (isSignUpMode && formData.mpin !== formData.confirmMpin) {
      newErrors.confirmMpin = 'MPINs do not match';
      isValid = false;
    }
    setErrors(newErrors);
    return isValid;
  };

  const handleSignup = async () => {
    setErrors({ name: '', phone: '', mpin: '', confirmMpin: '', role: '', general: '' });
    setMessage('');
    if (!validateForm()) return;
    setLoading(true);
    try {
      const phone = normalizePhoneInput(formData.phone);
      const res = await createUser(
        formData.name.trim(),
        phone,
        formData.mpin.trim(),
        formData.role as 'organizer' | 'player'
      );
      if ((res as any).error) {
        setErrors((prev) => ({ ...prev, general: (res as any).error }));
        return;
      }
      setMessage('Signup successful! Please sign in.');
      setIsSignUpMode(false);
      setFormData({ name: '', phone, mpin: '', confirmMpin: '', role: '' });
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, general: err?.message || 'Signup failed.' }));
    } finally {
      setLoading(false);
    }
  };

  const handleSignin = async () => {
    setErrors({ name: '', phone: '', mpin: '', confirmMpin: '', role: '', general: '' });
    setMessage('');
    const phone = normalizePhoneInput(formData.phone);
    const basicValid =
      phone &&
      /^[0-9]{10}$/.test(phone) &&
      formData.mpin.length === 6;
    if (!basicValid) {
      validateForm();
      return;
    }
    setLoading(true);
    try {
      const res = await authenticateUser(phone, formData.mpin.trim());
      if ((res as any).error) {
        setErrors((prev) => ({ ...prev, general: (res as any).error }));
        return;
      }
      const { token, ...userData } = res as any;
      if (token) {
        if (Platform.OS === 'web') {
          try {
            window.localStorage.setItem('auth_token', token);
            if (userData?.id !== undefined && userData?.id !== null) {
              window.localStorage.setItem('auth_user_id', String(userData.id));
            }
            if (userData?.name) {
              window.localStorage.setItem('auth_user_name', String(userData.name));
            }
            if (userData?.phone) {
              window.localStorage.setItem('auth_user_phone', String(userData.phone));
            }
            if (userData?.role) {
              window.localStorage.setItem('auth_user_role', String(userData.role));
            }
          }
          catch {
            console.warn('Failed to store auth token in localStorage');
          }
        } else {
          await SecureStore.setItemAsync('auth_token', token);
          if (userData?.id !== undefined && userData?.id !== null) {
            await SecureStore.setItemAsync('auth_user_id', String(userData.id));
          }
          if (userData?.name) {
            await SecureStore.setItemAsync('auth_user_name', String(userData.name));
          }
          if (userData?.phone) {
            await SecureStore.setItemAsync('auth_user_phone', String(userData.phone));
          }
          if (userData?.role) {
            await SecureStore.setItemAsync('auth_user_role', String(userData.role));
          }
        }
      }
      setUser?.(userData);
      navigateAfterAuth();
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, general: err?.message || 'Sign in failed.' }));
    } finally {
      setLoading(false);
    }
  };

  const checkUserExists = async (phone: string) => {
    const normalizedInputPhone = normalizePhone(phone);
    if (!normalizedInputPhone) return false;

    try {
      const storedUser = await getStoredAuthUser();
      const storedPhone = storedUser.phone;

      if (!storedPhone) return false;
      return normalizePhone(storedPhone) === normalizedInputPhone;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const restoreSessionIfExists = async () => {
      const token = await getStoredAuthToken();
      if (!token) return;

      const storedUser = await getStoredAuthUser();
      if (!storedUser.phone || !storedUser.name || !storedUser.id) return;

      const exists = await checkUserExists(storedUser.phone);
      if (!exists) return;

      setUser?.({
        id: Number(storedUser.id) || storedUser.id,
        name: storedUser.name,
        phone: storedUser.phone,
        role: storedUser.role || 'player',
      });
      navigateAfterAuth();
    };

    restoreSessionIfExists();
  }, [params.returnId, params.returnTo]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Image source={require('../../assets/images/hub/logo-name-new.png')} style={styles.logoClean} />
            <Text style={styles.title}>{isSignUpMode ? 'Create Account' : 'Sign In'}</Text>
            <Text style={styles.subtitle}>
              {isSignUpMode ? 'Join the community today' : 'Access Your Hub'}
            </Text>
          </View>
          <View style={styles.form}>
            {isSignUpMode && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={[styles.inputContainer, errors.name && styles.inputError]}>
                  <User size={20} color="#9CA3AF" />
                  <TextInput
                    style={styles.textInput}
                    value={formData.name}
                    onChangeText={(value) => updateFormData('name', value)}
                    placeholder="Enter your full name"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                  />
                </View>
                {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
              </View>
            )}
            {isSignUpMode && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Sign up as</Text>
                <View style={styles.roleCardsRow}>
                  <TouchableOpacity
                    style={[styles.roleCard, formData.role === 'organizer' && styles.roleCardSelected]}
                    onPress={() => updateFormData('role', 'organizer')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.roleIconWrap}>
                      <Shield size={18} color={formData.role === 'organizer' ? '#166534' : '#4B5563'} />
                    </View>
                    <Text style={styles.roleCardTitle}>Organizer</Text>
                    <Text style={styles.roleCardSubtitle}>Create and manage tournaments</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleCard, formData.role === 'player' && styles.roleCardSelected]}
                    onPress={() => updateFormData('role', 'player')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.roleIconWrap}>
                      <User size={18} color={formData.role === 'player' ? '#166534' : '#4B5563'} />
                    </View>
                    <Text style={styles.roleCardTitle}>Player</Text>
                    <Text style={styles.roleCardSubtitle}>Join and play matches</Text>
                  </TouchableOpacity>
                </View>
                {errors.role ? <Text style={styles.errorText}>{errors.role}</Text> : null}
              </View>
            )}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <View style={[styles.inputContainer, errors.phone && styles.inputError]}>
                <Phone size={20} color="#09b036" />
                <Text style={styles.phonePrefix}>+91</Text>
                <TextInput
                  style={[styles.textInput, styles.phoneTextInput]}
                  value={formData.phone}
                  onChangeText={(value) => updateFormData('phone', normalizePhoneInput(value))}
                  placeholder="Enter phone"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  inputMode="numeric"
                  maxLength={10}
                />
              </View>
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>MPIN</Text>
              <View style={[styles.pinInputWrapper, errors.mpin && styles.pinInputWrapperError]}>
                {Array.from({ length: 6 }).map((_, index) => {
                  const hasValue = Boolean(formData.mpin[index]);
                  const isActive = index === Math.min(formData.mpin.length, 5);
                  return (
                    <TouchableOpacity
                      key={`mpin-${index}`}
                      style={[
                        styles.pinDigitBox,
                        hasValue && styles.pinDigitBoxFilled,
                        isActive && styles.pinDigitBoxActive,
                      ]}
                      onPress={() => mpinInputRef.current?.focus()}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pinDigitText}>{hasValue ? '•' : ''}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TextInput
                  ref={mpinInputRef}
                  style={styles.hiddenPinInput}
                  value={formData.mpin}
                  onChangeText={(value) => updateFormData('mpin', normalizeMpin(value))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  caretHidden
                />
              </View>
              {errors.mpin ? <Text style={styles.errorText}>{errors.mpin}</Text> : null}
            </View>
            {isSignUpMode && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm MPIN</Text>
                <View style={[styles.pinInputWrapper, errors.confirmMpin && styles.pinInputWrapperError]}>
                  {Array.from({ length: 6 }).map((_, index) => {
                    const hasValue = Boolean(formData.confirmMpin[index]);
                    const isActive = index === Math.min(formData.confirmMpin.length, 5);
                    return (
                      <TouchableOpacity
                        key={`confirm-mpin-${index}`}
                        style={[
                          styles.pinDigitBox,
                          hasValue && styles.pinDigitBoxFilled,
                          isActive && styles.pinDigitBoxActive,
                        ]}
                        onPress={() => confirmMpinInputRef.current?.focus()}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.pinDigitText}>{hasValue ? '•' : ''}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TextInput
                    ref={confirmMpinInputRef}
                    style={styles.hiddenPinInput}
                    value={formData.confirmMpin}
                    onChangeText={(value) => updateFormData('confirmMpin', normalizeMpin(value))}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                    caretHidden
                  />
                </View>
                {errors.confirmMpin ? <Text style={styles.errorText}>{errors.confirmMpin}</Text> : null}
              </View>
            )}
            {message !== '' && <Text style={styles.message}>{message}</Text>}
            {errors.general ? <Text style={styles.errorText}>{errors.general}</Text> : null}
            <TouchableOpacity
              style={[styles.signupButton, loading && styles.signupButtonDisabled]}
              onPress={isSignUpMode ? handleSignup : handleSignin}
              disabled={loading}
            >
              <Text style={styles.signupButtonText}>
                {loading
                  ? 'Please wait...'
                  : isSignUpMode
                  ? 'Sign Up'
                  : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {isSignUpMode ? 'Already have an account? ' : "Don't have an account? "}
            </Text>
            <TouchableOpacity onPress={() => setIsSignUpMode((prev) => !prev)}>
              <Text style={styles.loginLink}>
                {isSignUpMode ? 'Sign In' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 28, fontFamily: 'Poppins-Bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center' },
  form: { marginBottom: 24 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#111827', marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputError: { borderColor: '#EF4444' },
  textInput: { flex: 1, fontSize: 16, fontFamily: 'Inter-Regular', color: '#111827', marginLeft: 12 },
  phonePrefix: {
    marginLeft: 10,
    marginRight: 8,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  phoneTextInput: {
    marginLeft: 0,
  },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#EF4444', marginTop: 4 },
  pinInputWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pinInputWrapperError: { borderColor: '#EF4444' },
  pinDigitBox: {
    width: 42,
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  pinDigitBoxFilled: {
    borderColor: '#22C55E',
    backgroundColor: '#ECFDF5',
  },
  pinDigitBoxActive: {
    borderColor: '#16A34A',
  },
  pinDigitText: {
    fontSize: 18,
    color: '#111827',
    fontFamily: 'Inter-SemiBold',
  },
  hiddenPinInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  roleCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  roleCardSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  roleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleCardTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  roleCardSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 16,
  },
  signupButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  signupButtonDisabled: { backgroundColor: '#9CA3AF' },
  signupButtonText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#6B7280' },
  loginLink: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#22C55E' },
  message: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#22C55E', marginTop: 4 },
  logoClean: { backgroundColor: 'transparent', width: 280, height: 200 , position: 'relative' }
});

export default AuthScreen;