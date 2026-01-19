-- ============================================
-- MiTong运维平台数据库初始化脚本
-- 版本: 2.0
-- 生成时间: 2025-01-19
-- ============================================

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 1. 租户表 (tenants)
-- ============================================
DROP TABLE IF EXISTS `tenants`;
CREATE TABLE `tenants` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '租户名称',
  `code` varchar(50) NOT NULL COMMENT '租户代码',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态(0-禁用,1-启用)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户表';

-- ============================================
-- 2. 用户表 (users)
-- ============================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `username` varchar(50) NOT NULL COMMENT '用户名',
  `password` varchar(255) NOT NULL COMMENT '密码(加密)',
  `full_name` varchar(100) DEFAULT NULL COMMENT '姓名',
  `email` varchar(100) DEFAULT NULL COMMENT '邮箱',
  `phone` varchar(20) DEFAULT NULL COMMENT '手机号',
  `is_active` tinyint NOT NULL DEFAULT '1' COMMENT '是否激活',
  `is_admin` tinyint NOT NULL DEFAULT '0' COMMENT '是否管理员',
  `last_login_at` datetime DEFAULT NULL COMMENT '最后登录时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================
-- 3. 角色表 (roles)
-- ============================================
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(50) NOT NULL COMMENT '角色名称',
  `description` varchar(200) DEFAULT NULL COMMENT '角色描述',
  `permissions` text COMMENT '权限列表(JSON)',
  `is_system` tinyint NOT NULL DEFAULT '0' COMMENT '是否系统角色',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- ============================================
-- 4. 用户角色关联表 (user_roles)
-- ============================================
DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE `user_roles` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `role_id` int NOT NULL COMMENT '角色ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_role` (`user_id`,`role_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表';

-- ============================================
-- 5. 菜单表 (menus)
-- ============================================
DROP TABLE IF EXISTS `menus`;
CREATE TABLE `menus` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '菜单ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `parent_id` int DEFAULT NULL COMMENT '父菜单ID',
  `name` varchar(50) NOT NULL COMMENT '菜单名称',
  `path` varchar(200) DEFAULT NULL COMMENT '路由路径',
  `icon` varchar(50) DEFAULT NULL COMMENT '图标',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `is_visible` tinyint NOT NULL DEFAULT '1' COMMENT '是否可见',
  `permission` varchar(100) DEFAULT NULL COMMENT '权限标识',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜单表';

