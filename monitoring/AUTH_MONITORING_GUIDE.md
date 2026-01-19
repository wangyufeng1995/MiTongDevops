# Authentication System Monitoring Guide

## Overview

This guide describes the monitoring and alerting system for the Session + Token authentication implementation. The system provides comprehensive visibility into authentication operations, Redis performance, and security events.

## Architecture

The monitoring system consists of:

1. **Metrics Collection**: Application exports Prometheus metrics via `/health/metrics` endpoint
2. **Metrics Storage**: Prometheus scrapes and stores metrics
3. **Alerting**: Prometheus Alertmanager sends alerts based on defined rules
4. **Visualization**: Grafana dashboards display metrics and trends

## Metrics Endpoints

### Application Metrics Endpoint

**URL**: `http://backend:9090/health/metrics`

**Scrape Interval**: 10 seconds (configured in `prometheus.yml`)

**Exported Metrics**:

#### Authentication Metrics

| Metric Name | Type | Description |
|------------|------|-------------|
| `auth_login_success_total` | Counter | Total successful logins |
| `auth_login_failed_total` | Counter | Total failed logins |
| `auth_login_success_rate` | Gauge | Login success rate (%) |
| `auth_logout_total` | Counter | Total logouts |
| `auth_token_refresh_success_total` | Counter | Total successful token refreshes |
| `auth_token_refresh_failed_total` | Counter | Total failed token refreshes |
| `auth_token_refresh_success_rate` | Gauge | Token refresh success rate (%) |
| `auth_verification_success_total` | Counter | Total successful auth verifications |
| `auth_verification_failed_total` | Counter | Total failed auth verifications |
| `auth_verification_success_rate` | Gauge | Auth verification success rate (%) |
| `auth_active_sessions_count` | Gauge | Number of active sessions |
| `auth_login_failed_by_reason{reason}` | Counter | Login failures by reason |
| `auth_token_refresh_failed_by_reason{reason}` | Counter | Token refresh failures by reason |
| `auth_verification_failed_by_reason{reason}` | Counter | Verification failures by reason |

#### Redis Metrics

| Metric Name | Type | Description |
|------------|------|-------------|
| `redis_up` | Gauge | Redis availability (1=up, 0=down) |
| `redis_uptime_seconds` | Counter | Redis server uptime |
| `redis_connected_clients` | Gauge | Number of connected clients |
| `redis_blocked_clients` | Gauge | Number of blocked clients |
| `redis_used_memory_bytes` | Gauge | Used memory in bytes |
| `redis_used_memory_rss_bytes` | Gauge | RSS memory in bytes |
| `redis_used_memory_peak_bytes` | Gauge | Peak memory usage |
| `redis_mem_fragmentation_ratio` | Gauge | Memory fragmentation ratio |
| `redis_commands_processed_total` | Counter | Total commands processed |
| `redis_ops_per_sec` | Gauge | Operations per second |
| `redis_keyspace_hits_total` | Counter | Total keyspace hits |
| `redis_keyspace_misses_total` | Counter | Total keyspace misses |
| `redis_cache_hit_rate` | Gauge | Cache hit rate (%) |
| `redis_evicted_keys_total` | Counter | Total evicted keys |
| `redis_expired_keys_total` | Counter | Total expired keys |
| `redis_pool_max_connections` | Gauge | Max connections in pool |
| `redis_pool_in_use_connections` | Gauge | In-use connections |
| `redis_pool_available_connections` | Gauge | Available connections |
| `redis_response_time_ping_ms` | Gauge | PING response time (ms) |
| `redis_response_time_get_ms` | Gauge | GET response time (ms) |
| `redis_response_time_set_ms` | Gauge | SET response time (ms) |

## Alert Rules

Alert rules are defined in `monitoring/alerts/auth_alerts.yml`.

### Authentication Alerts

#### HighAuthenticationFailureRate
- **Condition**: Login success rate < 90%
- **Duration**: 5 minutes
- **Severity**: Warning
- **Action**: Investigate credential issues or potential attacks

#### CriticalAuthenticationFailureRate
- **Condition**: Login success rate < 80%
- **Duration**: 2 minutes
- **Severity**: Critical
- **Action**: Immediate investigation required

