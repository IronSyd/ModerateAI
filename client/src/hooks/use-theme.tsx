import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDarkMode: boolean;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { toast } = useToast();
  const [theme, setThemeState] = useState<Theme>(() => {
    // Try to get the theme from localStorage
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    return savedTheme || "system";
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Effect to apply theme changes to the document
  useEffect(() => {
    const applyTheme = async () => {
      setIsLoading(true);

      try {
        // Determine if we should use dark mode
        let shouldUseDarkMode = false;

        if (theme === "system") {
          // Check system preference
          shouldUseDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
        } else {
          shouldUseDarkMode = theme === "dark";
        }

        setIsDarkMode(shouldUseDarkMode);

        // Apply the theme to the HTML element
        if (shouldUseDarkMode) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }

        // Save theme to localStorage
        localStorage.setItem("theme", theme);
      } catch (error) {
        console.error("Failed to apply theme:", error);
        toast({
          title: "Theme Error",
          description: "Failed to apply theme settings.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    applyTheme();
  }, [theme, toast]);

  // Listen for system theme changes if set to system
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    // Add event listener
    mediaQuery.addEventListener("change", handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [theme]);

  // The function to set the theme
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDarkMode, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}