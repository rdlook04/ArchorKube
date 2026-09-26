import { businessEventsClient } from "@dynatrace-sdk/client-classic-environment-v2";

import type { DataMode } from "./redact";

export type Destination = "ollama" | "clipboard";

export interface SendRecord {
  destination: Destination;
  module: string;
  mode: DataMode;
  /** Categorías reemplazadas ($NS, <kube-context>…), nunca los valores reales. */
  replaced: string[];
  /** Si el usuario editó el texto en la vista previa antes de enviarlo. */
  edited: boolean;
  chars: number;
}

/**
 * Registra cada envío fuera de Dynatrace como bizevent, para poder responder
 * "qué se mandó y a qué IA" sin guardar lo que se mandó: el evento NUNCA
 * lleva el texto ni nombres de workloads.
 *
 * Consultable con:
 *   fetch bizevents | filter event.type == "my.archor.kube.prompt.sent"
 *
 * Si falla (scope sin consentir, licencia) el envío ya ocurrió; no se bloquea
 * al usuario por la auditoría.
 */
export const recordSend = (record: SendRecord): void => {
  businessEventsClient
    .ingest({
      type: "application/cloudevent+json",
      body: {
        specversion: "1.0",
        id: crypto.randomUUID(),
        source: "my.archor.kube",
        type: "my.archor.kube.prompt.sent",
        data: {
          destination: record.destination,
          module: record.module,
          data_mode: record.mode,
          replaced: record.replaced.join(" "),
          edited: record.edited,
          chars: record.chars,
        },
      },
    })
    .catch((error: unknown) => {
      console.warn("ArchorKube: could not record the send", error);
    });
};
