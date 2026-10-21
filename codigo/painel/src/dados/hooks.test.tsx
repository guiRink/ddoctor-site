import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ATUALIZACAO_MS, opcoesAtualizacao, repositorio, useOSs } from "./hooks";

describe("atualização periódica (TV, Produção, Minhas tarefas)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("TV a cada 20 s mesmo em segundo plano; quadro a cada 30 s só com a aba visível; o resto não", () => {
    expect(opcoesAtualizacao("tv")).toEqual({ refetchInterval: 20_000, refetchIntervalInBackground: true });
    expect(opcoesAtualizacao("quadro")).toEqual({ refetchInterval: 30_000, refetchIntervalInBackground: false });
    expect(opcoesAtualizacao()).toEqual({});
    expect(ATUALIZACAO_MS.tv).toBeLessThan(60_000); // a TV avisa "desatualizado" depois de 1 min
  });

  it("useOSs('tv') recarrega sozinho, sem depender do tempo real", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const listar = vi.spyOn(repositorio, "listarOS").mockResolvedValue([]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const envolver = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useOSs("tv"), { wrapper: envolver });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(ATUALIZACAO_MS.tv);
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(ATUALIZACAO_MS.tv);
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(3));
    unmount();
    qc.clear();
  });
});
