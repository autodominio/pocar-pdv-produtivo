#!/bin/sh
# Backup do banco: um logo que o container sobe e depois todo dia às BACKUP_HORA (padrão 3h), compactado, em /backups.
# Cada arquivo é conferido (gzip íntegro e dump completo) antes de valer; os mais antigos que BACKUP_DIAS são apagados.
# Se falhar (ex.: banco reiniciando), tenta de novo a cada 10 minutos, até 6 vezes.
# Restaurar: gunzip -c backups/ARQUIVO.sql.gz | docker compose exec -T db psql -U pocar -d pocar
# Testar um backup sem mexer no banco em uso: ./deploy/testar-restore.sh
set -u
set -o pipefail 2>/dev/null || true
PASTA=${BACKUP_PASTA:-/backups}
mkdir -p "$PASTA"

fazer_backup() {
  arquivo="$PASTA/pocar-$(date +%Y-%m-%d_%H%M).sql.gz"
  if pg_dump --no-owner --clean --if-exists | gzip > "$arquivo.parcial" \
     && gzip -t "$arquivo.parcial" \
     && gunzip -c "$arquivo.parcial" | tail -n 10 | grep -q "PostgreSQL database dump complete"; then
    mv "$arquivo.parcial" "$arquivo"
    echo "$(date '+%F %T') backup gravado: $arquivo ($(du -h "$arquivo" | cut -f1))"
    find "$PASTA" -name 'pocar-*.sql.gz' -mtime +"${BACKUP_DIAS:-30}" -delete
    return 0
  fi
  rm -f "$arquivo.parcial"
  echo "$(date '+%F %T') ERRO: o backup falhou" >&2
  return 1
}

backup_com_tentativas() {
  for tentativa in 1 2 3 4 5 6; do
    fazer_backup && return 0
    [ "$tentativa" -lt 6 ] && echo "$(date '+%F %T') tentando de novo em 10 minutos ($tentativa/6)" >&2 && sleep 600
  done
  echo "$(date '+%F %T') ERRO: backup do dia não foi feito após 6 tentativas" >&2
}

# segundos até a próxima BACKUP_HORA (só aritmética: não depende do "date -d", que varia entre versões)
ate_a_hora() {
  h=$(date +%H); m=$(date +%M); s=$(date +%S)
  agora=$(( ${h#0} * 3600 + ${m#0} * 60 + ${s#0} ))
  hora=${BACKUP_HORA:-03}
  falta=$(( ${hora#0} * 3600 - agora ))
  [ "$falta" -le 0 ] && falta=$((falta + 86400))
  echo "$falta"
}

backup_com_tentativas
while true; do
  espera=$(ate_a_hora)
  echo "$(date '+%F %T') próximo backup em $((espera / 3600))h$(( espera % 3600 / 60 ))min"
  sleep "$espera"
  backup_com_tentativas
done
