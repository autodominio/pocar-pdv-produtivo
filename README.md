# Pocar Sport: gestão, PDV, financeiro e metas

```
frontend/   Vue 3 + Pinia + Vite. Publicado na Vercel.
backend/    Spring Boot 3.3 + Java 17 + PostgreSQL 16. Roda na VPS com Docker.
deploy/     nginx-api.conf (site do nginx da VPS) e script de backup
docker-compose.yml   banco, API e backup diário (só a parte da VPS)
```

## Arquitetura

```
Navegador ──> https://pocar-sport.vercel.app      (endereço gerado pela Vercel)
                 ├─ telas do sistema
                 └─ /api/...  ── rewrite da Vercel ──> https://IP-DA-VPS.sslip.io ──> nginx + certbot (já na VPS) ──> API Spring Boot ──> PostgreSQL
                                                                                                                                       └─> backup diário
```

O navegador só conversa com o endereço da Vercel. As chamadas para `/api` são repassadas pela própria Vercel para a VPS (rewrite no `frontend/vercel.json`). Por isso não é preciso comprar domínio, configurar DNS nem liberar CORS, e o cookie de login funciona em todos os navegadores, inclusive no Safari do iPhone.

Na VPS, o nginx com certbot que já existe recebe a chamada em HTTPS (senhas e o cookie de login passam por ela) e repassa para a API, que só escuta em `127.0.0.1:8080`. O endereço da VPS usa o sslip.io, um serviço gratuito que transforma o IP em nome (`203-0-113-10.sslip.io` aponta para `203.0.113.10`), então o certbot consegue emitir o certificado sem domínio próprio.

O banco é relacional (PostgreSQL): produtos, variações, estoque, clientes, vendas e itens, devoluções, caixa, crediário e parcelas, lançamentos financeiros, vale-compras, cashback, metas e fechamentos do mês, cada um na sua tabela, com chaves estrangeiras e restrições (estoque não fica negativo, só um caixa aberto, telefone de cliente único, total da venda confere com subtotal menos descontos).

As regras de negócio rodam na API (Java), cada operação numa transação: uma venda grava itens, baixa de estoque, lançamentos, carnê do crediário, fidelidade e auditoria juntos, ou nada. O frontend mostra prévias na tela (total do carrinho, parcelas, encargos), mas quem decide é o servidor, que recalcula tudo e recusa com uma mensagem clara (HTTP 422) o que não pode.

- **Login com senha** (BCrypt), sessão em cookie HttpOnly gravada no banco e bloqueio de 5 minutos após 5 senhas erradas.
- **Usuários e acessos:** o administrador cria usuários na tela Usuários e escolhe os menus de cada um. O menu lateral mostra só o que foi liberado, e a API confere o acesso de novo em cada operação (403 se não tiver). Os usuários do `APP_USUARIOS` são administradores.
- **CSRF:** o token fica num cookie HttpOnly e é entregue no corpo de `/api/auth/sessao` e `/api/auth/login`. O frontend o guarda só em memória e o envia no cabeçalho `X-XSRF-TOKEN`.
- **Concorrência:** cada operação trava o caixa aberto e os registros que altera (`select ... for update`), sempre na mesma ordem.
- **Auditoria:** cada operação registra quem fez o quê; usuário e horário vêm do servidor, e um trigger no banco impede alterar ou apagar registros.
- **Log de chamadas:** uma linha por requisição (`POST /api/vendas -> 200 (38 ms) usuario=leonardo`).
- **Backup diário** em `./backups`, com 30 dias de retenção.

### API

