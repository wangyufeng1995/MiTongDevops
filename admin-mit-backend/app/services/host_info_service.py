"""
主机信息收集服务
提供主机系统信息收集、性能指标收集、定时数据采集等功能
"""
import json
import logging
import re
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from decimal import Decimal

from app.extensions import db
from app.models.host import SSHHost, HostInfo, HostMetrics
from app.services.ssh_service import ssh_service, SSHConnectionError
from app.core.config_manager import config_manager

logger = logging.getLogger(__name__)


class HostInfoCollectionError(Exception):
    """主机信息收集异常"""
    pass


class SystemInfoCollector:
    """系统信息收集器"""
    
    @staticmethod
    def collect_os_info(ssh_connection) -> Dict[str, Any]:
        """收集操作系统信息"""
        try:
            # 获取操作系统信息
            os_info = {}
            
            # 获取操作系统名称和版本
            stdout, stderr, exit_code = ssh_connection.execute_command("cat /etc/os-release")
            if exit_code == 0:
                for line in stdout.strip().split('\n'):
                    if '=' in line:
                        key, value = line.split('=', 1)
                        value = value.strip('"')
                        if key == 'NAME':
                            os_info['os_name'] = value
                        elif key == 'VERSION':
                            os_info['os_version'] = value
            
            # 如果 /etc/os-release 不存在，尝试其他方法
            if not os_info.get('os_name'):
                stdout, stderr, exit_code = ssh_connection.execute_command("uname -s")
                if exit_code == 0:
                    os_info['os_name'] = stdout.strip()
            
            # 获取内核版本
            stdout, stderr, exit_code = ssh_connection.execute_command("uname -r")
            if exit_code == 0:
                os_info['kernel_version'] = stdout.strip()
            
            # 获取 CPU 核心数
            stdout, stderr, exit_code = ssh_connection.execute_command("nproc")
            if exit_code == 0:
                try:
                    os_info['cpu_cores'] = int(stdout.strip())
                except ValueError:
                    pass
            
            # 获取总内存（字节）
            stdout, stderr, exit_code = ssh_connection.execute_command("cat /proc/meminfo | grep MemTotal")
            if exit_code == 0:
                match = re.search(r'MemTotal:\s+(\d+)\s+kB', stdout)
                if match:
                    os_info['total_memory'] = int(match.group(1)) * 1024  # 转换为字节
            
            # 获取磁盘总容量（字节）
            stdout, stderr, exit_code = ssh_connection.execute_command("df -B1 / | tail -1")
            if exit_code == 0:
                parts = stdout.strip().split()
                if len(parts) >= 2:
                    try:
                        os_info['disk_total'] = int(parts[1])
                    except ValueError:
                        pass
            
            # 获取网络接口信息
            stdout, stderr, exit_code = ssh_connection.execute_command("ip -j addr show")
            if exit_code == 0:
                try:
                    interfaces = json.loads(stdout)
                    network_interfaces = []
                    for interface in interfaces:
                        if interface.get('ifname') != 'lo':  # 排除回环接口
                            iface_info = {
                                'name': interface.get('ifname'),
                                'state': interface.get('operstate'),
                                'addresses': []
                            }
                            for addr in interface.get('addr_info', []):
                                if addr.get('family') in ['inet', 'inet6']:
                                    iface_info['addresses'].append({
                                        'family': addr.get('family'),
                                        'local': addr.get('local'),
                                        'prefixlen': addr.get('prefixlen')
                                    })
                            network_interfaces.append(iface_info)
                    os_info['network_interfaces'] = network_interfaces
                except (json.JSONDecodeError, KeyError):
                    # 如果 JSON 解析失败，使用传统方法
                    stdout, stderr, exit_code = ssh_connection.execute_command("ifconfig -a")
                    if exit_code == 0:
                        os_info['network_interfaces'] = [{'raw_output': stdout}]
            
            return os_info
            
        except Exception as e:
            logger.error(f"收集系统信息失败: {str(e)}")
            raise HostInfoCollectionError(f"收集系统信息失败: {str(e)}")


