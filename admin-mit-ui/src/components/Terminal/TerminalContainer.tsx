import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Settings, Palette, Copy, Clipboard, RotateCcw, Maximize2 } from 'lucide-react';
import Terminal, { TerminalRef } from './Terminal';
import { TerminalContainerProps } from './types';
import { terminalThemes } from './themes';

const TerminalContainer = forwardRef<TerminalRef, TerminalContainerProps>((props, ref) => {
  const {
    className = '',
    theme = 'default',
    showThemeSelector = true,
    showCopyPaste = true,
    showToolbar = true,
    onThemeChange,
    onReady,
    onData,
    onResize,
    onCopy,
    onPaste,
    options = {}
  } = props;

  const [currentTheme, setCurrentTheme] = useState(theme);
  const [showSettings, setShowSettings] = useState(false);
  const terminalRef = useRef<TerminalRef>(null);

  // 响应外部 theme prop 变化
  useEffect(() => {
    setCurrentTheme(theme);
  }, [theme]);

  // 转发 ref 到内部的 Terminal 组件
  useImperativeHandle(ref, () => terminalRef.current!, []);

  const handleThemeChange = (newTheme: string) => {
    setCurrentTheme(newTheme);
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  const handleClear = () => {
    terminalRef.current?.clear();
  };

  const handleFit = () => {
    terminalRef.current?.fit();
  };

  const handleCopy = async () => {
    const selection = terminalRef.current?.getSelection();
    if (selection) {
      try {
        await navigator.clipboard.writeText(selection);
        if (onCopy) {
          onCopy(selection);
        }
        console.log('Text copied to clipboard');
      } catch (err) {
        console.warn('Failed to copy to clipboard:', err);
      }
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        terminalRef.current?.paste(text);
        if (onPaste) {
          onPaste(text);
        }
      }
    } catch (err) {
      console.warn('Failed to read from clipboard:', err);
    }
  };

  const handleSelectAll = () => {
    terminalRef.current?.selectAll();
  };

  return (
    <div className={`terminal-wrapper bg-gray-900 rounded-lg overflow-hidden h-full flex flex-col ${className}`}>
      {/* 终端工具栏 */}
      {showToolbar && (
        <div className="terminal-toolbar bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-gray-300 text-sm font-medium ml-4">Terminal</span>
          </div>
          
          <div className="flex items-center space-x-2">
            {showCopyPaste && (
              <>
                <button
                  onClick={handleCopy}
                  className="text-gray-400 hover:text-white px-2 py-1 rounded text-sm flex items-center space-x-1"
                  title="复制选中文本 (Ctrl+C)"
                >
                  <Copy size={14} />
                  <span>复制</span>
                </button>
                <button
                  onClick={handlePaste}
                  className="text-gray-400 hover:text-white px-2 py-1 rounded text-sm flex items-center space-x-1"
                  title="粘贴 (Ctrl+V)"
                >
                  <Clipboard size={14} />
                  <span>粘贴</span>
                </button>
                <button
                  onClick={handleSelectAll}
                  className="text-gray-400 hover:text-white px-2 py-1 rounded text-sm"
                  title="全选 (Ctrl+A)"
                >
                  全选
                </button>
                <div className="h-4 border-l border-gray-600"></div>
              </>
            )}
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-white px-2 py-1 rounded text-sm flex items-center space-x-1"
              title="清空终端"
            >
              <RotateCcw size={14} />
              <span>清空</span>
            </button>
            <button
              onClick={handleFit}
              className="text-gray-400 hover:text-white px-2 py-1 rounded text-sm flex items-center space-x-1"
              title="自适应大小"
            >
              <Maximize2 size={14} />
              <span>适应</span>
            </button>
            {showThemeSelector && (
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-gray-400 hover:text-white p-1 rounded"
                  title="设置"
                >
                  <Settings size={16} />
                </button>
                
                {showSettings && (
                  <div className="absolute right-0 top-8 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10 min-w-48">
                    <div className="p-3">
                      <div className="flex items-center space-x-2 mb-3">
                        <Palette size={16} className="text-gray-400" />
                        <span className="text-gray-300 text-sm font-medium">主题选择</span>
                      </div>
                      <div className="space-y-1">
                        {terminalThemes.map((themeOption) => (
                          <button
                            key={themeOption.name}
                            onClick={() => {
                              handleThemeChange(themeOption.name);
                              setShowSettings(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                              currentTheme === themeOption.name
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {themeOption.displayName}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 终端内容区域 - 使用 flex-1 填充剩余空间 */}
      <div className="terminal-content flex-1 min-h-0">
        <Terminal
          ref={terminalRef}
          theme={currentTheme}
          onReady={onReady}
          onData={onData}
          onResize={onResize}
          onCopy={onCopy}
          onPaste={onPaste}
          options={options}
          className="h-full"
        />
      </div>
    </div>
  );
});

TerminalContainer.displayName = 'TerminalContainer';

export default TerminalContainer;
