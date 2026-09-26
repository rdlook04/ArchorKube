import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components/layouts";
import { Tooltip } from "@dynatrace/strato-components/overlays";
import { CheckmarkIcon, HelpIcon, SettingIcon } from "@dynatrace/strato-icons";

import { useT } from "../i18n";

/**
 * Navegación ordenada por número de módulo (M1 → M14), no por afinidad
 * temática: es el orden con el que el equipo se refiere a ellos en el SPEC y en
 * las conversaciones. El código del módulo no cabe en la pestaña sin ensuciar
 * la barra, así que vive en el tooltip. Etiquetas y tooltips salen del
 * diccionario (i18n/ui.ts), por ruta.
 *
 * M5 aparece dos veces a propósito: el módulo cubre los dos ángulos del riesgo
 * de caída, las réplicas/probes y el margen de autoescalado.
 */
const NAV = [
  "/rightsizing",
  "/idle",
  "/nodes",
  "/risk",
  "/elasticity",
  "/orphans",
  "/tiers",
  "/tier-pending",
  "/preventive",
  "/errors",
  "/control-plane",
  "/bottlenecks",
  "/compliance",
  "/spend",
  "/guide",
] as const;

interface HeaderProps {
  /** Abre el aviso de app comunitaria (y, más adelante, la Guía). */
  onHelp: () => void;
}

export const Header = ({ onHelp }: HeaderProps) => {
  const { pathname } = useLocation();
  const { t } = useT();
  return (
    <AppHeader>
      <AppHeader.Navigation>
        {/*
          El logo lleva el porqué del nombre como tooltip nativo: se pregunta
          seguido y desde aquí queda a mano en todas las páginas, no solo en el
          Home. Va como `title` y no como Tooltip de Strato por la misma razón
          que arriba: Navigation descarta lo que no reconozca como hijo directo.
        */}
        <AppHeader.Logo
          as={Link}
          to="/"
          title={t.header.logoTitle}
        />
        {/*
          El Tooltip va DENTRO del item: AppHeader.Navigation solo renderiza los
          hijos directos que reconoce como NavigationItem o Logo, y descarta en
          silencio cualquier envoltorio.
        */}
        {NAV.map((to) => (
          <AppHeader.NavigationItem key={to} as={Link} to={to}>
            <Tooltip text={t.nav[to].tooltip} placement="bottom">
              <span>{t.nav[to].label}</span>
            </Tooltip>
          </AppHeader.NavigationItem>
        ))}
      </AppHeader.Navigation>
      <AppHeader.ActionItems>
        <AppHeader.ActionButton
          as={Link}
          to="/setup"
          prefixIcon={<CheckmarkIcon />}
          isSelected={pathname === "/setup"}
        >
          {t.header.setup}
        </AppHeader.ActionButton>
        <AppHeader.ActionButton
          as={Link}
          to="/settings"
          prefixIcon={<SettingIcon />}
          isSelected={pathname === "/settings"}
        >
          {t.header.settings}
        </AppHeader.ActionButton>
        <AppHeader.ActionButton prefixIcon={<HelpIcon />} onClick={onHelp}>
          {t.header.help}
        </AppHeader.ActionButton>
      </AppHeader.ActionItems>
    </AppHeader>
  );
};
