import { router } from 'expo-router';
import { ArrowLeft, Clock, Trophy, Users } from 'lucide-react-native';
import { useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MY_TEAMS = [
  {
    id: 1,
    name: 'Thunder Bolts',
    players: 11,
    image: 'https://images.pexels.com/photos/540518/pexels-photo-540518.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: 2,
    name: 'City Warriors',
    players: 15,
    image: 'https://images.pexels.com/photos/274506/pexels-photo-274506.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
];

const OPPONENT_TEAMS = [
  {
    id: 3,
    name: 'Royal Challengers',
    players: 12,
    image: 'https://images.pexels.com/photos/358042/pexels-photo-358042.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: 4,
    name: 'Mumbai Indians',
    players: 14,
    image: 'https://images.pexels.com/photos/163452/basketball-dunk-blue-game-163452.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: 5,
    name: 'Chennai Super Kings',
    players: 13,
    image: 'https://images.pexels.com/photos/1618200/pexels-photo-1618200.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
];

const MATCH_FORMATS = [
  {
    id: 'test',
    name: 'Test Match',
    description: '5 days, unlimited overs',
    duration: '5 Days',
    icon: '🏏',
  },
  {
    id: 'odi',
    name: 'One Day International',
    description: '50 overs per side',
    duration: '1 Day',
    icon: '🌅',
  },
  {
    id: 't20',
    name: 'T20 Match',
    description: '20 overs per side',
    duration: '3 Hours',
    icon: '⚡',
  },
  {
    id: 't10',
    name: 'T10 Match',
    description: '10 overs per side',
    duration: '90 Minutes',
    icon: '🚀',
  },
];

export default function StartMatchScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedMyTeam, setSelectedMyTeam] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleStartMatch = async () => {
    if (!selectedMyTeam || !selectedOpponent || !selectedFormat) {
      Alert.alert('Error', 'Please complete all steps');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Match Started!',
        `${selectedMyTeam.name} vs ${selectedOpponent.name} ${selectedFormat.name} has been created. Good luck!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to start match. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={styles.stepRow}>
          <View style={[
            styles.stepCircle,
            currentStep >= step && styles.stepCircleActive
          ]}>
            <Text style={[
              styles.stepNumber,
              currentStep >= step && styles.stepNumberActive
            ]}>{step}</Text>
          </View>
          {step < 3 && (
            <View style={[
              styles.stepLine,
              currentStep > step && styles.stepLineActive
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Your Team</Text>
      <Text style={styles.stepDescription}>Choose which team you want to play with</Text>

      {MY_TEAMS.map((team) => (
        <TouchableOpacity
          key={team.id}
          style={[
            styles.teamCard,
            selectedMyTeam?.id === team.id && styles.teamCardSelected
          ]}
          onPress={() => setSelectedMyTeam(team)}
        >
          <Image source={{ uri: team.image }} style={styles.teamImage} />
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{team.name}</Text>
            <View style={styles.teamDetail}>
              <Users size={16} color="#6B7280" />
              <Text style={styles.teamDetailText}>{team.players} players</Text>
            </View>
          </View>
          {selectedMyTeam?.id === team.id && (
            <View style={styles.selectedIndicator}>
              <Text style={styles.selectedText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Choose Opponent</Text>
      <Text style={styles.stepDescription}>Select the team you want to play against</Text>

      {OPPONENT_TEAMS.map((team) => (
        <TouchableOpacity
          key={team.id}
          style={[
            styles.teamCard,
            selectedOpponent?.id === team.id && styles.teamCardSelected
          ]}
          onPress={() => setSelectedOpponent(team)}
        >
          <Image source={{ uri: team.image }} style={styles.teamImage} />
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{team.name}</Text>
            <View style={styles.teamDetail}>
              <Users size={16} color="#6B7280" />
              <Text style={styles.teamDetailText}>{team.players} players</Text>
            </View>
          </View>
          {selectedOpponent?.id === team.id && (
            <View style={styles.selectedIndicator}>
              <Text style={styles.selectedText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Match Format</Text>
      <Text style={styles.stepDescription}>Choose the format for your cricket match</Text>

      {MATCH_FORMATS.map((format) => (
        <TouchableOpacity
          key={format.id}
          style={[
            styles.formatCard,
            selectedFormat?.id === format.id && styles.formatCardSelected
          ]}
          onPress={() => setSelectedFormat(format)}
        >
          <View style={styles.formatIcon}>
            <Text style={styles.formatIconText}>{format.icon}</Text>
          </View>
          <View style={styles.formatInfo}>
            <Text style={styles.formatName}>{format.name}</Text>
            <Text style={styles.formatDescription}>{format.description}</Text>
            <View style={styles.formatDetail}>
              <Clock size={14} color="#6B7280" />
              <Text style={styles.formatDuration}>{format.duration}</Text>
            </View>
          </View>
          {selectedFormat?.id === format.id && (
            <View style={styles.selectedIndicator}>
              <Text style={styles.selectedText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      {selectedMyTeam && selectedOpponent && selectedFormat && (
        <View style={styles.matchPreview}>
          <Text style={styles.previewTitle}>Match Preview</Text>
          <View style={styles.vsContainer}>
            <View style={styles.teamPreview}>
              <Image source={{ uri: selectedMyTeam.image }} style={styles.previewImage} />
              <Text style={styles.previewTeamName}>{selectedMyTeam.name}</Text>
            </View>
            <View style={styles.vsText}>
              <Text style={styles.vs}>VS</Text>
            </View>
            <View style={styles.teamPreview}>
              <Image source={{ uri: selectedOpponent.image }} style={styles.previewImage} />
              <Text style={styles.previewTeamName}>{selectedOpponent.name}</Text>
            </View>
          </View>
          <View style={styles.matchDetails}>
            <View style={styles.matchDetail}>
              <Trophy size={16} color="#22C55E" />
              <Text style={styles.matchDetailText}>{selectedFormat.name}</Text>
            </View>
            <View style={styles.matchDetail}>
              <Clock size={16} color="#22C55E" />
              <Text style={styles.matchDetailText}>{selectedFormat.duration}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start Match</Text>
        <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.homeButtonText}>Home</Text>
        </TouchableOpacity>
      </View>

      {renderStepIndicator()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </ScrollView>

      <View style={styles.footer}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={styles.backStepButton}
            onPress={() => setCurrentStep(currentStep - 1)}
          >
            <Text style={styles.backStepText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextButton,
            (currentStep === 1 && !selectedMyTeam) && styles.nextButtonDisabled,
            (currentStep === 2 && !selectedOpponent) && styles.nextButtonDisabled,
            (currentStep === 3 && !selectedFormat) && styles.nextButtonDisabled,
            loading && styles.nextButtonDisabled
          ]}
          onPress={() => {
            if (currentStep < 3) {
              setCurrentStep(currentStep + 1);
            } else {
              handleStartMatch();
            }
          }}
          disabled={
            (currentStep === 1 && !selectedMyTeam) ||
            (currentStep === 2 && !selectedOpponent) ||
            (currentStep === 3 && !selectedFormat) ||
            loading
          }
        >
          <Text style={styles.nextButtonText}>
            {currentStep === 3 ? (loading ? 'Starting...' : 'Start Match') : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  homeButton: {
    minWidth: 48,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
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
    marginBottom: 24,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  teamCardSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  teamImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  teamDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
  },
  selectedIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  formatCardSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  formatIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  formatIconText: {
    fontSize: 24,
  },
  formatInfo: {
    flex: 1,
  },
  formatName: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  formatDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 6,
  },
  formatDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formatDuration: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 4,
  },
  matchPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  teamPreview: {
    alignItems: 'center',
    flex: 1,
  },
  previewImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
  },
  previewTeamName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    textAlign: 'center',
  },
  vsText: {
    paddingHorizontal: 20,
  },
  vs: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#22C55E',
  },
  matchDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  matchDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginLeft: 6,
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
});