"""
K8S Cluster Model
Stores Kubernetes cluster connection information
"""
from datetime import datetime
from app.extensions import db
from app.models.base import BaseModel


class K8sCluster(BaseModel):
    """Kubernetes集群模型"""
    __tablename__ = 'k8s_clusters'
    
    name = db.Column(db.String(100), nullable=False)
    api_server = db.Column(db.String(255), nullable=False)
    auth_type = db.Column(db.String(20), nullable=False)  # token, kubeconfig
    token = db.Column(db.Text)  # 明文存储
    kubeconfig = db.Column(db.Text)  # 明文存储
    description = db.Column(db.Text)
    status = db.Column(db.String(20))  # online, offline, error
    version = db.Column(db.String(50))
    node_count = db.Column(db.Integer)
    namespace_count = db.Column(db.Integer)
    pod_count = db.Column(db.Integer)
    last_connected_at = db.Column(db.DateTime)
    last_sync_at = db.Column(db.DateTime)
    
    def set_token(self, token):
        """Set token"""
        self.token = token
    
    def get_token(self):
        """Get token"""
        return self.token
    
    def set_kubeconfig(self, kubeconfig):
        """Set kubeconfig"""
        self.kubeconfig = kubeconfig
    
    def get_kubeconfig(self):
        """Get kubeconfig"""
        return self.kubeconfig
    
    def to_dict(self, include_sensitive=False):
        """Convert to dictionary with optional sensitive data filtering"""
        result = super().to_dict()
        
        # Remove sensitive fields from response by default
        if not include_sensitive:
            result.pop('token', None)
            result.pop('kubeconfig', None)
        
        return result
    
    def __repr__(self):
        return f'<K8sCluster {self.name}>'
