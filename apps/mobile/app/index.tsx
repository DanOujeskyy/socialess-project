import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth.store';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../src/theme';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(app)/(tabs)/' : '/(auth)/login'} />;
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
});
