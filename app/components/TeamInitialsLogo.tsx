import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type TeamInitialsLogoProps = {
  name?: string | null;
  size?: number;
};

const COLORS = [
  ['#DCFCE7', '#166534'],
  ['#DBEAFE', '#1D4ED8'],
  ['#FEF3C7', '#92400E'],
  ['#FCE7F3', '#9D174D'],
  ['#EDE9FE', '#6D28D9'],
  ['#CFFAFE', '#0E7490'],
] as const;

const getInitials = (name?: string | null) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'TM';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const getColorPair = (name?: string | null) => {
  const value = String(name || 'team');
  const hash = Array.from(value).reduce((total, character) => total + character.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
};

export default function TeamInitialsLogo({ name, size = 48 }: TeamInitialsLogoProps) {
  const [backgroundColor, color] = getColorPair(name);

  return (
    <View
      accessibilityLabel={`${name || 'Team'} logo`}
      style={[
        styles.logo,
        {
          width: size,
          height: size,
          borderRadius: Math.max(8, Math.round(size * 0.24)),
          backgroundColor,
        },
      ]}
    >
      <Text style={[styles.initials, { color, fontSize: Math.max(12, Math.round(size * 0.34)) }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  initials: {
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0,
  },
});
