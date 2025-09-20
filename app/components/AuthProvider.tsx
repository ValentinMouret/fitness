import { createContext, useContext, useState, useEffect } from "react";
import type { User } from "~/auth";
import { getUser } from "~/auth";

interface AuthContextType {
  readonly user: User | null;
  readonly setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getUser();
      setUserState(currentUser);
      setIsLoading(false);
    };
    loadUser();
  }, []);

  // Listen for storage changes to sync auth state
  useEffect(() => {
    const handleStorageChange = async () => {
      const currentUser = await getUser();
      setUserState(currentUser);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
