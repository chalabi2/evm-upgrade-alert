import { Outlet } from "react-router-dom";
import { Header } from "./header";

export function Layout() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="container max-w-7xl py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
