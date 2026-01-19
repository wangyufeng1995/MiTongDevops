import React, { useState, useEffect } from 'react'
import { NetworkAlertRecord, NetworkProbe } from '../../../types/network'
import { networkAlertRecordService, networkProbeService } from '../../../services/network'
import { DataTable } from '../../../components/Table/DataTable'
import { ActionColumn } from '../../../components/Table/ActionColumn'
import { formatDateTime } from '../../../utils'

interface AlertHistoryListProps {
  ruleId?: number
  onViewDetail: (alert: NetworkAlertRecord) => void
}

export const AlertHistoryList: React.FC<AlertHistoryListProps> = ({ ruleId, onViewDetail }) => {
  const [alerts, setAlerts] = useState<NetworkAlertRecord[]>([])
  const [probes, setProbes] = useState<Map<number, NetworkProbe>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const perPage = 10

  useEffect(() => {
    loadAlerts()
    loadProbes()
  }, [page, ruleId])

  const loadAlerts = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = { page, per_page: perPage }
      if (ruleId) {
        params.rule_id = ruleId
      }

      const response = await networkAlertRecordService.getAll(params)
      if (response.success && response.data) {
        const items = Array.isArray(response.data) ? response.data : response.data.items || []
        setAlerts(items)
        setTotal(Array.isArray(response.data) ? items.length : response.data.total || 0)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load alert history')
    } finally {
      setLoading(false)
    }
  }

  const loadProbes = async () => {
    try {
      const response = await networkProbeService.getAll()
      if (response.success && response.data) {
        const items = Array.isArray(response.data) ? response.data : response.data.items || []
        const probeMap = new Map<number, NetworkProbe>()
        items.forEach((probe: NetworkProbe) => {
          probeMap.set(probe.id, probe)
        })
        setProbes(probeMap)
      }
    } catch (err) {
      console.error('Failed to load probes:', err)
    }
  }

  const handleAcknowledge = async (alert: NetworkAlertRecord) => {
    try {
      await networkAlertRecordService.acknowledge(alert.id)
      loadAlerts()
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge alert')
    }
  }

  const handleResolve = async (alert: NetworkAlertRecord) => {
    try {
      await networkAlertRecordService.resolve(alert.id)
      loadAlerts()
    } catch (err: any) {
      alert(err.message || 'Failed to resolve alert')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { bg: 'bg-red-100', text: 'text-red-800', label: 'Active' },
      acknowledged: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Acknowledged' },
      resolved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Resolved' },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return formatDateTime(dateString, 'YYYY/MM/DD HH:mm:ss')
  }

  const columns = [
    {
      key: 'probe',
      title: 'Probe',
      render: (alert: NetworkAlertRecord) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900">
            {probes.get(alert.probe_id)?.name || `Probe ID: ${alert.probe_id}`}
          </div>
          <div className="text-gray-500">
            Rule ID: {alert.rule_id}
          </div>
        </div>
      ),
    },
    {
      key: 'message',
      title: 'Message',
      render: (alert: NetworkAlertRecord) => (
        <div className="text-sm text-gray-900 max-w-md truncate" title={alert.message}>
          {alert.message}
        </div>
      ),
    },
    {
      key: 'triggered_value',
      title: 'Triggered Value',
      render: (alert: NetworkAlertRecord) => (
        <span className="text-sm text-gray-900">
          {alert.triggered_value !== undefined ? alert.triggered_value : 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (alert: NetworkAlertRecord) => getStatusBadge(alert.status),
    },
    {
      key: 'first_triggered_at',
      title: 'First Triggered',
      render: (alert: NetworkAlertRecord) => (
        <span className="text-sm text-gray-900">{formatDate(alert.first_triggered_at)}</span>
      ),
    },
    {
      key: 'last_triggered_at',
      title: 'Last Triggered',
      render: (alert: NetworkAlertRecord) => (
        <span className="text-sm text-gray-900">{formatDate(alert.last_triggered_at)}</span>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (alert: NetworkAlertRecord) => {
        const actions = [
          {
            label: 'View Details',
            onClick: () => onViewDetail(alert),
            variant: 'info' as const,
          },
        ]

        if (alert.status === 'active') {
          actions.push({
            label: 'Acknowledge',
            onClick: () => handleAcknowledge(alert),
            variant: 'warning' as const,
          })
          actions.push({
            label: 'Resolve',
            onClick: () => handleResolve(alert),
            variant: 'success' as const,
          })
        }

        if (alert.status === 'acknowledged') {
          actions.push({
            label: 'Resolve',
            onClick: () => handleResolve(alert),
            variant: 'success' as const,
          })
        }

        return <ActionColumn actions={actions} />
      },
    },
  ]

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    )
  }

  return (
    <DataTable
      columns={columns}
      data={alerts}
      loading={loading}
      pagination={{
        page,
        perPage,
        total,
        onPageChange: setPage,
      }}
      emptyMessage="No alert history found."
    />
  )
}