| Método | Caminho | Uso |
|---|---|---|
| GET | `/api/auth/usuarios`, `/api/auth/sessao` | nomes para a tela de entrada; quem está logado e o token CSRF |
| POST | `/api/auth/login`, `/api/auth/logout`, `/api/auth/senha` | entrar, sair, trocar a senha |
| GET | `/api/loja` | tudo que as telas mostram, montado das tabelas (`src/main/resources/sql/loja.sql`) |
| POST | `/api/loja/reiniciar` | `{senhaConfirmacao}`: apaga a operação e volta aos produtos iniciais |
| POST | `/api/produtos`, `/api/estoque/entradas` | novo produto (gera SKU e código de barras); entrada de mercadoria |
| POST / PUT | `/api/clientes`, `/api/clientes/{id}` | cadastrar e editar cliente |
| POST | `/api/caixa/abrir`, `/api/caixa/movimentos`, `/api/caixa/fechar` | caixa: abrir, adicionar/remover dinheiro, fechar |
| POST | `/api/vendas` | venda (com desconto, vale, cashback, troca, crediário); devolve o recibo |
| POST | `/api/vendas/{id}/devolucoes`, `/api/vendas/{id}/cancelamento` | devolução com estorno; cancelamento |
| POST | `/api/crediarios/{id}/parcelas/{n}/recebimento` | receber parcela (com multa e juros) |
| POST | `/api/lancamentos`, `/api/lancamentos/{id}/baixa`, `/api/fechamentos/{mes}` | lançamento manual, baixa, fechamento do mês |
| POST / PUT | `/api/despesas-fixas`, `/api/despesas-fixas/{id}` | despesa fixa mensal (gera a conta de cada mês no dia escolhido) |
| PUT | `/api/metas/{mes}`, `/api/config/fidelidade`, `/api/config/crediario`, `/api/config/etiquetas` | meta e configurações |
| GET / POST / PUT | `/api/usuarios`, `/api/usuarios/{id}`, `/api/usuarios/{id}/senha` | usuários e menus liberados (só administrador) |
| GET | `/api/auditoria` | `?usuario=&periodo=hoje\|7d\|30d\|tudo&busca=&antesDe=&limite=` |

Erros sempre como `{"erro": "mensagem"}`: 401 sem login, 403 sem acesso ao menu, senha de confirmação errada ou CSRF (`"codigo": "CSRF"`), 409 dado alterado ao mesmo tempo por outro aparelho, 422 operação recusada por uma regra, 429 login bloqueado.

## Publicação

### 1. Backend na VPS

```bash
cp .env.example .env      # DB_PASSWORD e APP_USUARIOS
docker compose up -d --build --remove-orphans
docker compose logs -f api   # na primeira subida, aparece "Usuário 'leonardo' criado."

# nginx: troque 203-0-113-10 pelo IP da VPS no arquivo e ative o site
sudo cp deploy/nginx-api.conf /etc/nginx/conf.d/pocar-api.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d 203-0-113-10.sslip.io
curl https://203-0-113-10.sslip.io/api/auth/usuarios   # deve listar os usuários
```

O build roda os testes do backend antes de gerar a imagem. Para atualizar: envie o código novo e rode `docker compose up -d --build` de novo. Os dados ficam no volume `db_data`.

### 2. Frontend na Vercel

1. Em `frontend/vercel.json`, troque `203-0-113-10.sslip.io` no `destination` pelo mesmo endereço usado no nginx.
2. Importe o repositório na Vercel com **Root Directory** = `frontend`. O `vercel.json` já configura o build (que roda os testes antes) e o repasse de `/api`.
3. Pronto: o sistema fica no endereço que a Vercel gerar (ex.: `pocar-sport.vercel.app`).

Na primeira subida, a API já carrega os produtos e o estoque da loja, sem vendas nem clientes. Cada usuário deve trocar a senha inicial em "Trocar senha".

Se um dia o cliente tiver domínio próprio, basta adicioná-lo na Vercel; nada muda no backend.

### Logs das chamadas

A API grava uma linha por chamada (sem corpo, senha ou cookie):

```
INFO  api.requisicoes : POST /api/vendas -> 200 (38 ms) usuario=leonardo ip=189.10.20.30
WARN  api.requisicoes : POST /api/auth/login -> 401 (412 ms) usuario=- ip=189.10.20.30
```

```bash
docker compose logs -f --tail=100 api           # API (o Docker guarda até 3 arquivos de 10 MB)
sudo tail -f /var/log/nginx/pocar-api.access.log # tudo que chegou na VPS, inclusive o que não passou para a API
```

Para ver só erros, defina `LOG_REQUISICOES: WARN` no `environment` da `api` no `docker-compose.yml`.

### Backup e restauração

O container `backup` faz um `pg_dump` do banco inteiro (produtos, vendas, financeiro, clientes, usuários e auditoria) logo que sobe e depois todo dia às 3h (`BACKUP_HORA`), em `./backups/pocar-AAAA-MM-DD_HHMM.sql.gz`. Cada arquivo é conferido (gzip íntegro e dump completo) antes de valer, e os com mais de 30 dias (`BACKUP_DIAS`) são apagados. Para ver se está rodando: `docker compose logs backup`.

