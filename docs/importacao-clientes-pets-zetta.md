# Exportação para desligamento definitivo do Zetta

Este arquivo descreve o formato **normalizado** aceito pelo importador do ERP Matilha Prado. O exportador do sistema antigo pode usar outros nomes de campos; converta-os antes.

```json
{
  "clientes": [
    {
      "codigo": "123",
      "nome": "Cliente Exemplo",
      "telefone": "11999999999",
      "email": "cliente@exemplo.com",
      "cpfCnpj": null,
      "endereco": "Rua Exemplo, 12",
      "cep": "01001000",
      "pets": [
        { "codigo": "987", "nome": "Tobias", "especie": "Cão", "raca": "SRD", "idade": "3", "peso": "8kg", "observacoes": null }
      ]
    }
  ]
}
```

**Atenção:** o exemplo é fictício. Não copie o exemplo para produção. Códigos originais de clientes/pets são obrigatórios e devem ser únicos; nunca invente IDs. Nome e telefone de cliente, nome e espécie dos pets são obrigatórios. Cadastros inválidos deverão ser corrigidos/revistos antes de executar.

1. Exporte do Zetta, enquanto ele ainda está acessível, todos os clientes e pets e preserve o arquivo original em local seguro. Também guarde as notas, XMLs, vendas e movimentos de estoque.
2. Faça backup do PostgreSQL atual. Revise as chaves externas, as duplicações e o volume. Na captura enviada havia **290 clientes e 416 pets**; esses números são apenas uma referência visual, **não uma validação do banco**.
3. Normalize a exportação para o JSON acima. Cuidado com dados pessoais (LGPD), acesso restrito e descarte seguro de cópias transitórias.
4. Rode `node scripts/importar-zetta-clientes-pets.mjs caminho/arquivo.json` com `DATABASE_URL` apontando para um **banco de QA**, primeiro sem `--apply` (somente diagnóstico). Este script **não chama a API do Zetta**.
5. Revise conflitos apontados. Para registros que já existem no ERP sem referência histórica, o script recusa a associação por e-mail/CPF automaticamente: resolva o vínculo de maneira explícita antes de aplicar.
6. Depois de backup e revisão, rode com `--apply`. O script registra IDs históricos e pode ser reexecutado sem duplicar registros já importados.
7. Confira contagem final, histórico e vínculos de pets, pedidos e estoque. Só depois planeje o corte e a revogação das credenciais Zetta.
8. **Este script não migra automaticamente vendas, notas, XMLs ou estoque.** Esses itens precisam de conferência/migração própria antes do desligamento.

Importação ainda **não executada** neste projeto: o arquivo original de clientes/pets não foi fornecido.
