# Performance Optimization Guide

## Overview

This document provides comprehensive guidance on performance testing, monitoring, and optimization for the Admin System Template.

## Table of Contents

1. [Performance Testing](#performance-testing)
2. [Database Optimization](#database-optimization)
3. [Cache Optimization](#cache-optimization)
4. [Frontend Optimization](#frontend-optimization)
5. [Monitoring and Reporting](#monitoring-and-reporting)
6. [Best Practices](#best-practices)

## Performance Testing

### Frontend Performance Tests

Location: `admin-mit-ui/src/test/performance.test.tsx`

Tests include:
- Component rendering performance (DataTable with 100/1000 rows)
- Re-render performance (50 rapid updates)
- Memory leak detection (100 mount/unmount cycles)

**Run tests:**
```bash
cd admin-mit-ui
npm test -- src/test/performance.test.tsx --run
```

**Performance Targets:**
- DataTable (100 rows): < 500ms
- DataTable (1000 rows): < 1000ms
- DashboardLayout: < 300ms
- 50 re-renders: < 500ms

### API Performance Tests

Location: `admin-mit-ui/src/test/api-performance.test.ts`

Tests include:
- Authentication API response times
- User management API performance
- Network probe API performance
- Concurrent request handling

**Run tests:**
```bash
cd admin-mit-ui
npm test -- src/test/api-performance.test.ts --run
```

**Performance Targets:**
- Login API: < 500ms
- Token refresh: < 200ms
- List APIs: < 300ms
- Create APIs: < 400ms
- 10 concurrent requests: < 2000ms

### Backend Database Performance Tests

Location: `admin-mit-backend/tests/test_performance_database.py`

Tests include:
- User list query performance
- Search query performance
- Network probe results pagination
- Alert records with joins
- Bulk insert performance
- Complex aggregation queries
- Index effectiveness
- Concurrent read operations

**Run tests:**
```bash
cd admin-mit-backend
pytest tests/test_performance_database.py -v
```

**Performance Targets:**
- Simple queries: < 100ms
- Search queries: < 150ms
- Queries with joins: < 200ms
- Bulk insert (100 records): < 500ms
- Aggregation queries: < 150ms

### Backend API Performance Tests

Location: `admin-mit-backend/tests/test_performance_api.py`

Tests include:
- API endpoint response times
- Concurrent request handling
- Load testing (50 requests)
- Response payload sizes

**Run tests:**
```bash
cd admin-mit-backend
pytest tests/test_performance_api.py -v
```

## Database Optimization

### Index Optimization Script

Location: `admin-mit-backend/scripts/optimize_database_indexes.py`

**Features:**
- Analyzes slow queries
- Checks existing indexes
- Creates recommended indexes
- Identifies missing foreign key indexes
- Runs VACUUM ANALYZE
- Provides table statistics

**Run optimization:**
```bash
cd admin-mit-backend
python scripts/optimize_database_indexes.py
```

### Recommended Indexes

The script creates indexes on:
- **tenant_id** columns (all tables)
- **Foreign key** columns
- **Status** and **enabled** columns
- **Timestamp** columns (created_at, probed_at, etc.)
- **Composite indexes** for common query patterns

### Query Optimization Tips

1. **Always filter by tenant_id first**
   ```sql
   WHERE tenant_id = ? AND other_conditions
   ```

2. **Use pagination for large result sets**
   ```sql
   LIMIT 10 OFFSET 0
   ```

3. **Avoid SELECT ***
   ```sql
   SELECT id, name, status FROM users
   ```

4. **Use indexes for sorting**
   ```sql
   ORDER BY created_at DESC  -- Ensure index exists
   ```

5. **Batch operations when possible**
   ```python
   db.session.bulk_save_objects(objects)
   ```

## Cache Optimization

### Redis Cache Service

Location: `admin-mit-backend/app/services/cache_optimization_service.py`

**Features:**
- Decorator-based caching
- Batch get/set operations
- Cache invalidation patterns
- Counter management
- Cache statistics
- Cache warming

### Cache TTL Configuration

```python
TTL_SHORT = 60      # 1 minute
TTL_MEDIUM = 300    # 5 minutes
TTL_LONG = 1800     # 30 minutes
TTL_NETWORK_PROBE = 180  # 3 minutes (per requirements)
```

### Usage Examples

**Decorator-based caching:**
```python
from app.services.cache_optimization_service import CacheOptimizationService

@CacheOptimizationService.cache_result(ttl=300, key_prefix="users")
def get_user_list(tenant_id, page=1):
    return User.query.filter_by(tenant_id=tenant_id).paginate(page=page)
```

**Manual caching:**
```python
cache_key = f"user:{user_id}"
user_data = CacheOptimizationService.get_or_set(
    cache_key,
    lambda: get_user_from_db(user_id),
    ttl=300
)
```

**Batch operations:**
```python
# Batch get
keys = [f"user:{id}" for id in user_ids]
cached_users = CacheOptimizationService.batch_get(keys)

# Batch set
data = {f"user:{u.id}": u.to_dict() for u in users}
CacheOptimizationService.batch_set(data, ttl=300)
```

**Cache invalidation:**
```python
# Invalidate specific pattern
CacheOptimizationService.invalidate_cache("user:*")

# Invalidate probe cache
NetworkProbeCacheService.invalidate_probe_cache(probe_id)
```

### Network Probe Caching

Special caching for network probe results:

```python
from app.services.cache_optimization_service import NetworkProbeCacheService

# Cache probe result
NetworkProbeCacheService.cache_probe_result(probe_id, result_data)

# Get cached result
result = NetworkProbeCacheService.get_cached_probe_result(probe_id)

# Update probe status
NetworkProbeCacheService.update_probe_status(probe_id, "running")
```

## Frontend Optimization

### Code Splitting and Lazy Loading

Location: `admin-mit-ui/src/router/index.tsx`

**Implementation:**
```typescript
// Eager load critical components
import { LoginPage } from '../pages/Login'
import { DashboardPage } from '../pages/Dashboard'

// Lazy load non-critical pages
const UsersPage = lazy(() => import('../pages/Users'))
const RolesPage = lazy(() => import('../pages/Roles'))

// Use with Suspense
<Suspense fallback={<Loading />}>
  <UsersPage />
</Suspense>
```

**Benefits:**
- Reduced initial bundle size
- Faster initial page load
- Better user experience
- Automatic code splitting by route

### Component Optimization

**Use React.memo for expensive components:**
```typescript
export const ExpensiveComponent = React.memo(({ data }) => {
  // Component logic
})
```

**Use useMemo for expensive calculations:**
```typescript
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.value - b.value)
}, [data])
```

**Use useCallback for event handlers:**
```typescript
const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies])
```

### Bundle Size Optimization

**Analyze bundle:**
```bash
npm run build
npm run analyze  # If configured
```

**Optimization techniques:**
1. Tree shaking (automatic with Vite)
2. Code splitting (implemented in router)
3. Lazy loading images
4. Remove unused dependencies
5. Use production builds

## Monitoring and Reporting

### Performance Monitoring API

Location: `admin-mit-backend/app/api/performance.py`

**Endpoints:**
- `GET /api/performance/system` - System metrics (CPU, memory, disk)
- `GET /api/performance/database` - Database metrics
- `GET /api/performance/cache` - Redis cache metrics
- `GET /api/performance/api-stats` - API statistics
- `GET /api/performance/slow-queries` - Slow query analysis
- `GET /api/performance/report` - Comprehensive report

### Performance Dashboard

Location: `admin-mit-ui/src/pages/Performance/PerformanceDashboard.tsx`

**Features:**
- Real-time system metrics
- Cache hit rate monitoring
- Database connection pool status
- Performance recommendations
- Auto-refresh every 5 seconds

**Access:**
Navigate to `/performance` in the application.

### Monitoring Best Practices

1. **Set up alerts for:**
   - CPU usage > 80%
   - Memory usage > 80%
   - Cache hit rate < 70%
   - Database connections > 50
   - API response time > 1000ms

2. **Regular monitoring:**
   - Check performance dashboard daily
   - Review slow queries weekly
   - Analyze cache statistics weekly
   - Run performance tests before releases

3. **Log performance metrics:**
   ```python
   import time
   start = time.time()
   # Operation
   duration = (time.time() - start) * 1000
   logger.info(f"Operation took {duration:.2f}ms")
   ```

## Best Practices

### Database

1. **Always use indexes on:**
   - Foreign keys
   - tenant_id columns
   - Frequently queried columns
   - Columns used in WHERE, ORDER BY, JOIN

2. **Connection pooling:**
   - Configure appropriate pool size
   - Monitor connection usage
   - Close connections properly

3. **Query optimization:**
   - Use EXPLAIN ANALYZE for slow queries
   - Avoid N+1 queries
   - Use eager loading for relationships
   - Batch operations when possible

### Caching

1. **Cache frequently accessed data:**
   - User sessions
   - Configuration data
   - Lookup tables
   - API responses

2. **Set appropriate TTLs:**
   - Short TTL for frequently changing data
   - Long TTL for static data
   - Consider cache invalidation strategy

3. **Monitor cache performance:**
   - Track hit rate (target > 70%)
   - Monitor memory usage
   - Identify cache misses

### Frontend

1. **Optimize rendering:**
   - Use React.memo for pure components
   - Implement virtual scrolling for large lists
   - Debounce user input
   - Throttle scroll events

2. **Reduce bundle size:**
   - Code splitting by route
   - Lazy load components
   - Remove unused code
   - Optimize images

3. **Network optimization:**
   - Implement request caching
   - Use pagination
   - Compress responses
   - Minimize API calls

### API

1. **Response optimization:**
   - Use pagination for lists
   - Implement field selection
   - Compress responses (gzip)
   - Cache responses when appropriate

2. **Request handling:**
   - Validate input early
   - Use async operations
   - Implement rate limiting
   - Handle errors gracefully

3. **Monitoring:**
   - Log response times
   - Track error rates
   - Monitor concurrent requests
   - Set up performance alerts

## Performance Checklist

### Before Deployment

- [ ] Run all performance tests
- [ ] Check database indexes
- [ ] Verify cache configuration
- [ ] Test with production-like data volume
- [ ] Run load tests
- [ ] Check bundle sizes
- [ ] Review slow queries
- [ ] Verify monitoring is configured

### Regular Maintenance

- [ ] Weekly: Review performance dashboard
- [ ] Weekly: Check slow queries
- [ ] Weekly: Analyze cache statistics
- [ ] Monthly: Run full performance test suite
- [ ] Monthly: Review and optimize indexes
- [ ] Quarterly: Capacity planning review

## Troubleshooting

### High CPU Usage

1. Check for inefficient queries
2. Review application logs for errors
3. Check for infinite loops
4. Monitor concurrent requests
5. Consider horizontal scaling

### High Memory Usage

1. Check for memory leaks
2. Review cache size
3. Check connection pool size
4. Monitor object creation
5. Use memory profiling tools

### Slow Queries

1. Run EXPLAIN ANALYZE
2. Check for missing indexes
3. Review query complexity
4. Consider query rewriting
5. Check table statistics

### Low Cache Hit Rate

1. Review TTL settings
2. Check cache invalidation logic
3. Verify cache key generation
4. Monitor cache size
5. Consider cache warming

## Additional Resources

- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [Vite Performance](https://vitejs.dev/guide/performance.html)