#### HighTokenRefreshFailureRate
- **Condition**: Token refresh success rate < 90%
- **Duration**: 5 minutes
- **Severity**: Warning
- **Action**: Check session and token validity

#### HighActiveSessionCount
- **Condition**: Active sessions > 100,000
- **Duration**: 5 minutes
- **Severity**: Warning
- **Action**: Consider scaling Redis or implementing cleanup

#### VeryHighActiveSessionCount
- **Condition**: Active sessions > 500,000
- **Duration**: 2 minutes
- **Severity**: Critical
- **Action**: System may be under attack

### Security Alerts

#### UserMismatchDetected
- **Condition**: User mismatch rate > 0.1/sec
- **Duration**: 2 minutes
- **Severity**: Critical
- **Action**: Potential security breach - investigate immediately

#### BlacklistedTokenUsage
- **Condition**: Blacklisted token usage > 0.5/sec
- **Duration**: 2 minutes
- **Severity**: Warning
- **Action**: Users attempting to use revoked tokens

#### HighInvalidPasswordAttempts
- **Condition**: Invalid password rate > 1/sec
- **Duration**: 5 minutes
- **Severity**: Warning
- **Action**: Possible brute force attack

#### CriticalInvalidPasswordAttempts
- **Condition**: Invalid password rate > 5/sec
- **Duration**: 2 minutes
- **Severity**: Critical
- **Action**: Brute force attack in progress

### Redis Performance Alerts

#### RedisHighResponseTime
- **Condition**: PING response time > 200ms
- **Duration**: 5 minutes
- **Severity**: Warning
- **Action**: Check Redis performance and load

#### RedisCriticalResponseTime
- **Condition**: PING response time > 500ms
- **Duration**: 2 minutes
- **Severity**: Critical
- **Action**: Severe performance issues

#### RedisConnectionPoolExhausted
- **Condition**: Available connections = 0
- **Duration**: 1 minute
- **Severity**: Critical
- **Action**: Application cannot access Redis

#### RedisHighMemoryUsage
- **Condition**: Memory usage > 80%
- **Duration**: 5 minutes
- **Severity**: Warning
- **Action**: Consider increasing memory or eviction policies

#### RedisDown
- **Condition**: Redis not responding
- **Duration**: 1 minute
- **Severity**: Critical
- **Action**: Authentication system unavailable

## Grafana Dashboard

### Importing the Dashboard

1. Open Grafana web interface
2. Navigate to Dashboards → Import
3. Upload `monitoring/dashboards/auth_dashboard.json`
4. Select Prometheus data source
5. Click Import

### Dashboard Panels

The authentication monitoring dashboard includes:

1. **Authentication Success Rate**: Line graph showing login, refresh, and verification success rates
2. **Active Sessions Count**: Current number of active sessions
3. **Authentication Operations Rate**: Operations per second for login, logout, and refresh
4. **Login Failure Reasons**: Pie chart showing distribution of failure reasons
5. **Redis Response Time**: Response times for PING, GET, and SET operations
6. **Redis Connection Pool**: Connection pool utilization
7. **Redis Memory Usage**: Memory consumption over time
8. **Redis Cache Performance**: Cache hit rate and operations
9. **Security Events**: Security-related events (user mismatch, blacklisted tokens, etc.)
10. **System Health Overview**: Key health indicators
11. **Authentication Totals**: Cumulative counters for all operations

### Dashboard Features

- **Auto-refresh**: Updates every 30 seconds
- **Time range**: Default 6 hours, customizable
- **Annotations**: Shows alerts on graphs
- **Alerts**: Built-in alerts for critical metrics

## Querying Metrics

### Prometheus Query Examples

#### Authentication Success Rate
```promql
auth_login_success_rate
```

#### Login Rate (per second)
```promql
rate(auth_login_success_total[5m])
```

#### Failed Login Reasons
```promql
auth_login_failed_by_reason
```

#### Active Sessions
```promql
auth_active_sessions_count
```

#### Redis Response Time
```promql
redis_response_time_ping_ms
```

#### Redis Cache Hit Rate
```promql
redis_cache_hit_rate
```

