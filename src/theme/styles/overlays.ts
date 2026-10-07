import { Platform, StyleSheet } from 'react-native';
import { fontFamily, layoutWidth, radius, spacing } from '../tokens';
import { WEB_FOCUS_RING_OUTER_SPREAD } from '../web-focus-ring';
import { StyleContext, cardSurface, floatingSurface, tabularNums } from './helpers';

export function createOverlayStyles({ colors, scheme }: StyleContext) {
  return {
    toastRoot: {
      flex: 1,
    },

    overlayRoot: {
      flex: 1,
    },
    modalBackdropCentered: {
      flex: 1,
      backgroundColor: scheme === 'dark' ? 'rgba(0, 0, 0, 0.62)' : 'rgba(15, 23, 42, 0.42)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    confirmDialogFrame: {
      width: '100%',
      maxWidth: layoutWidth.dialog,
      zIndex: 1,
      ...(Platform.OS === 'web'
        ? {
            padding: WEB_FOCUS_RING_OUTER_SPREAD,
            overflow: 'visible',
          }
        : null),
    },
    confirmDialogCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      gap: spacing.md,
      borderWidth: scheme === 'dark' ? 1 : StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      ...(Platform.OS === 'web'
        ? {
            overflow: 'visible',
            margin: -WEB_FOCUS_RING_OUTER_SPREAD,
            padding: spacing.xl + WEB_FOCUS_RING_OUTER_SPREAD,
          }
        : null),
    },
    confirmDialogTitle: {
      fontSize: 18,
      color: colors.text,
      fontFamily: fontFamily.semibold,
    },
    confirmDialogMessage: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
      fontFamily: fontFamily.regular,
    },
    confirmDialogActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    confirmDialogButton: {
      flex: 1,
      minHeight: 46,
    },
    confirmDialogDestructiveButton: {
      backgroundColor: colors.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 46,
    },
    confirmDialogDestructiveButtonText: {
      color: colors.onAccent,
      fontSize: 15,
      fontFamily: fontFamily.semibold,
    },
    modalSheetBackdrop: {
      flex: 1,
      backgroundColor: scheme === 'dark' ? 'rgba(0, 0, 0, 0.62)' : 'rgba(15, 23, 42, 0.42)',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    modalSheetDismissArea: {
      flex: 1,
      alignSelf: 'stretch',
      ...(Platform.OS === 'web'
        ? {
            marginTop: spacing.sm,
            marginHorizontal: spacing.sm,
          }
        : null),
    },
    datePickerSheet: {
      width: '100%',
      maxWidth: layoutWidth.sheet,
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      borderTopWidth: scheme === 'dark' ? 1 : StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    datePickerSheetFloating: {
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
      marginBottom: spacing.lg,
    },
    datePickerSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    datePickerSheetTitle: {
      flex: 1,
      fontSize: 18,
      color: colors.text,
      fontFamily: fontFamily.semibold,
    },
    datePickerSheetConfirm: {
      marginTop: spacing.xs,
    },
    datePickerPeriodRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    datePickerPeriodButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    datePickerPeriodButtonActive: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
    },
    datePickerPeriodButtonText: {
      fontSize: 15,
      color: colors.text,
      fontFamily: fontFamily.semibold,
    },
    datePickerPeriodButtonTextActive: {
      color: colors.accentText,
    },
    datePickerMonthGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    datePickerMonthCell: {
      width: '30%',
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: spacing.md,
    },
    datePickerMonthCellSelected: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.accent,
    },
    datePickerMonthCellDisabled: {
      opacity: 0.4,
    },
    datePickerMonthCellText: {
      fontSize: 14,
      color: colors.text,
      fontFamily: fontFamily.medium,
    },
    datePickerMonthCellTextSelected: {
      color: colors.onAccent,
      fontFamily: fontFamily.semibold,
    },
    datePickerMonthCellTextDisabled: {
      color: colors.textSubtle,
    },
    datePickerYearList: {
      maxHeight: 240,
    },
    datePickerYearListContent: {
      paddingVertical: spacing.xs,
    },
    datePickerYearRow: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      marginBottom: spacing.xs,
    },
    datePickerYearRowSelected: {
      backgroundColor: colors.accentSoft,
    },
    datePickerYearRowText: {
      fontSize: 16,
      color: colors.text,
      fontFamily: fontFamily.medium,
    },
    datePickerYearRowTextSelected: {
      color: colors.accentText,
      fontFamily: fontFamily.semibold,
    },
    toastContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      zIndex: 100,
    },
    toastCard: {
      width: '100%',
      maxWidth: layoutWidth.toast,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderWidth: 1,
      borderLeftWidth: 4,
      ...(scheme === 'dark'
        ? {
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 16,
            elevation: 8,
          }
        : {}),
    },
    toastTextGroup: {
      flex: 1,
      gap: 2,
    },
    toastCloseButton: {
      alignSelf: 'flex-start',
      marginTop: 1,
    },
    toastCardSuccess: {
      backgroundColor: colors.successSoft,
      borderColor: colors.successBorder,
      borderLeftColor: colors.success,
    },
    toastCardError: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.dangerBorder,
      borderLeftColor: colors.danger,
    },
    toastCardInfo: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentBorder,
      borderLeftColor: colors.accent,
    },
    toastTitle: {
      fontSize: 14,
      fontFamily: fontFamily.semibold,
    },
    toastTitleSuccess: {
      color: colors.successText,
    },
    toastTitleError: {
      color: colors.dangerText,
    },
    toastTitleInfo: {
      color: colors.accentText,
    },
    toastMessage: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: fontFamily.regular,
    },
    toastMessageSuccess: {
      color: colors.successText,
    },
    toastMessageError: {
      color: colors.dangerText,
    },
    toastMessageInfo: {
      color: colors.accentText,
    },

    loadingCard: {
      position: 'relative',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.overlay,
      borderRadius: radius.lg,
      zIndex: 2,
    },
    skeletonBlock: {
      backgroundColor: colors.skeleton,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    skeletonShimmer: {
      ...StyleSheet.absoluteFill,
    },

    tabBar: {
      flexDirection: 'row',
      position: 'absolute',
      borderRadius: radius.xl,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
      ...floatingSurface(colors, scheme),
    },
    tabBarItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
    },
    tabBarLabel: {
      fontSize: 11,
      fontFamily: fontFamily.medium,
    },
    tabBarIndicator: {
      position: 'absolute',
      top: spacing.sm,
      bottom: spacing.sm,
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
    },
  };
}
