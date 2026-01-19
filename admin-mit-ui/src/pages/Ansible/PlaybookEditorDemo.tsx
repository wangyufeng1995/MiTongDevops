/**
 * Ansible Playbook 编辑器演示页面
 * 用于测试 PlaybookEditor 组件功能
 */
import React, { useState } from 'react'
import { PlaybookEditor } from '../../components/Ansible'

const PlaybookEditorDemo: React.FC = () => {
  const [content, setContent] = useState(`---
- name: Example Playbook
  hosts: all
  become: yes
  vars:
    example_var: "Hello World"
  
  tasks:
    - name: Print message
      debug:
        msg: "{{ example_var }}"
    
    - name: Install packages
      package:
        name:
          - curl
          - wget
          - vim
        state: present`)

  const [isValid, setIsValid] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    console.log('Content changed:', newContent)
  }

  const handleSave = (content: string) => {
    console.log('Saving content:', content)
    alert('内容已保存到控制台')
  }

  const handleValidate = (valid: boolean, validationErrors?: string[]) => {
    setIsValid(valid)
    setErrors(validationErrors || [])
    console.log('Validation result:', { valid, errors: validationErrors })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ansible Playbook 编辑器演示
          </h1>
          <p className="text-gray-600">
            测试 YAML 在线编辑器功能，包含语法高亮、验证、代码自动补全和编辑器工具栏
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-lg font-medium text-gray-900 mb-2">编辑器状态</h2>
            <div className="flex items-center space-x-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isValid ? '语法正确' : '语法错误'}
              </div>
              <div className="text-sm text-gray-600">
                内容长度: {content.length} 字符
              </div>
            </div>
            {!isValid && errors.length > 0 && (
              <div className="mt-2">
                <ul className="text-sm text-red-600">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <PlaybookEditor
            value={content}
            onChange={handleContentChange}
            onSave={handleSave}
            onValidate={handleValidate}
            height="600px"
            showToolbar={true}
            showMinimap={true}
            className="border border-gray-300 rounded-lg overflow-hidden"
          />

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">功能说明</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 支持 YAML 语法高亮和自动补全</li>
              <li>• 提供 Ansible 关键词和模块补全</li>
              <li>• 实时语法验证和错误提示</li>
              <li>• 支持查找替换、缩放、全屏等功能</li>
              <li>• 可导入导出 YAML 文件</li>
              <li>• 支持主题切换和编辑器设置</li>
              <li>• 快捷键支持：Ctrl+S 保存，Ctrl+F 查找，Ctrl+Shift+F 替换</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlaybookEditorDemo