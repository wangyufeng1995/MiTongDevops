"""
K8S API module
Provides REST API endpoints for Kubernetes cluster management
"""

from .clusters import clusters_bp
from .namespaces import namespaces_bp
from .workloads import workloads_bp
from .services import services_bp
from .configs import configs_bp
from .storage import storage_bp
from .audit import audit_bp

__all__ = ['clusters_bp', 'namespaces_bp', 'workloads_bp', 'services_bp', 'configs_bp', 'storage_bp', 'audit_bp']

