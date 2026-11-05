import { Platform, StyleSheet } from 'react-native';
import { fontFamily, radius, spacing } from '../tokens';
import { StyleContext, cardSurface, floatingSurface, tabularNums } from './helpers';

export function createScreenStyles({ colors, scheme }: StyleContext) {
  return {
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    screenHeader: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      backgroundColor: colors.background,
    },
    screenHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    screenHeaderHairline: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    contentFrame: {
      flex: 1,
      width: '100%',
      alignSelf: 'center',
    },
    filterActionsRow: {
      alignItems: 'flex-end',
      marginTop: spacing.sm,
      minHeight: 20,
    },
    comparisonFilterSection: {
      gap: spacing.md,
    },
    scrollView: {
      flex: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
}
