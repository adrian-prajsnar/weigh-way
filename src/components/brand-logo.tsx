import Svg, { Polyline } from 'react-native-svg';
import { View } from 'react-native';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';

/** Rising geometric W — left arm shorter, right arm taller. Keep in sync with scripts/generate-brand-assets.mjs and website/src/components/brand-logo.astro. */
const BRAND_MARK_VIEWBOX = '0 0 32 32';
const BRAND_MARK_POINTS = '5,7.5 11,19 16,12.5 22.5,24.8 27,7.5';
const BRAND_MARK_STROKE_WIDTH = 3.6;

type BrandLogoProps = {
  size?: number;
};

export function BrandLogo({ size = 64 }: BrandLogoProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const markSize = Math.round(size * 0.56);

  return (
    <View
      style={[
        styles.authLogo,
        {
          width: size,
          height: size,
          backgroundColor: colors.accentSoft,
        },
      ]}
    >
      <Svg width={markSize} height={markSize} viewBox={BRAND_MARK_VIEWBOX}>
        <Polyline
          points={BRAND_MARK_POINTS}
          fill="none"
          stroke={colors.accent}
          strokeWidth={BRAND_MARK_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
