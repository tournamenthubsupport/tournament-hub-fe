import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import {
    ArrowLeft,
    Calendar
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './auth/auth-context';
import { getCityItemsForState, INDIAN_STATE_OPTIONS } from './constants/indianLocations';
import { createTournament, fetchGroundSuggestions } from './service/tournamentService';

const TEAM_OPTIONS = [4, 8, 12, 16, 24];

const buildStateItems = () =>
  (Array.isArray(INDIAN_STATE_OPTIONS) ? INDIAN_STATE_OPTIONS : []).map((state) => ({
    label: state,
    value: state,
  }));

const CreateTournament = () => {

  const auth = useAuth();

  if (!auth) {
    console.error('Auth context is not available');
    return <Text>Loading auth context...</Text>;
  }

  const { user } = auth;
  const userRole = (user?.role || 'player').toLowerCase();
  const canManage = userRole === 'organizer' || userRole === 'admin';
  const loggedUserName = user?.name || '';
  const loggedUserPhone = user?.phone || '';
  const userName = (name?: string) =>
    name && typeof name === 'string'
      ? name.charAt(0).toUpperCase() + name.slice(1)
      : '';

  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const [validateStep1, setValidateStep1] = useState(false);

  const [selectedSport, setSelectedSport] = useState<number>(1);

  useEffect(() => {
    if (loggedUserName) {
      setOrganizerName(userName(loggedUserName));
    }
    if (loggedUserPhone) {
      setOrganizerContact(stripCountryCode(loggedUserPhone).replace(/\D/g, '').slice(0, 10));
    }
  }, [loggedUserName, loggedUserPhone]);

  useEffect(() => {
    if (!canManage) {
      Alert.alert('Access Denied', 'Only organizers or admins can create and manage tournaments.');
      router.replace('/(tabs)');
    }
  }, [canManage]);

  const next = () => setStep((prev) => Math.min(prev + 1, totalSteps));
  const back = () => setStep((prev) => Math.max(prev - 1, 1));

  const [openState, setOpenState] = useState(false);
  const [openCity, setOpenCity] = useState(false);
  const [selectedState, setSelectedState] = useState('Tamil Nadu');
  const [selectedCity, setSelectedCity] = useState('Chennai');
  const [stateList, setStateList] = useState<{ label: string; value: string }[]>(buildStateItems());
  const [cityList, setCityList] = useState<{ label: string; value: string }[]>(getCityItemsForState('Tamil Nadu'));

  useEffect(() => {
    const nextCityItems = getCityItemsForState(selectedState);
    setCityList(nextCityItems);
    if (selectedCity && !nextCityItems.some((city) => city.value === selectedCity)) {
      setSelectedCity('');
    }
  }, [selectedState]);

  const [tournamentName, setTournamentName] = useState('');
  const [location, setLocation] = useState('');
  const [ground, setGround] = useState('');
  const [groundSuggestions, setGroundSuggestions] = useState<Array<{ ground: string; location?: string; state?: string; city?: string }>>([]);
  const [showGroundSuggestions, setShowGroundSuggestions] = useState(false);
  const [organizerName, setOrganizerName] = useState('');
  const [organizerContact, setOrganizerContact] = useState('');
  const [totalTeams, setTotalTeams] = useState('');
  const [entryFees, setEntryFees] = useState('');
  const [prize, setPrize] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [ballType, setBallType] = useState('Tennis');
  const [matchType, setMatchType] = useState('Limited Overs');
  const [tournamentType, setTournamentType] = useState('Turf');
  const [loading, setLoading] = useState(false);

  const normalizeTeamsInput = (value: string) => value.replace(/\D/g, '').slice(0, 2);
  const normalizeAmountInput = (value: string) => value.replace(/\D/g, '').slice(0, 9);
  const normalizeTextInput = (value: string) => value.replace(/\d/g, '').replace(/\s{2,}/g, ' ');
  const normalizeGroundSuggestion = (
    item: string | { ground?: string; location?: string; state?: string; city?: string },
  ) => {
    if (typeof item === 'string') {
      return { ground: item };
    }

    return {
      ground: item.ground || '',
      location: item.location || '',
      state: item.state || '',
      city: item.city || '',
    };
  };

  const isValidTotalTeams = (value: string) => {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric > 0 && numeric <= 30 && numeric % 2 === 0;
  };

  const isValidAmount = (value: string) => {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric > 0;
  };

  const stripCountryCode = (number: string, code = "91"): string => {
    const normalized = number.replace("+", "");
    return normalized.startsWith(code) ? normalized.slice(code.length) : normalized;
  };

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseInputDate = (value: string): Date | null => {
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const parsed = new Date(`${trimmed}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  useEffect(() => {
    if (!showGroundSuggestions) {
      return;
    }

    const searchTerm = ground.trim();
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetchGroundSuggestions(searchTerm);
        const nextSuggestions = Array.isArray(response?.grounds)
          ? response.grounds.map(normalizeGroundSuggestion).filter((item: { ground: string }) => item.ground.trim())
          : [];
        setGroundSuggestions(nextSuggestions);
      } catch (error) {
        setGroundSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [ground, showGroundSuggestions]);
  
  const handleCreateTournament = async () => {
    const payload = {
      name: tournamentName,
      sport_id: selectedSport,
      state: selectedState,
      city: selectedCity,
      location: location,
      ground: ground,
      organiser_name: organizerName,
      organiser_contact: organizerContact,
      teams: totalTeams,
      entry_fees: entryFees,
      prize: prize,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      ball_type: ballType,
      match_type: matchType,
      tournament_type: tournamentType,
      status: 'Open',
    };
    try {
      const data = await createTournament(payload);
      Alert.alert('✅ Success', 'Tournament created successfully!');
      router.push('/');
    } catch (err: any) {
      Alert.alert('❌ Error', err.message);
    }
  };

  const canProceed = () => {
    // Add your validation logic here based on the current step
    if (step === 1) {
      return (
        tournamentName.trim().length >= 5 &&
        ground.trim() !== '' &&
        location.trim() !== '' &&
        selectedState.trim() !== '' &&
        selectedCity.trim() !== ''
      );
    } else if (step === 2) {
      return (
        organizerName.trim() !== '' &&
        organizerContact.trim() !== '' &&
        isValidTotalTeams(totalTeams) &&
        isValidAmount(entryFees) &&
        isValidAmount(prize)
      );
    } else if (step === 3) {
      return endDate.getTime() >= startDate.getTime();
    }
    return false;
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Basic Info</Text>
      <Text style={styles.stepDescription}>Let's start with the basic details of your tournament</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Tournament Name</Text>
        <TextInput
          style={styles.textInput}
          value={tournamentName}
          onChangeText={setTournamentName}
          placeholder="Enter tournament name"
          placeholderTextColor="#9CA3AF"
        />
        {validateStep1 && tournamentName.trim().length > 0 && tournamentName.trim().length < 5 ? (
          <Text style={styles.validationHint}>Tournament name must be at least 5 characters.</Text>
        ) : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Ground or Turf Name</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Ground or Turf name"
          value={ground}
          onChangeText={(text) => setGround(normalizeTextInput(text))}
          onFocus={() => setShowGroundSuggestions(true)}
          onBlur={() => setTimeout(() => setShowGroundSuggestions(false), 150)}
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
          autoCorrect={false}
        />
        {showGroundSuggestions && groundSuggestions.length > 0 && (
          <View style={styles.suggestionBox}>
            {groundSuggestions.map((item) => (
              <TouchableOpacity
                key={`${item.ground}-${item.location || ''}-${item.state || ''}-${item.city || ''}`}
                style={styles.suggestionItem}
                onPress={() => {
                  setGround(item.ground || '');
                  setLocation(item.location || '');
                  if (item.state) {
                    setSelectedState(item.state);
                  }
                  if (item.city) {
                    setSelectedCity(item.city);
                  }
                  setShowGroundSuggestions(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.suggestionText}>{item.ground}</Text>
                {(item.location || item.state || item.city) ? (
                  <Text style={styles.suggestionMeta}>
                    {[item.location, item.city, item.state].filter(Boolean).join(' • ')}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Location</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Enter location"
          value={location}
          onChangeText={(text) => setLocation(normalizeTextInput(text))}
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
          autoCorrect={false}
        />
        {validateStep1 && location.trim() === '' ? (
          <Text style={styles.validationHint}>Location cannot be empty.</Text>
        ) : null}
      </View>


    

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>State / Union Territory</Text>
        <DropDownPicker
          open={openState}
          value={selectedState}
          items={stateList}
          setOpen={setOpenState}
          setValue={setSelectedState}
          setItems={setStateList}
          placeholder="Select a State / UT"
          listMode="MODAL"
          searchable={true}
          searchPlaceholder="Search states or union territories"
          placeholderStyle={styles.dropdownPlaceholder}
          textStyle={styles.dropdownText}
          listItemContainerStyle={styles.dropdownItem}
          selectedItemContainerStyle={styles.dropdownItemSelected}
          searchContainerStyle={styles.dropdownSearchContainer}
          searchTextInputStyle={styles.dropdownSearchInput}
          modalProps={{ animationType: 'slide', presentationStyle: 'pageSheet' }}
          modalTitle="Choose a State / UT"
          style={styles.dropdownField}
          dropDownContainerStyle={styles.dropdownMenu}
          modalContentContainerStyle={styles.dropdownModalContent}
        />
        {validateStep1 && !selectedState && <Text style={styles.validationHint}>Please choose a state or union territory.</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>City</Text>
        <DropDownPicker
          open={openCity}
          value={selectedCity}
          items={cityList}
          setOpen={setOpenCity}
          setValue={setSelectedCity}
          setItems={setCityList}
          placeholder={selectedState ? 'Select a City' : 'Select a State first'}
          listMode="MODAL"
          searchable={true}
          searchPlaceholder="Search cities"
          placeholderStyle={styles.dropdownPlaceholder}
          textStyle={styles.dropdownText}
          listItemContainerStyle={styles.dropdownItem}
          selectedItemContainerStyle={styles.dropdownItemSelected}
          searchContainerStyle={styles.dropdownSearchContainer}
          searchTextInputStyle={styles.dropdownSearchInput}
          disabled={!selectedState}
          modalProps={{ animationType: 'slide', presentationStyle: 'pageSheet' }}
          modalTitle="Choose a City"
          style={styles.dropdownField}
          dropDownContainerStyle={styles.dropdownMenu}
          modalContentContainerStyle={styles.dropdownModalContent}
        />
        {validateStep1 && !selectedCity && selectedState && <Text style={styles.validationHint}>Please choose a city.</Text>}
      </View>

      {validateStep1 && ground.trim() === '' ? <Text style={styles.validationHint}>Ground cannot be empty.</Text> : null}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Organizer Info</Text>
      <Text style={styles.stepDescription}>Enter details about the tournament organizer</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Organizer Name</Text>
        <TextInput
          style={[styles.textInput, styles.readOnlyInput]}
          placeholder="e.g. John Doe"
          value={organizerName}
          editable={false}
          selectTextOnFocus={false}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Organizer Contact</Text>
        <TextInput
          style={[styles.textInput, styles.readOnlyInput]}
          keyboardType="phone-pad"
          placeholder="+91 98765 43210"
          value={organizerContact}
          editable={false}
          selectTextOnFocus={false}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Total Teams</Text>
        <View style={styles.teamOptionsContainer}>
          {TEAM_OPTIONS.map((option) => {
            const isSelected = totalTeams === String(option);
            return (
              <TouchableOpacity
                key={option}
                style={[styles.teamOptionChip, isSelected && styles.teamOptionChipSelected]}
                onPress={() => setTotalTeams(String(option))}
                activeOpacity={0.85}
              >
                <Text style={[styles.teamOptionText, isSelected && styles.teamOptionTextSelected]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={[styles.textInput, styles.customTeamsInput]}
          placeholder="Or enter even number (max 30)"
          value={totalTeams}
          onChangeText={(value) => setTotalTeams(normalizeTeamsInput(value))}
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={2}
        />
        {totalTeams !== '' && !isValidTotalTeams(totalTeams) ? (
          <Text style={styles.validationHint}>Enter an even number up to 30</Text>
        ) : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Entry Fees</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Enter Entry Fees"
          value={entryFees}
          onChangeText={(value) => setEntryFees(normalizeAmountInput(value))}
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={9}
        />
        {entryFees !== '' && !isValidAmount(entryFees) ? (
          <Text style={styles.validationHint}>Enter a valid numeric amount</Text>
        ) : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Prize</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Enter Prize"
          value={prize}
          onChangeText={(value) => setPrize(normalizeAmountInput(value))}
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={9}
        />
        {prize !== '' && !isValidAmount(prize) ? (
          <Text style={styles.validationHint}>Enter a valid numeric amount</Text>
        ) : null}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Schedule & Match</Text>
      <Text style={styles.stepDescription}>Set the dates and match details</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Start Date</Text>
        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={formatDateForInput(startDate)}
            onChange={(event: any) => {
              const parsed = parseInputDate(event?.target?.value || '');
              if (!parsed) return;

              setStartDate(parsed);
              if (parsed.getTime() > endDate.getTime()) {
                setEndDate(parsed);
              }
            }}
            style={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#E5E7EB',
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: 16,
              fontFamily: 'Inter-Regular',
              color: '#111827',
            }}
          />
        ) : (
          <>
            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateButton}>
              <Calendar size={16} color="#555" />
              <Text style={styles.dateText}>{startDate.toDateString()}</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowStartPicker(false);
                  if (selectedDate) setStartDate(selectedDate);
                }}
              />
            )}
          </>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>End Date</Text>
        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={formatDateForInput(endDate)}
            min={formatDateForInput(startDate)}
            onChange={(event: any) => {
              const parsed = parseInputDate(event?.target?.value || '');
              if (!parsed) return;
              if (parsed.getTime() < startDate.getTime()) {
                setEndDate(startDate);
                return;
              }
              setEndDate(parsed);
            }}
            style={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#E5E7EB',
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: 16,
              fontFamily: 'Inter-Regular',
              color: '#111827',
            }}
          />
        ) : (
          <>
            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateButton}>
              <Calendar size={16} color="#555" />
              <Text style={styles.dateText}>{endDate.toDateString()}</Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowEndPicker(false);
                  if (selectedDate) setEndDate(selectedDate);
                }}
              />
            )}
          </>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Ball Type</Text>
        <View style={styles.optionsContainer}>
          {['Tennis', 'Rubber', 'Leather'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.optionButton, ballType === type && styles.selectedButton]}
              onPress={() => setBallType(type)}
            >
              <Text style={styles.optionText}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Match Type</Text>
        <View style={styles.optionsContainer}>
          {['Limited Overs', 'One Day', 'Test Match'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.optionButton, matchType === type && styles.selectedButton]}
              onPress={() => setMatchType(type)}
            >
              <Text style={styles.optionText}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Tournament Type</Text>
        <View style={styles.optionsContainer}>
          {['Turf', 'Open Ground'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.optionButton, tournamentType === type && styles.selectedButton]}
              onPress={() => setTournamentType(type)}
            >
              <Text style={styles.optionText}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {endDate.getTime() < startDate.getTime() ? (
        <Text style={styles.validationHint}>End date must be on or after start date.</Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Tournament</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.stepIndicator}>
          {[1, 2, 3].map((stepNum) => (
            <View key={stepNum} style={styles.stepRow}>
              <View style={[
                styles.stepCircle,
                step >= stepNum && styles.stepCircleActive
              ]}>
                <Text style={[
                  styles.stepNumber,
                  step >= stepNum && styles.stepNumberActive
                ]}>{stepNum}</Text>
              </View>
              {stepNum < 3 && (
                <View style={[
                  styles.stepLine,
                  step > stepNum && styles.stepLineActive
                ]} />
              )}
            </View>
          ))}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backStepButton}
              onPress={back}
            >
              <Text style={styles.backStepText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.nextButton,
              (!canProceed()) && styles.nextButtonDisabled,
              loading && styles.nextButtonDisabled
            ]}
            onPress={() => {
              if (step < totalSteps) {
                if (step === 1 && !canProceed()) {
                  setValidateStep1(true);
                  return;
                }
                setValidateStep1(false);
                next();
              } else {
                handleCreateTournament();
              }
            }}
            disabled={(!canProceed()) || loading}
          >
            <Text style={styles.nextButtonText}>
              {step === totalSteps ? (loading ? 'Creating...' : 'Create Tournament') : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  dropdownModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#F8FAFC',
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 20,
    maxHeight: 700,
  },
  dropdownPlaceholder: {
    color: '#94A3B8',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
  },
  dropdownText: {
    color: '#111827',
    fontSize: 15,
    fontFamily: 'Inter-Medium',
  },
  dropdownField: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  dropdownItem: {
    borderRadius: 14,
    marginHorizontal: 8,
    marginVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  dropdownItemSelected: {
    backgroundColor: '#DCFCE7',
  },
  dropdownSearchContainer: {
    borderBottomWidth: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#F8FAFC',
  },
  dropdownSearchInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 15,
  },
  dropdownTick: {
    tintColor: '#16A34A',
  },
  dropdownArrow: {
    tintColor: '#6B7280',
  },
  previewSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#9CA3AF',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#22C55E',
  },
  stepNumber: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#9CA3AF',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#22C55E',
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  suggestionBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    zIndex: 20,
    elevation: 12,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    width: '100%',
    alignItems: 'flex-start',
  },
  suggestionText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    width: '100%',
    lineHeight: 20,
  },
  suggestionMeta: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  readOnlyInput: {
    backgroundColor: '#F9FAFB',
    color: '#6B7280',
  },
  teamOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamOptionChip: {
    minWidth: 56,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  teamOptionChipSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#DCFCE7',
  },
  teamOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  teamOptionTextSelected: {
    color: '#166534',
  },
  validationHint: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
  },
  customTeamsInput: {
    marginTop: 12,
  },
  teamPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  addPlayerForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rolesContainer: {
    paddingVertical: 8,
  },
  roleOption: {
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    minWidth: 100,
  },
  roleOptionActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  roleIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  roleName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  roleNameActive: {
    color: '#FFFFFF',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 16,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  playersSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  playerInfo: {
    flex: 1,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  playerName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  playerBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  captainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  captainText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#F59E0B',
    marginLeft: 2,
  },
  viceCaptainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  viceCaptainText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#3B82F6',
    marginLeft: 2,
  },
  playerRole: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  playerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryTeamName: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  summaryPlayers: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  roleDistribution: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  roleCount: {
    alignItems: 'center',
  },
  roleCountIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  roleCountText: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  roleCountLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  leadership: {
    gap: 12,
  },
  leadershipItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadershipText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginLeft: 8,
  },
  requirements: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requirementsTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkmark: {
    fontSize: 16,
    color: '#22C55E',
    marginRight: 12,
    width: 20,
  },
  cross: {
    fontSize: 16,
    color: '#EF4444',
    marginRight: 12,
    width: 20,
  },
  requirementText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  backStepButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  backStepText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  dropdown: {
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
    zIndex: 10000,
    marginTop: 4
  },
  dropdownContainer: {
    borderColor: '#ccc',
    overflow: 'scroll'
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  selectedButton: {
    backgroundColor: '#22C55E',
  },
  optionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  dateText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter-Regular',
  },
});

export default CreateTournament;