#### Redis Memory Usage Percentage
```promql
(redis_used_memory_bytes / redis_maxmemory) * 100
```

## Troubleshooting

### High Authentication Failure Rate

**Symptoms**: `auth_login_success_rate` < 90%

**Possible Causes**:
1. Credential attacks (brute force)
2. User account issues (disabled accounts)
3. Database connectivity problems
4. Redis unavailability

**Investigation Steps**:
1. Check `auth_login_failed_by_reason` for failure distribution
2. Review application logs for detailed error messages
3. Verify database and Redis connectivity
4. Check for unusual IP addresses or patterns

### High Redis Response Time

**Symptoms**: `redis_response_time_ping_ms` > 200ms

**Possible Causes**:
1. High Redis load
2. Network latency
3. Memory pressure
4. Slow queries

**Investigation Steps**:
1. Check `redis_ops_per_sec` for load
2. Review `redis_used_memory_bytes` for memory pressure
3. Check `redis_connected_clients` for connection count
4. Use Redis SLOWLOG to identify slow commands

### Connection Pool Exhaustion

**Symptoms**: `redis_pool_available_connections` = 0

**Possible Causes**:
1. Connection leaks
2. Insufficient pool size
3. High concurrent load

**Investigation Steps**:
1. Check `redis_pool_in_use_connections` trend
2. Review application logs for connection errors
3. Increase pool size in configuration
4. Check for connection leaks in code

### Security Events

**Symptoms**: High rate of `user_mismatch` or `invalid_password` events

**Possible Causes**:
1. Security breach attempt
2. Token theft
3. Brute force attack

**Investigation Steps**:
1. Review security logs for patterns
2. Check source IP addresses
3. Implement rate limiting if not already active
4. Consider blocking suspicious IPs
5. Force password resets if necessary

## Best Practices

### Monitoring

1. **Regular Review**: Check dashboards daily for anomalies
2. **Baseline Establishment**: Understand normal patterns for your system
3. **Alert Tuning**: Adjust thresholds based on your traffic patterns
4. **Retention**: Keep metrics for at least 30 days for trend analysis

### Performance

1. **Target Metrics**:
   - Login success rate: > 95%
   - Redis response time: < 100ms
   - Cache hit rate: > 80%
   - Active sessions: Monitor growth trends

2. **Capacity Planning**:
   - Monitor session growth rate
   - Plan Redis scaling before hitting 80% memory
   - Review connection pool utilization

### Security

1. **Alert Response**:
   - Respond to critical security alerts within 5 minutes
   - Investigate all user mismatch events
   - Review failed login patterns daily

2. **Audit**:
   - Regular review of authentication logs
   - Periodic security assessments
   - Monitor for unusual patterns

## Integration with CI/CD

### Automated Monitoring Checks

Add monitoring checks to your deployment pipeline:

```bash
# Check authentication success rate
curl -s "http://prometheus:9090/api/v1/query?query=auth_login_success_rate" | \
  jq '.data.result[0].value[1]' | \
  awk '{if ($1 < 95) exit 1}'

# Check Redis response time
curl -s "http://prometheus:9090/api/v1/query?query=redis_response_time_ping_ms" | \
  jq '.data.result[0].value[1]' | \
  awk '{if ($1 > 200) exit 1}'
```

### Health Check Integration

Use the `/health` endpoint for deployment health checks:

```bash
# Check overall health
curl -f http://backend:9090/health || exit 1

# Check readiness
curl -f http://backend:9090/ready || exit 1
```

## Support and Maintenance

### Regular Tasks

- **Daily**: Review dashboard for anomalies
- **Weekly**: Check alert history and tune thresholds
- **Monthly**: Review capacity and plan scaling
- **Quarterly**: Security audit and performance review

### Metric Retention

- **Prometheus**: 15 days (configurable in `prometheus.yml`)
- **Long-term**: Export to long-term storage (e.g., Thanos, Cortex)

### Backup and Recovery

- **Prometheus Data**: Regular backups of TSDB
- **Grafana Dashboards**: Version control in Git
- **Alert Rules**: Version control in Git

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Redis Monitoring Best Practices](https://redis.io/topics/admin)
- [Authentication System Design](../.kiro/specs/session-token-auth/design.md)
