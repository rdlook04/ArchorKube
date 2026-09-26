import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import Borders from "@dynatrace/strato-design-tokens/borders";
import BoxShadows from "@dynatrace/strato-design-tokens/box-shadows";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Skeleton, TerminologyOverlay } from "@dynatrace/strato-components/content";
import { Tooltip } from "@dynatrace/strato-components/overlays";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import type { SvgIconProps } from "@dynatrace/strato-icons";
import {
  BugReportIcon,
  CheckmarkIcon,
  ClockIcon,
  CriticalIcon,
  FilterOutIcon,
  GhostIcon,
  GroupIcon,
  HeartIcon,
  HostsIcon,
  MeterbarIcon,
  MoneyIcon,
  NetworkIcon,
  RefreshAutoIcon,
  ResizeIcon,
  WarningIcon,
} from "@dynatrace/strato-icons";
import { useDql } from "@dynatrace-sdk/react-hooks";

import { USD_GB_MONTH, USD_VCPU_MONTH } from "../queries/costModel";
import { useT } from "../i18n";
import { windowLabel } from "../queries/analysisWindow";
import {
  HOME_COUNT_QUERIES,
  HOME_WINDOWS,
  type HomeMetric,
  toHomeMetric,
} from "../queries/homeCounts";

type IconType = React.ComponentType<SvgIconProps>;

interface ModuleItem {
  to: string;
  title: string;
  desc: string;
  Icon: IconType;
  /** Sustantivo del contador, ej. "workloads". */
  unit: string;
  /** Inventario de referencia: su volumen no son hallazgos por resolver. */
  catalog?: boolean;
}

interface ModuleSection {
  title: string;
  blurb: string;
  accent: string;
  items: ModuleItem[];
}

