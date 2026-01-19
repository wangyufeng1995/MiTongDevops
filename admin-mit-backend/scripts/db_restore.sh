#!/bin/bash
# 数据库恢复脚本

set -e

# 配置
DB_HOST="${DB_HOST:-172.30.3.135}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-mitong_devops}"
DB_USER="${DB_USER:-postgres}"

# 检查参数
if [ -z "$1" ]; then
    echo "用法: $0 <backup_file.sql.gz>"
    echo ""
    echo "示例:"
    echo "  $0 /backups/database/mitong_devops_20240101_120000.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

# 检查备份文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    echo "错误: 备份文件不存在: $BACKUP_FILE"
    exit 1
fi

echo "=========================================="
echo "数据库恢复脚本"
echo "=========================================="
echo "数据库: $DB_NAME"
echo "主机: $DB_HOST:$DB_PORT"
echo "备份文件: $BACKUP_FILE"
echo "=========================================="
echo ""
echo "⚠️  警告: 此操作将覆盖现有数据库！"
echo ""
read -p "确认要恢复数据库吗？(yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "操作已取消"
    exit 0
fi

# 创建备份（恢复前）
echo ""
echo "创建当前数据库备份..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SAFETY_BACKUP="/tmp/${DB_NAME}_before_restore_${TIMESTAMP}.sql.gz"

if command -v docker-compose &> /dev/null; then
    docker-compose exec -T postgres pg_dump -U "$DB_USER" -h localhost "$DB_NAME" | gzip > "$SAFETY_BACKUP"
else
    PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$SAFETY_BACKUP"
fi

echo "✓ 安全备份已创建: $SAFETY_BACKUP"

# 断开所有连接
echo ""
echo "断开所有数据库连接..."
if command -v docker-compose &> /dev/null; then
    docker-compose exec -T postgres psql -U "$DB_USER" -h localhost -d postgres -c "
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '$DB_NAME'
        AND pid <> pg_backend_pid();
    " || true
else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '$DB_NAME'
        AND pid <> pg_backend_pid();
    " || true
fi

# 删除并重建数据库
echo ""
echo "重建数据库..."
if command -v docker-compose &> /dev/null; then
    docker-compose exec -T postgres psql -U "$DB_USER" -h localhost -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    docker-compose exec -T postgres psql -U "$DB_USER" -h localhost -d postgres -c "CREATE DATABASE $DB_NAME;"
else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"
fi

echo "✓ 数据库已重建"

# 恢复数据
echo ""
echo "恢复数据..."
if command -v docker-compose &> /dev/null; then
    gunzip -c "$BACKUP_FILE" | docker-compose exec -T postgres psql -U "$DB_USER" -h localhost -d "$DB_NAME"
else
    gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
fi

# 验证恢复
echo ""
echo "验证数据恢复..."
if command -v docker-compose &> /dev/null; then
    TABLE_COUNT=$(docker-compose exec -T postgres psql -U "$DB_USER" -h localhost -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
else
    TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
fi

echo "✓ 数据表数量: $TABLE_COUNT"

echo ""
echo "=========================================="
echo "恢复完成！"
echo "=========================================="
echo "数据库: $DB_NAME"
echo "数据表: $TABLE_COUNT 个"
echo "安全备份: $SAFETY_BACKUP"
echo "=========================================="
echo ""
echo "如果恢复有问题，可以使用安全备份回滚:"
echo "  $0 $SAFETY_BACKUP"
