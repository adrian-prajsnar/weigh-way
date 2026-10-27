import { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { formatChartWeightRange } from '../format';
import { useUnits } from '../context/unit-context';
import { useTranslation } from '../i18n/language-context';
import { getDateLocale } from '../i18n/resolve-locale';
import { dateKeyToDate } from '../stats';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { layoutWidth } from '../theme/tokens';
import { WeightSeries } from '../types';
import { EmptyState } from './empty-state';

const PADDING_X = 6;
const PADDING_Y = 14;

type Point = { x: number; y: number };

function buildSmoothPath(points: Point[]): string {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const midX = (previous.x + current.x) / 2;
    path += ` C ${midX} ${previous.y} ${midX} ${current.y} ${current.x} ${current.y}`;
  }
  return path;
}

type WeightChartProps = {
  series: WeightSeries;
  height?: number;
};

export function WeightChart({ series, height = 160 }: WeightChartProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t, locale } = useTranslation();
  const { units } = useUnits();
  const [width, setWidth] = useState(0);
  const dateLocale = getDateLocale(locale);

  const formatAxisDate = (dateKey: string): string =>
    dateKeyToDate(dateKey).toLocaleDateString(dateLocale, {
      month: 'short',
      day: 'numeric',
    });

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  if (series.points.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <EmptyState
          icon="trending-up-outline"
          title={t('chart.noDataTitle')}
          message={t('chart.noDataMessage')}
        />
      </View>
    );
  }

  const chartHeight = width > layoutWidth.sheet ? 200 : height;
  const innerWidth = Math.max(width - PADDING_X * 2, 1);
  const innerHeight = chartHeight - PADDING_Y * 2;

  const span = series.max - series.min;
  const padding = span === 0 ? 1 : span * 0.15;
  const yMin = series.min - padding;
  const yMax = series.max + padding;

  const firstTime = dateKeyToDate(series.points[0].date).getTime();
  const lastTime = dateKeyToDate(series.points[series.points.length - 1].date).getTime();
  const timeSpan = lastTime - firstTime;

  const points: Point[] = series.points.map((entry, index) => {
    const time = dateKeyToDate(entry.date).getTime();
    const ratio =
      timeSpan === 0
        ? series.points.length === 1
          ? 0.5
          : index / (series.points.length - 1)
        : (time - firstTime) / timeSpan;
    return {
      x: PADDING_X + ratio * innerWidth,
      y: PADDING_Y + (1 - (entry.weightKg - yMin) / (yMax - yMin)) * innerHeight,
    };
  });

  const linePath = buildSmoothPath(points);
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`
      : '';
  const lastPoint = points[points.length - 1];

  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ gap: 8 }}>
      <View style={[styles.chartArea, { height: chartHeight }]} onLayout={handleLayout}>
        {width > 0 ? (
          <Svg width={width} height={chartHeight}>
            <Defs>
              <LinearGradient id="weightChartFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.accent} stopOpacity={0.28} />
                <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {areaPath ? <Path d={areaPath} fill="url(#weightChartFill)" /> : null}
            <Path
              d={linePath}
              stroke={colors.accent}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={7}
              fill={colors.accent}
              opacity={0.18}
            />
            <Circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={4}
              fill={colors.accent}
              stroke={colors.surface}
              strokeWidth={2}
            />
          </Svg>
        ) : null}
      </View>
      <View style={styles.chartAxisRow}>
        <Text style={styles.chartAxisLabel}>{formatAxisDate(series.points[0].date)}</Text>
        <Text style={styles.chartAxisLabel}>
          {formatChartWeightRange(series.min, series.max, units, locale)}
        </Text>
        <Text style={styles.chartAxisLabel}>
          {formatAxisDate(series.points[series.points.length - 1].date)}
        </Text>
      </View>
    </Animated.View>
  );
}
