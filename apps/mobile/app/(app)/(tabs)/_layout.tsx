import { Tabs } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize } from '../../../src/theme';
import { useGameStore } from '../../../src/store/game.store';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={[styles.tabEmoji, { opacity: focused ? 1 : 0.55 }]}>{icon}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const mode = useGameStore((s) => s.mode);
  const isMultiplayer = mode === 'multiplayer';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: FontSize.xs, marginBottom: 4 },
      }}
    >
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ focused }) => <TabIcon icon="🛒" focused={focused} />,
        }}
      />

      {isMultiplayer && (
        <Tabs.Screen
          name="cards"
          options={{
            title: 'Cards',
            tabBarIcon: ({ focused }) => <TabIcon icon="🃏" focused={focused} />,
          }}
        />
      )}

      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />

      {isMultiplayer && (
        <Tabs.Screen
          name="players"
          options={{
            title: 'Players',
            tabBarIcon: ({ focused }) => <TabIcon icon="👥" focused={focused} />,
          }}
        />
      )}

      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} />,
        }}
      />

      {/* Hidden tabs — always registered to avoid Expo Router warnings */}
      {!isMultiplayer && (
        <Tabs.Screen name="cards"   options={{ href: null }} />
      )}
      {!isMultiplayer && (
        <Tabs.Screen name="players" options={{ href: null }} />
      )}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabIconFocused: { backgroundColor: Colors.primary + '22' },
  tabEmoji: { fontSize: 20 },
});
