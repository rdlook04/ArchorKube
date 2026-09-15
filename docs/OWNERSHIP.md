# La capa de propiedad

Cómo ArchorKube averigua de quién es cada workload, y cómo cambiarlo.

## Por qué existe

Los módulos de análisis son Kubernetes genérico: throttling es throttling en cualquier cluster. Lo único que cambia de una organización a otra es **cómo se sabe quién es el dueño de un workload y qué tan crítico es**. Unas tienen un IDP, otras etiquetan, otras tienen una hoja de cálculo, y muchas no tienen nada.

Por eso esa decisión vive en un solo punto del código. Los módulos de análisis no saben —ni deben saber— de dónde salió el tier. Cambiar de fuente no toca ninguna consulta.

```
ui/app/ownership/
├── types.ts       el contrato
├── labels.ts      proveedor: labels/annotations de K8s
├── namespace.ts   proveedor: el namespace es el equipo
├── manual.ts      proveedor: reglas declaradas
├── none.ts        proveedor: sin propiedad
├── chain.ts       encadena varios
└── active.ts      ← el único archivo que configuras
```

## El contrato

Un proveedor emite **fragmentos de DQL, no datos**. El enriquecimiento ocurre dentro de la misma consulta que produce el hallazgo, para que filtrar por tier no obligue a traer todas las filas al navegador.

```ts
interface OwnershipProvider {
  id: string;
  label: string;
  about: string;
  enrich(sourceField: string, suffix?: string): string;
  filterOptions: string;
  catalog: string | null;
}
```

`enrich()` debe dejar disponibles exactamente cuatro campos — `tier`, `squad`, `tribu`, `appCode` — y en `null` cuando no se conocen. Nunca omitirlos: los módulos cuentan con que existan.

El parámetro `suffix` es para poder encadenar sin que los proveedores se pisen los nombres. Un proveedor usado solo nunca lo recibe.

## Elegir proveedor

Todo se decide en `ui/app/ownership/active.ts`:

```ts
export const ownership = chainProviders(
  manualProvider(EXCEPCIONES),
  labelsProvider,
  namespaceProvider,
);
```

El orden importa: gana el primero que resuelve **cada campo**, no el primero que responde algo. Un workload puede sacar el squad de su label y el tier de una regla manual — que es el caso real más común, porque tener dueño sin tier es lo normal.

Poner las excepciones manuales primero es deliberado: es la vía para corregir a mano lo que la fuente principal resuelve mal, sin tocar la fuente.

## Los proveedores

### `labelsProvider` — labels y annotations

El default. Lee la propiedad del propio workload. Las **annotations ganan sobre las labels**, porque las labels de un pod template son inmutables en algunos controladores y las annotations no, así que son la vía para sobrescribir un workload puntual.

Las claves se cambian en un solo sitio:

```ts
export const OWNERSHIP_KEYS = {
  tier: "archorkube.io/tier",
  squad: "archorkube.io/owner",
  tribu: "archorkube.io/domain",
  appCode: "app.kubernetes.io/part-of",
};
```

> **Verifica esto antes de confiar en él.** El nombre de las propiedades de entidad donde Grail guarda labels y annotations varía según la versión del operador de Kubernetes y de qué esté configurado para ingerirse. En un notebook:
>
> ```
> describe dt.entity.cloud_application
> ```
>
> Los nombres verificados contra un tenant real son **`cloudApplicationLabels`** y **`kubernetesAnnotations`**. No es `kubernetesLabels`: ese campo no existe, y usarlo no degrada el enriquecimiento — **hace fallar la consulta entera**, así que se cae el módulo completo.
>
> Si las labels no llegan, el operador no las está enviando. Usa `manual` o `namespace`: la app no puede inventarlas.

> **Las claves casi nunca son las del ejemplo.** En clusters reales lo habitual es encontrar convenciones propias ya establecidas (`squad`, `tribu`, `<dominio>/tier`, `application-code`) con muy buena cobertura. Antes de proponer reetiquetar nada, mira qué hay:
>
> ```
> fetch dt.entity.cloud_application
> | fieldsAdd sq = cloudApplicationLabels[`squad`]
> | summarize total = count(), con_squad = countIf(isNotNull(sq))
> ```
>
> Apuntar `OWNERSHIP_KEYS` a las claves que ya existen cuesta una línea; reetiquetar mil workloads, no.

### `namespaceProvider` — el namespace es el equipo

El más burdo y a la vez el que más veces acierta en clusters sin gobierno. No deduce tier ni dominio, solo dueño, y eso es correcto: derivar un tier del nombre de un namespace sería adivinar.

Pensado como último eslabón de una cadena.

### `manualProvider` — reglas declaradas

Funciona siempre, incluso sin labels ni catálogo. Se compila a una cadena de `if()` en DQL.

```ts
manualProvider([
  { match: "checkout-", prefix: true, squad: "squad-payments", tier: "1" },
  { match: "batch-reconcile", squad: "squad-finops", tier: "3" },
]);
```

Se evalúan en orden y gana la primera que coincide, así que las reglas específicas van arriba. Escala hasta unas pocas cientas; con miles conviene un lookup en Grail.

### `noneProvider` — sin propiedad

Todos los módulos corren igual. Solo se pierde el agrupado por equipo. Existe para que la app sea útil desde el primer minuto en un cluster del que no se sabe nada.

## Escribir uno nuevo

Es lo más útil que se puede aportar al proyecto. Unas 40 líneas:

```ts
import type { OwnershipProvider } from "./types";

export const backstageProvider: OwnershipProvider = {
  id: "backstage",
  label: "Catálogo de Backstage",

  // Se muestra al usuario en la página de Tiers. Debe decir qué pasa cuando
  // el dato falta, no solo cuando está.
  about: "La propiedad sale del catálogo de Backstage cargado como lookup…",

  enrich: (sourceField, suffix = "") => `| lookup [
    load "/lookups/backstage/components"
    | fields name, owner, tier
  ], sourceField:${sourceField}, lookupField:name,
     fields:{squad${suffix} = owner, tier${suffix} = tier}
| fieldsAdd tribu${suffix} = null, appCode${suffix} = null`,

  filterOptions: `load "/lookups/backstage/components"
| summarize by:{squad = owner, tier}
| sort squad asc`,

  catalog: null,
};
```

Reglas:

1. **Emite siempre los cuatro campos.** Los que tu fuente no conozca van en `null`, no ausentes.
2. **Respeta `suffix`** en todos los nombres que emitas, o romperás el encadenado.
3. **`filterOptions` vacío** si no puedes enumerar las opciones por adelantado — la UI esconde los selectores en vez de mostrarlos vacíos.
4. **`catalog: null`** si tu fuente solo resuelve workload por workload y no tiene una tabla que listar. La página de Tiers cae entonces al inventario de workloads vivos, que además muestra los que nadie reclamó.
5. **No inventes dueños.** Un `null` visible vale más que un dueño equivocado: el hueco es accionable, el dato falso no.

Regístralo en `availableProviders` y úsalo en `ownership`.
