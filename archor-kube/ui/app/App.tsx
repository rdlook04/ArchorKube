import { PageLayout } from "@dynatrace/strato-components/layouts";
import { ToastContainer } from "@dynatrace/strato-components/notifications";
import React, { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Bottlenecks } from "./pages/Bottlenecks";
import { Compliance } from "./pages/Compliance";
import { ControlPlane } from "./pages/ControlPlane";
import { Errors } from "./pages/Errors";
import { Idle } from "./pages/Idle";
import { Orphans } from "./pages/Orphans";
import { Preventive } from "./pages/Preventive";
import { Elasticity } from "./pages/Elasticity";
import { AiSettingsProvider } from "./ai/settings";
import { ExternalSendProvider } from "./ai/useExternalSend";
import { CommunityNotice, isNoticeDismissed } from "./components/CommunityNotice";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { Nodes } from "./pages/Nodes";
import { Rightsizing } from "./pages/Rightsizing";
import { Risk } from "./pages/Risk";
import { Settings } from "./pages/Settings";
import { Spend } from "./pages/Spend";
import { TierPending } from "./pages/TierPending";
import { Tiers } from "./pages/Tiers";

export const App = () => {
  const [noticeOpen, setNoticeOpen] = useState(() => !isNoticeDismissed());

  // Settings primero: el envío externo lee de ahí el modo de datos.
  return (
    <AiSettingsProvider>
      <ExternalSendProvider>
        <PageLayout>
          <PageLayout.Header>
            <Header onHelp={() => setNoticeOpen(true)} />
          </PageLayout.Header>
          <PageLayout.Content>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tiers" element={<Tiers />} />
              <Route path="/tier-pending" element={<TierPending />} />
              <Route path="/rightsizing" element={<Rightsizing />} />
              <Route path="/nodes" element={<Nodes />} />
              <Route path="/elasticity" element={<Elasticity />} />
              <Route path="/risk" element={<Risk />} />
              <Route path="/idle" element={<Idle />} />
              <Route path="/orphans" element={<Orphans />} />
              <Route path="/preventive" element={<Preventive />} />
              <Route path="/errors" element={<Errors />} />
              <Route path="/control-plane" element={<ControlPlane />} />
              <Route path="/bottlenecks" element={<Bottlenecks />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/spend" element={<Spend />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </PageLayout.Content>
          <CommunityNotice show={noticeOpen} onClose={() => setNoticeOpen(false)} />
          <ToastContainer />
        </PageLayout>
      </ExternalSendProvider>
    </AiSettingsProvider>
  );
};
