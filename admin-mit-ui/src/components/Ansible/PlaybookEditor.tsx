/**
 * Ansible Playbook 编辑器组件
 * 提供 YAML 在线编辑功能，包含语法高亮、验证、代码自动补全和编辑器工具栏
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import * as yaml from 'js-yaml'
import {
  Save,
  Undo,
  Redo,
  Search,
  Replace,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  CheckCircle,
  AlertCircle,
  Settings,
  Maximize,
  Minimize,
  Copy,
  Download,
  Upload
} from 'lucide-react'
import { ansibleService } from '../../services/ansible'

export interface PlaybookEditorProps {
  value?: string
  onChange?: (value: string) => void
  onSave?: (value: string) => void
  onValidate?: (isValid: boolean, errors?: string[]) => void
  readOnly?: boolean
  height?: string | number
  theme?: 'light' | 'dark'
  showToolbar?: boolean
  showMinimap?: boolean
  fontSize?: number
  className?: string
}

interface EditorSettings {
  fontSize: number
  theme: 'light' | 'dark'
  showMinimap: boolean
  wordWrap: 'on' | 'off'
  tabSize: number
}

const PlaybookEditor: React.FC<PlaybookEditorProps> = ({
  value = '',
  onChange,
  onSave,
  onValidate,
  readOnly = false,
  height = '600px',
  theme = 'light',
  showToolbar = true,
  showMinimap = true,
  fontSize = 14,
  className = ''
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const [editorValue, setEditorValue] = useState(value)
  const [isValid, setIsValid] = useState(true)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<EditorSettings>({
    fontSize,
    theme,
    showMinimap,
    wordWrap: 'on',
    tabSize: 2
  })

  // 同步外部 value 变化
  useEffect(() => {
    if (value !== editorValue) {
      setEditorValue(value)
    }
  }, [value])

  // 初始化编辑器
  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor

    // 配置 YAML 语言支持
    monaco.languages.setLanguageConfiguration('yaml', {
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ]
    })

    // 注册 Ansible 关键词补全
    monaco.languages.registerCompletionItemProvider('yaml', {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          // Ansible 基础关键词
          {
            label: 'name',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'name: ',
            documentation: 'Task name'
          },
          {
            label: 'hosts',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'hosts: ',
            documentation: 'Target hosts'
          },
          {
            label: 'tasks',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'tasks:\n  - name: ',
            documentation: 'List of tasks'
          },
          {
            label: 'vars',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'vars:\n  ',
            documentation: 'Variables'
          },
          {
            label: 'become',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'become: yes',
            documentation: 'Run as sudo'
          },
          {
            label: 'when',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'when: ',
            documentation: 'Conditional execution'
          },
          {
            label: 'with_items',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'with_items:\n  - ',
            documentation: 'Loop over items'
          },
          {
            label: 'register',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'register: ',
            documentation: 'Store task result'
          },
          // Ansible 模块
          {
            label: 'shell',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'shell: ',
            documentation: 'Execute shell commands'
          },
          {
            label: 'command',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'command: ',
            documentation: 'Execute commands'
          },
          {
            label: 'copy',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'copy:\n  src: \n  dest: ',
            documentation: 'Copy files'
          },
          {
            label: 'template',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'template:\n  src: \n  dest: ',
            documentation: 'Template files'
          },
          {
            label: 'service',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'service:\n  name: \n  state: ',
            documentation: 'Manage services'
          },
          {
            label: 'package',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'package:\n  name: \n  state: ',
            documentation: 'Manage packages'
          },
          {
            label: 'file',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'file:\n  path: \n  state: ',
            documentation: 'Manage files and directories'
          },
          {
            label: 'user',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'user:\n  name: \n  state: ',
            documentation: 'Manage users'
          },
          {
            label: 'group',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'group:\n  name: \n  state: ',
            documentation: 'Manage groups'
          },
          {
            label: 'debug',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'debug:\n  msg: ',
            documentation: 'Print debug information'
          }
        ]

        return { suggestions }
      }
    })

    // 键盘快捷键
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave()
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run()
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.startFindReplaceAction')?.run()
    })
  }, [])

  // 处理编辑器内容变化
  const handleEditorChange = useCallback((newValue: string | undefined) => {
    const content = newValue || ''
    setEditorValue(content)
    onChange?.(content)
    
    // 实时验证 YAML 语法
    validateYaml(content)
  }, [onChange])

  // 验证 YAML 语法
  const validateYaml = useCallback(async (content: string) => {
    try {
      // 基础 YAML 语法验证
      yaml.load(content)
      
      // 如果有后端验证服务，也可以调用
      if (content.trim()) {
        try {
          const result = await ansibleService.validatePlaybook(content)
          setIsValid(result.valid)
          setValidationErrors(result.errors || [])
          onValidate?.(result.valid, result.errors)
        } catch (err) {
          // 如果后端验证失败，至少保证基础 YAML 语法是正确的
          setIsValid(true)
          setValidationErrors([])
          onValidate?.(true, [])
        }
      } else {
        setIsValid(true)
        setValidationErrors([])
        onValidate?.(true, [])
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'YAML 语法错误'
      setIsValid(false)
      setValidationErrors([errorMessage])
      onValidate?.(false, [errorMessage])
    }
  }, [onValidate])

  // 保存
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(editorValue)
    }
  }, [editorValue, onSave])

  // 撤销
  const handleUndo = useCallback(() => {
    editorRef.current?.trigger('keyboard', 'undo', null)
  }, [])

  // 重做
  const handleRedo = useCallback(() => {
    editorRef.current?.trigger('keyboard', 'redo', null)
  }, [])

  // 查找
  const handleFind = useCallback(() => {
    editorRef.current?.getAction('actions.find')?.run()
  }, [])

  // 替换
  const handleReplace = useCallback(() => {
    editorRef.current?.getAction('editor.action.startFindReplaceAction')?.run()
  }, [])

  // 放大字体
  const handleZoomIn = useCallback(() => {
    const newFontSize = Math.min(settings.fontSize + 2, 24)
    setSettings(prev => ({ ...prev, fontSize: newFontSize }))
  }, [settings.fontSize])

  // 缩小字体
  const handleZoomOut = useCallback(() => {
    const newFontSize = Math.max(settings.fontSize - 2, 10)
    setSettings(prev => ({ ...prev, fontSize: newFontSize }))
  }, [settings.fontSize])

  // 重置内容
  const handleReset = useCallback(() => {
    if (window.confirm('确定要重置编辑器内容吗？此操作不可撤销。')) {
      setEditorValue('')
      onChange?.('')
    }
  }, [onChange])

  // 复制内容
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editorValue)
  }, [editorValue])

  // 导出文件
  const handleExport = useCallback(() => {
    const blob = new Blob([editorValue], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'playbook.yml'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [editorValue])

  // 导入文件
  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.yml,.yaml'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          setEditorValue(content)
          onChange?.(content)
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [onChange])

  // 切换全屏
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen)
  }, [isFullscreen])

  // 更新设置
  const updateSettings = useCallback((newSettings: Partial<EditorSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  // 监听 value 属性变化
  useEffect(() => {
    if (value !== editorValue) {
      setEditorValue(value)
    }
  }, [value])

  return (
    <div className={`relative flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''} ${className}`} style={{ height: isFullscreen ? '100vh' : height }}>
      {/* 工具栏 */}
      {showToolbar && (
        <div className="flex-shrink-0 flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            {/* 基础操作 */}
            <div className="flex items-center space-x-1 border-r border-gray-300 pr-2">
              <button
                onClick={handleSave}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                title="保存 (Ctrl+S)"
                disabled={readOnly}
              >
                <Save size={16} />
              </button>
              <button
                onClick={handleUndo}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="撤销 (Ctrl+Z)"
                disabled={readOnly}
              >
                <Undo size={16} />
              </button>
              <button
                onClick={handleRedo}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="重做 (Ctrl+Y)"
                disabled={readOnly}
              >
                <Redo size={16} />
              </button>
            </div>

            {/* 查找替换 */}
            <div className="flex items-center space-x-1 border-r border-gray-300 pr-2">
              <button
                onClick={handleFind}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="查找 (Ctrl+F)"
              >
                <Search size={16} />
              </button>
              <button
                onClick={handleReplace}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="替换 (Ctrl+Shift+F)"
                disabled={readOnly}
              >
                <Replace size={16} />
              </button>
            </div>

            {/* 缩放 */}
            <div className="flex items-center space-x-1 border-r border-gray-300 pr-2">
              <button
                onClick={handleZoomOut}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="缩小字体"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-sm text-gray-600 min-w-[3rem] text-center">
                {settings.fontSize}px
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="放大字体"
              >
                <ZoomIn size={16} />
              </button>
            </div>

            {/* 文件操作 */}
            <div className="flex items-center space-x-1 border-r border-gray-300 pr-2">
              <button
                onClick={handleImport}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="导入文件"
                disabled={readOnly}
              >
                <Upload size={16} />
              </button>
              <button
                onClick={handleExport}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="导出文件"
              >
                <Download size={16} />
              </button>
              <button
                onClick={handleCopy}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="复制内容"
              >
                <Copy size={16} />
              </button>
            </div>

            {/* 其他操作 */}
            <div className="flex items-center space-x-1">
              <button
                onClick={handleReset}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                title="重置内容"
                disabled={readOnly}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* 验证状态 */}
            <div className="flex items-center space-x-2">
              {isValid ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckCircle size={16} />
                  <span className="text-sm">语法正确</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle size={16} />
                  <span className="text-sm">语法错误</span>
                </div>
              )}
            </div>

            {/* 设置 */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title="编辑器设置"
            >
              <Settings size={16} />
            </button>

            {/* 全屏 */}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title={isFullscreen ? '退出全屏' : '全屏'}
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* 设置面板 */}
      {showSettings && (
        <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 shadow-lg">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">编辑器设置</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">主题</label>
                <select
                  value={settings.theme}
                  onChange={(e) => updateSettings({ theme: e.target.value as 'light' | 'dark' })}
                  className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">字体大小</label>
                <input
                  type="number"
                  min="10"
                  max="24"
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                  className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">自动换行</label>
                <select
                  value={settings.wordWrap}
                  onChange={(e) => updateSettings({ wordWrap: e.target.value as 'on' | 'off' })}
                  className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="on">开启</option>
                  <option value="off">关闭</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Tab 大小</label>
                <input
                  type="number"
                  min="2"
                  max="8"
                  value={settings.tabSize}
                  onChange={(e) => updateSettings({ tabSize: Number(e.target.value) })}
                  className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.showMinimap}
                  onChange={(e) => updateSettings({ showMinimap: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">显示代码缩略图</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {!isValid && validationErrors.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3">
          <div className="flex items-start">
            <AlertCircle size={16} className="text-red-400 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-red-800">YAML 语法错误</h4>
              <ul className="mt-1 text-sm text-red-700">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 编辑器 */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="yaml"
          theme={settings.theme === 'dark' ? 'vs-dark' : 'vs'}
          value={editorValue}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            readOnly,
            fontSize: settings.fontSize,
            minimap: { enabled: settings.showMinimap },
            wordWrap: settings.wordWrap,
            tabSize: settings.tabSize,
            insertSpaces: true,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            folding: true,
            lineNumbers: 'on',
            glyphMargin: true,
            contextmenu: true,
            mouseWheelZoom: true,
            formatOnPaste: true,
            formatOnType: true,
            autoIndent: 'full',
            bracketPairColorization: { enabled: true },
            guides: {
              indentation: true,
              bracketPairs: true
            },
            suggest: {
              showKeywords: true,
              showSnippets: true,
              showFunctions: true,
              showConstructors: true,
              showFields: true,
              showVariables: true,
              showClasses: true,
              showStructs: true,
              showInterfaces: true,
              showModules: true,
              showProperties: true,
              showEvents: true,
              showOperators: true,
              showUnits: true,
              showValues: true,
              showConstants: true,
              showEnums: true,
              showEnumMembers: true,
              showColors: true,
              showFiles: true,
              showReferences: true,
              showFolders: true,
              showTypeParameters: true
            }
          }}
        />
      </div>
    </div>
  )
}

export default PlaybookEditor