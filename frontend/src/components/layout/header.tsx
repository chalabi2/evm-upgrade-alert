import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";
import { ModeToggle } from "../ui/mode-toggle";

const navigation = [
  { name: "Radar", href: "/" },
  { name: "Alerts", href: "/alerts" },
  { name: "Releases", href: "/releases" },
  { name: "Chains", href: "/chains" },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="sticky px-6 top-0 z-50 w-full h-14 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 flex items-center">
      <Link to="/" className="flex items-center space-x-2">
        <img
          src="/upgrade_radar.svg"
          alt="Upgradar"
          className="h-10 w-10 rounded-full"
        />
        <span className="font-bold text-2xl ">Upgradar</span>
      </Link>

      <nav className="flex items-center gap-6 text-md absolute left-1/2 -translate-x-1/2">
        {navigation.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "transition-colors hover:text-primary",
              location.pathname === item.href
                ? "text-primary "
                : "text-muted-foreground"
            )}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="ml-auto">
        <ModeToggle />
      </div>
    </header>
  );
}
