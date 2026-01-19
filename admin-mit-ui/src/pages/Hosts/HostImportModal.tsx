/**
 * 主机批量导入弹窗组件
 */
import React, { useState, useRef } from 'react'
import { Upload, Download, X, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { hostsService } from '../../services/hosts'
import type { HostImportResponse } from '../../types/host'

interface HostImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type ImportStep = 'upload' | 'importing' | 'result'

export const HostImportModal: React.FC<HostImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<ImportStep>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<HostImportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 重置状态
  const resetState = () => {
    setStep('upload')
    setSelectedFile(null)
    setImporting(false)
    setResult(null)
    setError(null)
  }

  // 关闭弹窗
  const handleClose = () => {
    resetState()
    onClose()
  }

  // 下载模板
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true)
    try {
      const blob = await hostsService.downloadImportTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '主机导入模板.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      setError(err.message || '下载模板失败')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  // 选择文件
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('仅支持 .xlsx 或 .xls 格式的 Excel 文件')
        return
      }
      setSelectedFile(file)
      setError(null)
    }
  }

  // 拖拽上传
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('仅支持 .xlsx 或 .xls 格式的 Excel 文件')
        return
      }
      setSelectedFile(file)
      setError(null)
    }
  }

  // 执行导入
  const handleImport = async () => {
    if (!selectedFile) return

    setImporting(true)
    setStep('importing')
    setError(null)

    try {
      const response = await hostsService.importHosts(selectedFile)
      setResult(response)
      setStep('result')
      if (response.success_count > 0) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || '导入失败')
      setStep('upload')
    } finally {
      setImporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* 背景遮罩 */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
        />

        {/* 弹窗内容 */}
        <div className="relative inline-block w-full max-w-2xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
          {/* 标题栏 */}
          <div className="flex items-center justify-between pb-4 border-b">
            <h3 className="text-lg font-medium text-gray-900">
              批量导入主机
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 内容区域 */}
          <div className="mt-4">
            {step === 'upload' && (
              <div className="space-y-4">
                {/* 下载模板 */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">下载导入模板</p>
                      <p className="text-sm text-gray-500">
                        请先下载模板，按格式填写主机信息
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    disabled={downloadingTemplate}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {downloadingTemplate ? '下载中...' : '下载模板'}
                  </button>
                </div>

                {/* 模板说明 */}
                <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                  <p className="font-medium text-gray-700 mb-2">Excel 模板说明：</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>主机名称、主机地址、用户名为必填项</li>
                    <li>密码认证和密钥认证列使用 <code className="bg-gray-200 px-1 rounded">T</code> 或 <code className="bg-gray-200 px-1 rounded">F</code> 表示</li>
                    <li>选择密码认证（T）时，密码列必填</li>
                    <li>选择密钥认证（T）时，私钥列必填</li>
                    <li>分组名称如果不存在会自动创建</li>
                  </ul>
                </div>

                {/* 文件上传区域 */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    selectedFile 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {selectedFile ? (
                    <div className="space-y-2">
                      <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
                      <p className="font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedFile(null)
                        }}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        重新选择
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-12 h-12 mx-auto text-gray-400" />
                      <p className="font-medium text-gray-900">
                        点击或拖拽文件到此处上传
                      </p>
                      <p className="text-sm text-gray-500">
                        支持 .xlsx 或 .xls 格式
                      </p>
                    </div>
                  )}
                </div>

                {/* 错误提示 */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
              </div>
            )}

            {step === 'importing' && (
              <div className="py-12 text-center">
                <div className="animate-spin w-12 h-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
                <p className="mt-4 text-gray-600">正在导入主机数据...</p>
              </div>
            )}

            {step === 'result' && result && (
              <div className="space-y-4">
                {/* 导入统计 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <CheckCircle className="w-8 h-8 mx-auto text-green-500" />
                    <p className="mt-2 text-2xl font-bold text-green-700">{result.success_count}</p>
                    <p className="text-sm text-green-600">成功导入</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg text-center">
                    <XCircle className="w-8 h-8 mx-auto text-red-500" />
                    <p className="mt-2 text-2xl font-bold text-red-700">{result.failed_count}</p>
                    <p className="text-sm text-red-600">导入失败</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg text-center">
                    <AlertTriangle className="w-8 h-8 mx-auto text-yellow-500" />
                    <p className="mt-2 text-2xl font-bold text-yellow-700">{result.skipped_count}</p>
                    <p className="text-sm text-yellow-600">已跳过</p>
                  </div>
                </div>

                {/* 失败详情 */}
                {result.failed.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-red-50 border-b">
                      <p className="font-medium text-red-700">导入失败的记录</p>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left">行号</th>
                            <th className="px-4 py-2 text-left">主机名称</th>
                            <th className="px-4 py-2 text-left">主机地址</th>
                            <th className="px-4 py-2 text-left">错误原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.failed.map((item, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-4 py-2">{item.row}</td>
                              <td className="px-4 py-2">{item.name}</td>
                              <td className="px-4 py-2">{item.hostname}</td>
                              <td className="px-4 py-2 text-red-600">{item.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 跳过详情 */}
                {result.skipped.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-yellow-50 border-b">
                      <p className="font-medium text-yellow-700">已跳过的记录</p>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left">行号</th>
                            <th className="px-4 py-2 text-left">主机名称</th>
                            <th className="px-4 py-2 text-left">主机地址</th>
                            <th className="px-4 py-2 text-left">跳过原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.skipped.map((item, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-4 py-2">{item.row}</td>
                              <td className="px-4 py-2">{item.name}</td>
                              <td className="px-4 py-2">{item.hostname}</td>
                              <td className="px-4 py-2 text-yellow-600">{item.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="mt-6 flex justify-end space-x-3">
            {step === 'upload' && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selectedFile || importing}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  开始导入
                </button>
              </>
            )}
            {step === 'result' && (
              <>
                <button
                  onClick={resetState}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  继续导入
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  完成
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
