# 网络探测 Redis 缓存集成指南

## 概述

本文档描述如何在网络探测系统中集成 Redis 缓存服务，以提高性能并减少数据库查询。

## 缓存策略

### 缓存配置

缓存配置在 `config/redis.yaml` 中定义：

```yaml
redis:
  cache:
    default_timeout: 300  # 默认缓存时间（秒）
    network_probe_ttl: 180  # 网络探测结果缓存时间（秒）
    session_ttl: 3600  # 会话缓存时间
```

### 缓存键设计

缓存服务使用以下键命名规范：

- `network:probe:result:{probe_id}` - 最新探测结果
- `network:probe:results:list:{probe_id}:page:{page}:limit:{limit}` - 探测结果列表（分页）
- `network:probe:statistics:{probe_id}` - 探测统计信息
- `network:probe:config:{probe_id}` - 探测配置信息
- `network:probe:group:{group_id}` - 探测分组信息

## 使用示例

### 1. 导入缓存服务

```python
from app.services.network_cache_service import network_cache_service
```

### 2. 缓存探测结果

在执行探测后，将结果缓存到 Redis：

```python
from app.services.network_probe_service import network_probe_service
from app.services.network_cache_service import network_cache_service

# 执行探测
probe = NetworkProbe.query.get(probe_id)
result = network_probe_service.execute_http_probe(probe, probe_type='manual')

# 缓存结果
result_data = result.to_dict()
network_cache_service.cache_probe_result(probe_id, result_data)

# 同步到缓存（推荐使用此方法，会自动清除相关缓存）
network_cache_service.sync_probe_result_to_cache(probe_id, result_data)
```

### 3. 获取缓存的探测结果

在查询探测结果前，先尝试从缓存获取：

```python
# 尝试从缓存获取
cached_result = network_cache_service.get_cached_probe_result(probe_id)

if cached_result:
    # 使用缓存数据
    return cached_result
else:
    # 从数据库查询
    result = NetworkProbeResult.query.filter_by(probe_id=probe_id)\
        .order_by(NetworkProbeResult.probed_at.desc()).first()
    
    if result:
        result_data = result.to_dict()
        # 缓存到 Redis
        network_cache_service.cache_probe_result(probe_id, result_data)
        return result_data
    
    return None
```

### 4. 缓存探测结果列表（分页）

```python
# 尝试从缓存获取
page = 1
limit = 10
cached_list = network_cache_service.get_cached_probe_results_list(probe_id, page, limit)

if cached_list:
    return cached_list
else:
    # 从数据库查询
    results = NetworkProbeResult.query.filter_by(probe_id=probe_id)\
        .order_by(NetworkProbeResult.probed_at.desc())\
        .limit(limit)\
        .offset((page - 1) * limit)\
        .all()
    
    results_data = [r.to_dict() for r in results]
    
    # 缓存到 Redis
    network_cache_service.cache_probe_results_list(probe_id, results_data, page, limit)
    
    return {
        'results': results_data,
        'page': page,
        'limit': limit,
        'total': len(results_data)
    }
```

### 5. 缓存探测统计信息

```python
# 尝试从缓存获取
cached_stats = network_cache_service.get_cached_probe_statistics(probe_id)

if cached_stats:
    return cached_stats
else:
    # 计算统计信息
    statistics = network_probe_service.get_probe_statistics(probe_id, days=7)
    
    # 缓存到 Redis
    network_cache_service.cache_probe_statistics(probe_id, statistics)
    
    return statistics
```

### 6. 页面数据变更时同步缓存

当用户在页面上修改探测配置时，需要同步更新缓存：

```python
# 更新探测配置
probe = NetworkProbe.query.get(probe_id)
probe.name = new_name
probe.target_url = new_url
probe.timeout = new_timeout
db.session.commit()

# 同步配置到缓存
probe_data = probe.to_dict()
network_cache_service.sync_probe_config_to_cache(probe_id, probe_data)
```

### 7. 删除探测任务时清除缓存

```python
# 删除探测任务
probe = NetworkProbe.query.get(probe_id)
db.session.delete(probe)
db.session.commit()

# 清除所有相关缓存
network_cache_service.invalidate_probe_cache(probe_id)
```

### 8. 缓存探测分组信息

```python
# 缓存分组信息
group = NetworkProbeGroup.query.get(group_id)
group_data = group.to_dict()
network_cache_service.cache_probe_group(group_id, group_data)

# 获取缓存的分组信息
cached_group = network_cache_service.get_cached_probe_group(group_id)

# 更新分组时清除缓存
network_cache_service.invalidate_probe_group_cache(group_id)
```

## API 集成示例

### 获取探测结果 API

```python
@bp.route('/api/network/probes/<int:probe_id>/results', methods=['GET'])
@jwt_required()
def get_probe_results(probe_id):
    """获取探测结果列表"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    
    # 尝试从缓存获取
    cached_data = network_cache_service.get_cached_probe_results_list(
        probe_id, page, limit
    )
    
    if cached_data:
        return jsonify({
            'code': 200,
            'message': '获取成功（缓存）',
            'data': cached_data
        })
    
    # 从数据库查询
    results = NetworkProbeResult.query.filter_by(probe_id=probe_id)\
        .order_by(NetworkProbeResult.probed_at.desc())\
        .limit(limit)\
        .offset((page - 1) * limit)\
        .all()
    
    results_data = [r.to_dict() for r in results]
    
    # 缓存结果
    network_cache_service.cache_probe_results_list(
        probe_id, results_data, page, limit
    )
    
    return jsonify({
        'code': 200,
        'message': '获取成功',
        'data': {
            'results': results_data,
            'page': page,
            'limit': limit,
            'total': len(results_data)
        }
    })
```

