import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing } from '../../theme';

export interface ActivityDay {
  label: string;
  clicks: number;
  squats: number;
  steps: number;    // raw step count
  isToday: boolean;
}

interface Props {
  data: ActivityDay[];
  height?: number;
}

const CHART_H  = 100;   // bar area height only
const Y_AXIS_W = 28;
const LABEL_H  = 28;
const BAR_R    = 3;

const VIOLET = Colors.primary;
const GREEN  = Colors.success;
const AMBER  = Colors.warning;

const SERIES = [
  { key: 'clicks' as const, color: VIOLET, label: 'Push-ups' },
  { key: 'squats' as const, color: GREEN,  label: 'Squats'   },
  { key: 'steps'  as const, color: AMBER,  label: 'Steps ÷100' },
];

export function ActivityHistoryChart({ data, height = CHART_H }: Props) {
  const revealAnim = useRef(new Animated.Value(0)).current;

  // Normalise steps so they're visually comparable with reps
  const normalised: ActivityDay[] = data.map((d) => ({
    ...d,
    steps: Math.round(d.steps / 100),
  }));

  // Per-series max so each series fills independently
  const maxClicks = Math.max(1, ...normalised.map((d) => d.clicks));
  const maxSquats = Math.max(1, ...normalised.map((d) => d.squats));
  const maxSteps  = Math.max(1, ...normalised.map((d) => d.steps));
  const seriesMax = { clicks: maxClicks, squats: maxSquats, steps: maxSteps };

  // Y-axis tick = the highest single-series maximum (for a shared reference)
  const globalMax = Math.max(maxClicks, maxSquats, maxSteps);

  useEffect(() => {
    revealAnim.setValue(0);
    Animated.timing(revealAnim, {
      toValue:  1,
      duration: 900,
      delay:    150,
      easing:   Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [data]);

  return (
    <View style={styles.root}>
      {/* Legend */}
      <View style={styles.legend}>
        {SERIES.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.chartRow}>
        {/* Y-axis labels (top / bottom only for cleanliness) */}
        <View style={[styles.yAxis, { height }]}>
          <Text style={styles.yLabel}>{globalMax > 0 ? globalMax : ''}</Text>
          <Text style={styles.yLabel}>0</Text>
        </View>

        {/* Bar area + day labels */}
        <View style={styles.chartColumn}>
          {/* Bar area — all groups aligned at the bottom */}
          <View style={[styles.barsRow, { height }]}>
            {normalised.map((d, di) => (
              <View key={di} style={styles.dayGroup}>
                {SERIES.map((s) => {
                  const val     = d[s.key];
                  const frac    = val / seriesMax[s.key];
                  const targetH = Math.max(frac * height, val > 0 ? 3 : 0);
                  const barH    = revealAnim.interpolate({
                    inputRange:  [0, 1],
                    outputRange: [0, targetH],
                  });
                  const alpha = d.isToday ? 'FF' : '88';

                  return (
                    <View key={s.key} style={[styles.barTrack, { height }]}>
                      <Animated.View
                        style={{
                          height:                barH,
                          width:                 '100%',
                          backgroundColor:       s.color + alpha,
                          borderTopLeftRadius:   BAR_R,
                          borderTopRightRadius:  BAR_R,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Day labels — always flush below bars */}
          <View style={[styles.labelsRow, { height: LABEL_H }]}>
            {data.map((d, i) => (
              <Text
                key={i}
                style={[
                  styles.dayLabel,
                  d.isToday && { color: Colors.primary, fontWeight: FontWeight.bold },
                ]}
              >
                {d.label}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.sm },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendLabel:{ fontSize: FontSize.xs, color: Colors.textMuted },

  chartRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },

  yAxis: {
    width: Y_AXIS_W,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  yLabel: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    fontVariant: ['tabular-nums'],
  },

  chartColumn: { flex: 1 },

  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 3,
  },

  dayGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },

  barTrack: {
    flex: 1,
    maxWidth: 10,
    justifyContent: 'flex-end',
  },

  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
  },

  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
