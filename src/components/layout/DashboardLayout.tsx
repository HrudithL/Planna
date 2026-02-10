import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { GraduationCap, FileText, BookOpen, Shield, LogOut, BarChart3, Upload, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

const studentNav = [
  { title: "My Plans", url: "/dashboard/plans", icon: FileText },
  { title: "Browse Courses", url: "/dashboard/courses", icon: BookOpen },
  { title: "Preset Plans", url: "/dashboard/presets", icon: Layers },
];

const adminNav = [
  { title: "Admin Dashboard", url: "/dashboard/admin", icon: BarChart3 },
  { title: "Manage Courses", url: "/dashboard/admin/courses", icon: BookOpen },
  { title: "Upload Courses", url: "/dashboard/admin/courses/upload", icon: Upload },
  { title: "Manage Presets", url: "/dashboard/admin/presets", icon: Layers },
];

export default function DashboardLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border p-4">
            <Link to="/" className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-sidebar-primary" />
              <span className="font-serif text-lg font-bold text-sidebar-foreground">Planna</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/50">Student</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {studentNav.map(item => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={location.pathname.startsWith(item.url)}>
                        <NavLink to={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-sidebar-foreground/50">
                  <Shield className="mr-1 h-3 w-3" /> Admin
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminNav.map(item => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                          <NavLink to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <div className="border-t border-sidebar-border p-3">
            <div className="mb-2 truncate px-2 text-sm text-sidebar-foreground/70">
              {user?.name}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </Sidebar>

        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-card px-4 md:px-6">
            <SidebarTrigger />
            <div className="flex-1" />
            <span className="text-sm text-muted-foreground">
              {user?.is_admin && <span className="mr-2 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Admin</span>}
              {user?.name}
            </span>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
