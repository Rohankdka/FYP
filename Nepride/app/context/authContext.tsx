// context/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";

interface AuthContextType {
  user: {
    status: string; id: string; username: string; email: string; role: string 
} | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const router = useRouter();
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token from AsyncStorage on app start
  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("token");
        console.log("Loaded token from AsyncStorage:", storedToken); // Debug log
        if (storedToken) {
          setToken(storedToken);
          await fetchUser(storedToken);
        }
      } catch (error) {
        console.error("Error loading token:", error);
      } finally {
        setLoading(false);
      }
    };
    loadToken();
  }, []);

  // Fetch user details using token
  const fetchUser = async (token: string) => {
    try {
      const response = await axios.get("http://192.168.1.70:3001/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("Fetched user details:", response.data); // Debug log
      setUser(response.data);
    } catch (error) {
      console.error("Error fetching user:", error);
      await logout();
    }
  };

  // Handle login
  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post("http://192.168.1.70:3001/auth/login", {
        email,
        password,
      });
      const { token, role, id } = response.data; // Destructure token, role, and id
      console.log("Login successful, token:", token); // Debug log
  
      await AsyncStorage.setItem("token", token);
      setToken(token);
      await fetchUser(token);
  
      // Redirect based on role with `id` as a route parameter
      switch (role) {
        case "admin":
          router.push("/Dashboard/adminDashboard");
          break;
        case "driver":
          router.push(`/Dashboard/driverDashboard?driverId=${id}`); // Pass driverId
          break;
        case "passenger":
          router.push(`/Dashboard/passengerDashboard?passengerId=${id}`); // Pass passengerId
          break;
        default:
          router.push("/");
      }
    } catch (error: any) {
      console.error(
        "Login error:",
        error.response?.data?.message || error.message
      );
      throw error;
    }
  };
  // Handle logout
  const logout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      setToken(null);
      setUser(null);
      console.log("User logged out"); // Debug log
      router.push("/auth/login");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};