import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { Login, SemAcesso } from "./Login";

const auth = vi.hoisted(() => ({ temDono: null as boolean | null }));
vi.mock("../dados/autenticacao", async (original) => ({
  ...(await original<typeof import("../dados/autenticacao")>()),
  useOficinaTemDono: () => ({ data: auth.temDono }),
}));

const comConsultas = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe("tela de login", () => {
  it("campos com rótulo, erro no campo certo e sem ir ao servidor quando vazio", async () => {
    comConsultas(<Login />);
    expect(screen.getByLabelText("Usuário ou e-mail")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Digite o seu usuário");
    expect(screen.getByLabelText("Usuário ou e-mail")).toHaveAttribute("aria-invalid", "true");
  });

  it("mostrar a senha, esqueci a senha e o caminho para a demonstração", () => {
    comConsultas(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar a senha" }));
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Esqueci a senha" }));
    expect(screen.getByText(/Peça ao dono para redefinir em/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver demonstração" }).getAttribute("href")).toMatch(/\?demo=1$/);
    expect(screen.getByText("Primeiro acesso da oficina")).toBeInTheDocument();
  });
});

describe("primeiro acesso da oficina", () => {
  const passo = () => screen.getByText("Primeiro acesso da oficina").closest("details")!;

  it("sem dono com login (oficina_tem_dono = falso): o passo a passo já vem aberto", () => {
    auth.temDono = false;
    comConsultas(<Login />);
    expect(passo()).toHaveAttribute("open");
    expect(screen.getByText(/ainda não tem dono com login/)).toBeInTheDocument();
  });

  it("com dono, ou sem saber: fica recolhido", () => {
    auth.temDono = true;
    const { unmount } = comConsultas(<Login />);
    expect(passo()).not.toHaveAttribute("open");
    unmount();
    auth.temDono = null;
    comConsultas(<Login />);
    expect(passo()).not.toHaveAttribute("open");
  });
});

describe("sem acesso", () => {
  it("login sem perfil: explica o primeiro acesso e deixa sair", () => {
    const sair = vi.fn();
    render(<SemAcesso acesso={{ estado: "sem_perfil" }} email="dono@exemplo.test" onSair={sair} />);
    expect(screen.getByRole("heading", { name: "Sem acesso — fale com o dono" })).toBeInTheDocument();
    expect(screen.getByText(/definir_primeiro_dono/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(sair).toHaveBeenCalled();
  });

  it("perfil desligado: sem o passo a passo", () => {
    render(<SemAcesso acesso={{ estado: "inativo", nome: "Diego" }} onSair={() => {}} />);
    expect(screen.getByText(/O cadastro de Diego está desligado/)).toBeInTheDocument();
    expect(screen.queryByText(/definir_primeiro_dono/)).toBeNull();
  });
});