**Testar um backup** sem mexer no banco em uso. O script sobe um PostgreSQL temporário, restaura e compara as contagens com o banco atual:
```bash
./deploy/testar-restore.sh                                  # backup mais recente
./deploy/testar-restore.sh backups/pocar-2026-11-18_0300.sql.gz
```

**Restaurar de verdade** (volta o banco para o momento do backup; o que entrou depois se perde):
```bash
docker compose stop api
gunzip -c backups/pocar-AAAA-MM-DD_HHMM.sql.gz | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U pocar -d pocar
docker compose start api
```

**Cópia fora do servidor.** Se o servidor for perdido, os backups vão junto. `deploy/backup-externo.sh` envia os arquivos com o rclone para um Google Drive, Backblaze B2 ou S3, criptografados, e guarda 90 dias lá fora. A configuração (uma vez) está no começo do script.

### Levar os dados do QA para a produção

Os dados vão inteiros (produtos, estoque, vendas, clientes, financeiro, usuários com as senhas e auditoria). O que for lançado no QA depois da cópia não vai, então combine com o cliente um horário em que ninguém usa o sistema.

1. **Servidor de produção:** Docker, o projeto clonado, o `.env` (pode ter outra `DB_PASSWORD`), nginx e certbot com o `deploy/nginx-api.conf`. Ainda não suba a API.
2. **No QA**, no horário combinado:
   ```bash
   docker compose exec -T db pg_dump -U pocar --no-owner --clean --if-exists pocar | gzip > ~/pocar-para-producao.sql.gz
   gzip -t ~/pocar-para-producao.sql.gz && echo "arquivo ok"
   scp ~/pocar-para-producao.sql.gz usuario@SERVIDOR-DE-PRODUCAO:~/
   ```
3. **Na produção**, primeiro só o banco, depois a restauração, depois a API:
   ```bash
   docker compose up -d db
   gunzip -c ~/pocar-para-producao.sql.gz | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U pocar -d pocar
   docker compose up -d --build
   ```
   Como o banco já tem produtos, a API não carrega os produtos iniciais. Se a produção estiver numa versão mais nova, as migrações pendentes rodam sozinhas.
4. **Conferir:** compare as contagens (`./deploy/testar-restore.sh` mostra o banco atual), entre no sistema e veja estoque e últimas vendas.
5. **Vercel:** troque o `destination` do `frontend/vercel.json` para o endereço da produção e publique. A partir daí o QA fica só para testes.

### Produtos iniciais da loja

Na primeira subida (banco sem produtos e sem vendas), a API carrega os produtos e o estoque de `backend/src/main/resources/produtos-iniciais.json`, gerado da planilha "Produtos em estoque" exportada do PDV antigo, e dá a cada variação um código de barras. Antes de subir para produção, gere de novo com a planilha atualizada para o estoque inicial bater:

```bash
cd frontend
npm run importar-produtos ~/Downloads/Produtos_em_estoque.xlsx
npm test
```

Depois, `docker compose up -d --build` na VPS. A conversão (`frontend/src/domain/importacao.js`) agrupa as linhas por produto, transforma a variação em tamanho ou cor, tira o tamanho do nome das regatas NBA e define a categoria pelo nome. O arquivo só é usado com o banco sem produtos ou no "Reiniciar dados"; depois a loja segue pelo sistema.

## Desenvolvimento

```bash
# Backend (Java 17 e um PostgreSQL local; o Flyway cria as tabelas)
cd backend
APP_USUARIOS="leonardo:Leonardo:demo1234" COOKIE_SECURE=false mvn spring-boot:run
mvn test

# Frontend: o Vite encaminha /api para http://localhost:8080 (backend acima ou API simulada)
cd frontend
npm install
npm run mock     # opcional: API simulada na porta 8080 (usuários leonardo/admin, senha demo1234)
npm run dev      # http://localhost:5173
npm test
```

`frontend/tools/mock-api.mjs` implementa o mesmo contrato da API (reaproveitando as funções de `src/domain`) e serve para desenvolver o frontend e rodar testes de ponta a ponta sem o backend. Em produção, quem vale são as regras da API em Java.
