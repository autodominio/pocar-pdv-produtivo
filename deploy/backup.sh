#!/bin/sh
# Backup do banco: um logo que o container sobe e depois todo dia às BACKUP_HORA (padrão 3h), compactado, em /backups.
# Cada arquivo é conferido (gzip íntegro e dump completo) antes de valer; os mais antigos que BACKUP_DIAS são apagados.
# Restaurar: gunzip -c backups/ARQUIVO.sql.gz | docker compose exec -T db psql -U pocar -d pocar
# Testar um backup sem mexer no banco em uso: ./deploy/testar-restore.sh
set -u
set -o pipefail 2>/dev/null || true
mkdir -p /backups

fazer_backup() {
  arquivo="/backups/pocar-$(date +%Y-%m-%d_%H%M).sql.gz"
  if pg_dump --no-owner --clean --if-exists | gzip > "$arquivo.parcial" \
     && gzip -t "$arquivo.parcial" \
     && gunzip -c "$arquivo.parcial" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
    mv "$arquivo.parcial" "$arquivo"
    echo "$(date '+%F %T') backup gravado: $arquivo ($(du -h "$arquivo" | cut -f1))"
  else
    rm -f "$arquivo.parcial"
    echo "$(date '+%F %T') ERRO: o backup falhou" >&2
  fi
  find /backups -name 'pocar-*.sql.gz' -mtime +"${BACKUP_DIAS:-30}" -delete
}

# segundos até a próxima BACKUP_HORA
ate_a_hora() {
  alvo=$(date -d "$(date +%Y-%m-%d) ${BACKUP_HORA:-03}:00:00" +%s)
  agora=$(date +%s)
  [ "$alvo" -le "$agora" ] && alvo=$((alvo + 86400))
  echo $((alvo - agora))
}

fazer_backup
while true; do
  sleep "$(ate_a_hora)"
  fazer_backup
done
