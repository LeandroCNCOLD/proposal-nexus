# Relatório Final — Auditoria KFCalc / ColdPro em 680 Casos

## 1. Resumo executivo

Esta auditoria consolidou a base histórica extraída do KFCalc (`hkitfrigor.Historico`) e comparou a soma dos componentes de carga térmica contra o total registrado (`Ctot`).

| Métrica | Resultado |
|---|---:|
| Total de registros | 680 |
| Registros válidos | 680 |
| Erro médio percentual | 0,0203% |
| Erro médio absoluto percentual | 0,0203% |
| Erro máximo percentual | 0,3386% |
| Desvio padrão percentual | 0,0350% |
| Casos OK | 680 |
| Casos em ATENÇÃO | 0 |
| Casos DIVERGENTES | 0 |

**Status geral:** OK.

Os 680 casos analisados fecham tecnicamente com diferença máxima inferior a 0,34%, indicando que a fórmula consolidada e os componentes utilizados na base KFCalc foram corretamente identificados.

---

## 2. Fórmula consolidada identificada

A fórmula consolidada observada na base KFCalc é:

```txt
Ctot = Ccam + Cpro + Ctro + Cilu + Cmot + CPes + Cout
```

Onde:

| Campo | Descrição |
|---|---|
| `Ccam` | carga da câmara / transmissão |
| `Cpro` | carga de produto |
| `Ctro` | carga por trocas de ar |
| `Cilu` | carga de iluminação |
| `Cmot` | carga de motores |
| `CPes` | carga de pessoas |
| `Cout` | outras cargas |
| `Ctot` | carga total registrada |

---

## 3. Participação média dos componentes

Participação média de cada componente em relação ao total da base:

| Componente | Participação média |
|---|---:|
| Câmara / transmissão | 35,5660% |
| Produto | 37,4732% |
| Trocas de ar | 11,8925% |
| Iluminação | 6,2715% |
| Motores | 7,8063% |
| Pessoas | 0,9950% |
| Outras cargas | 0,0000% |

As cargas auxiliares explícitas (`Cilu + Cmot + CPes`) representam em média:

```txt
15,0727% da carga total
```

---

## 4. Análise do teste sem cargas auxiliares

Foi simulada a retirada das cargas auxiliares:

```txt
Cilu + Cmot + CPes
```

Resultado:

| Métrica | Resultado |
|---|---:|
| Erro médio percentual | -14,5449% |
| Erro mínimo percentual | -84,5744% |
| Erro máximo percentual | 0,1007% |
| Desvio padrão percentual | 17,0692% |
| Casos OK | 242 |
| Casos em ATENÇÃO | 217 |
| Casos DIVERGENTES | 221 |

Interpretação:

- Sem iluminação, motores e pessoas, o cálculo passa a subdimensionar a carga térmica.
- O erro médio fica em aproximadamente **-14,54%**.
- 221 casos passam para o status **DIVERGENTE**.
- Em casos críticos, a ausência de auxiliares gera subdimensionamento acima de 75%.

---

## 5. Conclusão técnica

As cargas auxiliares são obrigatórias para compatibilidade com o KFCalc.

A análise mostra que o fechamento da carga térmica depende explicitamente de:

```txt
Ccam + Cpro + Ctro + Cilu + Cmot + CPes + Cout
```

Portanto, qualquer motor que calcule apenas produto, transmissão/trocas e infiltração, sem considerar motores, iluminação e pessoas, tende a subdimensionar a carga.

Com todos os componentes considerados, o erro médio observado foi:

```txt
0,0203%
```

Esse valor é tecnicamente desprezível e compatível com diferenças de arredondamento.

---

## 6. Recomendação para o ColdPro

Manter cálculo explícito e rastreável de:

- câmara / transmissão;
- produto;
- trocas de ar;
- infiltração;
- iluminação;
- motores;
- pessoas;
- outras cargas;
- fator de segurança.

Também é recomendado que o resultado final do ColdPro continue expondo o breakdown por componente, permitindo auditoria técnica e comparação com KFCalc/SEQCT.

Estrutura recomendada:

```ts
{
  carga_base: {
    camara,
    produto,
    trocas_ar,
    infiltracao,
    iluminacao,
    motores,
    pessoas,
    outras
  },
  fator_seguranca,
  carga_total
}
```

---

## 7. Encaminhamento

Com base nos 680 casos analisados:

1. O modelo de fechamento de carga térmica do KFCalc foi identificado.
2. A ausência de cargas auxiliares foi confirmada como causa relevante de subdimensionamento.
3. O ColdPro deve manter as cargas auxiliares como componentes obrigatórios.
4. A base KFCalc pode ser usada como referência de auditoria para futuras calibrações do ColdPro.

