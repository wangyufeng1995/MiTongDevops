"""
菜单模型
"""
from app.extensions import db
from .base import BaseModel


class Menu(BaseModel):
    """菜单模型"""
    __tablename__ = 'menus'
    
    parent_id = db.Column(db.Integer, db.ForeignKey('menus.id'), nullable=True)
    name = db.Column(db.String(50), nullable=False)
    path = db.Column(db.String(100))
    component = db.Column(db.String(100))
    icon = db.Column(db.String(50))
    sort_order = db.Column(db.Integer, default=0)
    status = db.Column(db.Integer, default=1)  # 1: 启用, 0: 禁用
    
    # 自关联关系
    children = db.relationship('Menu', backref=db.backref('parent', remote_side='Menu.id'), lazy='dynamic')
    
    def get_children_tree(self):
        """获取子菜单树"""
        children = []
        for child in self.children.filter_by(status=1).order_by(Menu.sort_order):
            child_dict = child.to_dict()
            child_dict['children'] = child.get_children_tree()
            children.append(child_dict)
        return children
    
    def to_dict(self, include_children=False):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'parent_id': self.parent_id,
            'name': self.name,
            'path': self.path,
            'component': self.component,
            'icon': self.icon,
            'sort_order': self.sort_order,
            'status': self.status
        })
        
        if include_children:
            result['children'] = self.get_children_tree()
        
        return result
    
    @classmethod
    def get_menu_tree(cls, tenant_id):
        """获取租户的菜单树"""
        root_menus = cls.query.filter_by(
            tenant_id=tenant_id,
            parent_id=None,
            status=1
        ).order_by(cls.sort_order).all()
        
        tree = []
        for menu in root_menus:
            menu_dict = menu.to_dict()
            menu_dict['children'] = menu.get_children_tree()
            tree.append(menu_dict)
        
        return tree
    
    def __repr__(self):
        return f'<Menu {self.name}>'