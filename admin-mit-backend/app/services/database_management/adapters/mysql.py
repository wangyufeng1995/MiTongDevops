"""
MySQL 数据库适配器
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


class MySQLAdapter(BaseDatabaseAdapter):
    """MySQL 数据库适配器"""
    
    db_type = "mysql"
    default_port = 3306
    
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
        """创建 MySQL 连接"""
        try:
            import pymysql
            import pymysql.err
        except ImportError:
            raise UnsupportedDatabaseTypeError("未安装 pymysql 驱动，请安装: pip install pymysql")
        
        try:
            conn = pymysql.connect(
                host=host,
                port=port,
                user=username,
                password=password or '',
                database=database or None,
                connect_timeout=timeout,
                read_timeout=30,
                write_timeout=30,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            logger.info(f"Connected to MySQL at {host}:{port}")
            return conn
        except pymysql.err.OperationalError as e:
            error_code = e.args[0] if e.args else 0
            if error_code == 2003:
                raise DatabaseConnectionError(f"无法连接到服务器: {host}:{port}")
            elif error_code == 1045:
                raise DatabaseConnectionError(f"认证失败: 用户名或密码错误")
            elif error_code == 1049:
                raise DatabaseConnectionError(f"数据库不存在: {database}")
            else:
                raise DatabaseConnectionError(f"连接失败: {str(e)}")
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
        cursor.execute("SELECT VERSION()")
        result = cursor.fetchone()
        version = result.get('VERSION()') if isinstance(result, dict) else result[0]
        cursor.close()
        return version
    
    def get_databases(self, client: Any) -> List[str]:
        """获取数据库列表"""
        cursor = client.cursor()
        cursor.execute("SHOW DATABASES")
        result = cursor.fetchall()
        if result and isinstance(result[0], dict):
            databases = [row.get('Database') or list(row.values())[0] for row in result]
        else:
            databases = [row[0] for row in result]
        cursor.close()
        return databases
    
    def get_schemas(self, client: Any, database: Optional[str] = None) -> List[str]:
        """获取 Schema 列表（MySQL 中 Schema = Database）"""
        # MySQL 没有 Schema 概念，返回数据库列表
        if database:
            return [database]
        return self.get_databases(client)
    
    def get_tables(
        self,
        client: Any,
        schema: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取表列表"""
        cursor = client.cursor()
        
        if not schema:
            cursor.close()
            return []
        
        query = """
            SELECT 
                TABLE_NAME,
                TABLE_TYPE,
                TABLE_SCHEMA,
                TABLE_ROWS
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = %s
        """
        params = [schema]
        
        if search:
            query += " AND TABLE_NAME LIKE %s"
            params.append(f'%{search}%')
        
        query += " ORDER BY TABLE_NAME"
        
        cursor.execute(query, params)
        result = cursor.fetchall()
        
        tables = []
        for row in result:
            if isinstance(row, dict):
                tables.append({
                    'name': row.get('TABLE_NAME'),
                    'type': 'view' if row.get('TABLE_TYPE') == 'VIEW' else 'table',
                    'schema': row.get('TABLE_SCHEMA'),
                    'row_count': row.get('TABLE_ROWS') or 0
                })
            else:
                tables.append({
                    'name': row[0],
                    'type': 'view' if row[1] == 'VIEW' else 'table',
                    'schema': row[2],
                    'row_count': row[3] or 0
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
        cursor = client.cursor()
        
        query = """
            SELECT 
                COLUMN_NAME,
                COLUMN_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT,
                COLUMN_KEY,
                COLUMN_COMMENT
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
        """
        
        cursor.execute(query, [schema, table_name])
        result = cursor.fetchall()
        
        columns = []
        for row in result:
            if isinstance(row, dict):
                columns.append({
                    'name': row.get('COLUMN_NAME'),
                    'type': row.get('COLUMN_TYPE'),
                    'nullable': row.get('IS_NULLABLE') == 'YES',
                    'default_value': row.get('COLUMN_DEFAULT'),
                    'is_primary_key': row.get('COLUMN_KEY') == 'PRI',
                    'comment': row.get('COLUMN_COMMENT')
                })
            else:
                columns.append({
                    'name': row[0],
                    'type': row[1],
                    'nullable': row[2] == 'YES',
                    'default_value': row[3],
                    'is_primary_key': row[4] == 'PRI',
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
        cursor = client.cursor()
        
        query = """
            SELECT 
                INDEX_NAME,
                GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns,
                NOT NON_UNIQUE as is_unique,
                INDEX_NAME = 'PRIMARY' as is_primary
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            GROUP BY INDEX_NAME, NON_UNIQUE
            ORDER BY INDEX_NAME
        """
        
        cursor.execute(query, [schema, table_name])
        result = cursor.fetchall()
        
        indexes = []
        for row in result:
            if isinstance(row, dict):
                columns_str = row.get('columns', '')
                indexes.append({
                    'name': row.get('INDEX_NAME'),
                    'columns': columns_str.split(',') if columns_str else [],
                    'is_unique': bool(row.get('is_unique')),
                    'is_primary': bool(row.get('is_primary'))
                })
            else:
                columns_str = row[1] or ''
                indexes.append({
                    'name': row[0],
                    'columns': columns_str.split(',') if columns_str else [],
                    'is_unique': bool(row[2]),
                    'is_primary': bool(row[3])
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
                        if isinstance(row, dict):
                            row_data = [row.get(col) for col in result['columns']]
                        else:
                            row_data = list(row)
                        result['rows'].append(self.convert_row_to_json(row_data))
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
                    count_row = cursor.fetchone()
                    if isinstance(count_row, dict):
                        total_count = list(count_row.values())[0]
                    else:
                        total_count = count_row[0]
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
                            if isinstance(row, dict):
                                row_data = [row.get(col) for col in result['columns']]
                            else:
                                row_data = list(row)
                            result['rows'].append(self.convert_row_to_json(row_data))
                
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
                        if isinstance(row, dict):
                            row_data = [row.get(col) for col in result['columns']]
                        else:
                            row_data = list(row)
                        result['rows'].append(self.convert_row_to_json(row_data))
                    result['row_count'] = len(result['rows'])
                else:
                    result['affected_rows'] = cursor.rowcount
                    
        except Exception as e:
            try:
                client.rollback()
            except Exception:
                pass
            error_msg = str(e)
            if 'syntax' in error_msg.lower():
                raise DatabaseQueryError(f"SQL 语法错误: {error_msg}")
            raise DatabaseQueryError(f"查询执行失败: {error_msg}")
        finally:
            result['execution_time'] = int((time.time() - start_time) * 1000)
            cursor.close()
        
        return result
    
    def get_server_info(self, client: Any) -> Dict[str, Any]:
        """获取服务器信息"""
        cursor = client.cursor()
        info = {'db_type': self.db_type}
        
        cursor.execute("SELECT VERSION()")
        result = cursor.fetchone()
        info['version'] = result.get('VERSION()') if isinstance(result, dict) else result[0]
        
        cursor.execute("SHOW STATUS LIKE 'Threads_connected'")
        result = cursor.fetchone()
        if isinstance(result, dict):
            info['connections'] = int(result.get('Value', 0))
        else:
            info['connections'] = int(result[1]) if result else 0
        
        cursor.close()
        return info