class PerformanceMetricsCollector:
    """性能指标收集器"""
    
    @staticmethod
    def collect_cpu_usage(ssh_connection) -> Optional[Decimal]:
        """收集 CPU 使用率"""
        try:
            # 使用 top 命令获取 CPU 使用率
            stdout, stderr, exit_code = ssh_connection.execute_command(
                "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//'"
            )
            if exit_code == 0:
                try:
                    return Decimal(str(float(stdout.strip())))
                except (ValueError, TypeError):
                    pass
            
            # 备用方法：使用 /proc/stat
            stdout, stderr, exit_code = ssh_connection.execute_command(
                "grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$3+$4+$5)} END {print usage}'"
            )
            if exit_code == 0:
                try:
                    return Decimal(str(float(stdout.strip())))
                except (ValueError, TypeError):
                    pass
                    
        except Exception as e:
            logger.warning(f"收集 CPU 使用率失败: {str(e)}")
        
        return None
    
    @staticmethod
    def collect_memory_usage(ssh_connection) -> Optional[Decimal]:
        """收集内存使用率"""
        try:
            stdout, stderr, exit_code = ssh_connection.execute_command(
                "free | grep Mem | awk '{printf \"%.2f\", $3/$2 * 100.0}'"
            )
            if exit_code == 0:
                try:
                    return Decimal(str(float(stdout.strip())))
                except (ValueError, TypeError):
                    pass
                    
        except Exception as e:
            logger.warning(f"收集内存使用率失败: {str(e)}")
        
        return None
    
    @staticmethod
    def collect_disk_usage(ssh_connection) -> Optional[Decimal]:
        """收集磁盘使用率"""
        try:
            stdout, stderr, exit_code = ssh_connection.execute_command(
                "df / | tail -1 | awk '{print $5}' | sed 's/%//'"
            )
            if exit_code == 0:
                try:
                    return Decimal(str(float(stdout.strip())))
                except (ValueError, TypeError):
                    pass
                    
        except Exception as e:
            logger.warning(f"收集磁盘使用率失败: {str(e)}")
        
        return None
    
    @staticmethod
    def collect_network_traffic(ssh_connection) -> Tuple[Optional[int], Optional[int]]:
        """收集网络流量（入/出）"""
        try:
            # 获取所有网络接口的流量统计
            stdout, stderr, exit_code = ssh_connection.execute_command(
                "cat /proc/net/dev | tail -n +3 | awk '{rx+=$2; tx+=$10} END {print rx, tx}'"
            )
            if exit_code == 0:
                parts = stdout.strip().split()
                if len(parts) == 2:
                    try:
                        return int(parts[0]), int(parts[1])
                    except (ValueError, TypeError):
                        pass
                        
        except Exception as e:
            logger.warning(f"收集网络流量失败: {str(e)}")
        
        return None, None
    
    @staticmethod
    def collect_load_average(ssh_connection) -> Optional[Decimal]:
        """收集系统负载"""
        try:
            stdout, stderr, exit_code = ssh_connection.execute_command(
                "uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $1}' | xargs"
            )
            if exit_code == 0:
                try:
                    return Decimal(str(float(stdout.strip())))
                except (ValueError, TypeError):
                    pass
                    
        except Exception as e:
            logger.warning(f"收集系统负载失败: {str(e)}")
        
        return None


