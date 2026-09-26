import { queryExecutionClient } from "@dynatrace-sdk/client-query";

export type Records = Record<string, unknown>[];

/**
 * Corre una DQL y espera el resultado. Los chequeos de Setup no usan `useDql`
 * porque corren en lote, con concurrencia limitada, y necesitan distinguir el
 * error de permisos del de datos vacíos.
 */
export const runQuery = async (query: string, maxResultRecords = 1000): Promise<Records> => {
  const start = await queryExecutionClient.queryExecute({
    body: { query, requestTimeoutMilliseconds: 30000, maxResultRecords },
  });
  let result = start.result;
  let state = start.state;
  const token = start.requestToken;
  while (!result && token && (state === "RUNNING" || state === "NOT_STARTED")) {
    const poll = await queryExecutionClient.queryPoll({
      requestToken: token,
      requestTimeoutMilliseconds: 5000,
    });
    result = poll.result;
    state = poll.state;
  }
  if (!result) throw new Error(`The query ended in state ${state}`);
  return result.records.filter((r) => r !== null);
};

/** Mensaje legible de un error del SDK (permisos, sintaxis, timeout). */
export const errorMessage = (error: unknown): string => {
  const e = error as {
    message?: string;
    body?: { error?: { message?: string; details?: { errorMessage?: string } } };
  };
  return (
    e.body?.error?.details?.errorMessage ?? e.body?.error?.message ?? e.message ?? "Unknown error"
  );
};
