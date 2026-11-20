#!/bin/sh
# Copia os backups para fora do servidor (Google Drive, Backblaze B2, S3...) com o rclone, criptografados.
# Se o servidor for perdido, os backups continuam lá fora.
#
# Configuração (uma vez, no servidor):
#   1. sudo apt install rclone            (ou: curl https://rclone.org/install.sh | sudo bash)
#   2. rclone config  -> crie o remoto do serviço (ex.: "gdrive") e, por cima dele, um remoto do tipo "crypt"
#      chamado "pocar-cripto" apontando para gdrive:pocar-backups. Guarde as senhas do crypt fora do servidor.
#   3. crontab -e e acrescente (30 minutos depois do backup das 3h):
#      30 3 * * * /home/admin/pocar-pdv/deploy/backup-externo.sh >> /home/admin/pocar-backup-externo.log 2>&1
set -eu
cd "$(dirname "$0")/.."
DESTINO=${BACKUP_DESTINO:-pocar-cripto:}
DIAS_FORA=${BACKUP_DIAS_FORA:-90}

rclone copy backups "$DESTINO" --include 'pocar-*.sql.gz'                    # envia só o que ainda não está lá
rclone delete "$DESTINO" --include 'pocar-*.sql.gz' --min-age "${DIAS_FORA}d" # guarda 90 dias lá fora
echo "$(date '+%F %T') backups enviados para $DESTINO ($(rclone lsf "$DESTINO" --include 'pocar-*.sql.gz' | wc -l) arquivos lá)"
