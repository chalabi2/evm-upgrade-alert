import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/layout/layout";
import { Dashboard } from "./pages/dashboard";
import { Upgrades } from "./pages/upgrades";
import { Chains } from "./pages/chains";
import { Events } from "./pages/events";
import { Releases } from "./pages/releases";
import { ThemeProvider } from "./components/theme-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="upgrades" element={<Upgrades />} />
              <Route path="chains" element={<Chains />} />
              <Route path="events" element={<Events />} />
              <Route path="releases" element={<Releases />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
