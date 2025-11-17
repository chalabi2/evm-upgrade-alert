import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/layout/layout";
import { Radar } from "./pages/radar";
import { Alerts } from "./pages/alerts";
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
              <Route index element={<Radar />} />
              <Route path="alerts" element={<Alerts />} />
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
