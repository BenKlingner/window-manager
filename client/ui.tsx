import { Pressable, Text, View, type ViewStyle } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import { createContext, useContext, type ReactNode } from "react";

export const SettingsButtonLayout = createContext<{ compact: boolean } | null>(null);

export function Action({ theme, label, onPress, disabled, primary, danger, testID, variant }: {
  theme: PluginTheme; label: string; onPress(): void; disabled?: boolean; primary?: boolean; danger?: boolean; testID?: string; variant?: "filled";
}) {
  const settings = useContext(SettingsButtonLayout);
  const filled = variant === "filled" || (primary && !settings);
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => ({
      borderRadius: 8, paddingVertical: settings ? (settings.compact ? 10 : 6) : 10,
      paddingHorizontal: settings ? 12 : 14, minHeight: settings ? (settings.compact ? 40 : 32) : 40,
      alignItems: settings ? "center" : undefined, justifyContent: settings ? "center" : undefined,
      borderWidth: settings ? 1 : 0, borderColor: filled ? theme.colors.accent : theme.colors.border,
      backgroundColor: filled ? theme.colors.accent : settings ? "transparent" : theme.colors.surface2,
      opacity: disabled ? (settings ? 0.5 : 0.45) : pressed ? (settings ? 0.85 : 0.75) : 1,
    })}>
    <Text style={{ color: filled ? theme.colors.accentForeground : danger ? theme.colors.statusDanger : theme.colors.foreground, fontWeight: settings ? "400" : "600", fontSize: 13 }}>{label}</Text>
  </Pressable>;
}

export function Copy({ theme, children, muted, error }: { theme: PluginTheme; children: ReactNode; muted?: boolean; error?: boolean }) {
  return <Text accessibilityRole={error ? "alert" : undefined} style={{ color: error ? theme.colors.statusDanger : muted ? theme.colors.foregroundMuted : theme.colors.foreground, fontSize: 13, lineHeight: 20 }}>{children}</Text>;
}

export function Card({ theme, children, style }: { theme: PluginTheme; children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ backgroundColor: theme.colors.surface1, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 }, style]}>{children}</View>;
}

export function Divider({ theme }: { theme: PluginTheme }) {
  return <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 4 }} />;
}
