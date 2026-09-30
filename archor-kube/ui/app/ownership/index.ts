/**
 * Capa de propiedad. Todo el resto de la app importa desde aquí y nunca desde
 * un proveedor concreto, para que cambiar de fuente no toque ningún módulo.
 */
export type { OwnershipProvider, OwnershipField, ProviderText } from "./types";
export { OWNERSHIP_FIELDS, providerText } from "./types";

export { labelsProvider, OWNERSHIP_KEYS } from "./labels";
export { manualProvider, DEFAULT_RULES } from "./manual";
export type { OwnershipRule } from "./manual";
export { namespaceProvider } from "./namespace";
export { noneProvider } from "./none";
export { chainProviders } from "./chain";

export { lookupProvider } from "./lookup";
export { availableProviders } from "./active";

import { ownership as configured } from "./active";
import { chainProviders } from "./chain";
import { lookupProvider } from "./lookup";

/**
 * La cadena de `active.ts`, con la tabla de dueños de Grail delante cuando
 * existe. Así una tabla subida desde Setup funciona sin tocar código, también
 * en instalaciones cuyo `active.ts` es anterior a la tabla.
 */
export const ownership =
  lookupProvider.id === "none" || configured.id.split("+").includes("lookup")
    ? configured
    : chainProviders(lookupProvider, configured);
