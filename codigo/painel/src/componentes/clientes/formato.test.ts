import { describe, expect, it } from "vitest";
import type { ClienteResumo } from "../../dados/repositorio";
import {
  formatarTelefone,
  linhasEndereco,
  linkWhatsApp,
  mascaraCEP,
  mascaraDocumento,
  mascaraTelefone,
  nomeVeiculo,
  resumoCorresponde,
  telefoneCompleto,
} from "./formato";

describe("formato de clientes", () => {
  it("formata telefone guardado em E.164", () => {
    expect(formatarTelefone("+5541999990000")).toBe("(41) 99999-0000");
    expect(formatarTelefone("+554133330000")).toBe("(41) 3333-0000");
    expect(formatarTelefone(undefined)).toBe("");
  });

  it("monta o link do WhatsApp sem máscara", () => {
    expect(linkWhatsApp("+5541999990000")).toBe("https://wa.me/5541999990000");
    expect(linkWhatsApp("(41) 99999-0000")).toBe("https://wa.me/5541999990000");
  });

  it("aplica a máscara de telefone durante a digitação", () => {
    expect(mascaraTelefone("4")).toBe("(4");
    expect(mascaraTelefone("41999")).toBe("(41) 999");
    expect(mascaraTelefone("4133330000")).toBe("(41) 3333-0000");
    expect(mascaraTelefone("41999990000")).toBe("(41) 99999-0000");
    expect(mascaraTelefone("4199999000012")).toBe("(41) 99999-0000");
    expect(telefoneCompleto("(41) 9999")).toBe(false);
    expect(telefoneCompleto("")).toBe(true);
  });

  it("aplica a máscara de CPF e CNPJ (inclusive alfanumérico)", () => {
    expect(mascaraDocumento("1234")).toBe("123.4");
    expect(mascaraDocumento("12345678901")).toBe("123.456.789-01");
    expect(mascaraDocumento("123456789012")).toBe("12.345.678/9012");
    expect(mascaraDocumento("12345678000195", "pj")).toBe("12.345.678/0001-95");
    expect(mascaraDocumento("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
    expect(mascaraDocumento("123456789012345", "pf")).toBe("123.456.789-01");
  });

  it("aplica a máscara do CEP", () => {
    expect(mascaraCEP("80000")).toBe("80000");
    expect(mascaraCEP("80000123")).toBe("80000-123");
  });

  it("monta o endereço em duas linhas", () => {
    expect(
      linhasEndereco({ cep: "80000123", logradouro: "Rua Exemplo", numero: "10", complemento: "Sala 2", bairro: "Centro", cidade: "Curitiba", uf: "PR" }),
    ).toEqual(["Rua Exemplo, 10 · Sala 2", "Centro · Curitiba/PR · 80000-123"]);
  });

  it("não repete a marca no nome do veículo", () => {
    expect(nomeVeiculo({ marca: "Jeep", modelo: "Jeep Compass" })).toBe("Jeep Compass");
    expect(nomeVeiculo({ marca: "Mercedes-Benz", modelo: "Mercedes C180" })).toBe("Mercedes C180");
    expect(nomeVeiculo({ marca: "Fiat", modelo: "Toro" })).toBe("Fiat Toro");
    expect(nomeVeiculo({})).toBe("Modelo não informado");
  });

  it("encontra o cliente pela placa de um veículo", () => {
    const r: ClienteResumo = {
      cliente: { id: "c-1", nome: "Cliente Exemplo" },
      veiculos: [{ id: "v-1", placa: "ABC1D23" }],
      quantidadeOS: 0,
      totalPago: 0,
    };
    expect(resumoCorresponde(r, "abc-1d")).toBe(true);
    expect(resumoCorresponde(r, "exemplo")).toBe(true);
    expect(resumoCorresponde(r, "XYZ")).toBe(false);
  });
});