### 更新探测配置 API

```python
@bp.route('/api/network/probes/<int:probe_id>', methods=['PUT'])
@jwt_required()
def update_probe(probe_id):
    """更新探测配置"""
    data = request.get_json()
    
    probe = NetworkProbe.query.get_or_404(probe_id)
    
    # 更新配置
    probe.name = data.get('name', probe.name)
    probe.target_url = data.get('target_url', probe.target_url)
    probe.timeout = data.get('timeout', probe.timeout)
    # ... 其他字段
    
    db.session.commit()
    
    # 同步配置到缓存
    probe_data = probe.to_dict()
    network_cache_service.sync_probe_config_to_cache(probe_id, probe_data)
    
    # 清除结果缓存（配置变更后，旧结果可能不再有效）
    network_cache_service.invalidate_probe_results_cache(probe_id)
    
    return jsonify({
        'code': 200,
        'message': '更新成功',
        'data': probe_data
    })
```

### 执行探测 API

```python
@bp.route('/api/network/probes/<int:probe_id>/probe', methods=['POST'])
@jwt_required()
def execute_probe(probe_id):
    """执行主动探测"""
    probe = NetworkProbe.query.get_or_404(probe_id)
    
    # 执行探测
    if probe.protocol in ['http', 'https']:
        result = network_probe_service.execute_http_probe(probe, probe_type='manual')
    elif probe.protocol == 'websocket':
        result = network_probe_service.execute_websocket_probe(probe, probe_type='manual')
    elif probe.protocol == 'tcp':
        result = network_probe_service.execute_tcp_probe(probe, probe_type='manual')
    elif probe.protocol == 'udp':
        result = network_probe_service.execute_udp_probe(probe, probe_type='manual')
    else:
        return jsonify({'code': 400, 'message': '不支持的协议'}), 400
    
    # 同步结果到缓存
    result_data = result.to_dict()
    network_cache_service.sync_probe_result_to_cache(probe_id, result_data)
    
    return jsonify({
        'code': 200,
        'message': '探测完成',
        'data': result_data
    })
```

## 缓存失效策略

### 自动失效

- 探测结果缓存：180 秒后自动失效（TTL）
- 探测配置缓存：300 秒后自动失效（TTL）
- 分组信息缓存：300 秒后自动失效（TTL）

### 手动失效

在以下情况下需要手动清除缓存：

1. **探测配置更新**：清除配置缓存和结果缓存
   ```python
   network_cache_service.invalidate_probe_cache(probe_id)
   ```

2. **探测任务删除**：清除所有相关缓存
   ```python
   network_cache_service.invalidate_probe_cache(probe_id)
   ```

3. **新探测结果产生**：清除结果列表缓存
   ```python
   network_cache_service.invalidate_probe_results_cache(probe_id)
   ```

4. **分组信息更新**：清除分组缓存
   ```python
   network_cache_service.invalidate_probe_group_cache(group_id)
   ```

## 性能优化建议

### 1. 使用缓存优先策略

始终先尝试从缓存获取数据，缓存未命中时再查询数据库：

```python
def get_probe_result(probe_id):
    # 1. 尝试缓存
    cached = network_cache_service.get_cached_probe_result(probe_id)
    if cached:
        return cached
    
    # 2. 查询数据库
    result = query_from_database(probe_id)
    
    # 3. 写入缓存
    if result:
        network_cache_service.cache_probe_result(probe_id, result)
    
    return result
```

### 2. 批量缓存预热

在系统启动或低峰期，预先缓存热点数据：

```python
def warm_up_cache():
    """缓存预热"""
    # 获取活跃的探测任务
    active_probes = NetworkProbe.query.filter_by(enabled=True).all()
    
    for probe in active_probes:
        # 缓存最新结果
        last_result = probe.probe_results.order_by(
            NetworkProbeResult.probed_at.desc()
        ).first()
        
        if last_result:
            network_cache_service.cache_probe_result(
                probe.id, last_result.to_dict()
            )
        
        # 缓存配置
        network_cache_service.cache_probe_config(
            probe.id, probe.to_dict()
        )
```

### 3. 监控缓存命中率

定期检查缓存命中率，优化缓存策略：

```python
def get_cache_stats():
    """获取缓存统计信息"""
    info = network_cache_service.get_cache_info()
    
    # 可以添加更多统计信息
    # 如：命中率、缓存大小、键数量等
    
    return info
```

## 注意事项

1. **数据一致性**：确保在更新数据库后立即同步缓存
2. **缓存穿透**：对于不存在的数据，也应该缓存空结果（短 TTL）
3. **缓存雪崩**：避免大量缓存同时失效，使用随机 TTL
4. **内存管理**：定期清理过期缓存，避免 Redis 内存溢出
5. **错误处理**：Redis 故障时应该降级到数据库查询

## 测试

运行缓存服务测试：

```bash
cd admin-mit-backend
python -m pytest tests/test_network_cache_service.py -v
```

所有测试应该通过，确保缓存服务正常工作。
