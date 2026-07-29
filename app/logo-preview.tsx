import { StatusBar } from 'expo-status-bar';
import { CircleDot, Crown, Radio, Shield, Sparkles, Star, Trophy, Users } from 'lucide-react-native';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LogoPreviewScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Custom Logo Concepts</Text>
        <Text style={styles.subtitle}>All logos below are custom-made inside the app code.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Design 1: Championship Seal</Text>
          <View style={styles.logoWrapCenter}>
            <View style={styles.sealOuter}>
              <View style={styles.sealInner}>
                <Trophy size={86} color="#FFFFFF" strokeWidth={2.2} />
              </View>
            </View>
          </View>
          <Text style={styles.brand}>TOURNAMENT HUB</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Design 2: Elite Shield</Text>
          <View style={styles.logoWrapCenter}>
            <View style={styles.shieldPanel}>
              <Shield size={88} color="#0F172A" strokeWidth={2.2} />
              <View style={styles.shieldStarRow}>
                <Star size={18} color="#D97706" fill="#F59E0B" />
                <Star size={18} color="#D97706" fill="#F59E0B" />
                <Star size={18} color="#D97706" fill="#F59E0B" />
              </View>
            </View>
          </View>
          <Text style={styles.brand}>TOURNAMENT HUB</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Design 3: Crown Emblem</Text>
          <View style={styles.logoWrapCenter}>
            <View style={styles.crownBadge}>
              <Sparkles size={20} color="#2563EB" />
              <Crown size={92} color="#1E3A8A" strokeWidth={2.1} />
            </View>
          </View>
          <Text style={styles.brand}>TOURNAMENT HUB</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Design 4: Night Monogram</Text>
          <View style={styles.logoWrapCenter}>
            <View style={styles.monogramBadge}>
              <View style={styles.monogramRing}>
                <Text style={styles.monogramText}>TH</Text>
              </View>
            </View>
          </View>
          <Text style={styles.brand}>TOURNAMENT HUB</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Design 5: Victory Crest</Text>
          <View style={styles.logoWrapCenter}>
            <View style={styles.crestBadge}>
              <View style={styles.crestTopRow}>
                <Star size={16} color="#F59E0B" fill="#FBBF24" />
                <Star size={20} color="#F59E0B" fill="#FBBF24" />
                <Star size={16} color="#F59E0B" fill="#FBBF24" />
              </View>
              <Trophy size={82} color="#FFFFFF" strokeWidth={2.1} />
            </View>
          </View>
          <Text style={styles.brand}>TOURNAMENT HUB</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Design 6: Modern Arena</Text>
          <View style={styles.logoWrapCenter}>
            <View style={styles.arenaBadge}>
              <View style={styles.arenaBeamLeft} />
              <View style={styles.arenaBeamRight} />
              <Shield size={74} color="#0F172A" strokeWidth={2.3} />
              <View style={styles.arenaDotRow}>
                <View style={styles.arenaDot} />
                <View style={styles.arenaDot} />
                <View style={styles.arenaDot} />
              </View>
            </View>
          </View>
          <Text style={styles.brand}>TOURNAMENT HUB</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Design 7: MultiSport Fusion</Text>
          <View style={styles.logoWrapCenter}>
            <View style={styles.fusionBadge}>
              <View style={styles.fusionOrbBlue} />
              <View style={styles.fusionOrbRed} />
              <View style={styles.fusionOrbGreen} />
              <View style={styles.fusionCore}>
                <Trophy size={72} color="#FFFFFF" strokeWidth={2.2} />
              </View>
            </View>
          </View>
          <Text style={styles.brand}>TOURNAMENT HUB</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Design 8: Live Match Pulse</Text>
          <View style={styles.logoWrapCenter}>
            <View style={styles.liveBadge}>
              <View style={styles.livePulseRingOne} />
              <View style={styles.livePulseRingTwo} />
              <Radio size={64} color="#DC2626" strokeWidth={2.2} />
              <View style={styles.liveBottomRow}>
                <CircleDot size={16} color="#DC2626" fill="#DC2626" />
                <Users size={20} color="#0F172A" strokeWidth={2.2} />
                <CircleDot size={16} color="#0EA5E9" fill="#0EA5E9" />
              </View>
            </View>
          </View>
          <Text style={styles.brand}>TOURNAMENT HUB</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Design 9: Organizer Nexus</Text>
          <View style={styles.logoWrapCenter}>
            <View style={styles.nexusBadge}>
              <View style={styles.nexusTopBand} />
              <View style={styles.nexusIconRow}>
                <Shield size={30} color="#1D4ED8" strokeWidth={2.2} />
                <Trophy size={34} color="#D97706" strokeWidth={2.2} />
                <Users size={30} color="#059669" strokeWidth={2.2} />
              </View>
              <Text style={styles.nexusTH}>TH</Text>
            </View>
          </View>
          <Text style={styles.brand}>TOURNAMENT HUB</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Design 10: Brand Legacy Remix</Text>
          <View style={styles.logoWrapCenter}>
            <View style={styles.legacyWrap}>
              <View style={styles.legacyHalo} />
              <Image
                source={require('../assets/images/hub/logo-name-512.png')}
                style={styles.legacyLogo}
                resizeMode="contain"
              />
              <View style={styles.legacyChipRow}>
                <View style={[styles.legacyChip, { backgroundColor: '#2563EB' }]} />
                <View style={[styles.legacyChip, { backgroundColor: '#22C55E' }]} />
                <View style={[styles.legacyChip, { backgroundColor: '#F59E0B' }]} />
                <View style={[styles.legacyChip, { backgroundColor: '#EF4444' }]} />
              </View>
            </View>
          </View>
          <Text style={styles.brand}>TOURNAMENT HUB</Text>
        </View>

        <Text style={styles.footerNote}>Tell me: use Design 1 to 10 for launch screen.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 18,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 28,
    color: '#0F172A',
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    marginTop: 2,
    marginBottom: 4,
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    color: '#334155',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 14,
  },
  logoWrapCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sealOuter: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealInner: {
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 3,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldPanel: {
    width: 176,
    height: 176,
    borderRadius: 28,
    backgroundColor: '#E0E7FF',
    borderWidth: 2,
    borderColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  shieldStarRow: {
    flexDirection: 'row',
    gap: 8,
  },
  crownBadge: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: '#DBEAFE',
    borderWidth: 2,
    borderColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  monogramBadge: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    color: '#FFFFFF',
    fontSize: 48,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 1,
  },
  crestBadge: {
    width: 176,
    height: 176,
    borderRadius: 28,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  crestTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arenaBadge: {
    width: 176,
    height: 176,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 8,
  },
  arenaBeamLeft: {
    position: 'absolute',
    left: -22,
    top: 20,
    width: 90,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DBEAFE',
    transform: [{ rotate: '-28deg' }],
  },
  arenaBeamRight: {
    position: 'absolute',
    right: -22,
    top: 20,
    width: 90,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DBEAFE',
    transform: [{ rotate: '28deg' }],
  },
  arenaDotRow: {
    flexDirection: 'row',
    gap: 7,
  },
  arenaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0EA5E9',
  },
  fusionBadge: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fusionOrbBlue: {
    position: 'absolute',
    top: 22,
    left: 26,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2563EB',
    opacity: 0.8,
  },
  fusionOrbRed: {
    position: 'absolute',
    top: 22,
    right: 26,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EF4444',
    opacity: 0.8,
  },
  fusionOrbGreen: {
    position: 'absolute',
    bottom: 22,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#22C55E',
    opacity: 0.82,
  },
  fusionCore: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  liveBadge: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  livePulseRingOne: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#FCA5A5',
    opacity: 0.6,
  },
  livePulseRingTwo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: '#F87171',
    opacity: 0.65,
  },
  liveBottomRow: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nexusBadge: {
    width: 176,
    height: 176,
    borderRadius: 24,
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#7DD3FC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nexusTopBand: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: 34,
    backgroundColor: '#0EA5E9',
    opacity: 0.2,
  },
  nexusIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  nexusTH: {
    color: '#0F172A',
    fontSize: 40,
    letterSpacing: 1,
    fontFamily: 'Poppins-Bold',
  },
  legacyWrap: {
    width: 212,
    height: 212,
    borderRadius: 106,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  legacyHalo: {
    position: 'absolute',
    width: 184,
    height: 184,
    borderRadius: 92,
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  legacyLogo: {
    width: 176,
    height: 98,
  },
  legacyChipRow: {
    position: 'absolute',
    bottom: 18,
    flexDirection: 'row',
    gap: 7,
  },
  legacyChip: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  brand: {
    textAlign: 'center',
    color: '#0F172A',
    fontSize: 24,
    letterSpacing: 0.8,
    fontFamily: 'Poppins-Bold',
  },
  footerNote: {
    marginTop: 8,
    textAlign: 'center',
    color: '#475569',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
});
