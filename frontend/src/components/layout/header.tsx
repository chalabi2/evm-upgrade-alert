import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";
import { ModeToggle } from "../ui/mode-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MenuIcon } from "lucide-react";

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

      <nav className="items-center gap-6 text-md absolute left-1/2 -translate-x-1/2 hidden lg:flex">
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

      <div className="ml-auto hidden lg:block">
        <ModeToggle />
      </div>
      <div className="lg:hidden ml-auto">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <MenuIcon className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col space-y-4 mt-6">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "text-lg transition-colors hover:text-primary py-2 px-4 ",
                    location.pathname === item.href
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => {
                    // Close the sheet when a link is clicked
                    const sheetTrigger = document.querySelector(
                      '[data-state="open"]'
                    );
                    if (sheetTrigger) {
                      // This is a bit of a hack to close the sheet
                      const event = new MouseEvent("click", { bubbles: true });
                      sheetTrigger.dispatchEvent(event);
                    }
                  }}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
            <div className="p-2">
              <ModeToggle className="w-full" />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