class HostInfoService:
    """主机信息服务"""
    
    def __init__(self):
        self.system_collector = SystemInfoCollector()
        self.metrics_collector = PerformanceMetricsCollector()
        self._collection_threads = {}
        self._stop_collection = {}
        
        # 从配置获取采集间隔
        app_config = config_manager.get_app_config()
        self.collection_interval = app_config.get('host_monitoring', {}).get('collection_interval', 60)
        self.max_metrics_history = app_config.get('host_monitoring', {}).get('max_metrics_history', 1000)
    
    def collect_host_system_info(self, host: SSHHost) -> Dict[str, Any]:
        """收集主机系统信息"""
        try:
            with ssh_service.get_connection(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                auth_type=host.auth_type,
                password=host.password,
                private_key=host.private_key
            ) as connection:
                
                system_info = self.system_collector.collect_os_info(connection)
                
                # 更新或创建主机信息记录
                host_info = HostInfo.query.filter_by(host_id=host.id).first()
                if not host_info:
                    host_info = HostInfo(host_id=host.id)
                    db.session.add(host_info)
                
                # 更新系统信息
                host_info.os_name = system_info.get('os_name')
                host_info.os_version = system_info.get('os_version')
                host_info.kernel_version = system_info.get('kernel_version')
                host_info.cpu_cores = system_info.get('cpu_cores')
                host_info.total_memory = system_info.get('total_memory')
                host_info.disk_total = system_info.get('disk_total')
                host_info.network_interfaces = system_info.get('network_interfaces')
                host_info.updated_at = datetime.utcnow()
                
                db.session.commit()
                
                logger.info(f"成功收集主机系统信息: {host.name}")
                return system_info
                
        except Exception as e:
            logger.error(f"收集主机系统信息失败 {host.name}: {str(e)}")
            raise HostInfoCollectionError(f"收集主机系统信息失败: {str(e)}")
    
    def collect_host_performance_metrics(self, host: SSHHost) -> Dict[str, Any]:
        """收集主机性能指标"""
        try:
            with ssh_service.get_connection(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                auth_type=host.auth_type,
                password=host.password,
                private_key=host.private_key
            ) as connection:
                
                # 收集各项性能指标
                cpu_usage = self.metrics_collector.collect_cpu_usage(connection)
                memory_usage = self.metrics_collector.collect_memory_usage(connection)
                disk_usage = self.metrics_collector.collect_disk_usage(connection)
                network_in, network_out = self.metrics_collector.collect_network_traffic(connection)
                load_average = self.metrics_collector.collect_load_average(connection)
                
                # 创建性能指标记录
                metrics = HostMetrics(
                    host_id=host.id,
                    cpu_usage=cpu_usage,
                    memory_usage=memory_usage,
                    disk_usage=disk_usage,
                    network_in=network_in,
                    network_out=network_out,
                    load_average=load_average,
                    collected_at=datetime.utcnow()
                )
                
                db.session.add(metrics)
                
                # 清理旧的性能指标记录（保留最近的记录）
                self._cleanup_old_metrics(host.id)
                
                db.session.commit()
                
                metrics_data = {
                    'cpu_usage': float(cpu_usage) if cpu_usage else None,
                    'memory_usage': float(memory_usage) if memory_usage else None,
                    'disk_usage': float(disk_usage) if disk_usage else None,
                    'network_in': network_in,
                    'network_out': network_out,
                    'load_average': float(load_average) if load_average else None,
                    'collected_at': metrics.collected_at.isoformat()
                }
                
                logger.info(f"成功收集主机性能指标: {host.name}")
                return metrics_data
                
        except Exception as e:
            logger.error(f"收集主机性能指标失败 {host.name}: {str(e)}")
            raise HostInfoCollectionError(f"收集主机性能指标失败: {str(e)}")
    
    def _cleanup_old_metrics(self, host_id: int):
        """清理旧的性能指标记录"""
        try:
            # 获取该主机的指标记录数量
            metrics_count = HostMetrics.query.filter_by(host_id=host_id).count()
            
            if metrics_count > self.max_metrics_history:
                # 删除最旧的记录
                old_metrics = HostMetrics.query.filter_by(host_id=host_id)\
                    .order_by(HostMetrics.collected_at.asc())\
                    .limit(metrics_count - self.max_metrics_history)\
                    .all()
                
                for metric in old_metrics:
                    db.session.delete(metric)
                    
                logger.info(f"清理主机 {host_id} 的 {len(old_metrics)} 条旧性能指标记录")
                
        except Exception as e:
            logger.warning(f"清理旧性能指标记录失败: {str(e)}")
    
    def start_periodic_collection(self, host: SSHHost):
        """启动定时性能数据采集"""
        host_key = f"host_{host.id}"
        
        # 如果已经在采集，先停止
        if host_key in self._collection_threads:
            self.stop_periodic_collection(host)
        
        # 创建停止标志
        self._stop_collection[host_key] = threading.Event()
        
        # 创建采集线程
        collection_thread = threading.Thread(
            target=self._periodic_collection_worker,
            args=(host, host_key),
            daemon=True
        )
        
        self._collection_threads[host_key] = collection_thread
        collection_thread.start()
        
        logger.info(f"启动主机 {host.name} 的定时性能数据采集")
    
    def stop_periodic_collection(self, host: SSHHost):
        """停止定时性能数据采集"""
        host_key = f"host_{host.id}"
        
        # 设置停止标志
        if host_key in self._stop_collection:
            self._stop_collection[host_key].set()
        
        # 等待线程结束
        if host_key in self._collection_threads:
            thread = self._collection_threads[host_key]
            if thread.is_alive():
                thread.join(timeout=5)  # 最多等待5秒
            
            del self._collection_threads[host_key]
        
        # 清理停止标志
        if host_key in self._stop_collection:
            del self._stop_collection[host_key]
        
        logger.info(f"停止主机 {host.name} 的定时性能数据采集")
    
    def _periodic_collection_worker(self, host: SSHHost, host_key: str):
        """定时采集工作线程"""
        stop_event = self._stop_collection[host_key]
        
        while not stop_event.is_set():
            try:
                # 收集性能指标
                self.collect_host_performance_metrics(host)
                
                # 等待下次采集
                if stop_event.wait(timeout=self.collection_interval):
                    break  # 收到停止信号
                    
            except Exception as e:
                logger.error(f"定时采集主机 {host.name} 性能指标失败: {str(e)}")
                # 出错后等待一段时间再重试
                if stop_event.wait(timeout=30):
                    break
        
        logger.info(f"主机 {host.name} 的定时采集线程已停止")
    
    def get_host_metrics_history(self, host_id: int, hours: int = 24) -> List[Dict[str, Any]]:
        """获取主机性能指标历史"""
        try:
            start_time = datetime.utcnow() - timedelta(hours=hours)
            
            metrics = HostMetrics.query.filter(
                HostMetrics.host_id == host_id,
                HostMetrics.collected_at >= start_time
            ).order_by(HostMetrics.collected_at.desc()).all()
            
            return [metric.to_dict() for metric in metrics]
            
        except Exception as e:
            logger.error(f"获取主机性能指标历史失败: {str(e)}")
            raise HostInfoCollectionError(f"获取主机性能指标历史失败: {str(e)}")
    
    def get_host_latest_metrics(self, host_id: int) -> Optional[Dict[str, Any]]:
        """获取主机最新性能指标"""
        try:
            latest_metric = HostMetrics.query.filter_by(host_id=host_id)\
                .order_by(HostMetrics.collected_at.desc()).first()
            
            return latest_metric.to_dict() if latest_metric else None
            
        except Exception as e:
            logger.error(f"获取主机最新性能指标失败: {str(e)}")
            raise HostInfoCollectionError(f"获取主机最新性能指标失败: {str(e)}")
    
    def get_collection_status(self) -> Dict[str, Any]:
        """获取采集状态"""
        return {
            'active_collections': len(self._collection_threads),
            'collection_interval': self.collection_interval,
            'max_metrics_history': self.max_metrics_history,
            'collecting_hosts': list(self._collection_threads.keys())
        }
    
    def stop_all_collections(self):
        """停止所有采集"""
        host_keys = list(self._collection_threads.keys())
        for host_key in host_keys:
            if host_key in self._stop_collection:
                self._stop_collection[host_key].set()
        
        # 等待所有线程结束
        for host_key in host_keys:
            if host_key in self._collection_threads:
                thread = self._collection_threads[host_key]
                if thread.is_alive():
                    thread.join(timeout=5)
        
        self._collection_threads.clear()
        self._stop_collection.clear()
        
        logger.info("已停止所有主机性能数据采集")


# 全局主机信息服务实例
host_info_service = HostInfoService()