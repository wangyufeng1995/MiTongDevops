"""
命令过滤服务

提供命令过滤规则管理和命令检查功能。
支持白名单/黑名单模式，通配符匹配，管道和链式命令解析。
"""
import re
import fnmatch
import logging
from typing import Tuple, List, Optional, Dict, Any
from app.extensions import db
from app.models.webshell_audit import CommandFilterRule, DEFAULT_BLACKLIST

logger = logging.getLogger(__name__)


class CommandFilterService:
    """命令过滤服务类"""
    
    # 命令分隔符正则表达式
    # 匹配管道 |, 逻辑与 &&, 逻辑或 ||, 分号 ;
    COMMAND_SEPARATORS = re.compile(r'\s*(?:\|\||&&|[|;])\s*')
    
    # 提取基础命令的正则表达式
    # 匹配命令名（可能带路径）
    BASE_COMMAND_PATTERN = re.compile(r'^(?:\S*/)?([^\s/]+)')
    
    def __init__(self):
        """初始化命令过滤服务"""
        logger.info("命令过滤服务已初始化")
    
    def parse_command(self, command: str) -> List[str]:
        """
        解析命令字符串，提取所有基础命令
        
        处理管道 (|)、逻辑与 (&&)、逻辑或 (||)、分号 (;) 分隔的命令
        
        Args:
            command: 原始命令字符串
            
        Returns:
            基础命令列表
        """
        if not command or not command.strip():
            return []
        
        command = command.strip()
        
        # 分割命令
        parts = self.COMMAND_SEPARATORS.split(command)
        
        base_commands = []
        for part in parts:
            part = part.strip()
            if not part:
                continue
            
            # 提取基础命令
            base_cmd = self._extract_base_command(part)
            if base_cmd:
                base_commands.append(base_cmd)
        
        return base_commands
    
    def _extract_base_command(self, command_part: str) -> Optional[str]:
        """
        从命令片段中提取基础命令名
        
        Args:
            command_part: 单个命令片段（不含分隔符）
            
        Returns:
            基础命令名，如果无法提取则返回 None
        """
        if not command_part:
            return None
        
        # 去除前导空格和环境变量设置 (如 VAR=value cmd)
        command_part = command_part.strip()
        
        # 跳过环境变量设置
        while '=' in command_part.split()[0] if command_part.split() else False:
            parts = command_part.split(None, 1)
            if len(parts) > 1:
                command_part = parts[1]
            else:
                return None
        
        # 处理 sudo 前缀
        if command_part.startswith('sudo '):
            command_part = command_part[5:].strip()
        
        # 提取基础命令
        match = self.BASE_COMMAND_PATTERN.match(command_part)
        if match:
            return match.group(1)
        
        return None
    
    def match_pattern(self, command: str, pattern: str) -> bool:
        """
        检查命令是否匹配模式（支持通配符）
        
        使用 fnmatch 进行 glob 风格的通配符匹配
        
        Args:
            command: 要检查的命令
            pattern: 匹配模式（支持 * 和 ? 通配符）
            
        Returns:
            是否匹配
        """
        if not command or not pattern:
            return False
        
        # 使用 fnmatch 进行通配符匹配
        return fnmatch.fnmatch(command.lower(), pattern.lower())
    
    def check_command(self, host_id: Optional[int], tenant_id: int, command: str) -> Tuple[bool, str]:
        """
        检查命令是否允许执行
        
        Args:
            host_id: 主机 ID（可选）
            tenant_id: 租户 ID
            command: 要检查的命令
            
        Returns:
            (is_allowed, reason) 元组
            - is_allowed: 是否允许执行
            - reason: 原因说明（如果被阻止）
        """
        if not command or not command.strip():
            return True, ""
        
        # 获取过滤规则
        rules = self.get_filter_rules(host_id, tenant_id)
        
        if not rules or not rules.is_active:
            # 没有规则或规则未激活，允许执行
            return True, ""
        
        # 解析命令，获取所有基础命令
        base_commands = self.parse_command(command)
        
        if not base_commands:
            return True, ""
        
        # 根据模式检查命令
        mode = rules.mode
        whitelist = rules.whitelist or []
        blacklist = rules.blacklist or []
        
        if mode == 'whitelist' and whitelist:
            # 白名单模式：只允许白名单中的命令
            for base_cmd in base_commands:
                if not self._is_in_list(base_cmd, whitelist):
                    return False, f"命令 '{base_cmd}' 不在白名单中"
            return True, ""
        
        elif mode == 'blacklist' or (not whitelist and blacklist):
            # 黑名单模式：阻止黑名单中的命令
            for base_cmd in base_commands:
                matched_pattern = self._find_matching_pattern(base_cmd, blacklist)
                if matched_pattern:
                    return False, f"命令 '{base_cmd}' 匹配黑名单规则 '{matched_pattern}'"
            return True, ""
        
        # 没有配置有效规则，允许执行
        return True, ""
    
    def _is_in_list(self, command: str, patterns: List[str]) -> bool:
        """
        检查命令是否在模式列表中
        
        Args:
            command: 要检查的命令
            patterns: 模式列表
            
        Returns:
            是否匹配任一模式
        """
        for pattern in patterns:
            if self.match_pattern(command, pattern):
                return True
        return False
    
    def _find_matching_pattern(self, command: str, patterns: List[str]) -> Optional[str]:
        """
        查找匹配的模式
        
        Args:
            command: 要检查的命令
            patterns: 模式列表
            
        Returns:
            匹配的模式，如果没有匹配则返回 None
        """
        for pattern in patterns:
            if self.match_pattern(command, pattern):
                return pattern
        return None
    
    def get_filter_rules(self, host_id: Optional[int], tenant_id: int) -> Optional[CommandFilterRule]:
        """
        获取过滤规则
        
        只返回全局规则，不再支持主机特定规则
        
        Args:
            host_id: 主机 ID（忽略，保留参数兼容性）
            tenant_id: 租户 ID
            
        Returns:
            CommandFilterRule 对象，如果没有规则则返回 None
        """
        # 只获取全局规则（host_id 为 NULL）
        global_rule = CommandFilterRule.query.filter_by(
            tenant_id=tenant_id,
            host_id=None,
            is_active=True
        ).first()
        
        return global_rule
    
    def set_host_rules(self, host_id: int, tenant_id: int, 
                       mode: str = 'blacklist',
                       whitelist: List[str] = None,
                       blacklist: List[str] = None) -> Tuple[bool, str, Optional[CommandFilterRule]]:
        """
        设置主机特定规则
        
        Args:
            host_id: 主机 ID
            tenant_id: 租户 ID
            mode: 模式 ('whitelist' 或 'blacklist')
            whitelist: 白名单列表
            blacklist: 黑名单列表
            
        Returns:
            (success, message, rule) 元组
        """
        try:
            # 验证模式
            if mode not in ('whitelist', 'blacklist'):
                return False, "无效的模式，必须是 'whitelist' 或 'blacklist'", None
            
            # 查找现有规则
            rule = CommandFilterRule.query.filter_by(
                tenant_id=tenant_id,
                host_id=host_id
            ).first()
            
            if rule:
                # 更新现有规则
                rule.mode = mode
                rule.whitelist = whitelist or []
                rule.blacklist = blacklist or []
                rule.is_active = True
            else:
                # 创建新规则
                rule = CommandFilterRule(
                    tenant_id=tenant_id,
                    host_id=host_id,
                    mode=mode,
                    whitelist=whitelist or [],
                    blacklist=blacklist or [],
                    is_active=True
                )
                db.session.add(rule)
            
            db.session.commit()
            logger.info(f"设置主机 {host_id} 的命令过滤规则成功")
            return True, "规则设置成功", rule
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"设置主机规则失败: {str(e)}")
            return False, f"设置规则失败: {str(e)}", None
    
    def set_global_rules(self, tenant_id: int,
                         mode: str = 'blacklist',
                         whitelist: List[str] = None,
                         blacklist: List[str] = None) -> Tuple[bool, str, Optional[CommandFilterRule]]:
        """
        设置全局默认规则
        
        Args:
            tenant_id: 租户 ID
            mode: 模式 ('whitelist' 或 'blacklist')
            whitelist: 白名单列表
            blacklist: 黑名单列表
            
        Returns:
            (success, message, rule) 元组
        """
        try:
            # 验证模式
            if mode not in ('whitelist', 'blacklist'):
                return False, "无效的模式，必须是 'whitelist' 或 'blacklist'", None
            
            # 查找现有全局规则
            rule = CommandFilterRule.query.filter_by(
                tenant_id=tenant_id,
                host_id=None
            ).first()
            
            if rule:
                # 更新现有规则
                rule.mode = mode
                rule.whitelist = whitelist or []
                rule.blacklist = blacklist or []
                rule.is_active = True
            else:
                # 创建新规则
                rule = CommandFilterRule(
                    tenant_id=tenant_id,
                    host_id=None,
                    mode=mode,
                    whitelist=whitelist or [],
                    blacklist=blacklist or [],
                    is_active=True
                )
                db.session.add(rule)
            
            db.session.commit()
            logger.info(f"设置租户 {tenant_id} 的全局命令过滤规则成功")
            return True, "全局规则设置成功", rule
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"设置全局规则失败: {str(e)}")
            return False, f"设置规则失败: {str(e)}", None
    
    def delete_host_rules(self, host_id: int, tenant_id: int) -> Tuple[bool, str]:
        """
        删除主机特定规则
        
        Args:
            host_id: 主机 ID
            tenant_id: 租户 ID
            
        Returns:
            (success, message) 元组
        """
        try:
            rule = CommandFilterRule.query.filter_by(
                tenant_id=tenant_id,
                host_id=host_id
            ).first()
            
            if rule:
                db.session.delete(rule)
                db.session.commit()
                logger.info(f"删除主机 {host_id} 的命令过滤规则成功")
                return True, "规则删除成功"
            else:
                return True, "规则不存在"
                
        except Exception as e:
            db.session.rollback()
            logger.error(f"删除主机规则失败: {str(e)}")
            return False, f"删除规则失败: {str(e)}"
    
    def get_default_blacklist(self) -> List[str]:
        """
        获取默认黑名单
        
        Returns:
            默认黑名单命令列表
        """
        return DEFAULT_BLACKLIST.copy()


# 全局命令过滤服务实例
command_filter_service = CommandFilterService()
