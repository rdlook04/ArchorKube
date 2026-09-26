import React from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components/layouts";
import { Tooltip } from "@dynatrace/strato-components/overlays";
import { HelpIcon } from "@dynatrace/strato-icons";

interface NavItem {
  to: string;
  label: string;
  /** Qué módulo es y qué cubre; se muestra al pasar el cursor. */
  tooltip: string;
}

/**
 * Navegación ordenada por número de módulo (M1 → M12), no por afinidad
 * temática: es el orden con el que el equipo se refiere a ellos en el SPEC y en
 * las conversaciones. El código del módulo no cabe en la pestaña sin ensuciar
 * la barra, así que vive en el tooltip.
 *
 * M5 aparece dos veces a propósito: el módulo cubre los dos ángulos del riesgo
 * de caída, las réplicas/probes y el margen de autoescalado.
 */
const NAV: NavItem[] = [
  {
    to: "/rightsizing",
    label: "Rightsizing",
    tooltip: "Módulos 1 y 2 (M1/M2) — Rightsizing de CPU y memoria: ajuste de lo que cada workload reserva",
  },
  {
    to: "/idle",
    label: "Ociosos",
    tooltip: "Módulo 3 (M3) — Ociosos: workloads sin tráfico ni actividad, candidatos a apagar",
  },
  {
    to: "/nodes",
    label: "Nodos",
    tooltip: "Módulo 4 (M4) — Densidad: pods por nodo y nodos candidatos a consolidar",
  },
  {
    to: "/risk",
    label: "Riesgo",
    tooltip: "Módulo 5 (M5) — Riesgo de caída: réplica única y chequeos de salud faltantes",
  },
  {
    to: "/elasticity",
    label: "Elasticidad",
    tooltip: "Módulo 5 (M5) — Riesgo de caída, ángulo de autoescalado: HPAs topados o sin margen",
  },
  {
    to: "/orphans",
    label: "Huérfanos",
    tooltip: "Módulo 6 (M6) — Huérfanos: workloads sin réplicas o sin dueño en el catálogo",
  },
  {
    to: "/tiers",
    label: "Tiers",
    tooltip: "Módulo 7 (M7) — Tieraje: el catálogo de propiedad que prioriza los hallazgos de todos los demás",
  },
  {
    to: "/tier-pending",
    label: "Pendientes",
    tooltip: "Módulo 7 (M7) — Pendientes de tieraje: workloads sin tier declarado, repartidos por squad",
  },
  {
    to: "/preventive",
    label: "Preventiva",
    tooltip: "Módulo 8 (M8) — Detección preventiva: OOM kills y bucles de reinicio",
  },
  {
    to: "/errors",
    label: "Errores",
    tooltip: "Módulo 9 (M9) — Errores críticos: errores y fatales en los logs, por contenedor",
  },
  {
    to: "/control-plane",
    label: "Control plane",
    tooltip: "Módulo 10 (M10) — Control plane: salud de los nodos y condiciones activas",
  },
  {
    to: "/bottlenecks",
    label: "Cuellos de botella",
    tooltip: "Módulo 11 (M11) — Cuellos de botella: throttling de CPU y saturación de nodos",
  },
  {
    to: "/compliance",
    label: "Cumplimiento",
    tooltip: "Módulo 12 (M12) — Cumplimiento del estándar AKS: las 8 SPECs de buenas prácticas",
  },
  {
    to: "/spend",
    label: "Gasto",
    tooltip: "Módulo 13 (M13) — Gasto de infraestructura: qué máquinas hay, de qué tipo y desde cuándo",
  },
];

interface HeaderProps {
  /** Abre el aviso de app comunitaria (y, más adelante, la Guía). */
  onHelp: () => void;
}

export const Header = ({ onHelp }: HeaderProps) => {
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
          title="ArchorKube — de arch (arquitectura) y arconte, el arkhon griego que gobernaba y orquestaba el estado, sobre Kubernetes: la capa que le pone dueño y prioridad a cada hallazgo."
        />
        {/*
          El Tooltip va DENTRO del item: AppHeader.Navigation solo renderiza los
          hijos directos que reconoce como NavigationItem o Logo, y descarta en
          silencio cualquier envoltorio.
        */}
        {NAV.map((item) => (
          <AppHeader.NavigationItem key={item.to} as={Link} to={item.to}>
            <Tooltip text={item.tooltip} placement="bottom">
              <span>{item.label}</span>
            </Tooltip>
          </AppHeader.NavigationItem>
        ))}
      </AppHeader.Navigation>
      <AppHeader.ActionItems>
        <AppHeader.ActionButton prefixIcon={<HelpIcon />} onClick={onHelp}>
          Help
        </AppHeader.ActionButton>
      </AppHeader.ActionItems>
    </AppHeader>
  );
};
