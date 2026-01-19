"""
K8S Operation Model
Records audit logs for Kubernetes operations
"""
from datetime import datetime
from app.extensions import db


class K8sOperation(db.Model):
    """Kubernetes操作审计日志模型"""
    __tablename__ = 'k8s_operations'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    user_id = db.Column(db.Integer, nullable=False)
    cluster_id = db.Column(db.Integer, db.ForeignKey('k8s_clusters.id'))
    operation_type = db.Column(db.String(50), nullable=False)  # create, update, delete, scale, restart
    resource_type = db.Column(db.String(50), nullable=False)  # deployment, service, configmap, etc.
    resource_name = db.Column(db.String(255))
    namespace = db.Column(db.String(255))
    operation_data = db.Column(db.JSON)
    status = db.Column(db.String(20), nullable=False)  # success, failed
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'user_id': self.user_id,
            'cluster_id': self.cluster_id,
            'operation_type': self.operation_type,
            'resource_type': self.resource_type,
            'resource_name': self.resource_name,
            'namespace': self.namespace,
            'operation_data': self.operation_data,
            'status': self.status,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<K8sOperation {self.operation_type} {self.resource_type}/{self.resource_name}>'
