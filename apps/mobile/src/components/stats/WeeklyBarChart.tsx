import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Colors, FontSize, FontWeight, Spacing } from '../../theme';

export interface WeekBarData {
  label: string;   // 'Mon', 'Tue', …
  value: number;   // seconds used
  isToday: boolean;
  hasData: boolean;
}

interface Props {
  data: WeekBarData[];
  maxValue: number;       // seconds that maps to 100% bar height
  limitValue: number;     // seconds for the daily-limit dash line
  height?: number;        // chart area height (bars only, not labels)
  accentColor?: string;
}

const CHART_H   = 140;   // pixels — bars only
const Y_AXIS_W  = 36;    // pixels — left column for Y labels
const BAR_R     = 5;     // border-radius on bar tops
const LABEL_H   = 32;    // pixels reserved for day-label row below bars

/** Round a seconds value up to a "nice" minute boundary for axis labels. */
function niceMax(seconds: number): number {
  const mins = Math.ceil(seconds / 60);
  if (mins <= 15)  return 15 * 60;
  if (mins <= 30)  return 30 * 60;
  if (mins <= 60)  return 60 * 60;
  if (mins <= 90)  return 90 * 60;
  if (mins <= 120) return 120 * 60;
  return Math.ceil(mins / 30) * 30 * 60;
}

function fmtMins(s: number): string {
  const m = Math.round(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h${m % 60 ? `${m % 60}m` : ''}`;
  return `${m}m`;
}

export function WeeklyBarChart({
  data,
  maxValue,
  limitValue,
  height = CHART_H,
  accentColor = Colors.primary,
}: Props) {
  const revealAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    revealAnim.setValue(0);
    Animated.timing(revealAnim, {
      toValue:  1,
      duration: 900,
      easing:   Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [data]);

  const safeMax = niceMax(Math.max(maxValue, limitValue));

  // Y-axis labels: top, mid, bottom
  const yTop = fmtMins(safeMax);
  const yMid = fmtMins(safeMax / 2);

  // Limit dash line position (fraction of chart height, measured from top)
  const limitFrac = Math.min(1, limitValue / safeMax);
  const limitY    = height * (1 - limitFrac);

  return (
    <View style={styles.root}>
      {/* ── Y-axis labels (height = chart area only, no label row) ─── */}
      <View style={[styles.yAxis, { height }]}>
        <Text style={styles.yLabel}>{yTop}</Text>
        <Text style={styles.yLabel}>{yMid}</Text>
        <Text style={styles.yLabel}>0</Text>
      </View>

      {/* ── Chart area + day-label row ─────────────────────────────── */}
      <View style={styles.chartColumn}>
        {/* Chart area: bars + reference line overlay */}
        <View style={[styles.chartArea, { height }]}>
          {/* Reference dashed line */}
          <Svg
            style={StyleSheet.absoluteFillObject}
            width="100%"
            height={height}
            pointerEvents="none"
          >
            <Line
              x1="0"  y1={limitY}
              x2="100%" y2={limitY}
              stroke={Colors.textDisabled}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          </Svg>

          {/* Bars — aligned at the BOTTOM of the chart area */}
          <View style={[styles.barsRow, { height }]}>
            {data.map((d, i) => {
              const frac   = Math.min(1, d.value / safeMax);
              const targetH = Math.max(frac * height, d.value > 0 ? 3 : 0);
              const barH    = revealAnim.interpolate({
                inputRange:  [0, 1],
                outputRange: [0, targetH],
              });
              const barColor = d.isToday
                ? accentColor
                : !d.hasData
                  ? Colors.surfaceElevated
                  : accentColor + '60';

              return (
                <View key={i} style={styles.barSlot}>
                  {/* Track fills the full chart height; bar grows from bottom */}
                  <View style={[styles.barTrack, { height }]}>
                    <Animated.View
                      style={[
                        styles.bar,
                        {
                          height:          barH,
                          backgroundColor: barColor,
                        },
                        d.isToday && styles.barToday,
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Day labels — always flush below the chart area */}
        <View style={[styles.labelsRow, { height: LABEL_H }]}>
          {data.map((d, i) => (
            <View key={i} style={styles.labelSlot}>
              <Text
                style={[
                  styles.dayLabel,
                  d.isToday && { color: accentColor, fontWeight: FontWeight.bold },
                ]}
              >
                {d.label}
              </Text>
              {d.isToday && (
                <View style={[styles.todayDot, { backgroundColor: accentColor }]} />
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },

  // Y-axis: exactly as tall as the chart area, labels evenly distributed
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

  // Column that holds chart area + label row
  chartColumn: {
    flex: 1,
  },

  // The chart area itself — bars live here with SVG overlay
  chartArea: {
    position: 'relative',
    overflow: 'visible',
  },

  // Row of bar slots, aligned at the BOTTOM
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 3,
  },

  barSlot: {
    flex: 1,
    alignItems: 'center',
  },

  barTrack: {
    width: '100%',
    justifyContent: 'flex-end', // bar grows upward from the bottom
  },

  bar: {
    width: '100%',
    borderTopLeftRadius:  BAR_R,
    borderTopRightRadius: BAR_R,
  },

  barToday: {
    shadowColor:   Colors.primary,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius:  6,
    elevation:     4,
  },

  // Label row — separate from bar area so day names are always at the bottom
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 6,
    gap: 3,
  },

  labelSlot: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },

  dayLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
