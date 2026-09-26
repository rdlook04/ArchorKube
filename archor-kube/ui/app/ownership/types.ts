import type { Lang, Localized } from "../i18n";

/**
 * Capa de propiedad (ownership): cómo un workload de Kubernetes se convierte en
 * `{ tier, squad, tribu, appCode }`.
 *
 * Es el ÚNICO punto de la app que depende de cómo cada organización registra a
 * los dueños de sus servicios. Todo lo demás (M1–M11, umbrales, UI, auditoría)
 * es Kubernetes genérico y no debe saber de dónde salió el tier.
 *
 * Un proveedor emite fragmentos de DQL, no datos: el enriquecimiento ocurre
 * dentro de la misma consulta que produce el hallazgo, para que filtrar por
 * tier no obligue a traer todas las filas al navegador.
 *
 * CONTRATO: `enrich()` debe dejar disponibles exactamente estos cuatro campos,
 * en null cuando no se conocen. Ningún módulo debe asumir que existen otros.
 */
/**
 * Texto de un proveedor: simple (un solo idioma, como puede venir de un
 * port.ts local) o en los dos idiomas.
 */
export type ProviderText = string | Localized;

/** Resuelve un ProviderText al idioma pedido. */
export const providerText = (text: ProviderText, lang: Lang): string =>
  typeof text === "string" ? text : text[lang];

export const OWNERSHIP_FIELDS = ["tier", "squad", "tribu", "appCode"] as const;

export type OwnershipField = (typeof OWNERSHIP_FIELDS)[number];

export interface OwnershipProvider {
  /** Identificador estable; se persiste en la configuración de la app. */
  id: string;
  /** Nombre visible en Settings. */
  label: ProviderText;
  /**
   * Explicación de la fuente para el panel "de dónde salen estos datos".
   * Se muestra tal cual al usuario, así que debe decir qué pasa cuando el dato
   * falta, no solo cuando está.
   */
  about: ProviderText;
  /**
   * Fragmento DQL que agrega los campos del contrato a partir de `sourceField`
   * (el campo de la consulta que trae el nombre del workload/contenedor).
   *
   * `suffix` existe para poder encadenar varios proveedores sin que se pisen
   * los nombres: con suffix "_1" el proveedor emite `tier_1`, `squad_1`, etc.
   * Un proveedor usado solo nunca recibe suffix.
   */
  enrich: (sourceField: string, suffix?: string) => string;
  /**
   * DQL que alimenta los selectores transversales (tier/squad/tribu).
   * Cadena vacía = este proveedor no puede enumerar opciones por adelantado;
   * la UI entonces esconde los selectores en vez de mostrarlos vacíos.
   */
  filterOptions: string;
  /**
   * DQL del inventario completo para la página de Tiers, si el proveedor tiene
   * un catálogo propio que listar. `null` cuando la propiedad solo existe
   * pegada a los workloads y no hay una tabla que mostrar.
   *
   * Entrega filas sin ordenar: el `sort` lo pone quien consume, porque cada
   * vista ordena distinto y un sort propio quedaria despues del `limit`.
   */
  catalog: string | null;
  /**
   * Consulta que devuelve los nombres **canónicos** de equipos y dominios, en
   * los campos `squad_canon` y `tribu_canon`. Solo la declara una fuente
   * autoritativa (un catálogo); las que leen del propio workload, no.
   *
   * Sirve para que al encadenar fuentes el mismo equipo no aparezca dos veces
   * con dos grafías (`Data Ninjas` del catálogo y `dataninjas` de una label). Ver
   * `canonical.ts`.
   *
   * Que sea la consulta más barata que los liste: se ejecuta una vez por cada
   * consulta de módulo, así que conviene la tabla de equipos y no el inventario
   * completo de servicios.
   */
  canonicalNames?: string;
}
