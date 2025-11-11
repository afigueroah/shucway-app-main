import React from 'react';
window.React = React;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "antd/dist/reset.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { AlertsProvider } from "./context/AlertsContext";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/es";
import updateLocale from "dayjs/plugin/updateLocale";
import { ConfigProvider, theme } from "antd";
import esES from "antd/locale/es_ES";

dayjs.extend(updateLocale);
dayjs.updateLocale("es", {
  weekStart: 1,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false, 
      refetchOnReconnect: true, 
      retry: 1, 
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider locale={esES} theme={{ algorithm: theme.defaultAlgorithm }}>
          <AuthProvider>
            <AlertsProvider>
              <App />
            </AlertsProvider>
          </AuthProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
