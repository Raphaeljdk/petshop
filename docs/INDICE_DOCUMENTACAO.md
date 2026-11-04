# Matilha Prado — índice central da documentação
**Revisão:** 04/11/2026 | **Escopo:** repositório `Raphaeljdk/petshop` na branch `main` durante auditoria documental.

> Este índice documenta a existência de componentes, modelos e rotas no código, não certifica que cada integração está ativa ou funcional em produção. A condição operacional deve ser confirmada por testes e evidências.

## Por onde começar
1. [Mapa funcional e arquitetura](./MAPA_SISTEMA_E_ARQUITETURA.md)
2. [Pendências e protocolo de validação](./AUDITORIA_DOCUMENTAL_2026-11-04.md)
3. [README e instalação](../README.md)
4. [Experiência do cliente](./EXPERIENCIA_CLIENTE.md)
5. [Pendências que dependem do cliente](./PENDENCIAS_CLIENTE_ENTREGA.md)
6. [Migração para ERP próprio](./erp-proprio-migracao.md)

## Acesso e clientes
- [Convites de clientes](./CONVITES_CLIENTES.md)
- [Importação de clientes e pets do Zetta](./importacao-clientes-pets-zetta.md)
- [Instalação na tela inicial](./INSTALACAO_TELA_INICIAL.md)

## Produtos, serviços e agenda
- [Configuração dos serviços estéticos](./catalogo-servicos-esteticos-admin.md)
- [Serviços confirmados e histórico de emissão Zetta](./relatorios/matilha-servicos-confirmados-zetta-sem-emissao-2026-11.md)

## Fiscal — não utilizar a documentação como autorização contábil
- [Preparação da primeira NF-e 55 em homologação](./primeira-nfe-homologacao-matilha-prado.md)
- [Emissor direto SEFAZ-SP](./emissor-direto-sefaz-sp.md)
- [Emissor fiscal unificado](./emissor-fiscal-unificado.md)
- [Cadastro do cliente e NF-e 55](./nfe-55-cadastro-cliente.md)
- [Auditoria fiscal e classificações](./auditoria-fiscal-buddy-20261022.md)
- [Importação fiscal Zetta](./importacao-fiscal-zetta.md)
- [Vendas on-line e fiscal](./fiscal-vendas-online.md)
- [Mercado Livre](./mercado-livre-faturador-nfe.md)
- [Mercado Pago e fiscal](./mercado-pago-fiscal.md)
- Relatórios fiscais e CSVs de referência: [docs/relatorios](./relatorios)

## Implantação
- [Neon: lançamento em produção](./neon-lancamento-producao.md)
- [Pendência da API de pedidos Zetta](./ZETTA_ORDER_API_PENDING.md)

## Regras de manutenção documental
- Atualizar o mapa funcional ao incluir/remover módulos, APIs ou integrações.
- Marcar toda funcionalidade como **implementação localizada**, **testada em ambiente controlado**, **validada em homologação** ou **confirmada em produção**, com evidência; não equivaler rota existente a recurso entregue.
- Atualizar documentação fiscal após parecer formal da contadora; nunca preencher dados tributários presumidos.
- Manter segredos, certificados digitais, tokens, dados pessoais e URLs com credenciais fora do GitHub.
- Em mudanças de banco ou configuração, registrar rollback, impacto e evidência de backup. 
