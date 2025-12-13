import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarDays, 
  LayoutGrid, 
  Calendar, 
  Settings,
  Menu,
  LogOut,
  ChefHat
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/reservations', label: 'Prenotazioni', icon: CalendarDays },
  { path: '/rooms', label: 'Sale', icon: LayoutGrid },
  { path: '/working-days', label: 'Orari', icon: Calendar },
  { path: '/settings', label: 'Impostazioni', icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();

  const NavItems = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
              'hover:bg-secondary/80',
              isActive && 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Navigation */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-sm border-b border-border z-50">
        <div className="container flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ChefHat className="h-8 w-8 text-primary" />
            <span className="text-xl font-semibold text-foreground">Ristorante</span>
          </Link>
          
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
                    'hover:bg-secondary/80 text-muted-foreground hover:text-foreground',
                    isActive && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Ciao, <span className="font-medium text-foreground">{user?.name}</span>
            </span>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-card/95 backdrop-blur-sm border-b border-border z-50">
        <div className="flex items-center justify-between px-4 h-full">
          <Link to="/" className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold text-foreground">Ristorante</span>
          </Link>
          
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-semibold text-lg">Menu</span>
                </div>
                <nav className="flex flex-col gap-1 flex-1">
                  <NavItems onClick={() => setMobileOpen(false)} />
                </nav>
                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{user?.name}</span>
                    <Button variant="ghost" size="sm" onClick={logout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Esci
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-sm border-t border-border z-50">
        <div className="flex items-center justify-around h-full">
          {navItems.slice(0, 4).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-14 md:pt-16 pb-20 md:pb-8">
        <div className="container py-4 md:py-6">{children}</div>
      </main>
    </div>
  );
}
