import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalProps } from './types';
import { getThemeByName } from './themes';
import '@xterm/xterm/css/xterm.css';
import './Terminal.css';

export interface TerminalRef {
  terminal: XTerm | null;
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  focus: () => void;
  fit: () => void;
  resize: (cols: number, rows: number) => void;
  selectAll: () => void;
  getSelection: () => string;
  paste: (text: string) => void;
  copy: () => string;
}

const Terminal = forwardRef<TerminalRef, TerminalProps>(({
  className = '',
  theme = 'default',
  onReady,
  onData,
  onResize,
  onCopy,
  onPaste,
  options = {}
}, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isInitializedRef = useRef(false);
  
  // 使用 ref 存储回调函数和 options，避免依赖变化导致重新创建终端
  const callbacksRef = useRef({
    onReady,
    onData,
    onResize,
    onCopy,
    onPaste
  });
  
  // 使用 ref 存储 options 和初始主题，只在首次渲染时使用
  const optionsRef = useRef(options);
  const initialThemeRef = useRef(theme);
  
  // 更新回调 ref
  useEffect(() => {
    callbacksRef.current = {
      onReady,
      onData,
      onResize,
      onCopy,
      onPaste
    };
  }, [onReady, onData, onResize, onCopy, onPaste]);

  // 处理键盘事件
  const handleKeyboardEvents = useCallback((terminal: XTerm) => {
    // 处理复制粘贴快捷键
    terminal.attachCustomKeyEventHandler((event) => {
      // Ctrl+C 复制选中文本
      if (event.ctrlKey && event.code === 'KeyC' && event.type === 'keydown') {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection).then(() => {
            callbacksRef.current.onCopy?.(selection);
          }).catch(err => {
            console.warn('Failed to copy to clipboard:', err);
          });
          return false; // 阻止默认行为
        }
      }
      
      // Ctrl+V 粘贴文本
      if (event.ctrlKey && event.code === 'KeyV' && event.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          if (text) {
            callbacksRef.current.onData?.(text);
            callbacksRef.current.onPaste?.(text);
          }
        }).catch(err => {
          console.warn('Failed to read from clipboard:', err);
        });
        return false; // 阻止默认行为
      }
      
      // Ctrl+A 全选
      if (event.ctrlKey && event.code === 'KeyA' && event.type === 'keydown') {
        terminal.selectAll();
        return false; // 阻止默认行为
      }
      
      return true; // 允许其他按键正常处理
    });
  }, []);

  // 处理右键菜单
  const handleContextMenu = useCallback((terminal: XTerm, element: HTMLElement) => {
    element.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      
      // 创建简单的右键菜单
      const menu = document.createElement('div');
      menu.className = 'terminal-context-menu';
      menu.style.cssText = `
        position: fixed;
        top: ${event.clientY}px;
        left: ${event.clientX}px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
        min-width: 120px;
      `;
      
      const selection = terminal.getSelection();
      
      // 复制选项
      if (selection) {
        const copyItem = document.createElement('div');
        copyItem.textContent = '复制';
        copyItem.className = 'terminal-menu-item';
        copyItem.style.cssText = `
          padding: 8px 12px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
        `;
        copyItem.addEventListener('click', () => {
          navigator.clipboard.writeText(selection).then(() => {
            callbacksRef.current.onCopy?.(selection);
          }).catch(err => {
            console.warn('Failed to copy to clipboard:', err);
          });
          document.body.removeChild(menu);
        });
        menu.appendChild(copyItem);
      }
      
      // 粘贴选项
      const pasteItem = document.createElement('div');
      pasteItem.textContent = '粘贴';
      pasteItem.className = 'terminal-menu-item';
      pasteItem.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
      `;
      pasteItem.addEventListener('click', () => {
        navigator.clipboard.readText().then(text => {
          if (text) {
            callbacksRef.current.onData?.(text);
            callbacksRef.current.onPaste?.(text);
          }
        }).catch(err => {
          console.warn('Failed to read from clipboard:', err);
        });
        document.body.removeChild(menu);
      });
      menu.appendChild(pasteItem);
      
      // 全选选项
      const selectAllItem = document.createElement('div');
      selectAllItem.textContent = '全选';
      selectAllItem.className = 'terminal-menu-item';
      selectAllItem.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
      `;
      selectAllItem.addEventListener('click', () => {
        terminal.selectAll();
        document.body.removeChild(menu);
      });
      menu.appendChild(selectAllItem);
      
      // 添加样式
      const style = document.createElement('style');
      style.textContent = `
        .terminal-menu-item:hover {
          background-color: #f5f5f5;
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(menu);
      
      // 点击其他地方关闭菜单
      const closeMenu = (e: MouseEvent) => {
        if (!menu.contains(e.target as Node)) {
          document.body.removeChild(menu);
          document.head.removeChild(style);
          document.removeEventListener('click', closeMenu);
        }
      };
      
      setTimeout(() => {
        document.addEventListener('click', closeMenu);
      }, 0);
    });
  }, []);

  useImperativeHandle(ref, () => ({
    terminal: xtermRef.current,
    write: (data: string) => {
      xtermRef.current?.write(data);
    },
    writeln: (data: string) => {
      xtermRef.current?.writeln(data);
    },
    clear: () => {
      xtermRef.current?.clear();
    },
    focus: () => {
      xtermRef.current?.focus();
    },
    fit: () => {
      fitAddonRef.current?.fit();
    },
    resize: (cols: number, rows: number) => {
      xtermRef.current?.resize(cols, rows);
    },
    selectAll: () => {
      xtermRef.current?.selectAll();
    },
    getSelection: () => {
      return xtermRef.current?.getSelection() || '';
    },
    paste: (text: string) => {
      if (xtermRef.current) {
        // 将粘贴的文本发送给终端
        callbacksRef.current.onData?.(text);
      }
    },
    copy: () => {
      return xtermRef.current?.getSelection() || '';
    }
  }));

  useEffect(() => {
    if (!terminalRef.current || isInitializedRef.current) return;
    
    isInitializedRef.current = true;

    // 获取主题配置（使用初始主题）
    const themeConfig = getThemeByName(initialThemeRef.current);
    
    // 创建终端实例
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      rows: 24,
      cols: 80,
      scrollback: 1000,
      allowProposedApi: true, // 允许使用实验性 API
      ...themeConfig.options,
      ...optionsRef.current
    });

    // 创建插件
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    // 加载插件
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // 打开终端
    terminal.open(terminalRef.current);

    // 自适应大小
    fitAddon.fit();

    // 保存引用
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // 设置键盘事件处理
    handleKeyboardEvents(terminal);
    
    // 设置右键菜单
    handleContextMenu(terminal, terminalRef.current);

    // 监听数据输入
    terminal.onData((data) => {
      callbacksRef.current.onData?.(data);
    });

    // 监听大小变化
    terminal.onResize(({ cols, rows }) => {
      callbacksRef.current.onResize?.(cols, rows);
    });

    // 监听窗口大小变化
    const handleResize = () => {
      setTimeout(() => {
        fitAddon.fit();
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    // 监听容器大小变化（使用 ResizeObserver）
    let resizeObserver: ResizeObserver | null = null;
    if (terminalRef.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        setTimeout(() => {
          fitAddon.fit();
        }, 100);
      });
      resizeObserver.observe(terminalRef.current);
    }

    // 通知组件就绪
    callbacksRef.current.onReady?.(terminal);

    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      isInitializedRef.current = false;
    };
  }, [handleKeyboardEvents, handleContextMenu]);

  // 响应主题变化 - 不重新创建终端，只更新主题
  useEffect(() => {
    if (xtermRef.current && isInitializedRef.current) {
      const themeConfig = getThemeByName(theme);
      if (themeConfig.options.theme) {
        xtermRef.current.options.theme = themeConfig.options.theme;
      }
    }
  }, [theme]);

  return (
    <div 
      ref={terminalRef} 
      className={`terminal-container ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  );
});

Terminal.displayName = 'Terminal';

export default Terminal;