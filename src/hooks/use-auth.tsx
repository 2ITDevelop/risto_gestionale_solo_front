import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { name: string; role: string } | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider(props: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [user, setUser] = useState<{ name: string; role: string } | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    localStorage.setItem('isAuthenticated', String(isAuthenticated));
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [isAuthenticated, user]);

  const login = async (username: string, password: string): Promise<boolean> => {
    if (username && password) {
      setUser({ name: username, role: 'staff' });
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
  };

  const value = { isAuthenticated, user, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {props.children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
