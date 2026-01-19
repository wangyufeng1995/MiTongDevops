"""
Database Index Optimization Script
Analyzes and creates optimal indexes for performance
"""
from sqlalchemy import create_engine, text, inspect
from app.core.config_manager import config_manager
from app.extensions import db
from app import create_app


def get_database_url():
    """Get database URL from config"""
    db_config = config_manager.get_database_config()
    return (
        f"postgresql://{db_config['username']}:{db_config['password']}"
        f"@{db_config['host']}:{db_config['port']}/{db_config['database']}"
    )


def analyze_slow_queries(engine):
    """Analyze slow queries from PostgreSQL logs"""
    print("\n=== Analyzing Slow Queries ===")
    
    with engine.connect() as conn:
        # Enable query statistics if not already enabled
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_stat_statements"))
            conn.commit()
            
            # Get top 10 slowest queries
            result = conn.execute(text("""
                SELECT 
                    query,
                    calls,
                    total_exec_time,
                    mean_exec_time,
                    max_exec_time
                FROM pg_stat_statements
                ORDER BY mean_exec_time DESC
                LIMIT 10
            """))
            
            print("\nTop 10 Slowest Queries:")
            for row in result:
                print(f"\nQuery: {row.query[:100]}...")
                print(f"  Calls: {row.calls}")
                print(f"  Mean time: {row.mean_exec_time:.2f}ms")
                print(f"  Max time: {row.max_exec_time:.2f}ms")
        except Exception as e:
            print(f"Could not analyze queries: {e}")


def check_existing_indexes(engine):
    """Check existing indexes on all tables"""
    print("\n=== Existing Indexes ===")
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    for table in tables:
        indexes = inspector.get_indexes(table)
        if indexes:
            print(f"\n{table}:")
            for idx in indexes:
                columns = ', '.join(idx['column_names'])
                unique = 'UNIQUE' if idx['unique'] else ''
                print(f"  - {idx['name']}: ({columns}) {unique}")


def create_recommended_indexes(engine):
    """Create recommended indexes for performance"""
    print("\n=== Creating Recommended Indexes ===")
    
    indexes = [
        # User table indexes
        ("idx_users_tenant_id", "users", ["tenant_id"]),
        ("idx_users_username", "users", ["username"]),
        ("idx_users_email", "users", ["email"]),
        ("idx_users_tenant_username", "users", ["tenant_id", "username"]),
        
        # SSH Hosts indexes
        ("idx_ssh_hosts_tenant_id", "ssh_hosts", ["tenant_id"]),
        ("idx_ssh_hosts_status", "ssh_hosts", ["status"]),
        ("idx_ssh_hosts_tenant_status", "ssh_hosts", ["tenant_id", "status"]),
        
        # Network Probes indexes
        ("idx_network_probes_tenant_id", "network_probes", ["tenant_id"]),
        ("idx_network_probes_group_id", "network_probes", ["group_id"]),
        ("idx_network_probes_enabled", "network_probes", ["enabled"]),
        ("idx_network_probes_tenant_group", "network_probes", ["tenant_id", "group_id"]),
        
        # Network Probe Results indexes
        ("idx_probe_results_tenant_id", "network_probe_results", ["tenant_id"]),
        ("idx_probe_results_probe_id", "network_probe_results", ["probe_id"]),
        ("idx_probe_results_probed_at", "network_probe_results", ["probed_at"]),
        ("idx_probe_results_probe_time", "network_probe_results", ["probe_id", "probed_at"]),
        
        # Alert Rules indexes
        ("idx_alert_rules_tenant_id", "alert_rules", ["tenant_id"]),
        ("idx_alert_rules_enabled", "alert_rules", ["enabled"]),
        ("idx_alert_rules_tenant_enabled", "alert_rules", ["tenant_id", "enabled"]),
        
        # Alert Records indexes
        ("idx_alert_records_tenant_id", "alert_records", ["tenant_id"]),
        ("idx_alert_records_rule_id", "alert_records", ["rule_id"]),
        ("idx_alert_records_host_id", "alert_records", ["host_id"]),
        ("idx_alert_records_status", "alert_records", ["status"]),
        ("idx_alert_records_triggered_at", "alert_records", ["first_triggered_at"]),
        
        # Operation Logs indexes
        ("idx_operation_logs_tenant_id", "operation_logs", ["tenant_id"]),
        ("idx_operation_logs_user_id", "operation_logs", ["user_id"]),
        ("idx_operation_logs_created_at", "operation_logs", ["created_at"]),
        ("idx_operation_logs_tenant_created", "operation_logs", ["tenant_id", "created_at"]),
        
        # Roles indexes
        ("idx_roles_tenant_id", "roles", ["tenant_id"]),
        
        # Menus indexes
        ("idx_menus_tenant_id", "menus", ["tenant_id"]),
        ("idx_menus_parent_id", "menus", ["parent_id"]),
        
        # Host Info indexes
        ("idx_host_info_host_id", "host_info", ["host_id"]),
        
        # Host Metrics indexes
        ("idx_host_metrics_host_id", "host_metrics", ["host_id"]),
        ("idx_host_metrics_collected_at", "host_metrics", ["collected_at"]),
        ("idx_host_metrics_host_time", "host_metrics", ["host_id", "collected_at"]),
    ]
    
    with engine.connect() as conn:
        for index_name, table_name, columns in indexes:
            try:
                # Check if index already exists
                result = conn.execute(text(f"""
                    SELECT 1 FROM pg_indexes 
                    WHERE indexname = '{index_name}'
                """))
                
                if result.fetchone():
                    print(f"✓ Index {index_name} already exists")
                    continue
                
                # Create index
                columns_str = ', '.join(columns)
                create_sql = f"CREATE INDEX {index_name} ON {table_name} ({columns_str})"
                
                print(f"Creating index: {index_name} on {table_name}({columns_str})")
                conn.execute(text(create_sql))
                conn.commit()
                print(f"✓ Created index {index_name}")
                
            except Exception as e:
                print(f"✗ Error creating index {index_name}: {e}")
                conn.rollback()


