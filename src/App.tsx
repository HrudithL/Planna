import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthGuard, AdminGuard } from "@/components/auth/AuthGuard";
import Landing from "./pages/Landing";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import DashboardLayout from "./components/layout/DashboardLayout";
import PlansPage from "./pages/Plans";
import PlanEditor from "./pages/PlanEditor";
import CoursesPage from "./pages/Courses";
import PresetsPage from "./pages/Presets";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminCourseUpload from "./pages/admin/AdminCourseUpload";
import AdminPresets from "./pages/admin/AdminPresets";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<AuthGuard><DashboardLayout /></AuthGuard>}>
              <Route index element={<Navigate to="plans" replace />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="plans/:id" element={<PlanEditor />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="presets" element={<PresetsPage />} />
              <Route path="admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
              <Route path="admin/courses" element={<AdminGuard><AdminCourses /></AdminGuard>} />
              <Route path="admin/courses/upload" element={<AdminGuard><AdminCourseUpload /></AdminGuard>} />
              <Route path="admin/presets" element={<AdminGuard><AdminPresets /></AdminGuard>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