/** Módulos agrupados por el rol que cumplen para el equipo. */
const SECTIONS: ModuleSection[] = [
  {
    title: "Optimización de costos (FinOps)",
    blurb: "Recupera capacidad y dinero de recursos sobre-aprovisionados o inactivos.",
    accent: Colors.Text.Success.Default,
    items: [
      {
        to: "/rightsizing",
        title: "Rightsizing",
        desc: "Slack de CPU/memoria vs. lo reservado; sobre y subdimensionamiento.",
        Icon: ResizeIcon,
        unit: "pods",
      },
      {
        to: "/nodes",
        title: "Nodos",
        desc: "Densidad de pods por nodo y candidatos a consolidar o eliminar.",
        Icon: HostsIcon,
        unit: "nodos",
      },
      {
        to: "/idle",
        title: "Ociosos",
        desc: "Workloads sin tráfico ni actividad, candidatos a escalar a cero.",
        Icon: GhostIcon,
        unit: "workloads",
      },
    ],
  },
  {
    title: "Confiabilidad (SRE)",
    blurb: "Anticipa caídas y degradaciones antes de que impacten al usuario.",
    accent: Colors.Text.Critical.Default,
    items: [
      {
        to: "/risk",
        title: "Riesgo de caída",
        desc: "Réplica única y probes faltantes: puntos únicos de falla.",
        Icon: WarningIcon,
        unit: "workloads",
      },
      {
        to: "/preventive",
        title: "Preventiva",
        desc: "OOM kills y bucles de reinicio: inestabilidad emergente.",
        Icon: HeartIcon,
        unit: "workloads",
      },
      {
        to: "/errors",
        title: "Errores críticos",
        desc: "Errores y fatales en logs, agrupados por contenedor.",
        Icon: BugReportIcon,
        unit: "contenedores",
      },
      {
        to: "/bottlenecks",
        title: "Cuellos de botella",
        desc: "Picos de CPU throttling y nodos saturados.",
        Icon: MeterbarIcon,
        unit: "workloads",
      },
      {
        to: "/elasticity",
        title: "Elasticidad",
        desc: "HPAs topados en su máximo o sin margen para escalar.",
        Icon: RefreshAutoIcon,
        unit: "HPAs",
      },
      {
        to: "/control-plane",
        title: "Control plane",
        desc: "Salud de nodos: condiciones NotReady y presión de recursos.",
        Icon: NetworkIcon,
        unit: "condiciones",
      },
    ],
  },
  {
    title: "Gobernanza",
    blurb: "Estándares, tieraje y limpieza del inventario de la plataforma.",
    accent: Colors.Text.Primary.Default,
    items: [
      {
        to: "/compliance",
        title: "Cumplimiento",
        desc: "8 SPECs del estándar AKS (limits, requests, probes, non-root, Helm).",
        Icon: CheckmarkIcon,
        unit: "workloads",
      },
      {
        to: "/orphans",
        title: "Huérfanos",
        desc: "Workloads sin réplicas o sin dueño en el catálogo.",
        Icon: FilterOutIcon,
        unit: "workloads",
      },
      {
        to: "/tiers",
        title: "Tiers",
        desc: "Catálogo de propiedad que prioriza cada hallazgo por impacto de negocio.",
        Icon: GroupIcon,
        unit: "repos",
        catalog: true,
      },
      {
        to: "/tier-pending",
        title: "Pendientes de tier",
        desc: "Workloads sin tier declarado, repartidos por el squad al que hay que reclamárselo.",
        Icon: GroupIcon,
        unit: "workloads",
      },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((section) => section.items);
const FINDING_ROUTES = ALL_ITEMS.filter((item) => !item.catalog).map((item) => item.to);

const plain = new Intl.NumberFormat("es");
const money = (value: number): string => `$${plain.format(Math.round(value))}`;

interface Severity {
  label: string;
  fg: string;
  bg: string;
}

/** Estado de un módulo según su propio volumen de hallazgos. */
const severityOf = (item: ModuleItem, metric?: HomeMetric): Severity | undefined => {
  if (item.catalog) {
    return {
      label: "Catálogo",
      fg: Colors.Text.Neutral.Default,
      bg: Colors.Background.Container.Neutral.Default,
    };
  }
  if (!metric) return undefined;
  if (metric.criticos > 0) {
    return {
      label: `${plain.format(metric.criticos)} ${metric.criticos === 1 ? "crítico" : "críticos"}`,
      fg: Colors.Text.Critical.Default,
      bg: Colors.Background.Container.Critical.Default,
    };
  }
  if (metric.hallazgos > 0) {
    return {
      label: "Atención",
      fg: Colors.Text.Warning.Default,
      bg: Colors.Background.Container.Warning.Default,
    };
  }
  return {
    label: "Sin hallazgos",
    fg: Colors.Text.Success.Default,
    bg: Colors.Background.Container.Success.Default,
  };
};

/** Etiqueta de severidad en mayúsculas, como en el diseño. */
const SeverityTag = ({ label, fg, bg }: Severity) => (
  <span
    style={{
      color: fg,
      background: bg,
      borderRadius: Borders.Radius.Field.Default,
      padding: "2px 8px",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </span>
);

interface ModuleCardProps {
  item: ModuleItem;
  accent: string;
  onResult: (route: string, metric: HomeMetric) => void;
}

/**
 * Tarjeta de módulo con su volumen real de hallazgos. Cada una consulta por su
 * cuenta: el Home pinta de inmediato y los números van llegando, en vez de
 * dejar la página en blanco hasta que respondan los doce módulos.
 */
const ModuleCard = ({ item, accent, onResult }: ModuleCardProps) => {
  const { Icon } = item;
  const { data, error, isLoading } = useDql({ query: HOME_COUNT_QUERIES[item.to] });

  const metric = useMemo(() => {
    const record = data?.records?.[0];
    return record ? toHomeMetric(record) : undefined;
  }, [data?.records]);

  const reported = useRef(false);
  useEffect(() => {
    if (metric && !reported.current) {
      reported.current = true;
      onResult(item.to, metric);
    }
  }, [metric, item.to, onResult]);

  const severity = severityOf(item, metric);
  const analysisWindow = HOME_WINDOWS[item.to];
  const { lang } = useT();

  return (
    <RouterLink
      to={item.to}
      className="ak-card"
      style={{
        textDecoration: "none",
        color: Colors.Text.Neutral.Default,
        display: "flex",
      }}
    >
      <Flex
        flexDirection="column"
        gap={12}
        padding={20}
        style={{
          flex: 1,
          minHeight: 208,
          border: `1px solid ${Colors.Border.Neutral.Default}`,
          borderRadius: Borders.Radius.Container.Default,
          background: Colors.Background.Surface.Default,
          boxShadow: BoxShadows.Surface.Raised.Rest,
        }}
      >
        <Flex alignItems="center" justifyContent="space-between" gap={8}>
          <Flex
            alignItems="center"
            justifyContent="center"
            style={{
              width: 36,
              height: 36,
              borderRadius: Borders.Radius.Container.Default,
              background: Colors.Background.Container.Neutral.Default,
              color: accent,
              flexShrink: 0,
            }}
          >
            <Icon size={20} />
          </Flex>
          {severity && <SeverityTag {...severity} />}
        </Flex>

        <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
          <Heading level={6} style={{ color: Colors.Text.Neutral.Default }}>
            {item.title}
          </Heading>
          <Text style={{ color: Colors.Text.Neutral.Subdued }}>{item.desc}</Text>
        </Flex>

        <Flex
          alignItems="baseline"
          gap={6}
          paddingTop={12}
          style={{ borderTop: `1px solid ${Colors.Border.Neutral.Subdued}` }}
        >
          {isLoading && <Skeleton width={72} height={28} />}
          {error && <Text style={{ color: Colors.Text.Critical.Default }}>sin datos</Text>}
          {metric && (
            <>
              <span style={{ fontSize: 28, fontWeight: 600, color: Colors.Text.Neutral.Default }}>
                {plain.format(metric.hallazgos)}
              </span>
              <Text style={{ color: Colors.Text.Neutral.Subdued }}>{item.unit}</Text>
            </>
          )}
        </Flex>

        {analysisWindow && (
          <Flex alignItems="center" gap={6}>
            <ClockIcon size={12} style={{ color: Colors.Text.Neutral.Subdued, flexShrink: 0 }} />
            <Text style={{ color: Colors.Text.Neutral.Subdued, fontSize: 12 }}>
              {windowLabel(analysisWindow, lang)}
            </Text>
          </Flex>
        )}
      </Flex>
    </RouterLink>
  );
};

/** Una línea del desglose del tooltip: concepto, cifra y de dónde sale. */
const BreakdownLine = ({ label, value, source }: { label: string; value: string; source: string }) => (
  <Flex justifyContent="space-between" gap={16}>
    <Text style={{ color: Colors.Text.Neutral.Default }}>
      <strong>{label}</strong> {source}
    </Text>
    <Text style={{ color: Colors.Text.Neutral.Default, whiteSpace: "nowrap" }}>{value}</Text>
  </Flex>
);

/**
 * Explica de dónde sale el desperdicio estimado. El KPI suma tres módulos que
 * miden el mismo dinero desde ángulos distintos, así que además del desglose
 * hay que decir que se solapan: es un techo, no una factura.
 */
const WasteBreakdown = ({ metrics }: { metrics: Record<string, HomeMetric> }) => (
  <Flex flexDirection="column" gap={8} style={{ maxWidth: 380 }}>
    <Text style={{ color: Colors.Text.Neutral.Default }}>
      Se valoriza la capacidad reservada y no aprovechada, a{" "}
      <strong>{money(USD_VCPU_MONTH)} por vCPU al mes</strong> y{" "}
      <strong>{money(USD_GB_MONTH)} por GB de RAM al mes</strong> (nodo AKS Dv5 aproximado,
      prorrateado mitad CPU y mitad memoria).
    </Text>
    <BreakdownLine
      label="Rightsizing"
      source="— lo que los pods reservan y no usan (request menos uso real)."
      value={money(metrics["/rightsizing"]?.usd ?? 0)}
    />
    <BreakdownLine
      label="Ociosos"
      source="— la reserva completa de los workloads sin actividad."
      value={money(metrics["/idle"]?.usd ?? 0)}
    />
    <BreakdownLine
      label="Nodos"
      source="— capacidad de nodo que ningún pod solicitó."
      value={money(metrics["/nodes"]?.usd ?? 0)}
    />
    <Text style={{ color: Colors.Text.Neutral.Subdued }}>
      Los tres se solapan: un pod sobredimensionado también deja capacidad libre en su nodo, y
      un workload ocioso aparece además con slack en rightsizing. Tómalo como el techo del
      desperdicio, no como una factura.
    </Text>
  </Flex>
);

interface StatProps {
  Icon: IconType;
  value: string;
  label: string;
  ready: boolean;
  /** Cómo se calcula este número; se muestra al pasar el cursor. */
  detail: ReactNode;
}

/** KPI de la banda superior: el agregado de todos los módulos de hallazgos. */
const Stat = ({ Icon, value, label, ready, detail }: StatProps) => (
  <Tooltip text={detail} placement="bottom">
    <Flex gap={12} alignItems="flex-start" style={{ cursor: "help" }}>
      <Icon
        size={24}
        style={{ color: Colors.Text.Neutral.OnAccent.Default, flexShrink: 0, marginTop: 2 }}
      />
      <Flex flexDirection="column" gap={4}>
        {ready ? (
          <span
            style={{
              fontSize: 32,
              fontWeight: 600,
              lineHeight: 1,
              color: Colors.Text.Neutral.OnAccent.Default,
            }}
          >
            {value}
          </span>
        ) : (
          <Skeleton width={64} height={32} />
        )}
        <Text style={{ color: Colors.Text.Neutral.OnAccent.DefaultHover, fontSize: 13 }}>
          {label}
        </Text>
      </Flex>
    </Flex>
  </Tooltip>
);

export const Home = () => {
  const [metrics, setMetrics] = useState<Record<string, HomeMetric>>({});

  const onResult = useCallback((route: string, metric: HomeMetric) => {
    setMetrics((previous) => ({ ...previous, [route]: metric }));
  }, []);

  // Los totales solo suman módulos de hallazgos: el catálogo de tiers es
  // inventario, no trabajo pendiente.
  const totals = useMemo(() => {
    const loaded = FINDING_ROUTES.filter((route) => metrics[route]);
    return {
      ready: loaded.length === FINDING_ROUTES.length,
      hallazgos: loaded.reduce((sum, route) => sum + metrics[route].hallazgos, 0),
      criticos: loaded.reduce((sum, route) => sum + metrics[route].criticos, 0),
      usd: loaded.reduce((sum, route) => sum + (metrics[route].usd ?? 0), 0),
      cumplimiento: metrics["/compliance"]?.pct,
    };
  }, [metrics]);

  return (
    <Flex
      flexDirection="column"
      padding={32}
      gap={40}
      style={{ maxWidth: 1180, margin: "0 auto", width: "100%" }}
    >
      {/* Efecto de elevación al pasar el cursor por una tarjeta. */}
      <style>{`
        .ak-card > div { transition: box-shadow 120ms ease, transform 120ms ease, border-color 120ms ease; }
        .ak-card:hover > div {
          box-shadow: ${BoxShadows.Surface.Raised.Hover};
          transform: translateY(-2px);
          border-color: ${Colors.Border.Primary.Default};
        }
      `}</style>

      {/* Hero */}
      <Flex flexDirection="column" gap={12} style={{ maxWidth: 720 }}>
        <Text
          style={{
            color: Colors.Text.Primary.Default,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontSize: 12,
          }}
        >
          Vista general del clúster
        </Text>
        <Heading level={1}>¿Cuántos problemas tengo ahora mismo?</Heading>
        <Paragraph style={{ color: Colors.Text.Neutral.Subdued }}>
          {/*
            De dónde sale el nombre: se pregunta seguido, pero es una respuesta
            que cada quien lee una sola vez. Va colgada de la palabra misma
            —subrayado punteado, se abre al hacer clic— en vez de ocupar un
            bloque fijo que el resto de las visitas tiene que saltarse.
          */}
          <TerminologyOverlay>
            <TerminologyOverlay.Trigger>ArchorKube</TerminologyOverlay.Trigger>
            <TerminologyOverlay.Description>
              <em>Arch</em> de arquitectura y <em>arconte</em> —del griego <em>arkhon</em>,
              «el que gobierna»: los magistrados que orquestaban el estado— sobre{" "}
              <em>Kube</em>rnetes. Esa es la idea: no un tablero más que reporta, sino el que
              manda en la cola, poniéndole dueño, criticidad y orden de atención a cada
              hallazgo para que el caos operativo no se gobierne solo.
            </TerminologyOverlay.Description>
          </TerminologyOverlay>{" "}
          revisa costos, confiabilidad y cumplimiento sobre datos en vivo de Grail. Este
          resumen agrupa cada módulo por lo que resuelve, con el volumen de hallazgos que te
          espera adentro y la ventana de datos que analiza cada uno.
        </Paragraph>
      </Flex>

      {/* Banda de KPIs agregados */}
      <Flex
        padding={24}
        style={{
          background: Colors.Background.Container.Primary.Accent,
          borderRadius: Borders.Radius.Container.Default,
          boxShadow: BoxShadows.Surface.Raised.Rest,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 24,
            width: "100%",
          }}
        >
          <Stat
            Icon={WarningIcon}
            ready={totals.ready}
            value={plain.format(totals.hallazgos)}
            label="Hallazgos abiertos en el clúster"
            detail="Suma de las filas que devuelve cada módulo de hallazgos, con el mismo criterio que verás al entrar. El catálogo de Tiers no suma: es inventario, no trabajo pendiente."
          />
          <Stat
            Icon={CriticalIcon}
            ready={totals.ready}
            value={plain.format(totals.criticos)}
            label="De máxima prioridad en su módulo"
            detail="Hallazgos en el peor escalón que define cada módulo: throttling crítico en rightsizing, OOM kill en preventiva, ocioso confirmado, riesgo de caída con los tres factores, y así. Cada módulo fija el suyo."
          />
          <Stat
            Icon={MoneyIcon}
            ready={totals.ready}
            value={money(totals.usd)}
            label="Desperdicio estimado por mes"
            detail={<WasteBreakdown metrics={metrics} />}
          />
          <Stat
            Icon={CheckmarkIcon}
            ready={totals.cumplimiento !== undefined}
            value={`${totals.cumplimiento ?? 0}%`}
            label="Cumplimiento del estándar AKS"
            detail="Promedio del porcentaje de cumplimiento de las 8 SPECs del estándar AKS (limits, requests, probes, non-root, Helm) sobre todos los workloads evaluados."
          />
        </div>
      </Flex>

      {/* Secciones de módulos */}
      {SECTIONS.map((section) => {
        const findings = section.items.filter((item) => !item.catalog);
        const loaded = findings.filter((item) => metrics[item.to]);
        const sectionTotal = loaded.reduce((sum, item) => sum + metrics[item.to].hallazgos, 0);

        return (
          <Flex key={section.title} flexDirection="column" gap={12}>
            <Flex
              justifyContent="space-between"
              alignItems="baseline"
              gap={16}
              paddingBottom={12}
              style={{ borderBottom: `1px solid ${Colors.Border.Neutral.Subdued}` }}
            >
              <Heading level={3} style={{ color: section.accent }}>
                {section.title}
              </Heading>
              {loaded.length === findings.length && (
                <Text style={{ color: Colors.Text.Neutral.Subdued, whiteSpace: "nowrap" }}>
                  {plain.format(sectionTotal)} hallazgos
                </Text>
              )}
            </Flex>
            <Text style={{ color: Colors.Text.Neutral.Subdued }}>{section.blurb}</Text>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))",
                gap: 16,
                width: "100%",
              }}
            >
              {section.items.map((item) => (
                <ModuleCard
                  key={item.to}
                  item={item}
                  accent={section.accent}
                  onResult={onResult}
                />
              ))}
            </div>
          </Flex>
        );
      })}
    </Flex>
  );
};
