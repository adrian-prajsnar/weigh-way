import { Platform, StyleSheet } from 'react-native';
import { fontFamily, radius, spacing } from '../tokens';
import { webFocusRingBoxShadow } from '../web-focus-ring';
import { StyleContext, cardSurface, floatingSurface, tabularNums } from './helpers';

export function createFormStyles({ colors, scheme }: StyleContext) {
  return {
    fieldLabel: {
      fontSize: 13,
      color: colors.textMuted,
      fontFamily: fontFamily.medium,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: Platform.OS === 'ios' ? 14 : 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surfaceMuted,
      fontFamily: fontFamily.regular,
    },
    inputFocused: {
      ...(Platform.OS === 'web'
        ? {
            boxShadow: webFocusRingBoxShadow(colors, 'control'),
            backgroundColor: colors.surface,
          }
        : {
            borderColor: colors.accent,
            backgroundColor: colors.surface,
          }),
    },
    passwordFieldGroup: {
      gap: spacing.sm,
    },
    passwordField: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      paddingRight: spacing.sm,
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: Platform.OS === 'ios' ? 14 : 12,
      fontSize: 16,
      color: colors.text,
      fontFamily: fontFamily.regular,
    },
    passwordToggle: {
      padding: spacing.sm,
    },
    dateButton: {
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surfaceMuted,
    },
    dateButtonValue: {
      fontSize: 16,
      color: colors.text,
      fontFamily: fontFamily.medium,
    },
    dateButtonReadOnly: {
      backgroundColor: colors.surfaceSunken,
    },
    dateButtonInStepper: {
      flex: 1,
    },
    dateButtonInvalid: {
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
    },

    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 15,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    primaryButtonText: {
      color: colors.onAccent,
      fontSize: 16,
      fontFamily: fontFamily.semibold,
    },
    secondaryButton: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 46,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 15,
      fontFamily: fontFamily.semibold,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.985 }],
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    iconButtonDanger: {
      backgroundColor: colors.dangerSoft,
    },

    presetScroll: {
      marginHorizontal: -spacing.xl,
      // Room for inset focus rings inside horizontal scroll views.
      marginVertical: -spacing.xs,
    },
    presetScrollContent: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xs,
    },
    presetButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceMuted,
    },
    presetButtonActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    presetButtonText: {
      color: colors.textMuted,
      fontSize: 14,
      fontFamily: fontFamily.medium,
    },
    presetButtonTextActive: {
      color: colors.accentText,
      fontFamily: fontFamily.semibold,
    },

    segmentedTrack: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSunken,
      borderRadius: radius.md,
      padding: 4,
      position: 'relative',
    },
    segmentedIndicator: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      left: 0,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: scheme === 'dark' ? 1 : StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    segmentedItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm + 1,
      borderRadius: radius.sm,
    },
    segmentedLabel: {
      fontSize: 13,
      color: colors.textMuted,
      fontFamily: fontFamily.medium,
    },
    segmentedLabelActive: {
      color: colors.text,
      fontFamily: fontFamily.semibold,
    },
  };
}
