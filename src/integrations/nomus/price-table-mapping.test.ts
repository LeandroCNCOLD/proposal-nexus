import { strict as assert } from "node:assert";
import {
  extractNomusPriceTableItems,
  mapNomusPriceTableItemToDb,
  parseNomusNumber,
} from "./price-table-mapping";

const response = {
  ativo: true,
  id: 92,
  nome: "Preco Chinelo HS",
  itensTabelaPreco: [
    {
      descricaoProduto: "Chinelo Azul 39-40",
      idProduto: 3129,
      nomeProduto: "CH.AZ.39.40",
      preco: "10,0000000000",
      siglaUnidadeMedidaProduto: "UND",
    },
  ],
};

assert.equal(extractNomusPriceTableItems(response).length, 1);
assert.equal(parseNomusNumber("10,0000000000"), 10);
assert.equal(parseNomusNumber("1.234,56"), 1234.56);
assert.equal(parseNomusNumber("1234.56"), 1234.56);
assert.equal(parseNomusNumber(10), 10);
assert.equal(parseNomusNumber(null), null);
assert.equal(parseNomusNumber(undefined), null);
assert.equal(parseNomusNumber(""), null);

const mapped = mapNomusPriceTableItemToDb(response.itensTabelaPreco[0], "table-db-id");

assert.equal(mapped.ok, true);
if (mapped.ok) {
  assert.equal(mapped.payload.unit_price, 10);
  assert.equal(Number(mapped.payload.nomus_product_id), 3129);
  assert.equal(mapped.payload.product_name, "CH.AZ.39.40");
  assert.equal(mapped.payload.product_description, "Chinelo Azul 39-40");
  assert.equal(mapped.payload.unidade_medida, "UND");
  assert.equal(mapped.payload.raw, response.itensTabelaPreco[0]);
}

console.log("price-table-mapping tests passed");
