import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { prefetchHomeInitialData } from './service/tournamentService';

export default function LaunchScreen() {
  const pulse = useRef(new Animated.Value(1)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1050,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1050,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -8,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.5,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0.2,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );

    pulseLoop.start();
    floatLoop.start();
    glowLoop.start();

    // Warm up initial home APIs while launch animation is playing.
    prefetchHomeInitialData('Chennai');

    const timer = setTimeout(() => {
      router.replace('/(tabs)');
    }, 5000);

    return () => {
      clearTimeout(timer);
      pulseLoop.stop();
      floatLoop.stop();
      glowLoop.stop();
    };
  }, [floatY, glow, pulse]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <Animated.View style={[styles.glowRing, { opacity: 0 }]} />
      <Animated.View style={[styles.glowRingInner, { opacity: 0 }]} />

      <Animated.View style={[styles.logoWrap, { transform: [{ scale: pulse }, { translateY: floatY }] }]}>
        <Image
          source={require('../assets/images/hub/logo-name-new-transparent.png')}
          style={styles.legacyLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandSubheading}>All Sports. One Tournament Hub.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  glowRing: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  glowRingInner: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  logoWrap: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: 'center',
  },
  legacyLogo: {
    width: 344,
    height: 196,
    opacity: 0.97,
  },
  brandSubheading: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 14,
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
