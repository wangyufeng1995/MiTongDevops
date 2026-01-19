"""
达梦 DM 数据库适配器
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


class DMAdapter(BaseDatabaseAdapter):
    """达梦 DM 数据库适配器"""
    
    db_type = "dm"
    default_port = 5236
    
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
        """创建达梦连接"""
        try:
            import dmPython
            
            conn = dmPython.connect(
                host=host,
                port=port,
                user=username,
                password=password or '',
                database=database or None,
                login_timeout=timeout
            )
            logger.info(f"Connected to DM at {host}:{port}")
            return conn
        except ImportError:
            raise UnsupportedDatabaseTypeError("未安装 dmPython 驱动，请联系管理员安装达梦数据库驱动")
        except Exception as e:
            error_msg = str(e)
            if 'timeout' in error_msg.lower():
                raise DatabaseTimeoutError(f"连接超时: {host}:{port}")
            elif 'login' in error_msg.lower() or 'password' in error_msg.lower():
                raise DatabaseConnectionError(f"认证失败: 用户名或密码错误")
            else:
                raise DatabaseConnectionError(f"连接失败: {error_msg}")
    
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
        cursor.execute("SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1")
        version = cursor.fetchone()[0]
        cursor.close()
        return version
    
    def get_databases(self, client: Any) -> List[str]:
        """获取数据库列表（Schema 列表）"""
        cursor = client.cursor()
        cursor.execute("""
            SELECT DISTINCT OWNER FROM ALL_TABLES 
            ORDER BY OWNER
        """)
        databases = [row[0] for row in cursor.fetchall()]
        cursor.close()
        return databases
    
    def get_schemas(self, client: Any, database: Optional[str] = None) -> List[str]:
        """获取 Schema 列表"""
        return self.get_databases(client)
    
    def get_tables(
        self,
        client: Any,
        schema: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取表列表"""
        cursor = client.cursor()
        tables = []
        
        # 获取表
        query = """
            SELECT 
                TABLE_NAME,
                'TABLE' as TABLE_TYPE,
                OWNER,
                NUM_ROWS
            FROM ALL_TABLES 
            WHERE OWNER = :1
        """
        params = [schema.upper() if schema else 'SYSDBA']
        
        if search:
            query += " AND TABLE_NAME LIKE :2"
            params.append(f'%{search.upper()}%')
        
        query += " ORDER BY TABLE_NAME"
        
        cursor.execute(query, params)
        for row in cursor.fetchall():
            tables.append({
                'name': row[0],
                'type': 'table',
                'schema': row[2],
                'row_count': row[3] or 0
            })
        
        # 获取视图
        view_query = """
            SELECT 
                VIEW_NAME,
                'VIEW' as TABLE_TYPE,
                OWNER
            FROM ALL_VIEWS 
            WHERE OWNER = :1
        """
        view_params = [schema.upper() if schema else 'SYSDBA']
        
        if search:
            view_query += " AND VIEW_NAME LIKE :2"
            view_params.append(f'%{search.upper()}%')
        
        view_query += " ORDER BY VIEW_NAME"
        
        cursor.execute(view_query, view_params)
        for row in cursor.fetchall():
            tables.append({
                'name': row[0],
                'type': 'view',
                'schema': row[2],
                'row_count': 0
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
        schema = schema.upper() if schema else 'SYSDBA'
        
        query = """
            SELECT 
                c.COLUMN_NAME,
                c.DATA_TYPE,
                c.NULLABLE,
                c.DATA_DEFAULT,
                CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'Y' ELSE 'N' END as IS_PK,
                cc.COMMENTS
            FROM ALL_TAB_COLUMNS c
            LEFT JOIN (
                SELECT acc.COLUMN_NAME
                FROM ALL_CONSTRAINTS ac
                JOIN ALL_CONS_COLUMNS acc ON ac.CONSTRAINT_NAME = acc.CONSTRAINT_NAME
                WHERE ac.CONSTRAINT_TYPE = 'P'
                    AND ac.OWNER = :1
                    AND ac.TABLE_NAME = :2
            ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
            LEFT JOIN ALL_COL_COMMENTS cc 
                ON c.OWNER = cc.OWNER 
                AND c.TABLE_NAME = cc.TABLE_NAME 
                AND c.COLUMN_NAME = cc.COLUMN_NAME
            WHERE c.OWNER = :3 AND c.TABLE_NAME = :4
            ORDER BY c.COLUMN_ID
        """
        
        cursor.execute(query, [schema, table_name.upper(), schema, table_name.upper()])
        columns = []
        for row in cursor.fetchall():
            columns.append({
                'name': row[0],
                'type': row[1],
                'nullable': row[2] == 'Y',
                'default_value': row[3],
                'is_primary_key': row[4] == 'Y',
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
        schema = schema.upper() if schema else 'SYSDBA'
        
        query = """
            SELECT 
                i.INDEX_NAME,
                LISTAGG(ic.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY ic.COLUMN_POSITION) as columns,
                i.UNIQUENESS,
                CASE WHEN c.CONSTRAINT_TYPE = 'P' THEN 'Y' ELSE 'N' END as IS_PRIMARY
            FROM ALL_INDEXES i
            JOIN ALL_IND_COLUMNS ic ON i.INDEX_NAME = ic.INDEX_NAME AND i.OWNER = ic.INDEX_OWNER
            LEFT JOIN ALL_CONSTRAINTS c ON i.INDEX_NAME = c.INDEX_NAME AND i.OWNER = c.OWNER
            WHERE i.OWNER = :1 AND i.TABLE_NAME = :2
            GROUP BY i.INDEX_NAME, i.UNIQUENESS, c.CONSTRAINT_TYPE
            ORDER BY i.INDEX_NAME
        """
        
        cursor.execute(query, [schema, table_name.upper()])
        indexes = []
        for row in cursor.fetchall():
            indexes.append({
                'name': row[0],
                'columns': row[1].split(',') if row[1] else [],
                'is_unique': row[2] == 'UNIQUE',
                'is_primary': row[3] == 'Y'
            })
        cursor.close()
        return indexes
    
    def build_paginated_sql(self, sql: str, limit: int, offset: int) -> str:
        """构建分页 SQL（达梦使用 ROWNUM）"""
        if offset > 0:
            return f"""
                SELECT * FROM (
                    SELECT t.*, ROWNUM AS rn FROM ({sql}) t WHERE ROWNUM <= {offset + limit}
                ) WHERE rn > {offset}
            """
        return f"SELECT * FROM ({sql}) WHERE ROWNUM <= {limit}"
    
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
                    count_sql = f"SELECT COUNT(*) FROM ({sql_clean})"
                    cursor.execute(count_sql)
                    total_count = cursor.fetchone()[0]
                except Exception:
                    pass
                
                offset = (page - 1) * per_page
                limit = min(per_page, max_rows - offset) if offset < max_rows else 0
                
                if limit > 0:
                    paginated_sql = self.build_paginated_sql(sql_clean, limit, offset)
                    cursor.execute(paginated_sql)
                    
                    if cursor.description:
                        result['columns'] = [desc[0] for desc in cursor.description]
                        # 过滤掉 rn 列
                        if 'RN' in [c.upper() for c in result['columns']]:
                            rn_index = [c.upper() for c in result['columns']].index('RN')
                            result['columns'] = result['columns'][:rn_index] + result['columns'][rn_index+1:]
                        
                        rows = cursor.fetchall()
                        for row in rows:
                            row_data = list(row)
                            if len(row_data) > len(result['columns']):
                                row_data = row_data[:len(result['columns'])]
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
        
        cursor.execute("SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1")
        info['version'] = cursor.fetchone()[0]
        
        cursor.close()
        return info