-- ============================================
-- 6. 主机分组表 (host_groups)
-- ============================================
DROP TABLE IF EXISTS `host_groups`;
CREATE TABLE `host_groups` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '分组ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '分组名称',
  `description` varchar(500) DEFAULT NULL COMMENT '分组描述',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_host_group_tenant_name` (`tenant_id`,`name`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主机分组表';

-- ============================================
-- 7. SSH主机表 (ssh_hosts)
-- ============================================
DROP TABLE IF EXISTS `ssh_hosts`;
CREATE TABLE `ssh_hosts` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主机ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `group_id` int DEFAULT NULL COMMENT '分组ID',
  `name` varchar(100) NOT NULL COMMENT '主机名称',
  `host` varchar(255) NOT NULL COMMENT '主机地址',
  `port` int NOT NULL DEFAULT '22' COMMENT 'SSH端口',
  `username` varchar(100) NOT NULL COMMENT 'SSH用户名',
  `password` text COMMENT 'SSH密码(加密)',
  `private_key` text COMMENT 'SSH私钥(加密)',
  `auth_type` varchar(20) NOT NULL DEFAULT 'password' COMMENT '认证方式(password/key)',
  `description` varchar(500) DEFAULT NULL COMMENT '主机描述',
  `tags` varchar(500) DEFAULT NULL COMMENT '标签(JSON)',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态(0-禁用,1-启用)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_group_id` (`group_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SSH主机表';

-- ============================================
-- 8. 主机信息表 (host_info)
-- ============================================
DROP TABLE IF EXISTS `host_info`;
CREATE TABLE `host_info` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `host_id` int NOT NULL COMMENT '主机ID',
  `hostname` varchar(255) DEFAULT NULL COMMENT '主机名',
  `os_type` varchar(50) DEFAULT NULL COMMENT '操作系统类型',
  `os_version` varchar(100) DEFAULT NULL COMMENT '操作系统版本',
  `kernel_version` varchar(100) DEFAULT NULL COMMENT '内核版本',
  `cpu_model` varchar(255) DEFAULT NULL COMMENT 'CPU型号',
  `cpu_cores` int DEFAULT NULL COMMENT 'CPU核心数',
  `memory_total` bigint DEFAULT NULL COMMENT '总内存(MB)',
  `disk_total` bigint DEFAULT NULL COMMENT '总磁盘(GB)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_host_id` (`host_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主机信息表';

-- ============================================
-- 9. 主机性能指标表 (host_metrics)
-- ============================================
DROP TABLE IF EXISTS `host_metrics`;
CREATE TABLE `host_metrics` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `host_id` int NOT NULL COMMENT '主机ID',
  `cpu_usage` float DEFAULT NULL COMMENT 'CPU使用率(%)',
  `memory_usage` float DEFAULT NULL COMMENT '内存使用率(%)',
  `disk_usage` float DEFAULT NULL COMMENT '磁盘使用率(%)',
  `network_in` bigint DEFAULT NULL COMMENT '网络入流量(bytes)',
  `network_out` bigint DEFAULT NULL COMMENT '网络出流量(bytes)',
  `load_average` varchar(50) DEFAULT NULL COMMENT '负载平均值',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '采集时间',
  PRIMARY KEY (`id`),
  KEY `idx_host_id` (`host_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主机性能指标表';

-- ============================================
-- 10. 主机探测结果表 (host_probe_results)
-- ============================================
DROP TABLE IF EXISTS `host_probe_results`;
CREATE TABLE `host_probe_results` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `host_id` int NOT NULL COMMENT '主机ID',
  `is_reachable` tinyint NOT NULL DEFAULT '0' COMMENT '是否可达',
  `response_time` int DEFAULT NULL COMMENT '响应时间(ms)',
  `error_message` text COMMENT '错误信息',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '探测时间',
  PRIMARY KEY (`id`),
  KEY `idx_host_id` (`host_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主机探测结果表';

-- ============================================
-- 11. WebShell审计日志表 (webshell_audit_logs)
-- ============================================
DROP TABLE IF EXISTS `webshell_audit_logs`;
CREATE TABLE `webshell_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `host_id` int NOT NULL COMMENT '主机ID',
  `session_id` varchar(100) NOT NULL COMMENT '会话ID',
  `command` text NOT NULL COMMENT '执行的命令',
  `output` text COMMENT '命令输出',
  `status` varchar(20) NOT NULL COMMENT '执行状态(success/failed/blocked)',
  `risk_level` varchar(20) DEFAULT 'low' COMMENT '风险等级(low/medium/high/critical)',
  `executed_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_host_id` (`host_id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_audit_host_date` (`host_id`,`executed_at`),
  KEY `idx_audit_user_date` (`user_id`,`executed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='WebShell审计日志表';

-- ============================================
-- 12. 命令过滤规则表 (command_filter_rules)
-- ============================================
DROP TABLE IF EXISTS `command_filter_rules`;
CREATE TABLE `command_filter_rules` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '规则ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `host_id` int DEFAULT NULL COMMENT '主机ID(NULL表示全局规则)',
  `rule_type` varchar(20) NOT NULL COMMENT '规则类型(blacklist/whitelist)',
  `patterns` text NOT NULL COMMENT '匹配模式(JSON数组)',
  `action` varchar(20) NOT NULL DEFAULT 'block' COMMENT '动作(block/warn/log)',
  `description` varchar(500) DEFAULT NULL COMMENT '规则描述',
  `is_active` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_filter_rule_tenant_host` (`tenant_id`,`host_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_host_id` (`host_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='命令过滤规则表';

-- ============================================
-- 13. Ansible Playbook表 (ansible_playbooks)
-- ============================================
DROP TABLE IF EXISTS `ansible_playbooks`;
CREATE TABLE `ansible_playbooks` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'PlaybookID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT 'Playbook名称',
  `description` varchar(500) DEFAULT NULL COMMENT '描述',
  `content` text NOT NULL COMMENT 'Playbook内容(YAML)',
  `variables` text COMMENT '变量(JSON)',
  `tags` varchar(500) DEFAULT NULL COMMENT '标签(JSON)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ansible Playbook表';

-- ============================================
-- 14. K8S集群表 (k8s_clusters)
-- ============================================
DROP TABLE IF EXISTS `k8s_clusters`;
CREATE TABLE `k8s_clusters` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '集群ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '集群名称',
  `api_server` varchar(500) NOT NULL COMMENT 'API Server地址',
  `token` text COMMENT '访问令牌(加密)',
  `ca_cert` text COMMENT 'CA证书',
  `description` varchar(500) DEFAULT NULL COMMENT '集群描述',
  `status` varchar(20) NOT NULL DEFAULT 'online' COMMENT '状态(online/offline)',
  `version` varchar(50) DEFAULT NULL COMMENT 'K8S版本',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='K8S集群表';

-- ============================================
-- 15. K8S操作审计表 (k8s_operations)
-- ============================================
DROP TABLE IF EXISTS `k8s_operations`;
CREATE TABLE `k8s_operations` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '操作ID',
  `cluster_id` int NOT NULL COMMENT '集群ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `operation_type` varchar(50) NOT NULL COMMENT '操作类型',
  `resource_type` varchar(50) NOT NULL COMMENT '资源类型',
  `resource_name` varchar(200) DEFAULT NULL COMMENT '资源名称',
  `namespace` varchar(100) DEFAULT NULL COMMENT '命名空间',
  `status` varchar(20) NOT NULL COMMENT '操作状态',
  `details` text COMMENT '操作详情(JSON)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_cluster_id` (`cluster_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='K8S操作审计表';

-- ============================================
-- 16. Redis连接配置表 (redis_connections)
-- ============================================
DROP TABLE IF EXISTS `redis_connections`;
CREATE TABLE `redis_connections` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '连接ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '连接名称',
  `host` varchar(255) NOT NULL COMMENT 'Redis主机',
  `port` int NOT NULL DEFAULT '6379' COMMENT 'Redis端口',
  `password` text COMMENT 'Redis密码(加密)',
  `database` int NOT NULL DEFAULT '0' COMMENT '数据库编号',
  `description` varchar(500) DEFAULT NULL COMMENT '连接描述',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_redis_connection_tenant_name` (`tenant_id`,`name`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Redis连接配置表';

-- ============================================
-- 17. 数据库连接配置表 (database_connections)
-- ============================================
DROP TABLE IF EXISTS `database_connections`;
CREATE TABLE `database_connections` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '连接ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '连接名称',
  `db_type` varchar(20) NOT NULL COMMENT '数据库类型(mysql/postgresql/mongodb等)',
  `host` varchar(255) NOT NULL COMMENT '数据库主机',
  `port` int NOT NULL COMMENT '数据库端口',
  `username` varchar(100) NOT NULL COMMENT '用户名',
  `password` text COMMENT '密码(加密)',
  `database` varchar(100) DEFAULT NULL COMMENT '数据库名',
  `description` varchar(500) DEFAULT NULL COMMENT '连接描述',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态(0-禁用,1-启用)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_database_connection_tenant_name` (`tenant_id`,`name`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_database_connections_type` (`db_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据库连接配置表';

-- ============================================
-- 18. 网络探测分组表 (network_probe_groups)
-- ============================================
DROP TABLE IF EXISTS `network_probe_groups`;
CREATE TABLE `network_probe_groups` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '分组ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '分组名称',
  `description` varchar(500) DEFAULT NULL COMMENT '分组描述',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_group_name` (`tenant_id`,`name`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='网络探测分组表';

-- ============================================
-- 19. 网络探测任务表 (network_probes)
-- ============================================
DROP TABLE IF EXISTS `network_probes`;
CREATE TABLE `network_probes` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '探测ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `group_id` int NOT NULL COMMENT '分组ID',
  `name` varchar(100) NOT NULL COMMENT '探测名称',
  `target` varchar(255) NOT NULL COMMENT '探测目标',
  `probe_type` varchar(20) NOT NULL COMMENT '探测类型(ping/http/tcp/dns)',
  `interval` int NOT NULL DEFAULT '60' COMMENT '探测间隔(秒)',
  `timeout` int NOT NULL DEFAULT '5' COMMENT '超时时间(秒)',
  `config` text COMMENT '探测配置(JSON)',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态(0-禁用,1-启用)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_group_id` (`group_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='网络探测任务表';

-- ============================================
-- 20. 网络探测结果表 (network_probe_results)
-- ============================================
DROP TABLE IF EXISTS `network_probe_results`;
CREATE TABLE `network_probe_results` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '结果ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `probe_id` int NOT NULL COMMENT '探测ID',
  `is_success` tinyint NOT NULL DEFAULT '0' COMMENT '是否成功',
  `response_time` int DEFAULT NULL COMMENT '响应时间(ms)',
  `status_code` int DEFAULT NULL COMMENT 'HTTP状态码',
  `error_message` text COMMENT '错误信息',
  `details` text COMMENT '详细信息(JSON)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '探测时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_probe_id` (`probe_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='网络探测结果表';

-- ============================================
-- 21. 网络告警规则表 (network_alert_rules)
-- ============================================
DROP TABLE IF EXISTS `network_alert_rules`;
CREATE TABLE `network_alert_rules` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '规则ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `probe_id` int NOT NULL COMMENT '探测ID',
  `name` varchar(100) NOT NULL COMMENT '规则名称',
  `condition_type` varchar(20) NOT NULL COMMENT '条件类型(failure/latency/status_code)',
  `threshold` int DEFAULT NULL COMMENT '阈值',
  `duration` int DEFAULT NULL COMMENT '持续时间(秒)',
  `severity` varchar(20) NOT NULL DEFAULT 'warning' COMMENT '严重程度(info/warning/error/critical)',
  `is_active` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_probe_id` (`probe_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='网络告警规则表';

-- ============================================
-- 22. 网络告警记录表 (network_alert_records)
-- ============================================
DROP TABLE IF EXISTS `network_alert_records`;
CREATE TABLE `network_alert_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `rule_id` int NOT NULL COMMENT '规则ID',
  `probe_id` int NOT NULL COMMENT '探测ID',
  `status` varchar(20) NOT NULL DEFAULT 'firing' COMMENT '状态(firing/resolved)',
  `message` text COMMENT '告警消息',
  `details` text COMMENT '详细信息(JSON)',
  `fired_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '触发时间',
  `resolved_at` datetime DEFAULT NULL COMMENT '解决时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_rule_id` (`rule_id`),
  KEY `idx_probe_id` (`probe_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='网络告警记录表';

-- ============================================
-- 23. 告警渠道表 (alert_channels)
-- ============================================
DROP TABLE IF EXISTS `alert_channels`;
CREATE TABLE `alert_channels` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '渠道ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '渠道名称',
  `channel_type` varchar(20) NOT NULL COMMENT '渠道类型(email/sms/webhook/dingtalk/wechat)',
  `config` text NOT NULL COMMENT '渠道配置(JSON)',
  `is_active` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_channel_type` (`channel_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='告警渠道表';

-- ============================================
-- 24. 告警规则表 (alert_rules)
-- ============================================
DROP TABLE IF EXISTS `alert_rules`;
CREATE TABLE `alert_rules` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '规则ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '规则名称',
  `description` varchar(500) DEFAULT NULL COMMENT '规则描述',
  `rule_type` varchar(20) NOT NULL COMMENT '规则类型(host/network/k8s/custom)',
  `datasource_id` int DEFAULT NULL COMMENT '数据源ID',
  `query` text COMMENT '查询语句',
  `condition` text COMMENT '触发条件(JSON)',
  `severity` varchar(20) NOT NULL DEFAULT 'warning' COMMENT '严重程度',
  `channels` text COMMENT '告警渠道ID列表(JSON)',
  `is_active` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_rule_type` (`rule_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='告警规则表';

-- ============================================
-- 25. 告警记录表 (alert_records)
-- ============================================
DROP TABLE IF EXISTS `alert_records`;
CREATE TABLE `alert_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `rule_id` int NOT NULL COMMENT '规则ID',
  `rule_name` varchar(100) NOT NULL COMMENT '规则名称',
  `severity` varchar(20) NOT NULL COMMENT '严重程度',
  `status` varchar(20) NOT NULL DEFAULT 'firing' COMMENT '状态(firing/resolved/acknowledged)',
  `message` text COMMENT '告警消息',
  `details` text COMMENT '详细信息(JSON)',
  `fired_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '触发时间',
  `resolved_at` datetime DEFAULT NULL COMMENT '解决时间',
  `acknowledged_at` datetime DEFAULT NULL COMMENT '确认时间',
  `acknowledged_by` int DEFAULT NULL COMMENT '确认人ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_rule_id` (`rule_id`),
  KEY `idx_status` (`status`),
  KEY `idx_fired_at` (`fired_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='告警记录表';

-- ============================================
-- 26. 告警通知记录表 (alert_notifications)
-- ============================================
DROP TABLE IF EXISTS `alert_notifications`;
CREATE TABLE `alert_notifications` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '通知ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `alert_record_id` int NOT NULL COMMENT '告警记录ID',
  `channel_id` int NOT NULL COMMENT '渠道ID',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态(pending/sent/failed)',
  `error_message` text COMMENT '错误信息',
  `sent_at` datetime DEFAULT NULL COMMENT '发送时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_alert_record_id` (`alert_record_id`),
  KEY `idx_channel_id` (`channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='告警通知记录表';

-- ============================================
-- 27. 数据源配置表 (datasource_configs)
-- ============================================
DROP TABLE IF EXISTS `datasource_configs`;
CREATE TABLE `datasource_configs` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '数据源名称',
  `datasource_type` varchar(20) NOT NULL COMMENT '数据源类型(prometheus/grafana/elasticsearch)',
  `url` varchar(500) NOT NULL COMMENT '数据源URL',
  `auth_type` varchar(20) DEFAULT 'none' COMMENT '认证类型(none/basic/token)',
  `username` varchar(100) DEFAULT NULL COMMENT '用户名',
  `password` text COMMENT '密码(加密)',
  `token` text COMMENT '访问令牌(加密)',
  `is_active` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_datasource_configs_tenant_name` (`tenant_id`,`name`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据源配置表';

-- ============================================
-- 28. 保存的PromQL查询表 (saved_promql_queries)
-- ============================================
DROP TABLE IF EXISTS `saved_promql_queries`;
CREATE TABLE `saved_promql_queries` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '查询ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `config_id` int NOT NULL COMMENT '数据源配置ID',
  `name` varchar(100) NOT NULL COMMENT '查询名称',
  `query` text NOT NULL COMMENT 'PromQL查询语句',
  `description` varchar(500) DEFAULT NULL COMMENT '查询描述',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_saved_queries_tenant_config_name` (`tenant_id`,`config_id`,`name`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_config_id` (`config_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='保存的PromQL查询表';

-- ============================================
-- 29. Grafana配置表 (grafana_configs)
-- ============================================
DROP TABLE IF EXISTS `grafana_configs`;
CREATE TABLE `grafana_configs` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '配置名称',
  `url` varchar(500) NOT NULL COMMENT 'Grafana URL',
  `api_key` text COMMENT 'API密钥(加密)',
  `username` varchar(100) DEFAULT NULL COMMENT '用户名',
  `password` text COMMENT '密码(加密)',
  `is_active` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_grafana_configs_tenant_name` (`tenant_id`,`name`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Grafana配置表';

-- ============================================
-- 30. Grafana仪表盘表 (grafana_dashboards)
-- ============================================
DROP TABLE IF EXISTS `grafana_dashboards`;
CREATE TABLE `grafana_dashboards` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '仪表盘ID',
  `config_id` int NOT NULL COMMENT 'Grafana配置ID',
  `name` varchar(100) NOT NULL COMMENT '仪表盘名称',
  `uid` varchar(100) NOT NULL COMMENT 'Grafana UID',
  `url` varchar(500) DEFAULT NULL COMMENT '仪表盘URL',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_grafana_dashboards_config_name` (`config_id`,`name`),
  KEY `idx_config_id` (`config_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Grafana仪表盘表';

-- ============================================
-- 31. 操作日志表 (operation_logs)
-- ============================================
DROP TABLE IF EXISTS `operation_logs`;
CREATE TABLE `operation_logs` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `module` varchar(50) NOT NULL COMMENT '模块名称',
  `action` varchar(50) NOT NULL COMMENT '操作动作',
  `resource_type` varchar(50) DEFAULT NULL COMMENT '资源类型',
  `resource_id` int DEFAULT NULL COMMENT '资源ID',
  `details` text COMMENT '操作详情(JSON)',
  `ip_address` varchar(50) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` varchar(500) DEFAULT NULL COMMENT '用户代理',
  `status` varchar(20) NOT NULL DEFAULT 'success' COMMENT '操作状态(success/failed)',
  `error_message` text COMMENT '错误信息',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_module` (`module`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- ============================================
-- 32. 系统通知表 (system_notifications)
-- ============================================
DROP TABLE IF EXISTS `system_notifications`;
CREATE TABLE `system_notifications` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '通知ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `title` varchar(200) NOT NULL COMMENT '通知标题',
  `content` text NOT NULL COMMENT '通知内容',
  `notification_type` varchar(20) NOT NULL DEFAULT 'info' COMMENT '通知类型(info/warning/error/success)',
  `target_users` text COMMENT '目标用户ID列表(JSON,NULL表示全部)',
  `is_read` tinyint NOT NULL DEFAULT '0' COMMENT '是否已读',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统通知表';

-- ============================================
-- 33. 系统设置表 (system_settings)
-- ============================================
DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '设置ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `key` varchar(100) NOT NULL COMMENT '设置键名',
  `value` text COMMENT '设置值',
  `category` varchar(50) DEFAULT 'general' COMMENT '设置分类',
  `description` varchar(500) DEFAULT NULL COMMENT '设置描述',
  `is_encrypted` tinyint NOT NULL DEFAULT '0' COMMENT '是否加密存储',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_setting_key` (`tenant_id`,`key`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_tenant_category` (`tenant_id`,`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统设置表';

-- ============================================
-- 34. 全局配置表 (global_configs)
-- ============================================
DROP TABLE IF EXISTS `global_configs`;
CREATE TABLE `global_configs` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `key` varchar(100) NOT NULL COMMENT '配置键名',
  `value` text COMMENT '配置值',
  `category` varchar(50) DEFAULT 'general' COMMENT '配置分类',
  `description` varchar(500) DEFAULT NULL COMMENT '配置描述',
  `is_encrypted` tinyint NOT NULL DEFAULT '0' COMMENT '是否加密存储',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_key` (`key`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='全局配置表';

-- ============================================
-- 35. 备份记录表 (backup_records)
-- ============================================
DROP TABLE IF EXISTS `backup_records`;
CREATE TABLE `backup_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '备份ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `backup_type` varchar(20) NOT NULL COMMENT '备份类型(full/incremental)',
  `file_path` varchar(500) NOT NULL COMMENT '备份文件路径',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小(bytes)',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '状态(pending/success/failed)',
  `error_message` text COMMENT '错误信息',
  `started_at` datetime DEFAULT NULL COMMENT '开始时间',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='备份记录表';

-- ============================================
-- 36. AI模型配置表 (ai_model_config)
-- ============================================
DROP TABLE IF EXISTS `ai_model_config`;
CREATE TABLE `ai_model_config` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `tenant_id` int NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '配置名称',
  `description` varchar(500) DEFAULT NULL COMMENT '配置描述',
  `api_key` text NOT NULL COMMENT 'API密钥(加密存储)',
  `api_endpoint` varchar(500) DEFAULT NULL COMMENT 'API端点',
  `timeout` int DEFAULT '30' COMMENT '超时时间(秒)',
  `model_name` varchar(100) NOT NULL COMMENT '模型名称',
  `temperature` float DEFAULT '0.7' COMMENT '温度参数',
  `max_tokens` int DEFAULT '2000' COMMENT '最大令牌数',
  `top_p` float DEFAULT '1.0' COMMENT 'Top P参数',
  `frequency_penalty` float DEFAULT '0.0' COMMENT '频率惩罚',
  `presence_penalty` float DEFAULT '0.0' COMMENT '存在惩罚',
  `system_prompt` text COMMENT '系统提示词',
  `is_active` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  `is_default` tinyint NOT NULL DEFAULT '0' COMMENT '是否为默认配置',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `updated_by` int DEFAULT NULL COMMENT '更新人ID',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_active` (`tenant_id`,`is_active`),
  KEY `idx_tenant_default` (`tenant_id`,`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI模型配置表';

-- ============================================
-- 初始化数据
-- ============================================

-- 插入默认租户
INSERT INTO `tenants` (`id`, `name`, `code`, `status`) VALUES
(1, '默认租户', 'default', 1);

-- 插入默认管理员用户 (密码: admin123)
INSERT INTO `users` (`id`, `tenant_id`, `username`, `password`, `full_name`, `email`, `is_active`, `is_admin`) VALUES
(1, 1, 'admin', 'pbkdf2:sha256:260000$salt$hash', '系统管理员', 'admin@example.com', 1, 1);

-- 插入默认角色
INSERT INTO `roles` (`id`, `tenant_id`, `name`, `description`, `is_system`) VALUES
(1, 1, '超级管理员', '拥有所有权限', 1),
(2, 1, '运维工程师', '运维相关权限', 1),
(3, 1, '只读用户', '只读权限', 1);

-- 插入用户角色关联
INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES
(1, 1);

-- 插入默认菜单
INSERT INTO `menus` (`id`, `tenant_id`, `parent_id`, `name`, `path`, `icon`, `sort_order`, `is_visible`) VALUES
(1, 1, NULL, '仪表盘', '/dashboard', 'LayoutDashboard', 1, 1),
(2, 1, NULL, '用户管理', '/users', 'Users', 2, 1),
(3, 1, NULL, '角色管理', '/roles', 'ShieldCheck', 3, 1),
(4, 1, NULL, '菜单管理', '/menus', 'ListTree', 4, 1),
(5, 1, NULL, '主机运维', '/hostoperate', 'ServerCog', 10, 1),
(6, 1, 5, 'SSH主机', '/hostoperate/hosts', 'Server', 1, 1),
(7, 1, 5, '主机分组', '/hostoperate/hosts/groups', 'FolderTree', 2, 1),
(8, 1, 5, '命令过滤', '/hostoperate/command-filter', 'Filter', 3, 1),
(9, 1, 5, 'Ansible管理', '/hostoperate/ansible', 'Workflow', 4, 1),
(10, 1, NULL, '监控告警', '/monitor', 'BellRing', 20, 1),
(11, 1, 10, '监控大屏', '/monitor/dashboard', 'Gauge', 1, 1),
(12, 1, 10, '告警记录', '/monitor/alerts', 'AlertTriangle', 2, 1),
(13, 1, 10, '告警渠道', '/monitor/channels', 'Bell', 3, 1),
(14, 1, 10, '告警规则', '/monitor/rules', 'ListChecks', 4, 1),
(15, 1, 10, '告警历史', '/monitor/history', 'ClipboardList', 5, 1);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- 初始化完成
-- ============================================
