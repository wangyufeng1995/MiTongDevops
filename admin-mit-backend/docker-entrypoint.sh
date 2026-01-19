#!/bin/bash
set -e

echo "Starting Admin System Backend..."

# 等待数据库就绪
echo "Waiting for PostgreSQL..."
while ! pg_isready -h ${DB_HOST:-172.30.3.135} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres}; do
  sleep 1
done
echo "PostgreSQL is ready!"

# 等待 Redis 就绪
echo "Waiting for Redis..."
while ! timeout 1 bash -c "echo > /dev/tcp/${REDIS_HOST:-172.30.3.135}/${REDIS_PORT:-6379}"; do
  sleep 1
done
echo "Redis is ready!"

# 运行数据库迁移
echo "Running database migrations..."
flask db upgrade || echo "Migration failed or already up to date"

# 生成 RSA 密钥对（如果不存在）
if [ ! -f "keys/private_key.pem" ]; then
    echo "Generating RSA key pair..."
    python -c "
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import os

os.makedirs('keys', exist_ok=True)
private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)
with open('keys/private_key.pem', 'wb') as f:
    f.write(pem)
print('RSA key pair generated successfully')
"
fi

echo "Starting application..."
exec "$@"
