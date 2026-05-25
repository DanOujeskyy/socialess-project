import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';

WebBrowser.maybeCompleteAuthSession();

interface SocialAuthButtonsProps {
  onGoogleAuth: (accessToken: string) => Promise<void>;
  onAppleAuth: (
    identityToken: string,
    fullName?: AppleAuthentication.AppleAuthenticationFullName | null,
  ) => Promise<void>;
  disabled?: boolean;
}

export function SocialAuthButtons({ onGoogleAuth, onAppleAuth, disabled }: SocialAuthButtonsProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const [request, _response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    }
  }, []);

  const handleGooglePress = async () => {
    if (googleLoading || disabled) return;
    setGoogleLoading(true);
    try {
      const result = await promptAsync();
      if (result.type === 'success' && result.authentication?.accessToken) {
        await onGoogleAuth(result.authentication.accessToken);
      }
    } catch {
      // Error handled by parent via store
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleApplePress = async () => {
    if (appleLoading || disabled) return;
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        await onAppleAuth(credential.identityToken, credential.fullName);
      }
    } catch (error: any) {
      if (error?.code !== 'ERR_CANCELED') {
        // Non-cancel errors propagate to parent via store
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const isAnyLoading = googleLoading || appleLoading;
  const showApple = appleAvailable && Platform.OS === 'ios';

  return (
    <View style={[styles.row, showApple && styles.rowDouble]}>
      <SocialButton
        icon="logo-google"
        label="Google"
        onPress={handleGooglePress}
        loading={googleLoading}
        disabled={disabled || isAnyLoading}
        style={showApple ? styles.halfBtn : styles.fullBtn}
      />
      {showApple && (
        <SocialButton
          icon="logo-apple"
          label="Apple"
          onPress={handleApplePress}
          loading={appleLoading}
          disabled={disabled || isAnyLoading}
          style={[styles.halfBtn, styles.appleBtn]}
          textColor={Colors.text}
        />
      )}
    </View>
  );
}

interface SocialButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
  style?: object | object[];
  textColor?: string;
}

function SocialButton({ icon, label, onPress, loading, disabled, style, textColor = Colors.text }: SocialButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Ionicons name={icon} size={18} color={textColor} />
      )}
      <Text style={[styles.btnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  rowDouble: { gap: Spacing.sm },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 52,
    paddingHorizontal: Spacing.base,
  },
  fullBtn: { flex: 1 },
  halfBtn: { flex: 1 },
  appleBtn: { backgroundColor: '#050505', borderColor: '#1a1a1a' },
  btnDisabled: { opacity: 0.45 },
  btnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
