import type { PluginClientContext, PluginScreenProps, PluginSidebarItemProps, PluginSurfaceProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { ScrollView } from "react-native";
import { createLauncher, startWindowReceiver } from "./client/web";
import { WindowMenu } from "./client/menu";
import { WindowSettings } from "./client/settings";

export default function contribute(client: PluginClientContext) {
  const stopReceiver = startWindowReceiver();
  const launcher = createLauncher();

  function Setup(props: PluginSurfaceProps) { return <WindowSettings {...props} launcher={launcher} />; }
  function Launch(props: PluginScreenProps) {
    const { theme, layout } = props;
    return <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} contentContainerStyle={{ padding: layout.compact ? 16 : 24 }}>
      <WindowMenu {...props} launcher={launcher} openSettings={() => client.openSettings("sessions")} />
    </ScrollView>;
  }
  function Item({ currentScreen, openScreen }: PluginSidebarItemProps) {
    return <SidebarRow icon="PanelsTopLeft" active={currentScreen?.screenId === "launch"} onPress={() => openScreen({ screenId: "launch" })} />;
  }
  client.addSettingsScreen({ id: "sessions", title: "Window Manager", icon: "PanelsTopLeft", Component: Setup });
  client.addScreen({ id: "launch", title: "Window Manager", Component: Launch });
  client.addSidebarHeaderItem({ id: "launch", title: "Window Manager", Component: Item });
  client.addCommandCenterItem({ id: "window-manager-open", title: "Window Manager", icon: "PanelsTopLeft", context: "global", onSelect({ openScreen }) { openScreen({ screenId: "launch" }); } });
  client.addCommandCenterItem({ id: "window-manager-setup", title: "Window Manager: settings", icon: "PanelsTopLeft", context: "global", onSelect() { client.openSettings("sessions"); } });

  return () => { stopReceiver(); launcher.dispose(); };
}
