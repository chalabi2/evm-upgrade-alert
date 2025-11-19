import { Outlet } from "react-router-dom";
import { Header } from "./header";
import { Toaster } from "@/components/ui/sonner";

export function Layout() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="container max-w-7xl py-10">
          <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  );
}
