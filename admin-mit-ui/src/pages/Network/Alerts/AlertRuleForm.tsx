import React, { useState, useEffect } from 'react'
import { NetworkAlertRule, NetworkProbe } from '../../../types/network'
import { AlertChannel } from '../../../types/monitor'
import { networkProbeService } from '../../../services/network'
import { alertChannelService } from '../../../services/monitor'
import { Input } from '../../../components/Form/Input'
import { Select, SelectOption } from '../../../components/Form/Select'

interface AlertRuleFormProps {
  rule?: NetworkAlertRule | null
  onSubmit: (data: Partial<NetworkAlertRule>) => Promise<void>
  onCancel: () => void
}

const CONDITION_TYPE_OPTIONS: SelectOption[] = [
  { value: 'response_time', label: 'Response Time', description: 'Alert based on response time (ms)' },
  { value: 'status_code', label: 'Status Code', description: 'Alert based on HTTP status code' },
  { value: 'availability', label: 'Availability', description: 'Alert when probe fails' },
]

const OPERATOR_OPTIONS: SelectOption[] = [
  { value: '>', label: 'Greater than (>)' },
  { value: '<', label: 'Less than (<)' },
  { value: '>=', label: 'Greater than or equal (>=)' },
  { value: '<=', label: 'Less than or equal (<=)' },
  { value: '==', label: 'Equal to (==)' },
  { value: '!=', label: 'Not equal to (!=)' },
]

export const AlertRuleForm: React.FC<AlertRuleFormProps> = ({ rule, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Partial<NetworkAlertRule>>({
    name: '',
    condition_type: 'response_time',
    condition_operator: '>',
    threshold_value: 1000,
    consecutive_failures: 3,
    channel_ids: [],
    enabled: true,
  })

  const [probes, setProbes] = useState<NetworkProbe[]>([])
  const [channels, setChannels] = useState<AlertChannel[]>([])
  const [probeOptions, setProbeOptions] = useState<SelectOption[]>([])
  const [channelOptions, setChannelOptions] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    loadProbesAndChannels()
  }, [])

  useEffect(() => {
    if (rule) {
      setFormData({
        probe_id: rule.probe_id,
        name: rule.name,
        condition_type: rule.condition_type,
        condition_operator: rule.condition_operator,
        threshold_value: rule.threshold_value,
        consecutive_failures: rule.consecutive_failures,
        channel_ids: rule.channel_ids,
        enabled: rule.enabled,
      })
    }
  }, [rule])

  const loadProbesAndChannels = async () => {
    setLoadingData(true)
    try {
      // Load probes
      const probesResponse = await networkProbeService.getAll()
      if (probesResponse.success && probesResponse.data) {
        const probeItems = Array.isArray(probesResponse.data) 
          ? probesResponse.data 
          : probesResponse.data.items || []
        setProbes(probeItems)
        
        const pOptions: SelectOption[] = probeItems.map((probe: NetworkProbe) => ({
          value: probe.id,
          label: probe.name,
          description: `${probe.protocol.toUpperCase()} - ${probe.target_url}`,
        }))
        setProbeOptions(pOptions)
      }

      // Load channels
      const channelsResponse = await alertChannelService.getAll()
      if (channelsResponse.success && channelsResponse.data) {
        const channelItems = Array.isArray(channelsResponse.data)
          ? channelsResponse.data
          : channelsResponse.data.items || []
        setChannels(channelItems)
        
        const cOptions: SelectOption[] = channelItems.map((channel: AlertChannel) => ({
          value: channel.id,
          label: channel.name,
          description: `${channel.type.toUpperCase()}`,
        }))
        setChannelOptions(cOptions)
      }
    } catch (err) {
      console.error('加载数据错误:', err)
    } finally {
      setLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation
    if (!formData.probe_id) {
      setError('Please select a probe')
      setLoading(false)
      return
    }

    if (!formData.channel_ids || formData.channel_ids.length === 0) {
      setError('Please select at least one alert channel')
      setLoading(false)
      return
    }

    try {
      await onSubmit(formData)
    } catch (err: any) {
      setError(err.message || '保存告警规则失败')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleProbeChange = (value: string | number | null) => {
    setFormData(prev => ({ ...prev, probe_id: value as number }))
  }

  const handleConditionTypeChange = (value: string | number | null) => {
    setFormData(prev => ({ ...prev, condition_type: value as any }))
  }

  const handleOperatorChange = (value: string | number | null) => {
    setFormData(prev => ({ ...prev, condition_operator: value as any }))
  }

  const handleChannelsChange = (values: (string | number)[]) => {
    setFormData(prev => ({ ...prev, channel_ids: values as number[] }))
  }

  const showThresholdField = formData.condition_type !== 'availability'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
        
        <Input
          label="Rule Name"
          name="name"
          id="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="Enter alert rule name"
        />

        <Select
          label="Target Probe"
          options={probeOptions}
          value={formData.probe_id}
          onSelectionChange={handleProbeChange}
          required
          loading={loadingData}
          placeholder="Select a probe to monitor"
          helperText="Choose the network probe to apply this alert rule to"
        />
      </div>

      {/* Alert Condition */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Alert Condition</h3>
        
        <Select
          label="Condition Type"
          options={CONDITION_TYPE_OPTIONS}
          value={formData.condition_type}
          onSelectionChange={handleConditionTypeChange}
          required
        />

        {showThresholdField && (
          <>
            <Select
              label="Operator"
              options={OPERATOR_OPTIONS}
              value={formData.condition_operator}
              onSelectionChange={handleOperatorChange}
              required
            />

            <Input
              label={formData.condition_type === 'response_time' ? 'Threshold (milliseconds)' : 'Threshold Value'}
              name="threshold_value"
              id="threshold_value"
              type="number"
              value={formData.threshold_value}
              onChange={handleChange}
              required
              min={0}
              helperText={
                formData.condition_type === 'response_time'
                  ? 'Alert when response time exceeds this value'
                  : 'Alert when status code matches this condition'
              }
            />
          </>
        )}

        <Input
          label="Consecutive Failures"
          name="consecutive_failures"
          id="consecutive_failures"
          type="number"
          value={formData.consecutive_failures}
          onChange={handleChange}
          required
          min={1}
          max={100}
          helperText="Number of consecutive failures before triggering alert"
        />
      </div>

      {/* Alert Channels */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Alert Channels</h3>
        
        <Select
          label="Notification Channels"
          options={channelOptions}
          value={formData.channel_ids}
          onSelectionChange={handleChannelsChange}
          multiple
          required
          loading={loadingData}
          placeholder="Select channels to send alerts"
          helperText="Choose one or more channels to receive alert notifications"
        />

        {formData.channel_ids && formData.channel_ids.length > 0 && (
          <div className="text-sm text-gray-600">
            Selected {formData.channel_ids.length} channel(s)
          </div>
        )}
      </div>

      {/* Rule Settings */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Rule Settings</h3>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="enabled"
            name="enabled"
            checked={formData.enabled}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
            Enable Alert Rule
          </label>
        </div>
        <p className="text-sm text-gray-500 ml-6">
          Enable or disable this alert rule
        </p>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || loadingData}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? '保存中...' : rule ? '更新规则' : '创建规则'}
        </button>
      </div>
    </form>
  )
}
