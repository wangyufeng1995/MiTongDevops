import React, { useState, useEffect } from 'react'
import { networkProbeGroupService } from '../../../services/network'
import { NetworkProbeGroup } from '../../../types/network'

interface GroupSelectorProps {
  value?: number | null
  onChange: (groupId: number | null) => void
  className?: string
  required?: boolean
  disabled?: boolean
}

/**
 * Group Selector Component
 * Hides the default "未分组" group from selection
 * If no group is selected, the backend will automatically assign to default group
 */
export const GroupSelector: React.FC<GroupSelectorProps> = ({
  value,
  onChange,
  className = '',
  required = false,
  disabled = false,
}) => {
  const [groups, setGroups] = useState<NetworkProbeGroup[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = async () => {
    setLoading(true)
    try {
      const response = await networkProbeGroupService.getSelectableGroups()
      if (response.success) {
        setGroups(response.data)
      }
    } catch (err) {
      console.error('加载分组错误:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value
    onChange(selectedValue ? parseInt(selectedValue) : null)
  }

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || loading}
      required={required}
      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border ${className}`}
    >
      <option value="">
        {loading ? '正在加载分组...' : '选择分组（可选）'}
      </option>
      {groups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </select>
  )
}
