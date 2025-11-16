import { Outlet } from "react-router-dom";
import { Header } from "./header";

export function Layout() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 flex justify-center px-6">
        <div className="container py-6 max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
