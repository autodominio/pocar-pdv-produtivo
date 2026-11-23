#!/bin/sh
# Testa um backup de verdade, sem mexer no banco em uso: sobe um PostgreSQL temporário, restaura o arquivo
# e compara a quantidade de registros com o banco atual. No fim, o PostgreSQL temporário é apagado.
# Uso (na pasta do projeto): ./deploy/testar-restore.sh                      -> backup mais recente
#                            ./deploy/testar-restore.sh backups/ARQUIVO.sql.gz
set -eu
cd "$(dirname "$0")/.."

arquivo=${1:-$(ls -t backups/pocar-*.sql.gz 2>/dev/null | head -1)}
[ -n "$arquivo" ] && [ -f "$arquivo" ] || { echo "Nenhum backup encontrado em ./backups"; exit 1; }
echo "Testando $arquivo ($(du -h "$arquivo" | cut -f1))"

teste=pocar-teste-restore
docker rm -f "$teste" >/dev/null 2>&1 || true
docker run -d --name "$teste" -e POSTGRES_USER=pocar -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=pocar postgres:16-alpine >/dev/null
trap 'docker rm -f "$teste" >/dev/null 2>&1' EXIT
# espera a inicialização terminar (a imagem sobe um servidor provisório antes do definitivo)
until docker logs "$teste" 2>&1 | grep -q "init process complete"; do sleep 1; done
until docker exec "$teste" pg_isready -U pocar -d pocar >/dev/null 2>&1; do sleep 1; done

gunzip -c "$arquivo" | docker exec -i "$teste" psql -q -v ON_ERROR_STOP=1 -U pocar -d pocar >/dev/null
echo "Restaurado sem erro."

CONTAGEM="select 'produtos', count(*) from produto union all select 'variações', count(*) from variante
  union all select 'peças em estoque', coalesce(sum(qtd), 0) from variante union all select 'clientes', count(*) from cliente
  union all select 'vendas', count(*) from venda union all select 'lançamentos', count(*) from lancamento
  union all select 'despesas fixas', count(*) from despesa_fixa union all select 'usuários', count(*) from usuario
  union all select 'auditoria', count(*) from auditoria"
docker exec "$teste" psql -U pocar -d pocar -At -F '|' -c "$CONTAGEM" > /tmp/pocar-restore-backup.txt
docker compose exec -T db psql -U pocar -d pocar -At -F '|' -c "$CONTAGEM" > /tmp/pocar-restore-atual.txt

printf '\n%-18s %12s %12s\n' "" "no backup" "banco atual"
paste -d '|' /tmp/pocar-restore-backup.txt /tmp/pocar-restore-atual.txt | while IFS='|' read -r nome b _ a; do
  printf '%-18s %12s %12s\n' "$nome" "$b" "$a"
done
rm -f /tmp/pocar-restore-backup.txt /tmp/pocar-restore-atual.txt
printf "\nO banco atual pode ter mais registros que o backup: é o que entrou depois do horário dele.\n"
