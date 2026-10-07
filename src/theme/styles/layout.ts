import { Platform, StyleSheet } from 'react-native';
import { fontFamily, radius, spacing } from '../tokens';
import { StyleContext, cardSurface, floatingSurface, tabularNums } from './helpers';

export function createLayoutStyles({ colors, scheme }: StyleContext) {
  return {
    content: {
      padding: spacing.xl,
      paddingTop: spacing.xs,
      gap: spacing.lg,
    },
    title: {
      fontSize: 30,
      letterSpacing: -0.6,
      color: colors.text,
      fontFamily: fontFamily.bold,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      marginTop: 2,
      fontFamily: fontFamily.regular,
    },
    sectionLabel: {
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textSubtle,
      fontFamily: fontFamily.semibold,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      gap: spacing.md,
      ...cardSurface(colors, scheme, 1),
    },
    cardElevated: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      gap: spacing.lg,
      ...cardSurface(colors, scheme, 2),
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    cardTitle: {
      fontSize: 17,
      letterSpacing: -0.2,
      color: colors.text,
      fontFamily: fontFamily.semibold,
    },
    cardSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      fontFamily: fontFamily.regular,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
  };
}
