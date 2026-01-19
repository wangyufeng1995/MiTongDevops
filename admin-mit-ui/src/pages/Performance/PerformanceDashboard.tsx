import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';

interface SystemMetrics {
  cpu: {
    percent: number;
    count: number;
  };
  memory: {
    total: number;
    used: number;
    percent: number;
  };
  disk: {
    total: number;
    used: number;
    percent: number;
  };
}

interface CacheMetrics {
  stats: {
    hit_rate: number;
    keyspace_hits: number;
    keyspace_misses: number;
    used_memory: string;
  };
}

interface DatabaseMetrics {
  connection_pool: {
    size: number;
    checked_out: number;
    total_connections: number;
  };
  active_connections: number;
  database_size: string;
}

export const PerformanceDashboard = () => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics | null>(null);
  const [databaseMetrics, setDatabaseMetrics] = useState<DatabaseMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // 使用 useCallback 稳定函数引用，避免重复创建
  const fetchMetrics = useCallback(async () => {
    // 检查组件是否仍然挂载
    if (!mountedRef.current) return;
    
    try {
      const [systemRes, cacheRes, dbRes] = await Promise.all([
        axios.get('/api/performance/system'),
        axios.get('/api/performance/cache'),
        axios.get('/api/performance/database'),
      ]);

      // 再次检查组件是否仍然挂载
      if (!mountedRef.current) return;

      setSystemMetrics(systemRes.data.data);
      setCacheMetrics(cacheRes.data.data);
      setDatabaseMetrics(dbRes.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    // 立即获取一次数据
    fetchMetrics();
    
    // 设置定时器，每 5 秒刷新一次
    intervalRef.current = setInterval(fetchMetrics, 5000);
    
    // 清理函数
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchMetrics]); // 添加 fetchMetrics 到依赖数组

  const getStatusColor = (percent: number) => {
    if (percent < 60) return 'text-green-600';
    if (percent < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return <div className="p-6">Loading performance metrics...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">性能监控</h1>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">CPU Usage</h3>
          {systemMetrics && (
            <>
              <div className={`text-4xl font-bold ${getStatusColor(systemMetrics.cpu.percent)}`}>
                {systemMetrics.cpu.percent.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {systemMetrics.cpu.count} cores
              </div>
            </>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Memory Usage</h3>
          {systemMetrics && (
            <>
              <div className={`text-4xl font-bold ${getStatusColor(systemMetrics.memory.percent)}`}>
                {systemMetrics.memory.percent.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {(systemMetrics.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB / 
                {(systemMetrics.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB
              </div>
            </>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Disk Usage</h3>
          {systemMetrics && (
            <>
              <div className={`text-4xl font-bold ${getStatusColor(systemMetrics.disk.percent)}`}>
                {systemMetrics.disk.percent.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {(systemMetrics.disk.used / 1024 / 1024 / 1024).toFixed(2)} GB / 
                {(systemMetrics.disk.total / 1024 / 1024 / 1024).toFixed(2)} GB
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cache Metrics */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Redis Cache Performance</h3>
        {cacheMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Hit Rate</div>
              <div className={`text-2xl font-bold ${getStatusColor(100 - cacheMetrics.stats.hit_rate)}`}>
                {cacheMetrics.stats.hit_rate.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Cache Hits</div>
              <div className="text-2xl font-bold">{cacheMetrics.stats.keyspace_hits}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Cache Misses</div>
              <div className="text-2xl font-bold">{cacheMetrics.stats.keyspace_misses}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Memory Used</div>
              <div className="text-2xl font-bold">{cacheMetrics.stats.used_memory}</div>
            </div>
          </div>
        )}
      </div>

      {/* Database Metrics */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Database Performance</h3>
        {databaseMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Active Connections</div>
              <div className="text-2xl font-bold">{databaseMetrics.active_connections}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Pool Size</div>
              <div className="text-2xl font-bold">{databaseMetrics.connection_pool.size}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Checked Out</div>
              <div className="text-2xl font-bold">{databaseMetrics.connection_pool.checked_out}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Database Size</div>
              <div className="text-2xl font-bold">{databaseMetrics.database_size}</div>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Performance Recommendations</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          {systemMetrics && systemMetrics.cpu.percent > 80 && (
            <li className="text-red-600">CPU usage is high. Consider scaling or optimization.</li>
          )}
          {systemMetrics && systemMetrics.memory.percent > 80 && (
            <li className="text-red-600">Memory usage is high. Check for memory leaks.</li>
          )}
          {cacheMetrics && cacheMetrics.stats.hit_rate < 70 && (
            <li className="text-yellow-600">Cache hit rate is low. Review caching strategy.</li>
          )}
          {databaseMetrics && databaseMetrics.active_connections > 50 && (
            <li className="text-yellow-600">High database connections. Optimize connection pooling.</li>
          )}
        </ul>
      </div>
    </div>
  );
};
