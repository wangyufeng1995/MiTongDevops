-- ============================================
-- Admin-MIT 数据库初始化脚本
-- 适用于 PostgreSQL 数据库
-- ============================================

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 租户表
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    status INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_code ON tenants(code);

-- ============================================
-- 2. 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    avatar_style VARCHAR(50) DEFAULT 'avataaars',
    avatar_seed VARCHAR(100),
    avatar_config JSONB,
    status INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- 3. 角色表
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(50) NOT NULL,
    description TEXT,
    permissions JSONB,
    status INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON roles(tenant_id);

-- ============================================
-- 4. 用户角色关联表
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_user_role UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- ============================================
-- 5. 菜单表
-- ============================================
CREATE TABLE IF NOT EXISTS menus (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    parent_id INTEGER REFERENCES menus(id),
    name VARCHAR(50) NOT NULL,
    path VARCHAR(100),
    component VARCHAR(100),
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menus_tenant_id ON menus(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menus_parent_id ON menus(parent_id);

-- ============================================
-- 6. 操作日志表
-- ============================================
CREATE TABLE IF NOT EXISTS operation_logs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_tenant_id ON operation_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user_id ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);

-- ============================================
-- 7. 主机分组表
-- ============================================
CREATE TABLE IF NOT EXISTS host_groups (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_host_group_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_host_groups_tenant_id ON host_groups(tenant_id);

-- ============================================
-- 8. SSH主机表
-- ============================================
CREATE TABLE IF NOT EXISTS ssh_hosts (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    group_id INTEGER REFERENCES host_groups(id),
    name VARCHAR(100) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    port INTEGER DEFAULT 22,
    username VARCHAR(100) NOT NULL,
    auth_type VARCHAR(20) NOT NULL,
    password VARCHAR(255),
    private_key TEXT,
    description TEXT,
    os_type VARCHAR(100),
    status INTEGER DEFAULT 1,
    last_connected_at TIMESTAMP,
    last_probe_status VARCHAR(20),
    last_probe_at TIMESTAMP,
    last_probe_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ssh_hosts_tenant_id ON ssh_hosts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ssh_hosts_group_id ON ssh_hosts(group_id);

-- ============================================
-- 9. 主机信息表
-- ============================================
CREATE TABLE IF NOT EXISTS host_info (
    id SERIAL PRIMARY KEY,
    host_id INTEGER NOT NULL REFERENCES ssh_hosts(id) ON DELETE CASCADE,
    os_name VARCHAR(100),
    os_version VARCHAR(100),
    kernel_version VARCHAR(100),
    cpu_cores INTEGER,
    total_memory BIGINT,
    disk_total BIGINT,
    network_interfaces JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_host_info_host_id ON host_info(host_id);

-- ============================================
-- 10. 主机性能指标表
-- ============================================
CREATE TABLE IF NOT EXISTS host_metrics (
    id SERIAL PRIMARY KEY,
    host_id INTEGER NOT NULL REFERENCES ssh_hosts(id) ON DELETE CASCADE,
    cpu_usage NUMERIC(5, 2),
    memory_usage NUMERIC(5, 2),
    disk_usage NUMERIC(5, 2),
    network_in BIGINT,
    network_out BIGINT,
    load_average NUMERIC(5, 2),
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_host_metrics_host_id ON host_metrics(host_id);
CREATE INDEX IF NOT EXISTS idx_host_metrics_collected_at ON host_metrics(collected_at);

-- ============================================
-- 11. 主机探测结果表
-- ============================================
CREATE TABLE IF NOT EXISTS host_probe_results (
    id SERIAL PRIMARY KEY,
    host_id INTEGER NOT NULL REFERENCES ssh_hosts(id) ON DELETE CASCADE,
    task_id VARCHAR(100),
    status VARCHAR(20) NOT NULL,
    message TEXT,
    ansible_output TEXT,
    response_time FLOAT,
    probed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_host_probe_results_host_id ON host_probe_results(host_id);


-- ============================================
-- 12. Ansible Playbook表
-- ============================================
CREATE TABLE IF NOT EXISTS ansible_playbooks (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    variables JSONB,
    version VARCHAR(20) DEFAULT '1.0',
    tags JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    category VARCHAR(50),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ansible_playbooks_tenant_id ON ansible_playbooks(tenant_id);

-- ============================================
-- 13. Playbook执行记录表
-- ============================================
CREATE TABLE IF NOT EXISTS playbook_executions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    playbook_id INTEGER NOT NULL REFERENCES ansible_playbooks(id) ON DELETE CASCADE,
    host_ids JSONB NOT NULL,
    variables JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    output TEXT,
    error_message TEXT,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_by INTEGER NOT NULL REFERENCES users(id),
    execution_id VARCHAR(100),
    progress INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    skipped_tasks INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_playbook_executions_tenant_id ON playbook_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_playbook_id ON playbook_executions(playbook_id);

-- ============================================
-- 14. 告警渠道表
-- ============================================
CREATE TABLE IF NOT EXISTS alert_channels (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    config JSONB NOT NULL,
    description TEXT,
    status INTEGER DEFAULT 1,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_channels_tenant_id ON alert_channels(tenant_id);

-- ============================================
-- 15. 告警规则表
-- ============================================
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    metric_type VARCHAR(50) NOT NULL,
    condition_operator VARCHAR(10) NOT NULL,
    threshold_value NUMERIC(10, 2) NOT NULL,
    duration INTEGER DEFAULT 300,
    severity VARCHAR(20) DEFAULT 'warning',
    host_ids JSONB,
    channel_ids JSONB NOT NULL,
    silence_period INTEGER DEFAULT 3600,
    enabled BOOLEAN DEFAULT TRUE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant_id ON alert_rules(tenant_id);

-- ============================================
-- 16. 告警记录表
-- ============================================
CREATE TABLE IF NOT EXISTS alert_records (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    host_id INTEGER NOT NULL REFERENCES ssh_hosts(id),
    metric_type VARCHAR(50) NOT NULL,
    current_value NUMERIC(10, 2) NOT NULL,
    threshold_value NUMERIC(10, 2) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    message TEXT NOT NULL,
    first_triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    acknowledged_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_records_tenant_id ON alert_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_records_rule_id ON alert_records(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_records_status ON alert_records(status);

-- ============================================
-- 17. 告警通知记录表
-- ============================================
CREATE TABLE IF NOT EXISTS alert_notifications (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    alert_record_id INTEGER NOT NULL REFERENCES alert_records(id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES alert_channels(id),
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_tenant_id ON alert_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert_record_id ON alert_notifications(alert_record_id);

-- ============================================
-- 18. 网络探测分组表
-- ============================================
CREATE TABLE IF NOT EXISTS network_probe_groups (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_system BOOLEAN DEFAULT FALSE,
    color VARCHAR(7) DEFAULT '#1890ff',
    sort_order INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_tenant_group_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_network_probe_groups_tenant_id ON network_probe_groups(tenant_id);

-- ============================================
-- 19. 网络探测任务表
-- ============================================
CREATE TABLE IF NOT EXISTS network_probes (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    group_id INTEGER NOT NULL REFERENCES network_probe_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    protocol VARCHAR(20) NOT NULL,
    target_url VARCHAR(500) NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    headers JSONB,
    body TEXT,
    timeout INTEGER DEFAULT 30,
    interval_seconds INTEGER DEFAULT 60,
    auto_probe_enabled BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_network_probes_tenant_id ON network_probes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_network_probes_group_id ON network_probes(group_id);

-- ============================================
-- 20. 网络探测结果表
-- ============================================
CREATE TABLE IF NOT EXISTS network_probe_results (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    probe_id INTEGER NOT NULL REFERENCES network_probes(id) ON DELETE CASCADE,
    probe_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time INTEGER,
    status_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    probed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_network_probe_results_tenant_id ON network_probe_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_network_probe_results_probe_id ON network_probe_results(probe_id);
CREATE INDEX IF NOT EXISTS idx_network_probe_results_probed_at ON network_probe_results(probed_at);

-- ============================================
-- 21. 网络告警规则表
-- ============================================
CREATE TABLE IF NOT EXISTS network_alert_rules (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    probe_id INTEGER NOT NULL REFERENCES network_probes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    condition_type VARCHAR(50) NOT NULL,
    condition_operator VARCHAR(10) NOT NULL,
    threshold_value NUMERIC(10, 2),
    consecutive_failures INTEGER DEFAULT 3,
    channel_ids JSONB NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_network_alert_rules_tenant_id ON network_alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_network_alert_rules_probe_id ON network_alert_rules(probe_id);

-- ============================================
-- 22. 网络告警记录表
-- ============================================
CREATE TABLE IF NOT EXISTS network_alert_records (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    rule_id INTEGER NOT NULL REFERENCES network_alert_rules(id) ON DELETE CASCADE,
    probe_id INTEGER NOT NULL REFERENCES network_probes(id),
    status VARCHAR(20) DEFAULT 'active',
    message TEXT NOT NULL,
    triggered_value NUMERIC(10, 2),
    first_triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    acknowledged_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_network_alert_records_tenant_id ON network_alert_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_network_alert_records_rule_id ON network_alert_records(rule_id);


-- ============================================
-- 23. 系统设置表
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    key VARCHAR(100) NOT NULL,
    value JSONB,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_tenant_setting_key UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_system_settings_tenant_id ON system_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_category ON system_settings(tenant_id, category);

-- ============================================
-- 24. WebShell审计日志表
-- ============================================
CREATE TABLE IF NOT EXISTS webshell_audit_logs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    host_id INTEGER NOT NULL REFERENCES ssh_hosts(id),
    session_id VARCHAR(100),
    command TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    output_summary TEXT,
    error_message TEXT,
    block_reason VARCHAR(255),
    ip_address VARCHAR(45),
    execution_time FLOAT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_host_date ON webshell_audit_logs(host_id, executed_at);
CREATE INDEX IF NOT EXISTS idx_audit_user_date ON webshell_audit_logs(user_id, executed_at);
CREATE INDEX IF NOT EXISTS idx_audit_status ON webshell_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_date ON webshell_audit_logs(tenant_id, executed_at);

-- ============================================
-- 25. 命令过滤规则表
-- ============================================
CREATE TABLE IF NOT EXISTS command_filter_rules (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    host_id INTEGER REFERENCES ssh_hosts(id),
    mode VARCHAR(20) NOT NULL DEFAULT 'blacklist',
    whitelist JSONB DEFAULT '[]',
    blacklist JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_filter_rule_tenant_host UNIQUE (tenant_id, host_id)
);

CREATE INDEX IF NOT EXISTS idx_command_filter_rules_tenant_id ON command_filter_rules(tenant_id);

-- ============================================
-- 26. 备份记录表
-- ============================================
CREATE TABLE IF NOT EXISTS backup_records (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(500) NOT NULL,
    category VARCHAR(50) NOT NULL,
    backup_type VARCHAR(20) NOT NULL DEFAULT 'manual',
    file_size BIGINT,
    file_size_display VARCHAR(50),
    compression BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    message TEXT,
    db_host VARCHAR(255),
    db_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    deleted_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_records_tenant_id ON backup_records(tenant_id);

-- ============================================
-- 27. Redis连接配置表
-- ============================================
CREATE TABLE IF NOT EXISTS redis_connections (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    connection_type VARCHAR(20) NOT NULL DEFAULT 'standalone',
    host VARCHAR(255),
    port INTEGER DEFAULT 6379,
    password TEXT,
    database INTEGER DEFAULT 0,
    cluster_nodes TEXT,
    timeout INTEGER DEFAULT 5,
    description TEXT,
    status INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_redis_connection_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_redis_connections_tenant_id ON redis_connections(tenant_id);

-- ============================================
-- 28. 数据库连接配置表
-- ============================================
CREATE TABLE IF NOT EXISTS database_connections (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    db_type VARCHAR(20) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    username VARCHAR(100) NOT NULL,
    password TEXT,
    database VARCHAR(100),
    schema VARCHAR(100),
    service_name VARCHAR(100),
    sid VARCHAR(100),
    timeout INTEGER DEFAULT 10,
    description TEXT,
    status INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_database_connection_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_database_connections_tenant_id ON database_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_database_connections_type ON database_connections(db_type);

-- ============================================
-- 29. K8S集群表
-- ============================================
CREATE TABLE IF NOT EXISTS k8s_clusters (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    api_server VARCHAR(255) NOT NULL,
    auth_type VARCHAR(20) NOT NULL,
    token TEXT,
    kubeconfig TEXT,
    description TEXT,
    status VARCHAR(20),
    version VARCHAR(50),
    node_count INTEGER,
    namespace_count INTEGER,
    pod_count INTEGER,
    last_connected_at TIMESTAMP,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_k8s_clusters_tenant_id ON k8s_clusters(tenant_id);

-- ============================================
-- 30. K8S操作审计日志表
-- ============================================
CREATE TABLE IF NOT EXISTS k8s_operations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    cluster_id INTEGER REFERENCES k8s_clusters(id),
    operation_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_name VARCHAR(255),
    namespace VARCHAR(255),
    operation_data JSONB,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_k8s_operations_tenant_id ON k8s_operations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_k8s_operations_cluster_id ON k8s_operations(cluster_id);


-- ============================================
-- 31. 数据源配置表
-- ============================================
CREATE TABLE IF NOT EXISTS datasource_configs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) DEFAULT 'prometheus',
    url VARCHAR(500) NOT NULL,
    auth_type VARCHAR(20) DEFAULT 'none',
    username VARCHAR(100),
    password VARCHAR(500),
    token VARCHAR(1000),
    is_default BOOLEAN DEFAULT FALSE,
    status INTEGER DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_datasource_configs_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_datasource_configs_tenant_id ON datasource_configs(tenant_id);

-- ============================================
-- 32. 保存的PromQL查询表
-- ============================================
CREATE TABLE IF NOT EXISTS saved_promql_queries (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    config_id INTEGER NOT NULL REFERENCES datasource_configs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    query TEXT NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_saved_queries_tenant_config_name UNIQUE (tenant_id, config_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_promql_queries_tenant_id ON saved_promql_queries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saved_promql_queries_config_id ON saved_promql_queries(config_id);

-- ============================================
-- 33. Grafana配置表
-- ============================================
CREATE TABLE IF NOT EXISTS grafana_configs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    status INTEGER DEFAULT 1,
    iframe_height INTEGER DEFAULT 800,
    auth_type VARCHAR(20) DEFAULT 'none',
    auth_username VARCHAR(100),
    auth_password VARCHAR(200),
    auth_token VARCHAR(500),
    api_key VARCHAR(500),
    use_proxy BOOLEAN DEFAULT TRUE,
    allow_anonymous BOOLEAN DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_grafana_configs_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_grafana_configs_tenant_id ON grafana_configs(tenant_id);

-- ============================================
-- 34. Grafana仪表盘表
-- ============================================
CREATE TABLE IF NOT EXISTS grafana_dashboards (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES grafana_configs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_grafana_dashboards_config_name UNIQUE (config_id, name)
);

CREATE INDEX IF NOT EXISTS idx_grafana_dashboards_config_id ON grafana_dashboards(config_id);

-- ============================================
-- 35. 系统通知表
-- ============================================
CREATE TABLE IF NOT EXISTS system_notifications (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    category VARCHAR(50) NOT NULL DEFAULT 'system',
    is_read BOOLEAN DEFAULT FALSE,
    is_global BOOLEAN DEFAULT FALSE,
    target_user_id INTEGER,
    related_type VARCHAR(50),
    related_id INTEGER,
    read_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_notifications_tenant_id ON system_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_notifications_target_user ON system_notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_system_notifications_is_read ON system_notifications(is_read);

-- ============================================
-- 初始化示例数据
-- ============================================

-- 插入示例租户
INSERT INTO tenants (name, code, status) VALUES ('示例企业', 'demo_company', 1)
ON CONFLICT (code) DO NOTHING;

-- 获取租户ID并插入角色
DO $$
DECLARE
    v_tenant_id INTEGER;
    v_super_admin_role_id INTEGER;
    v_admin_role_id INTEGER;
    v_user_role_id INTEGER;
    v_admin_user_id INTEGER;
    v_normal_user_id INTEGER;
BEGIN
    -- 获取租户ID
    SELECT id INTO v_tenant_id FROM tenants WHERE code = 'demo_company';
    
    -- 插入超级管理员角色
    INSERT INTO roles (tenant_id, name, description, permissions, status)
    VALUES (v_tenant_id, 'super_admin', '超级管理员，拥有所有权限', 
        '["user:read", "user:create", "user:update", "user:delete", "role:read", "role:create", "role:update", "role:delete", "menu:read", "menu:create", "menu:update", "menu:delete", "host:read", "host:create", "host:update", "host:delete", "ansible:read", "ansible:create", "ansible:update", "ansible:delete", "monitor:read", "monitor:create", "monitor:update", "monitor:delete", "network:read", "network:create", "network:update", "network:delete", "log:read", "system:read", "system:update", "k8s:read", "k8s:create", "k8s:update", "k8s:delete", "datasource:read", "datasource:create", "datasource:update", "datasource:delete", "grafana:read", "grafana:create", "grafana:update", "grafana:delete"]'::jsonb, 1)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_super_admin_role_id;
    
    IF v_super_admin_role_id IS NULL THEN
        SELECT id INTO v_super_admin_role_id FROM roles WHERE tenant_id = v_tenant_id AND name = 'super_admin';
    END IF;
    
    -- 插入管理员角色
    INSERT INTO roles (tenant_id, name, description, permissions, status)
    VALUES (v_tenant_id, 'admin', '管理员，拥有大部分权限',
        '["user:read", "user:create", "user:update", "role:read", "menu:read", "host:read", "host:create", "host:update", "host:delete", "ansible:read", "ansible:create", "ansible:update", "ansible:delete", "monitor:read", "monitor:create", "monitor:update", "monitor:delete", "network:read", "network:create", "network:update", "network:delete", "log:read"]'::jsonb, 1)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_admin_role_id;
    
    -- 插入普通用户角色
    INSERT INTO roles (tenant_id, name, description, permissions, status)
    VALUES (v_tenant_id, '普通用户', '普通用户，拥有基本查看权限',
        '["user:read", "host:read", "ansible:read", "monitor:read", "network:read", "log:read"]'::jsonb, 1)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_user_role_id;
    
    IF v_user_role_id IS NULL THEN
        SELECT id INTO v_user_role_id FROM roles WHERE tenant_id = v_tenant_id AND name = '普通用户';
    END IF;
    
    -- 插入管理员用户 (密码: admin123, 使用 werkzeug 生成的 hash)
    INSERT INTO users (tenant_id, username, email, password_hash, full_name, avatar_style, avatar_seed, status)
    VALUES (v_tenant_id, 'admin', 'admin@example.com', 
        'scrypt:32768:8:1$YqKxPvJhNmLwRtSu$8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8',
        '系统管理员', 'avataaars', 'admin', 1)
    ON CONFLICT (username) DO NOTHING
    RETURNING id INTO v_admin_user_id;
    
    IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM users WHERE username = 'admin';
    END IF;
    
    -- 插入普通用户 (密码: user123)
    INSERT INTO users (tenant_id, username, email, password_hash, full_name, avatar_style, avatar_seed, status)
    VALUES (v_tenant_id, 'user', 'user@example.com',
        'scrypt:32768:8:1$AbCdEfGhIjKlMnOp$1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1',
        '普通用户', 'avataaars', 'user', 1)
    ON CONFLICT (username) DO NOTHING
    RETURNING id INTO v_normal_user_id;
    
    IF v_normal_user_id IS NULL THEN
        SELECT id INTO v_normal_user_id FROM users WHERE username = 'user';
    END IF;
    
    -- 分配角色
    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_admin_user_id, v_super_admin_role_id)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_normal_user_id, v_user_role_id)
    ON CONFLICT DO NOTHING;
    
    -- 创建默认网络探测分组
    INSERT INTO network_probe_groups (tenant_id, name, description, is_default, is_system, color, sort_order, created_by)
    VALUES (v_tenant_id, '未分组', '系统默认分组，用于未指定分组的探测目标', TRUE, TRUE, '#999999', 999, v_admin_user_id)
    ON CONFLICT DO NOTHING;
    
END $$;


-- ============================================
-- 初始化菜单数据（使用唯一图标）
-- ============================================
DO $$
DECLARE
    v_tenant_id INTEGER;
    v_dashboard_id INTEGER;
    v_users_id INTEGER;
    v_roles_id INTEGER;
    v_menus_id INTEGER;
    v_devops_id INTEGER;
    v_monitor_id INTEGER;
    v_network_id INTEGER;
    v_logs_id INTEGER;
    v_system_id INTEGER;
    v_k8s_id INTEGER;
    v_middleware_id INTEGER;
BEGIN
    -- 获取租户ID
    SELECT id INTO v_tenant_id FROM tenants WHERE code = 'demo_company';
    
    -- 仪表盘 (LayoutDashboard)
    INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
    VALUES (v_tenant_id, NULL, '仪表盘', '/dashboard', 'Dashboard', 'LayoutDashboard', 1, 1)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_dashboard_id;
    
    -- 用户管理 (Users)
    INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
    VALUES (v_tenant_id, NULL, '用户管理', '/users', 'Users', 'Users', 2, 1)
    ON CONFLICT DO NOTHING;
    
    -- 角色管理 (ShieldCheck)
    INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
    VALUES (v_tenant_id, NULL, '角色管理', '/roles', 'Roles', 'ShieldCheck', 3, 1)
    ON CONFLICT DO NOTHING;
    
    -- 菜单管理 (ListTree)
    INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
    VALUES (v_tenant_id, NULL, '菜单管理', '/menus', 'Menus', 'ListTree', 4, 1)
    ON CONFLICT DO NOTHING;
    
    -- 主机运维 (ServerCog)
    INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
    VALUES (v_tenant_id, NULL, '主机运维', '/hostoperate', NULL, 'ServerCog', 5, 1)
    RETURNING id INTO v_devops_id;
    
    IF v_devops_id IS NOT NULL THEN
        INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
        VALUES 
            (v_tenant_id, v_devops_id, 'SSH 主机', '/hostoperate/hosts', 'DevOps/Hosts', 'Server', 1, 1),
            (v_tenant_id, v_devops_id, '主机分组', '/hostoperate/hosts/groups', 'DevOps/HostGroups', 'FolderTree', 2, 1),
            (v_tenant_id, v_devops_id, '主机审计', '/hostoperate/audit', 'DevOps/Audit', 'FileSearch', 3, 1),
            (v_tenant_id, v_devops_id, '命令过滤', '/hostoperate/command-filter', 'DevOps/CommandFilter', 'Filter', 4, 1),
            (v_tenant_id, v_devops_id, 'Ansible 管理', '/hostoperate/ansible', 'DevOps/Ansible', 'Workflow', 5, 1)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- 监控告警 (BellRing)
    INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
    VALUES (v_tenant_id, NULL, '监控告警', '/monitor', NULL, 'BellRing', 6, 1)
    RETURNING id INTO v_monitor_id;
    
    IF v_monitor_id IS NOT NULL THEN
        INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
        VALUES 
            (v_tenant_id, v_monitor_id, '监控大屏', '/monitor/dashboard', 'Monitor/Dashboard', 'Gauge', 1, 1),
            (v_tenant_id, v_monitor_id, '告警记录', '/monitor/alerts', 'Monitor/Alerts', 'AlertTriangle', 2, 1),
            (v_tenant_id, v_monitor_id, '告警渠道', '/monitor/channels', 'Monitor/Channels', 'Bell', 3, 1),
            (v_tenant_id, v_monitor_id, '告警规则', '/monitor/rules', 'Monitor/Rules', 'ListChecks', 4, 1),
            (v_tenant_id, v_monitor_id, '告警历史', '/monitor/history', 'Monitor/History', 'ClipboardList', 5, 1)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- 网络运维 (Globe)
    INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
    VALUES (v_tenant_id, NULL, '网络运维', '/network', NULL, 'Globe', 7, 1)
    RETURNING id INTO v_network_id;
    
    IF v_network_id IS NOT NULL THEN
        INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
        VALUES 
            (v_tenant_id, v_network_id, '探测大屏', '/network/dashboard', 'Network/Dashboard', 'Radar', 1, 1),
            (v_tenant_id, v_network_id, '探测管理', '/network/probes', 'Network/Probes', 'Activity', 2, 1),
            (v_tenant_id, v_network_id, '数据可视化', '/network/visualizer', 'Network/Visualizer', 'LineChart', 3, 1),
            (v_tenant_id, v_network_id, '配置构建器', '/network/builder', 'Network/Builder', 'Wrench', 4, 1),
            (v_tenant_id, v_network_id, '深度分析', '/network/analytics', 'Network/Analytics', 'TrendingUp', 5, 1),
            (v_tenant_id, v_network_id, '探测分组', '/network/groups', 'Network/Groups', 'FolderKanban', 6, 1)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- 中间件运维 (Layers)
    INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
    VALUES (v_tenant_id, NULL, '中间件运维', '/middleware', NULL, 'Layers', 8, 1)
    RETURNING id INTO v_middleware_id;
    
    IF v_middleware_id IS NOT NULL THEN
        INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
        VALUES 
            (v_tenant_id, v_middleware_id, 'Redis管理', '/middleware/redis-manager', 'Middleware/Redis', 'DatabaseZap', 1, 1),
            (v_tenant_id, v_middleware_id, '数据库管理', '/middleware/database-manager', 'Middleware/Database', 'Database', 2, 1),
            (v_tenant_id, v_middleware_id, 'Nginx管理', '/middleware/nginx', 'Middleware/Nginx', 'Network', 3, 1),
            (v_tenant_id, v_middleware_id, 'RabbitMQ管理', '/middleware/rabbitmq', 'Middleware/RabbitMQ', 'Rabbit', 4, 1),
            (v_tenant_id, v_middleware_id, 'Kafka管理', '/middleware/kafka', 'Middleware/Kafka', 'Radio', 5, 1)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- K8S运维 (Box)
    INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
    VALUES (v_tenant_id, NULL, 'K8S运维', '/middleware/k8s-manager', NULL, 'Box', 9, 1)
    RETURNING id INTO v_k8s_id;
    
    IF v_k8s_id IS NOT NULL THEN
        INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
        VALUES 
            (v_tenant_id, v_k8s_id, '集群管理', '/middleware/k8s-manager/clusters', 'K8s/Clusters', 'CloudCog', 1, 1),
            (v_tenant_id, v_k8s_id, '命名空间', '/middleware/k8s-manager/namespaces', 'K8s/Namespaces', 'Boxes', 2, 1),
            (v_tenant_id, v_k8s_id, '工作负载', '/middleware/k8s-manager/workloads', 'K8s/Workloads', 'Cpu', 3, 1),
            (v_tenant_id, v_k8s_id, '服务发现', '/middleware/k8s-manager/services', 'K8s/Services', 'GitBranch', 4, 1),
            (v_tenant_id, v_k8s_id, '配置管理', '/middleware/k8s-manager/configs', 'K8s/Configs', 'Settings', 5, 1),
            (v_tenant_id, v_k8s_id, '存储管理', '/middleware/k8s-manager/storage', 'K8s/Storage', 'HardDrive', 6, 1)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- 操作日志 (ScrollText)
    INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
    VALUES (v_tenant_id, NULL, '操作日志', '/logs', 'Logs', 'ScrollText', 10, 1)
    ON CONFLICT DO NOTHING;
    
    -- 系统设置 (Cog)
    INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
    VALUES (v_tenant_id, NULL, '系统设置', '/settings', NULL, 'Cog', 11, 1)
    RETURNING id INTO v_system_id;
    
    IF v_system_id IS NOT NULL THEN
        INSERT INTO menus (tenant_id, parent_id, name, path, component, icon, sort_order, status)
        VALUES 
            (v_tenant_id, v_system_id, '基本设置', '/settings/general', 'Settings/General', 'Settings', 1, 1),
            (v_tenant_id, v_system_id, '安全设置', '/settings/security', 'Settings/Security', 'Lock', 2, 1),
            (v_tenant_id, v_system_id, '备份恢复', '/settings/backup', 'Settings/Backup', 'Archive', 3, 1),
            (v_tenant_id, v_system_id, '通知设置', '/settings/notification', 'Settings/Notification', 'BellDot', 4, 1)
        ON CONFLICT DO NOTHING;
    END IF;
    
END $$;

-- ============================================
-- 完成
-- ============================================
SELECT '数据库初始化完成！' AS message;
