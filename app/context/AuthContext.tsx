"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "customer" | "driver" | "admin";
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    name: string,
    role: "customer" | "driver"
  ) => Promise<void>;
  logout: () => void;
  toggleRole: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("currentUser");
      }
    }
    setIsLoading(false);
  }, []);

  const toggleRole = () => {
    if (!user) return;
    const newRole = user.role === "customer" ? "driver" : "customer";
    const newUser = { ...user, role: newRole as "customer" | "driver" };
    setUser(newUser);
    localStorage.setItem("currentUser", JSON.stringify(newUser));
  };

  const login = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });

      const data = (await response.json()) as { user?: User; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      setUser(data.user || null);
      if (data.user) {
        localStorage.setItem("currentUser", JSON.stringify(data.user));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    role: "customer" | "driver"
  ) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signup", email, password, name, role }),
      });

      const data = (await response.json()) as { user?: User; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      setUser(data.user || null);
      if (data.user) {
        localStorage.setItem("currentUser", JSON.stringify(data.user));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("currentUser");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, toggleRole, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
