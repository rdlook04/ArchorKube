import {
  EXCLUDED_NAMESPACES_CONTAINING,
  EXCLUDED_NAMESPACES_EXACT,
} from "../config/site";

/**
 * Exclusión de namespaces de plataforma, compartida por todos los módulos.
 *
 * Qué se excluye es decisión de cada instalación y vive en `config/site.ts`;
 * aquí solo se compila esa decisión a DQL.
 */

const quoted = (values: string[]): string =>
  `{${values.map((v) => `"${v.replace(/["\\]/g, "")}"`).join(", ")}}`;

/**
 * Cláusula `filterOut` para descartar los namespaces de plataforma. Se aplica
 * sobre `k8s.namespace.name`, así que va después de que ese campo exista.
 */
export const excludedNamespacesClause = (): string =>
  [
    ...(EXCLUDED_NAMESPACES_EXACT.length
      ? [`| filterOut in(k8s.namespace.name, ${quoted(EXCLUDED_NAMESPACES_EXACT)})`]
      : []),
    ...EXCLUDED_NAMESPACES_CONTAINING.map(
      (needle) =>
        `| filterOut contains(k8s.namespace.name, "${needle.replace(/["\\]/g, "")}")`,
    ),
  ].join("\n");
