"""
PostgreSQL 数据库适配器
"""
import logging
import time
from typing import Dict, List, Any, Optional

from ..base import (
    DatabaseConnectionError,
    DatabaseTimeoutError,
    DatabaseQueryError,
    UnsupportedDatabaseTypeError
)
from .base import BaseDatabaseAdapter

logger = logging.getLogger(__name__)


class PostgreSQLAdapter(BaseDatabaseAdapter):
    """PostgreSQL 数据库适配器"""
    
    db_type = "postgresql"
    default_port = 5432
    
    def create_connection(
        self,
        host: str,
        port: int,
        username: str,
        password: Optional[str],
        database: Optional[str],
        timeout: int,
        **kwargs
    ) -> Any:
        """创建 PostgreSQL 连接"""
        try:
            import psycopg2
        except ImportError:
            raise UnsupportedDatabaseTypeError("未安装 psycopg2 驱动，请安装: pip install psycopg2-binary")
        
        try:
            conn = psycopg2.connect(
                host=host,
                port=port,
                user=username,
                password=password or '',
                database=database or 'postgres',
                connect_timeout=timeout,
                options='-c statement_timeout=30000'
            )
            conn.autocommit = False
            logger.info(f"Connected to PostgreSQL at {host}:{port}")
            return conn
        except psycopg2.OperationalError as e:
            error_msg = str(e)
            if 'timeout' in error_msg.lower():
                raise DatabaseTimeoutError(f"连接超时: {host}:{port}")
            elif 'authentication' in error_msg.lower() or 'password' in error_msg.lower():
                raise DatabaseConnectionError(f"认证失败: 用户名或密码错误")
            else:
                raise DatabaseConnectionError(f"连接失败: {error_msg}")
        except Exception as e:
            raise DatabaseConnectionError(f"连接失败: {str(e)}")
    
    def ping(self, client: Any) -> bool:
        """验证连接是否有效"""
        try:
            cursor = client.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            return True
        except Exception:
            return False
    
    def get_version(self, client: Any) -> str:
        """获取数据库版本"""
        cursor = client.cursor()
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
        cursor.close()
        return version.split(',')[0]
    
    def get_databases(self, client: Any) -> List[str]:
        """获取数据库列表"""
        cursor = client.cursor()
        cursor.execute("""
            SELECT datname FROM pg_database 
            WHERE datistemplate = false 
            ORDER BY datname
        """)
        databases = [row[0] for row in cursor.fetchall()]
        cursor.close()
        return databases
    
    def get_schemas(self, client: Any, database: Optional[str] = None) -> List[str]:
        """获取 Schema 列表"""
        cursor = client.cursor()
        cursor.execute("""
            SELECT schema_name FROM information_schema.schemata 
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY schema_name
        """)
        schemas = [row[0] for row in cursor.fetchall()]
        cursor.close()
        return schemas
    
    def get_tables(
        self,
        client: Any,
        schema: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取表列表"""
        schema = schema or 'public'
        cursor = client.cursor()
        
        query = """
            SELECT 
                t.table_name,
                t.table_type,
                t.table_schema,
                COALESCE(s.n_live_tup, 0) as row_count
            FROM information_schema.tables t
            LEFT JOIN pg_stat_user_tables s 
                ON t.table_name = s.relname AND t.table_schema = s.schemaname
            WHERE t.table_schema = %s
        """
        params = [schema]
        
        if search:
            query += " AND t.table_name ILIKE %s"
            params.append(f'%{search}%')
        
        query += " ORDER BY t.table_name"
        
        cursor.execute(query, params)
        tables = []
        for row in cursor.fetchall():
            tables.append({
                'name': row[0],
                'type': 'view' if row[1] == 'VIEW' else 'table',
                'schema': row[2],
                'row_count': row[3]
            })
        cursor.close()
        return tables
    
    def get_table_columns(
        self,
        client: Any,
        table_name: str,
        schema: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取表的列信息"""
        schema = schema or 'public'
        cursor = client.cursor()
        
        query = """
            SELECT 
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
                pgd.description as column_comment
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = %s
                    AND tc.table_name = %s
            ) pk ON c.column_name = pk.column_name
            LEFT JOIN pg_catalog.pg_statio_all_tables st 
                ON c.table_schema = st.schemaname AND c.table_name = st.relname
            LEFT JOIN pg_catalog.pg_description pgd 
                ON pgd.objoid = st.relid 
                AND pgd.objsubid = c.ordinal_position
            WHERE c.table_schema = %s AND c.table_name = %s
            ORDER BY c.ordinal_position
        """
        
        cursor.execute(query, [schema, table_name, schema, table_name])
        columns = []
        for row in cursor.fetchall():
            columns.append({
                'name': row[0],
                'type': row[1],
                'nullable': row[2] == 'YES',
                'default_value': row[3],
                'is_primary_key': row[4],
                'comment': row[5]
            })
        cursor.close()
        return columns
    
    def get_table_indexes(
        self,
        client: Any,
        table_name: str,
        schema: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取表的索引信息"""
        schema = schema or 'public'
        cursor = client.cursor()
        
        query = """
            SELECT 
                i.relname as index_name,
                array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
            WHERE n.nspname = %s AND t.relname = %s
            GROUP BY i.relname, ix.indisunique, ix.indisprimary
            ORDER BY i.relname
        """
        
        cursor.execute(query, [schema, table_name])
        indexes = []
        for row in cursor.fetchall():
            indexes.append({
                'name': row[0],
                'columns': row[1],
                'is_unique': row[2],
                'is_primary': row[3]
            })
        cursor.close()
        return indexes
    
    def execute_query(
        self,
        client: Any,
        sql: str,
        page: int = 1,
        per_page: int = 50,
        max_rows: int = 1000
    ) -> Dict[str, Any]:
        """执行 SQL 查询"""
        start_time = time.time()
        cursor = client.cursor()
        
        sql_upper = sql.strip().upper()
        is_select = sql_upper.startswith('SELECT') or sql_upper.startswith('WITH')
        is_dml = sql_upper.startswith(('INSERT', 'UPDATE', 'DELETE'))
        is_ddl = sql_upper.startswith(('CREATE', 'ALTER', 'DROP', 'TRUNCATE'))
        special_commands = ('SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN')
        is_special = any(sql_upper.startswith(cmd) for cmd in special_commands)
        
        result = {
            'columns': [],
            'rows': [],
            'row_count': 0,
            'total_count': None,
            'execution_time': 0,
            'affected_rows': None,
            'is_select': is_select or is_special,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': 0,
                'pages': 0,
                'has_prev': False,
                'has_next': False
            }
        }
        
        try:
            if is_special:
                cursor.execute(sql)
                if cursor.description:
                    result['columns'] = [desc[0] for desc in cursor.description]
                    rows = cursor.fetchall()
                    for row in rows:
                        result['rows'].append(self.convert_row_to_json(list(row)))
                    result['row_count'] = len(result['rows'])
                    result['total_count'] = result['row_count']
                    result['pagination']['total'] = result['row_count']
                    result['pagination']['pages'] = 1
                    
            elif is_select:
                sql_clean = sql.rstrip().rstrip(';')
                total_count = None
                
                try:
                    count_sql = f"SELECT COUNT(*) FROM ({sql_clean}) AS count_query"
                    cursor.execute(count_sql)
                    total_count = cursor.fetchone()[0]
                except Exception:
                    pass
                
                offset = (page - 1) * per_page
                limit = min(per_page, max_rows - offset) if offset < max_rows else 0
                
                if limit > 0:
                    paginated_sql = f"{sql_clean} LIMIT {limit} OFFSET {offset}"
                    cursor.execute(paginated_sql)
                    
                    if cursor.description:
                        result['columns'] = [desc[0] for desc in cursor.description]
                        rows = cursor.fetchall()
                        for row in rows:
                            result['rows'].append(self.convert_row_to_json(list(row)))
                
                result['row_count'] = len(result['rows'])
                result['total_count'] = total_count if total_count is not None else result['row_count']
                
                if total_count is not None:
                    total_pages = (total_count + per_page - 1) // per_page
                    result['pagination'] = {
                        'page': page,
                        'per_page': per_page,
                        'total': total_count,
                        'pages': total_pages,
                        'has_prev': page > 1,
                        'has_next': page < total_pages
                    }
                    
            elif is_dml or is_ddl:
                cursor.execute(sql)
                result['affected_rows'] = cursor.rowcount
                client.commit()
            else:
                cursor.execute(sql)
                if cursor.description:
                    result['columns'] = [desc[0] for desc in cursor.description]
                    rows = cursor.fetchmany(max_rows)
                    for row in rows:
                        result['rows'].append(self.convert_row_to_json(list(row)))
                    result['row_count'] = len(result['rows'])
                else:
                    result['affected_rows'] = cursor.rowcount
                    
        except Exception as e:
            try:
                client.rollback()
            except Exception:
                pass
            raise DatabaseQueryError(f"查询执行失败: {str(e)}")
        finally:
            result['execution_time'] = int((time.time() - start_time) * 1000)
            cursor.close()
        
        return result
    
    def get_server_info(self, client: Any) -> Dict[str, Any]:
        """获取服务器信息"""
        cursor = client.cursor()
        info = {'db_type': self.db_type}
        
        cursor.execute("SELECT version()")
        info['version'] = cursor.fetchone()[0]
        
        cursor.execute("SELECT pg_database_size(current_database())")
        size_bytes = cursor.fetchone()[0]
        info['database_size'] = f"{size_bytes / (1024*1024):.2f} MB"
        
        cursor.execute("SELECT count(*) FROM pg_stat_activity")
        info['connections'] = cursor.fetchone()[0]
        
        cursor.close()
        return info
