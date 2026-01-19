"""
网络探测分组管理服务
"""
import logging
from typing import Optional, Tuple, List
from flask import g
from sqlalchemy import or_
from app.extensions import db
from app.models.network import NetworkProbeGroup, NetworkProbe

logger = logging.getLogger(__name__)


class NetworkGroupService:
    """网络探测分组服务类"""
    
    @staticmethod
    def get_current_tenant_id() -> Optional[int]:
        """获取当前租户ID"""
        return getattr(g, 'tenant_id', None)
    
    @staticmethod
    def get_current_user_id() -> Optional[int]:
        """获取当前用户ID"""
        return getattr(g, 'user_id', None)
    
    @staticmethod
    def validate_group_data(data: dict, is_update: bool = False) -> Tuple[bool, str]:
        """
        验证分组数据
        
        Args:
            data: 分组数据字典
            is_update: 是否为更新操作
            
        Returns:
            (是否有效, 错误信息)
        """
        if not isinstance(data, dict):
            return False, "数据格式错误"
        
        # 创建时必需字段
        if not is_update:
            required_fields = ['name']
            for field in required_fields:
                if field not in data or not data[field]:
                    return False, f"缺少必需字段: {field}"
        
        # 验证名称
        if 'name' in data:
            name = data['name']
            if not isinstance(name, str) or not name.strip():
                return False, "分组名称不能为空"
            if len(name) > 100:
                return False, "分组名称长度不能超过100个字符"
        
        # 验证描述
        if 'description' in data and data['description']:
            if len(data['description']) > 500:
                return False, "描述长度不能超过500个字符"
        
        # 验证颜色
        if 'color' in data and data['color']:
            color = data['color']
            if not isinstance(color, str):
                return False, "颜色格式错误"
            # 简单验证十六进制颜色格式
            if not color.startswith('#') or len(color) != 7:
                return False, "颜色格式必须为 #RRGGBB"
        
        # 验证排序顺序
        if 'sort_order' in data:
            if not isinstance(data['sort_order'], int):
                return False, "排序顺序必须为整数"
        
        return True, "验证通过"
    
    @staticmethod
    def check_group_name_exists(name: str, tenant_id: int, exclude_id: Optional[int] = None) -> bool:
        """
        检查分组名称是否已存在
        
        Args:
            name: 分组名称
            tenant_id: 租户ID
            exclude_id: 排除的分组ID（用于更新时检查）
            
        Returns:
            是否存在
        """
        query = NetworkProbeGroup.query.filter(
            NetworkProbeGroup.tenant_id == tenant_id,
            NetworkProbeGroup.name == name
        )
        
        if exclude_id:
            query = query.filter(NetworkProbeGroup.id != exclude_id)
        
        return query.first() is not None
    
    @staticmethod
    def get_default_group(tenant_id: int) -> Optional[NetworkProbeGroup]:
        """
        获取默认分组（未分组）
        
        Args:
            tenant_id: 租户ID
            
        Returns:
            默认分组对象，如果不存在则返回 None
        """
        return NetworkProbeGroup.query.filter(
            NetworkProbeGroup.tenant_id == tenant_id,
            NetworkProbeGroup.is_default == True
        ).first()
    
    @staticmethod
    def ensure_default_group(tenant_id: int, user_id: int) -> NetworkProbeGroup:
        """
        确保默认分组存在，如果不存在则创建
        
        Args:
            tenant_id: 租户ID
            user_id: 用户ID
            
        Returns:
            默认分组对象
        """
        default_group = NetworkGroupService.get_default_group(tenant_id)
        
        if not default_group:
            default_group = NetworkProbeGroup(
                tenant_id=tenant_id,
                name='未分组',
                description='系统默认分组，用于未指定分组的探测目标',
                is_default=True,
                is_system=True,
                color='#999999',
                sort_order=999,
                created_by=user_id
            )
            db.session.add(default_group)
            db.session.commit()
            logger.info(f"为租户 {tenant_id} 创建默认分组")
        
        return default_group
    
    @staticmethod
    def get_group_list(tenant_id: int, page: int = 1, per_page: int = 20, 
                       search: Optional[str] = None) -> Tuple[List[NetworkProbeGroup], int]:
        """
        获取分组列表
        
        Args:
            tenant_id: 租户ID
            page: 页码
            per_page: 每页数量
            search: 搜索关键词
            
        Returns:
            (分组列表, 总数)
        """
        query = NetworkProbeGroup.query.filter(
            NetworkProbeGroup.tenant_id == tenant_id
        )
        
        # 搜索过滤
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    NetworkProbeGroup.name.ilike(search_pattern),
                    NetworkProbeGroup.description.ilike(search_pattern)
                )
            )
        
        # 排序：先按 sort_order，再按创建时间
        query = query.order_by(
            NetworkProbeGroup.sort_order.asc(),
            NetworkProbeGroup.created_at.asc()
        )
        
        # 分页
        total = query.count()
        groups = query.offset((page - 1) * per_page).limit(per_page).all()
        
        return groups, total
    
    @staticmethod
    def get_group_by_id(group_id: int, tenant_id: int) -> Optional[NetworkProbeGroup]:
        """
        根据ID获取分组
        
        Args:
            group_id: 分组ID
            tenant_id: 租户ID
            
        Returns:
            分组对象，如果不存在则返回 None
        """
        return NetworkProbeGroup.query.filter(
            NetworkProbeGroup.id == group_id,
            NetworkProbeGroup.tenant_id == tenant_id
        ).first()
    
    @staticmethod
    def create_group(data: dict, tenant_id: int, user_id: int) -> Tuple[bool, str, Optional[NetworkProbeGroup]]:
        """
        创建分组
        
        Args:
            data: 分组数据
            tenant_id: 租户ID
            user_id: 用户ID
            
        Returns:
            (是否成功, 消息, 分组对象)
        """
        try:
            # 验证数据
            is_valid, message = NetworkGroupService.validate_group_data(data)
            if not is_valid:
                return False, message, None
            
            # 检查名称是否已存在
            if NetworkGroupService.check_group_name_exists(data['name'], tenant_id):
                return False, "分组名称已存在", None
            
            # 创建分组
            group = NetworkProbeGroup(
                tenant_id=tenant_id,
                name=data['name'],
                description=data.get('description', ''),
                color=data.get('color', '#1890ff'),
                sort_order=data.get('sort_order', 0),
                is_default=False,  # 用户创建的分组不能是默认分组
                is_system=False,   # 用户创建的分组不是系统分组
                created_by=user_id
            )
            
            db.session.add(group)
            db.session.commit()
            
            logger.info(f"创建分组成功: {group.name} (ID: {group.id})")
            return True, "创建成功", group
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"创建分组失败: {str(e)}", exc_info=True)
            return False, f"创建失败: {str(e)}", None
    
    @staticmethod
    def update_group(group_id: int, data: dict, tenant_id: int) -> Tuple[bool, str, Optional[NetworkProbeGroup]]:
        """
        更新分组
        
        Args:
            group_id: 分组ID
            data: 更新数据
            tenant_id: 租户ID
            
        Returns:
            (是否成功, 消息, 分组对象)
        """
        try:
            # 获取分组
            group = NetworkGroupService.get_group_by_id(group_id, tenant_id)
            if not group:
                return False, "分组不存在", None
            
            # 系统分组不能修改名称和系统标识
            if group.is_system:
                # 只允许修改描述和颜色
                allowed_fields = ['description', 'color', 'sort_order']
                data = {k: v for k, v in data.items() if k in allowed_fields}
            
            # 验证数据
            is_valid, message = NetworkGroupService.validate_group_data(data, is_update=True)
            if not is_valid:
                return False, message, None
            
            # 检查名称是否已存在（如果修改了名称）
            if 'name' in data and data['name'] != group.name:
                if NetworkGroupService.check_group_name_exists(data['name'], tenant_id, exclude_id=group_id):
                    return False, "分组名称已存在", None
            
            # 更新字段
            for key, value in data.items():
                if hasattr(group, key) and key not in ['id', 'tenant_id', 'created_by', 'created_at', 'is_default', 'is_system']:
                    setattr(group, key, value)
            
            db.session.commit()
            
            logger.info(f"更新分组成功: {group.name} (ID: {group.id})")
            return True, "更新成功", group
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"更新分组失败: {str(e)}", exc_info=True)
            return False, f"更新失败: {str(e)}", None
    
    @staticmethod
    def delete_group(group_id: int, tenant_id: int) -> Tuple[bool, str]:
        """
        删除分组
        
        Args:
            group_id: 分组ID
            tenant_id: 租户ID
            
        Returns:
            (是否成功, 消息)
        """
        try:
            # 获取分组
            group = NetworkGroupService.get_group_by_id(group_id, tenant_id)
            if not group:
                return False, "分组不存在"
            
            # 系统分组不能删除
            if group.is_system:
                return False, "系统分组不能删除"
            
            # 获取默认分组
            default_group = NetworkGroupService.get_default_group(tenant_id)
            if not default_group:
                # 如果默认分组不存在，创建一个
                user_id = NetworkGroupService.get_current_user_id()
                default_group = NetworkGroupService.ensure_default_group(tenant_id, user_id)
            
            # 将该分组下的所有探测目标移动到默认分组
            probe_count = NetworkProbe.query.filter(
                NetworkProbe.group_id == group_id,
                NetworkProbe.tenant_id == tenant_id
            ).count()
            
            if probe_count > 0:
                NetworkProbe.query.filter(
                    NetworkProbe.group_id == group_id,
                    NetworkProbe.tenant_id == tenant_id
                ).update({'group_id': default_group.id})
                
                logger.info(f"将 {probe_count} 个探测目标从分组 {group.name} 移动到默认分组")
            
            # 删除分组
            db.session.delete(group)
            db.session.commit()
            
            logger.info(f"删除分组成功: {group.name} (ID: {group.id})")
            return True, f"删除成功，已将 {probe_count} 个探测目标移动到默认分组"
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"删除分组失败: {str(e)}", exc_info=True)
            return False, f"删除失败: {str(e)}"
    
    @staticmethod
    def get_group_statistics(tenant_id: int) -> dict:
        """
        获取分组统计信息
        
        Args:
            tenant_id: 租户ID
            
        Returns:
            统计信息字典
        """
        try:
            total_groups = NetworkProbeGroup.query.filter(
                NetworkProbeGroup.tenant_id == tenant_id
            ).count()
            
            total_probes = NetworkProbe.query.filter(
                NetworkProbe.tenant_id == tenant_id
            ).count()
            
            default_group = NetworkGroupService.get_default_group(tenant_id)
            ungrouped_count = 0
            if default_group:
                ungrouped_count = NetworkProbe.query.filter(
                    NetworkProbe.tenant_id == tenant_id,
                    NetworkProbe.group_id == default_group.id
                ).count()
            
            return {
                'total_groups': total_groups,
                'total_probes': total_probes,
                'ungrouped_count': ungrouped_count,
                'grouped_count': total_probes - ungrouped_count
            }
            
        except Exception as e:
            logger.error(f"获取分组统计信息失败: {str(e)}", exc_info=True)
            return {
                'total_groups': 0,
                'total_probes': 0,
                'ungrouped_count': 0,
                'grouped_count': 0
            }
