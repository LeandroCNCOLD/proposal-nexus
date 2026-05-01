import { strict as assert } from "node:assert";
import {
  buildProposalDocumentContextFromRecords,
  resolveProposalVariable,
  resolveProposalVariablesInText,
} from "./document-context";

const context = buildProposalDocumentContextFromRecords({
  proposal: {
    number: "CN-2026-0329",
    title: "Projeto Citrosuco",
    total_value: 122000,
    payment_terms: "36 parcelas",
  },
  client: {
    name: "CITROSUCO S/A",
    document: "33.010.786/0001-87",
    city: "Matão",
    state: "SP",
  },
  contact: {
    name: "Leonardo",
    email: "cliente@example.com",
  },
  template: {
    empresa_nome: "CN Cold",
    empresa_telefone: "(11) 4054-4192",
    empresa_email: "contato@cncold.com.br",
    empresa_site: "www.cncold.com.br",
    empresa_cidade: "Diadema/SP",
    dados_bancarios: { banco: "Bradesco", agencia: "0272", conta: "94183-2" },
  } as never,
});

assert.equal(resolveProposalVariable("proposal.number", context), "CN-2026-0329");
assert.equal(resolveProposalVariable("proposal_number", context), "CN-2026-0329");
assert.equal(resolveProposalVariable("client.name", context), "CITROSUCO S/A");
assert.equal(resolveProposalVariable("client.document", context), "33.010.786/0001-87");
assert.equal(resolveProposalVariable("company.phone", context), "(11) 4054-4192");
assert.equal(resolveProposalVariable("missing.value", context), "—");
assert.equal(
  resolveProposalVariablesInText("Cliente {{client.name}} · Proposta {{proposal.number}}", context),
  "Cliente CITROSUCO S/A · Proposta CN-2026-0329",
);

console.log("document-context tests passed");
