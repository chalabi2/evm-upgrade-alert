import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ModeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const themes = ["dark", "light"] as const;
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getIcon = () => {
    switch (theme) {
      case "light":
        return (
          <Sun className="h-[1.2rem] w-[1.2rem] animate-in slide-in-from-top-2 duration-300" />
        );
      case "dark":
        return (
          <Moon className="h-[1.2rem] w-[1.2rem] animate-in slide-in-from-top-2 duration-300" />
        );
    }
  };

  return (
    <Button
      className={className}
      variant="outline"
      size="icon"
      onClick={cycleTheme}
    >
      {getIcon()}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
