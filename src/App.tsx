import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Reservations from "./pages/Reservations";
import NewReservation from "./pages/NewReservation";
import Rooms from "./pages/Rooms";
import WorkingDays from "./pages/WorkingDays";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/reservations" element={
              <ProtectedRoute>
                <AppLayout>
                  <Reservations />
                </AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/reservations/new" element={
              <ProtectedRoute>
                <AppLayout>
                  <NewReservation />
                </AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/rooms" element={
              <ProtectedRoute>
                <AppLayout>
                  <Rooms />
                </AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/working-days" element={
              <ProtectedRoute>
                <AppLayout>
                  <WorkingDays />
                </AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings" element={
              <ProtectedRoute>
                <AppLayout>
                  <Settings />
                </AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
