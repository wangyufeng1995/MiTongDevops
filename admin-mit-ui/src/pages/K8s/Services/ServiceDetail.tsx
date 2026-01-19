/**
 * K8S服务详情组件 - 美化版
 */
import React, { useState, useEffect } from 'react'
import { Spin, Empty } from 'antd'
import { Server, Network, Globe, Tag, Clock, MapPin, CheckCircle, AlertCircle, Layers } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { k8sServicesService } from '../../../services/k8s/services'
import type { ServiceDetail as ServiceDetailType, EndpointAddress } from '../../../types/k8s'

interface ServiceDetailProps {
  clusterId: number
  namespace: string
  name: string
}

export const ServiceDetail: React.FC<ServiceDetailProps> = ({ clusterId, namespace, name }) => {
  const { isDark } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [serviceDetail, setServiceDetail] = useState<ServiceDetailType | null>(null)
  const [endpoints, setEndpoints] = useState<any>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const detail = await k8sServicesService.getServiceDetail(clusterId, namespace, name)
        setServiceDetail(detail)
        try {
          const endpointsData = await k8sServicesService.getServiceEndpoints(clusterId, namespace, name)
          setEndpoints(endpointsData)
        } catch (err) { console.error('Failed to load endpoints:', err) }
      } catch (err: any) {
        setError(err.response?.data?.message || '加载服务详情失败')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [clusterId, namespace, name])

  const getEndpointAddresses = (): EndpointAddress[] => {
    const list = endpoints?.data?.endpoints || endpoints?.endpoints || []
    if (!Array.isArray(list) || list.length === 0) return []
    if (list[0] && 'ip' in list[0]) {
      return list.map((ep: any) => ({
        ip: ep.ip, hostname: ep.hostname, node_name: ep.node_name,
        target_ref: ep.pod_name ? { kind: 'Pod', name: ep.pod_name, namespace: endpoints?.data?.namespace || endpoints?.namespace } : undefined
      }))
    }
    const addresses: EndpointAddress[] = []
    list.forEach((endpoint: any) => { if (endpoint.addresses) addresses.push(...endpoint.addresses) })
    return addresses
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Spin size="large" /><span className={`ml-3 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>加载中...</span></div>
  if (error) return <div className={`p-4 rounded-lg ${isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>{error}</div>
  if (!serviceDetail) return <Empty description="服务不存在" />

  const typeColors: Record<string, string> = { ClusterIP: 'blue', NodePort: 'green', LoadBalancer: 'orange', ExternalName: 'purple' }
  const endpointAddresses = getEndpointAddresses()


  return (
    <div className="space-y-4">
      {/* 基本信息卡片 */}
      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-white border border-gray-200'}`}>
        <div className={`px-4 py-3 flex items-center gap-2 ${isDark ? 'bg-emerald-500/10 border-b border-slate-700' : 'bg-emerald-50 border-b border-gray-200'}`}>
          <Server className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>基本信息</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <InfoItem label="服务名称" value={serviceDetail.name} icon={<Server className="w-3.5 h-3.5" />} isDark={isDark} />
          <InfoItem label="命名空间" value={serviceDetail.namespace} icon={<Layers className="w-3.5 h-3.5" />} isDark={isDark} />
          <InfoItem label="服务类型" isDark={isDark}>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              typeColors[serviceDetail.type] === 'blue' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600') :
              typeColors[serviceDetail.type] === 'green' ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600') :
              typeColors[serviceDetail.type] === 'orange' ? (isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600') :
              (isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600')
            }`}>{serviceDetail.type}</span>
          </InfoItem>
          <InfoItem label="Cluster IP" value={serviceDetail.cluster_ip || '-'} icon={<Globe className="w-3.5 h-3.5" />} isDark={isDark} />
          <InfoItem label="创建时间" value={serviceDetail.created_at} icon={<Clock className="w-3.5 h-3.5" />} isDark={isDark} span={2} />
          
          {/* 外部IP */}
          {serviceDetail.external_ips && serviceDetail.external_ips.length > 0 && (
            <div className="col-span-2">
              <div className={`text-xs mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>外部IP</div>
              <div className="flex flex-wrap gap-1.5">
                {serviceDetail.external_ips.map((ip, i) => (
                  <span key={i} className={`inline-flex px-2 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>{ip}</span>
                ))}
              </div>
            </div>
          )}

          {/* 端口映射 */}
          {serviceDetail.ports && serviceDetail.ports.length > 0 && (
            <div className="col-span-2">
              <div className={`text-xs mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>端口映射</div>
              <div className="flex flex-wrap gap-1.5">
                {serviceDetail.ports.map((port, i) => (
                  <span key={i} className={`inline-flex px-2 py-1 rounded text-xs font-mono ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                    {port.name && `${port.name}: `}{port.port}{port.target_port && ` → ${port.target_port}`}{port.node_port && ` (NodePort: ${port.node_port})`}/{port.protocol || 'TCP'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 选择器 */}
          {serviceDetail.selector && Object.keys(serviceDetail.selector).length > 0 && (
            <div className="col-span-2">
              <div className={`text-xs mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>选择器</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(serviceDetail.selector).map(([k, v]) => (
                  <span key={k} className={`inline-flex px-2 py-0.5 rounded text-xs ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-600'}`}>{k}: {v}</span>
                ))}
              </div>
            </div>
          )}

          {/* 标签 */}
          {serviceDetail.labels && Object.keys(serviceDetail.labels).length > 0 && (
            <div className="col-span-2">
              <div className={`text-xs mb-1.5 flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><Tag className="w-3 h-3" />标签</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(serviceDetail.labels).map(([k, v]) => (
                  <span key={k} className={`inline-flex px-2 py-0.5 rounded text-xs ${isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{k}: {v}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Endpoints卡片 */}
      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-white border border-gray-200'}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'bg-teal-500/10 border-b border-slate-700' : 'bg-teal-50 border-b border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <Network className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Endpoints</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-600'}`}>{endpointAddresses.length}</span>
        </div>
        <div className="p-4">
          {endpointAddresses.length > 0 ? (
            <>
              <div className={`mb-3 p-2.5 rounded-lg flex items-center gap-2 ${isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
                <CheckCircle className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                <span className={`text-sm ${isDark ? 'text-green-300' : 'text-green-700'}`}>该服务有 {endpointAddresses.length} 个可用的Endpoint地址</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={isDark ? 'bg-slate-700/50' : 'bg-gray-50'}>
                      {['IP地址', '主机名', '节点', '目标引用'].map(h => (
                        <th key={h} className={`px-3 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-100'}`}>
                    {endpointAddresses.map((ep, i) => (
                      <tr key={i} className={isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-2"><span className={`font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{ep.ip}</span></td>
                        <td className={`px-3 py-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{ep.hostname || '-'}</td>
                        <td className={`px-3 py-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{ep.node_name || '-'}</td>
                        <td className="px-3 py-2">{ep.target_ref ? <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{ep.target_ref.kind}: {ep.target_ref.name}</span> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
              <AlertCircle className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
              <span className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>该服务当前没有可用的Endpoint地址，可能是因为没有匹配的Pod或Pod未就绪</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 信息项组件
const InfoItem: React.FC<{ label: string; value?: string; icon?: React.ReactNode; isDark: boolean; span?: number; children?: React.ReactNode }> = ({ label, value, icon, isDark, span = 1, children }) => (
  <div className={span === 2 ? 'col-span-2' : ''}>
    <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</div>
    {children || (
      <div className={`flex items-center gap-1.5 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
        {icon && <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>{icon}</span>}
        <span className="font-medium">{value}</span>
      </div>
    )}
  </div>
)

export default ServiceDetail