def analyze_table_statistics(engine):
    """Analyze table statistics for query planner"""
    print("\n=== Analyzing Table Statistics ===")
    
    with engine.connect() as conn:
        try:
            # Run ANALYZE on all tables
            conn.execute(text("ANALYZE"))
            conn.commit()
            print("✓ Table statistics updated")
            
            # Get table sizes
            result = conn.execute(text("""
                SELECT 
                    schemaname,
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
                    n_live_tup as row_count
                FROM pg_stat_user_tables
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                LIMIT 20
            """))
            
            print("\nTop 20 Largest Tables:")
            for row in result:
                print(f"  {row.tablename}: {row.size} ({row.row_count} rows)")
                
        except Exception as e:
            print(f"Error analyzing statistics: {e}")


def check_missing_indexes(engine):
    """Check for missing indexes on foreign keys"""
    print("\n=== Checking for Missing Foreign Key Indexes ===")
    
    with engine.connect() as conn:
        try:
            result = conn.execute(text("""
                SELECT
                    c.conrelid::regclass AS table_name,
                    string_agg(a.attname, ', ') AS columns,
                    c.conname AS constraint_name
                FROM pg_constraint c
                JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
                WHERE c.contype = 'f'
                AND NOT EXISTS (
                    SELECT 1 FROM pg_index i
                    WHERE i.indrelid = c.conrelid
                    AND c.conkey::int[] <@ i.indkey::int[]
                )
                GROUP BY c.conrelid, c.conname
                ORDER BY c.conrelid::regclass::text
            """))
            
            missing = list(result)
            if missing:
                print("\nForeign keys without indexes:")
                for row in missing:
                    print(f"  {row.table_name}.{row.columns} (constraint: {row.constraint_name})")
            else:
                print("\n✓ All foreign keys have indexes")
                
        except Exception as e:
            print(f"Error checking foreign keys: {e}")


def vacuum_analyze_database(engine):
    """Run VACUUM ANALYZE to optimize database"""
    print("\n=== Running VACUUM ANALYZE ===")
    
    # VACUUM requires autocommit mode
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        try:
            print("Running VACUUM ANALYZE (this may take a while)...")
            conn.execute(text("VACUUM ANALYZE"))
            print("✓ VACUUM ANALYZE completed")
        except Exception as e:
            print(f"Error running VACUUM: {e}")


def main():
    """Main optimization function"""
    print("=" * 60)
    print("Database Index Optimization Tool")
    print("=" * 60)
    
    # Create engine
    database_url = get_database_url()
    engine = create_engine(database_url)
    
    try:
        # Check existing indexes
        check_existing_indexes(engine)
        
        # Check for missing foreign key indexes
        check_missing_indexes(engine)
        
        # Create recommended indexes
        create_recommended_indexes(engine)
        
        # Analyze table statistics
        analyze_table_statistics(engine)
        
        # Analyze slow queries
        analyze_slow_queries(engine)
        
        # Run VACUUM ANALYZE
        vacuum_analyze_database(engine)
        
        print("\n" + "=" * 60)
        print("Optimization Complete!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\nError during optimization: {e}")
    finally:
        engine.dispose()


if __name__ == '__main__':
    main()
