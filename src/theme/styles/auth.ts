import { Platform, StyleSheet } from 'react-native';
import { fontFamily, layoutWidth, radius, spacing } from '../tokens';
import { StyleContext, cardSurface, floatingSurface, tabularNums } from './helpers';

export function createAuthStyles({ colors, scheme }: StyleContext) {
  return {
    authMain: {
      flex: 1,
    },
    authContent: {
      flexGrow: 1,
      padding: spacing.xl,
      paddingTop: 64,
      paddingBottom: spacing.lg,
      gap: spacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    authFrame: {
      width: '100%',
      maxWidth: layoutWidth.auth,
      gap: spacing.lg,
    },
    authBrand: {
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    authHeader: {
      alignItems: 'center',
      gap: spacing.lg,
      marginBottom: spacing.sm,
    },
    authHeading: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    authTitle: {
      fontSize: 30,
      letterSpacing: -0.6,
      color: colors.text,
      textAlign: 'center',
      fontFamily: fontFamily.bold,
    },
    authSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: 'center',
      fontFamily: fontFamily.regular,
    },
    authLogo: {
      width: 64,
      height: 64,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    authBrandFooter: {
      alignItems: 'center',
      gap: 2,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    authBrandFooterName: {
      fontSize: 12,
      letterSpacing: 0.2,
      color: colors.textSubtle,
      textAlign: 'center',
      fontFamily: fontFamily.semibold,
    },
    authBrandFooterTagline: {
      fontSize: 11,
      lineHeight: 16,
      color: colors.textSubtle,
      textAlign: 'center',
      fontFamily: fontFamily.regular,
    },
    authBackdrop: {
      ...StyleSheet.absoluteFill,
      height: 360,
    },
    linkText: {
      textAlign: 'center',
      color: colors.accent,
      fontSize: 15,
      fontFamily: fontFamily.semibold,
    },
    authInlineLink: {
      alignSelf: 'flex-end',
      marginTop: -spacing.xs,
      marginBottom: spacing.xs,
    },
    authNotice: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.sm + 2,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    authNoticeText: {
      fontSize: 14,
      color: colors.accentText,
      lineHeight: 20,
      fontFamily: fontFamily.regular,
    },
    infoBanner: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    infoBannerHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    infoBannerText: {
      flex: 1,
      fontSize: 14,
      color: colors.accentText,
      lineHeight: 20,
      fontFamily: fontFamily.regular,
    },
    infoBannerLink: {
      alignSelf: 'flex-start',
      color: colors.accent,
      fontSize: 14,
      fontFamily: fontFamily.semibold,
    },
    oauthButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      paddingVertical: 15,
      paddingHorizontal: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 52,
    },
    oauthButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    oauthButtonText: {
      color: colors.text,
      fontSize: 16,
      fontFamily: fontFamily.semibold,
    },
    authOrDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    authOrDividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    authOrDividerText: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: fontFamily.regular,
      textTransform: 'uppercase',
    },
  };
}
