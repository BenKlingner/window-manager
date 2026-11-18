import { Pressable, Text, View, type ViewStyle } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import { createContext, useContext, type ReactNode } from "react";
import { Icon } from "@getpaseo/plugin/client/ui";

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

export function TabBar<Tab extends string>({ theme, compact, tabs, value, onChange }: {
  theme: PluginTheme; compact: boolean; tabs: readonly { name: Tab; icon: string }[]; value: NoInfer<Tab>; onChange(tab: NoInfer<Tab>): void;
}) {
  return <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
    {tabs.map(({ name, icon }) => {
      const selected = name === value;
      return <Pressable key={name} accessibilityRole="tab" accessibilityLabel={name}
        accessibilityState={{ selected }} onPress={() => onChange(name)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6,
          paddingVertical: compact ? 10 : 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          backgroundColor: selected ? theme.colors.accent : theme.colors.surface1 }}>
        <Icon name={icon} size={14} color={selected ? theme.colors.accentForeground : theme.colors.foregroundMuted} />
        <Text style={{ color: selected ? theme.colors.accentForeground : theme.colors.foreground, fontSize: 13, fontWeight: selected ? "500" : "400" }}>{name}</Text>
      </Pressable>;
    })}
  </View>;
}

// One launchable item: name and detail on the left, its open button on the right.
export function LaunchRow({ theme, compact, name, detail, disabled, onOpen }: {
  theme: PluginTheme; compact: boolean; name: string; detail?: string; disabled?: boolean; onOpen(): void;
}) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: compact ? 10 : 8, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }}>
    <View style={{ flex: 1, gap: 2 }}>
      <Text numberOfLines={1} style={{ color: theme.colors.foreground, fontSize: 14, fontWeight: "500" }}>{name}</Text>
      {!!detail && <Text numberOfLines={1} style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{detail}</Text>}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}`} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onOpen} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6,
        paddingVertical: compact ? 10 : 6, paddingHorizontal: 12, minHeight: compact ? 40 : 32, borderRadius: 8,
        backgroundColor: theme.colors.surface2, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 })}>
      <Icon name="AppWindow" size={14} color={theme.colors.foreground} />
      <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "500" }}>{compact ? "Open" : "Open in new window"}</Text>
    </Pressable>
  </View>;
}
