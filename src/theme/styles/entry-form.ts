import { Platform, StyleSheet } from 'react-native';
import { fontFamily, radius, spacing } from '../tokens';
import { webFocusRingBoxShadow } from '../web-focus-ring';
import { StyleContext, cardSurface, floatingSurface, tabularNums } from './helpers';

export function createEntryFormStyles({ colors, scheme }: StyleContext) {
  return {
    weightEntryRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: spacing.md,
      ...(Platform.OS === 'web'
        ? {
            margin: -spacing.xs,
            padding: spacing.xs,
            overflow: 'visible',
          }
        : null),
    },
    weightInputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.md,
    },
    weightInputWrapperFocused: {
      ...(Platform.OS === 'web'
        ? {
            boxShadow: webFocusRingBoxShadow(colors, 'control'),
          }
        : {
            borderColor: colors.accent,
          }),
    },
    weightInput: {
      flex: 1,
      textAlign: 'center',
      fontSize: 32,
      paddingVertical: spacing.md,
      color: colors.text,
      fontFamily: fontFamily.bold,
      ...tabularNums,
    },
    weightInputUnit: {
      fontSize: 16,
      color: colors.textMuted,
      fontFamily: fontFamily.medium,
    },
    stepperButton: {
      width: 52,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web'
        ? {
            position: 'relative',
            zIndex: 0,
          }
        : null),
    },
  };
}
