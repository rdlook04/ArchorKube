/**
 * Capa de propiedad. Todo el resto de la app importa desde aquí y nunca desde
 * un proveedor concreto, para que cambiar de fuente no toque ningún módulo.
 */
export type { OwnershipProvider, OwnershipField } from "./types";
export { OWNERSHIP_FIELDS } from "./types";

export { labelsProvider, OWNERSHIP_KEYS } from "./labels";
export { manualProvider, DEFAULT_RULES } from "./manual";
export type { OwnershipRule } from "./manual";
export { namespaceProvider } from "./namespace";
export { noneProvider } from "./none";
export { chainProviders } from "./chain";

export { ownership, availableProviders } from "./active";
