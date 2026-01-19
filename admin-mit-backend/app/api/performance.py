"""
Performance Monitoring API
Provides endpoints for monitoring system performance
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import psutil
import time
from datetime import datetime
from app.services.cache_optimization_service import CacheOptimizationService
from app.extensions import db, redis_client
from sqlalchemy import text
from app.core.middleware import tenant_required

performance_bp = Blueprint('performance', __name__, url_prefix='/api/performance')


@performance_bp.route('/system', methods=['GET'])
@tenant_required
def get_system_metrics():
    """Get system performance metrics"""
    try:
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        
        # Memory metrics
        memory = psutil.virtual_memory()
        
        # Disk metrics
        disk = psutil.disk_usage('/')
        
        # Network metrics
        net_io = psutil.net_io_counters()
        
        return jsonify({
            'success': True,
            'data': {
                'cpu': {
                    'percent': cpu_percent,
                    'count': cpu_count,
                    'per_cpu': psutil.cpu_percent(interval=1, percpu=True)
                },
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'percent': memory.percent,
                    'used': memory.used
                },
                'disk': {
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percent': disk.percent
                },
                'network': {
                    'bytes_sent': net_io.bytes_sent,
                    'bytes_recv': net_io.bytes_recv,
                    'packets_sent': net_io.packets_sent,
                    'packets_recv': net_io.packets_recv
                },
                'timestamp': datetime.utcnow().isoformat()
            }
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error getting system metrics: {str(e)}'
        }), 500


@performance_bp.route('/database', methods=['GET'])
@tenant_required
def get_database_metrics():
    """Get database performance metrics"""
    try:
        metrics = {}
        
        # Connection pool stats
        engine = db.engine
        pool = engine.pool
        metrics['connection_pool'] = {
            'size': pool.size(),
            'checked_in': pool.checkedin(),
            'checked_out': pool.checkedout(),
            'overflow': pool.overflow(),
            'total_connections': pool.size() + pool.overflow()
        }
        
        # Database size
        with db.engine.connect() as conn:
            result = conn.execute(text("""
                SELECT pg_size_pretty(pg_database_size(current_database())) as size
            """))
            row = result.fetchone()
            metrics['database_size'] = row[0] if row else 'N/A'
            
            # Active connections
            result = conn.execute(text("""
                SELECT count(*) as active_connections
                FROM pg_stat_activity
                WHERE state = 'active'
            """))
            row = result.fetchone()
            metrics['active_connections'] = row[0] if row else 0
            
            # Table sizes
            result = conn.execute(text("""
                SELECT 
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
                    n_live_tup as row_count
                FROM pg_stat_user_tables
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                LIMIT 10
            """))
            metrics['largest_tables'] = [
                {
                    'name': row[0],
                    'size': row[1],
                    'rows': row[2]
                }
                for row in result
            ]
        
        return jsonify({
            'success': True,
            'data': metrics
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error getting database metrics: {str(e)}'
        }), 500


@performance_bp.route('/cache', methods=['GET'])
@tenant_required
def get_cache_metrics():
    """Get Redis cache performance metrics"""
    try:
        stats = CacheOptimizationService.get_cache_stats()
        
        # Additional Redis info
        info = redis_client.info()
        
        return jsonify({
            'success': True,
            'data': {
                'stats': stats,
                'redis_version': info.get('redis_version', 'N/A'),
                'uptime_days': info.get('uptime_in_days', 0),
                'total_keys': sum(
                    redis_client.dbsize() for _ in range(1)
                ),
                'memory': {
                    'used': info.get('used_memory_human', 'N/A'),
                    'peak': info.get('used_memory_peak_human', 'N/A'),
                    'fragmentation_ratio': info.get('mem_fragmentation_ratio', 0)
                }
            }
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error getting cache metrics: {str(e)}'
        }), 500


@performance_bp.route('/api-stats', methods=['GET'])
@tenant_required
def get_api_stats():
    """Get API performance statistics"""
    try:
        # Get request count from cache
        stats_key = 'api:stats:requests'
        
        # This would typically be populated by middleware
        # For now, return sample structure
        stats = {
            'total_requests': redis_client.get(f'{stats_key}:total') or 0,
            'successful_requests': redis_client.get(f'{stats_key}:success') or 0,
            'failed_requests': redis_client.get(f'{stats_key}:failed') or 0,
            'average_response_time': 0,  # Would be calculated from stored metrics
            'endpoints': {}  # Would contain per-endpoint statistics
        }
        
        return jsonify({
            'success': True,
            'data': stats
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error getting API stats: {str(e)}'
        }), 500


@performance_bp.route('/slow-queries', methods=['GET'])
@tenant_required
def get_slow_queries():
    """Get slow database queries"""
    try:
        with db.engine.connect() as conn:
            # Try to get slow queries from pg_stat_statements
            try:
                result = conn.execute(text("""
                    SELECT 
                        query,
                        calls,
                        total_exec_time,
                        mean_exec_time,
                        max_exec_time
                    FROM pg_stat_statements
                    WHERE mean_exec_time > 100
                    ORDER BY mean_exec_time DESC
                    LIMIT 20
                """))
                
                slow_queries = [
                    {
                        'query': row[0][:200],  # Truncate long queries
                        'calls': row[1],
                        'total_time': float(row[2]),
                        'mean_time': float(row[3]),
                        'max_time': float(row[4])
                    }
                    for row in result
                ]
            except:
                slow_queries = []
        
        return jsonify({
            'success': True,
            'data': {
                'slow_queries': slow_queries,
                'note': 'Requires pg_stat_statements extension'
            }
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error getting slow queries: {str(e)}'
        }), 500


@performance_bp.route('/report', methods=['GET'])
@tenant_required
def get_performance_report():
    """Get comprehensive performance report"""
    try:
        report = {
            'generated_at': datetime.utcnow().isoformat(),
            'system': {},
            'database': {},
            'cache': {},
            'recommendations': []
        }
        
        # System metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        
        report['system'] = {
            'cpu_usage': cpu_percent,
            'memory_usage': memory.percent,
            'status': 'healthy' if cpu_percent < 80 and memory.percent < 80 else 'warning'
        }
        
        # Database metrics
        with db.engine.connect() as conn:
            result = conn.execute(text("""
                SELECT count(*) FROM pg_stat_activity WHERE state = 'active'
            """))
            active_conn = result.fetchone()[0]
            
            report['database'] = {
                'active_connections': active_conn,
                'pool_size': db.engine.pool.size(),
                'status': 'healthy' if active_conn < 50 else 'warning'
            }
        
        # Cache metrics
        cache_stats = CacheOptimizationService.get_cache_stats()
        report['cache'] = {
            'hit_rate': cache_stats.get('hit_rate', 0),
            'status': 'healthy' if cache_stats.get('hit_rate', 0) > 70 else 'warning'
        }
        
        # Generate recommendations
        if cpu_percent > 80:
            report['recommendations'].append({
                'type': 'cpu',
                'severity': 'high',
                'message': 'CPU usage is high. Consider scaling horizontally or optimizing code.'
            })
        
        if memory.percent > 80:
            report['recommendations'].append({
                'type': 'memory',
                'severity': 'high',
                'message': 'Memory usage is high. Check for memory leaks or increase available memory.'
            })
        
        if cache_stats.get('hit_rate', 0) < 70:
            report['recommendations'].append({
                'type': 'cache',
                'severity': 'medium',
                'message': 'Cache hit rate is low. Review caching strategy and TTL settings.'
            })
        
        if active_conn > 50:
            report['recommendations'].append({
                'type': 'database',
                'severity': 'medium',
                'message': 'High number of active database connections. Consider connection pooling optimization.'
            })
        
        return jsonify({
            'success': True,
            'data': report
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error generating performance report: {str(e)}'
        }), 500
