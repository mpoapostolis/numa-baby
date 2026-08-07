import { Baby, BarChart3, ChevronRight, Clock, Home, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "./ui/sidebar";
import { Profile, Tab } from "../domain/types";

export function AppSidebar({
  activeTab,
  onNavigate,
  profile,
  onProfile,
}: {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
  profile: Profile;
  onProfile: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  const navItems: Array<{ value: Tab; label: string; icon: React.ReactNode }> = [
    { value: "today", label: "Today", icon: <Home /> },
    { value: "timeline", label: "Timeline", icon: <Clock /> },
    { value: "insights", label: "Insights", icon: <BarChart3 /> },
    { value: "more", label: "Settings", icon: <Settings /> },
  ];

  const navigate = (tab: Tab) => {
    onNavigate(tab);
    setOpenMobile(false);
  };

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="numa-sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Baby Tracker"
              aria-label="Baby Tracker"
              className="app-sidebar-brand"
              onClick={() => navigate("today")}
            >
              <span className="wordmark-mark"><Baby /></span>
              <span className="app-sidebar-brand-copy">
                <strong>Baby Tracker</strong>
                <small>Private family log</small>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tracker</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={item.label}
                    aria-label={item.label}
                    aria-current={activeTab === item.value ? "page" : undefined}
                    isActive={activeTab === item.value}
                    onClick={() => navigate(item.value)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="sidebar-profile-button" tooltip="Baby profile" aria-label="Baby profile" onClick={onProfile}>
              <span className="baby-avatar"><Baby /></span>
              <span className="sidebar-profile-copy">
                <strong>{profile.name}</strong>
                <small>Private profile</small>
              </span>
              <ChevronRight />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
