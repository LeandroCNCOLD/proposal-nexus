import { strict as assert } from "node:assert";
import {
  mapNomusCostToProductCost,
  mapNomusPriceToCatalogPrice,
  mapNomusProductToCatalogProduct,
} from "@/modules/nomus/mappers";
import { validateCatalogProduct } from "@/modules/catalog/validation";
import type { CatalogProduct } from "@/modules/catalog/types";

const product = mapNomusProductToCatalogProduct({
  id: "10",
  codigo: "  abc-123 ",
  descricao: "Evaporador industrial",
  categoria: "Evaporadores",
  unidadeMedida: "un",
  ativo: true,
  ncm: "8418.99.00",
});

assert.equal(product.id, "10");
assert.equal(product.codigo, "ABC-123");
assert.equal(product.nome, "Evaporador industrial");
assert.equal(product.unidade, "UN");
assert.equal(product.status, "ativo");

const price = mapNomusPriceToCatalogPrice({
  idProduto: "10",
  idTabelaPreco: "T1",
  nomeTabelaPreco: "Tabela padrão",
  precoVenda: "1.250,50",
  moeda: "brl",
  validade: "2099-12-31",
  status: "ativo",
});

assert.equal(price.produtoId, "10");
assert.equal(price.tabelaId, "T1");
assert.equal(price.tabelaNome, "Tabela padrão");
assert.equal(price.precoVenda, 1250.5);
assert.equal(price.moeda, "BRL");

const cost = mapNomusCostToProductCost({
  idProduto: "10",
  custoMaterial: "500,00",
  custoMaoObra: "100,00",
  custoTerceiros: "50,00",
});

assert.equal(cost.produtoId, "10");
assert.equal(cost.custoTotal, 650);

const nullProduct = mapNomusProductToCatalogProduct({
  id: null,
  codigo: null,
  descricao: null,
  ativo: false,
});

assert.equal(nullProduct.codigo, null);
assert.equal(nullProduct.nome, null);
assert.equal(nullProduct.status, "inativo");

const incomplete: CatalogProduct = {
  ...nullProduct,
  id: "missing",
  codigo: "",
  nome: "Produto incompleto",
  status: "ativo",
};
const missingPriceWarnings = validateCatalogProduct({
  product: incomplete,
  prices: [],
  costs: [cost],
}).warnings;
assert.ok(missingPriceWarnings.some((warning) => warning.code === "missing_product_code"));
assert.ok(missingPriceWarnings.some((warning) => warning.code === "missing_price"));

const missingCostWarnings = validateCatalogProduct({
  product,
  prices: [price],
  costs: [],
}).warnings;
assert.ok(missingCostWarnings.some((warning) => warning.code === "missing_cost"));

const expiredPrice = { ...price, validade: "2000-01-01" };
const expiredWarnings = validateCatalogProduct({
  product,
  prices: [expiredPrice],
  costs: [cost],
}).warnings;
assert.ok(expiredWarnings.some((warning) => warning.code === "expired_price_table"));

const highCostWarnings = validateCatalogProduct({
  product,
  prices: [{ ...price, precoVenda: 100 }],
  costs: [{ ...cost, custoTotal: 200 }],
}).warnings;
assert.ok(highCostWarnings.some((warning) => warning.code === "cost_greater_than_price"));
