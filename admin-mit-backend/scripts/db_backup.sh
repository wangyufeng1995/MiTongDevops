#!/bin/bash
# 数据库备份脚本

set -e

# 配置
BACKUP_DIR="${BACKUP_DIR:-/backups/database}"
DB_HOST="${DB_HOST:-172.30.3.135}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-mitong_devops}"
DB_USER="${DB_USER:-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

echo "=========================================="
echo "数据库备份脚本"
echo "=========================================="
echo "数据库: $DB_NAME"
echo "主机: $DB_HOST:$DB_PORT"
echo "备份文件: $BACKUP_FILE_GZ"
echo "=========================================="

# 执行备份
echo "开始备份..."
if command -v docker-compose &> /dev/null; then
    # Docker 环境
    docker-compose exec -T postgres pg_dump -U "$DB_USER" -h localhost "$DB_NAME" | gzip > "$BACKUP_FILE_GZ"
else
    # 直接连接
    PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE_GZ"
fi

# 检查备份是否成功
if [ -f "$BACKUP_FILE_GZ" ] && [ -s "$BACKUP_FILE_GZ" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
    echo "✓ 备份成功！文件大小: $BACKUP_SIZE"
else
    echo "✗ 备份失败！"
    exit 1
fi

# 清理旧备份
echo ""
echo "清理 $RETENTION_DAYS 天前的备份..."
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" | wc -l)
echo "✓ 清理完成，剩余备份: $REMAINING_BACKUPS 个"

# 备份数据卷（可选）
if [ "$BACKUP_VOLUMES" = "true" ]; then
    echo ""
    echo "备份数据卷..."
    VOLUME_BACKUP_FILE="$BACKUP_DIR/postgres_data_${TIMESTAMP}.tar.gz"
    docker run --rm \
        -v admin-system-template_postgres_data:/data \
        -v "$BACKUP_DIR":/backup \
        alpine tar czf "/backup/postgres_data_${TIMESTAMP}.tar.gz" -C /data .
    echo "✓ 数据卷备份完成"
fi

echo ""
echo "=========================================="
echo "备份完成！"
echo "=========================================="
echo "备份文件: $BACKUP_FILE_GZ"
echo "备份大小: $BACKUP_SIZE"
echo "=========================================="
