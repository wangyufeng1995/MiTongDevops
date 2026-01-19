import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { TerminalContainer } from '../Terminal';
import { TerminalRef } from '../Terminal/Terminal';
import { useWebShell } from '../../hooks/useWebShell';
import { WebSocketState } from '../../services/webshell';

export interface WebShellTerminalProps {
  hostId: number;
  className?: string;
  autoConnect?: boolean;
  theme?: string;
  onConnectionStateChange?: (state: WebSocketState) => void;
  onError?: (error: any) => void;
  onThemeChange?: (theme: string) => void;
}

export interface WebShellTerminalRef {
  connectToHost: () => Promise<void>;
  disconnectFromHost: () => void;
  clearTerminal: () => void;
  focusTerminal: () => void;
  connectionState: WebSocketState;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  session: any;
  error: string | null;
}

const WebShellTerminal = forwardRef<WebShellTerminalRef, WebShellTerminalProps>(({
  hostId,
  className = '',
  autoConnect = false,
  theme = 'default',
  onConnectionStateChange,
  onError,
  onThemeChange
}, ref) => {
  const terminalRef = useRef<TerminalRef>(null);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  
  // 用于防抖的 resize 定时器和上次尺寸
  const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSizeRef = useRef<{ cols: number; rows: number } | null>(null);
  
  // 防止重复初始化
  const hasInitializedRef = useRef(false);
  
  // 使用 ref 存储 terminalRef 和 isTerminalReady 的最新值
  const terminalStateRef = useRef({ isTerminalReady: false });
  terminalStateRef.current.isTerminalReady = isTerminalReady;

  // 处理 WebShell 数据 - 使用 ref 避免依赖变化
  const handleWebShellData = useCallback((data: string) => {
    if (terminalRef.current && terminalStateRef.current.isTerminalReady) {
      terminalRef.current.write(data);
    }
  }, []);

  // 处理连接状态变化
  const handleConnectionStateChange = useCallback((state: WebSocketState) => {
    onConnectionStateChange?.(state);

    if (!terminalRef.current || !terminalStateRef.current.isTerminalReady) return;

    switch (state) {
      case WebSocketState.CONNECTED:
        terminalRef.current.writeln('\r\n✓ WebShell 连接成功!');
        terminalRef.current.writeln('正在初始化终端会话...\r\n');
        break;
      
      case WebSocketState.DISCONNECTED:
        terminalRef.current.writeln('\r\n✗ WebShell 连接已断开');
        break;
      
      case WebSocketState.ERROR:
        terminalRef.current.writeln('\r\n✗ WebShell 连接错误');
        break;
      
      case WebSocketState.RECONNECTING:
        terminalRef.current.writeln(`\r\n⟳ 正在重连...`);
        break;
    }
  }, [onConnectionStateChange]);

  // 处理 WebShell 错误
  const handleWebShellError = useCallback((err: any) => {
    console.error('WebShell error:', err);
    onError?.(err);
    if (terminalRef.current && terminalStateRef.current.isTerminalReady) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      terminalRef.current.writeln(`\r\n✗ 错误: ${errorMessage}`);
    }
  }, [onError]);

  const {
    connectionState,
    isConnected,
    isConnecting,
    isReconnecting,
    session,
    reconnectAttempt,
    reconnectDelay,
    connect,
    disconnect,
    sendData,
    sendResize,
    error
  } = useWebShell({
    hostId,
    autoConnect,
    onTerminalData: handleWebShellData,
    onConnectionStateChange: handleConnectionStateChange,
    onError: handleWebShellError
  });

  // 处理终端就绪
  const handleTerminalReady = useCallback((terminal: any) => {
    // 防止重复初始化
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;
    setIsTerminalReady(true);
    
    // 显示欢迎信息
    terminal.writeln('\x1b[1;36m╔══════════════════════════════════════╗\x1b[0m');
    terminal.writeln('\x1b[1;36m║\x1b[0m      \x1b[1;33mWebShell 终端\x1b[0m                   \x1b[1;36m║\x1b[0m');
    terminal.writeln('\x1b[1;36m╚══════════════════════════════════════╝\x1b[0m');
    terminal.writeln('');
    terminal.writeln(`\x1b[90m主机 ID: ${hostId}\x1b[0m`);
    if (!autoConnect) {
      terminal.writeln('\x1b[33m点击"连接"按钮开始连接到远程主机\x1b[0m');
    }
    terminal.writeln('');
  }, [hostId, autoConnect]);

  // 处理终端数据输入 - 直接发送到 SSH 服务器
  const handleTerminalData = useCallback((data: string) => {
    // 如果未连接，显示提示
    if (!isConnected) {
      if (data === '\r') {
        if (terminalRef.current) {
          terminalRef.current.writeln('');
          terminalRef.current.writeln('\x1b[31m请先连接到 WebShell 服务\x1b[0m');
        }
      }
      return;
    }

    // 直接发送所有数据到 SSH 服务器（包括上下箭头等特殊键）
    sendData(data);
  }, [isConnected, sendData]);

  // 处理终端大小调整 - 添加防抖，避免频繁触发
  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    // 检查尺寸是否真的变化了
    if (lastSizeRef.current && 
        lastSizeRef.current.cols === cols && 
        lastSizeRef.current.rows === rows) {
      return;
    }
    
    // 清除之前的定时器
    if (resizeTimerRef.current) {
      clearTimeout(resizeTimerRef.current);
    }
    
    // 防抖：300ms 后才真正发送
    resizeTimerRef.current = setTimeout(() => {
      lastSizeRef.current = { cols, rows };
      
      // 如果已连接，发送大小调整信息到 WebShell
      if (isConnected) {
        sendResize(cols, rows);
      }
    }, 300);
  }, [isConnected, sendResize]);

  // 处理复制
  const handleCopy = useCallback((_text: string) => {
    // 复制成功，无需日志
  }, []);

  // 处理粘贴
  const handlePaste = useCallback((_text: string) => {
    // 粘贴的文本会通过 handleTerminalData 处理
  }, []);

  // 处理主题变化
  const handleThemeChange = useCallback((newTheme: string) => {
    onThemeChange?.(newTheme);
  }, [onThemeChange]);

  // 公开的方法
  const connectToHost = useCallback(async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  }, [connect]);

  const disconnectFromHost = useCallback(() => {
    disconnect();
    if (terminalRef.current && isTerminalReady) {
      terminalRef.current.writeln('\r\n\x1b[33m已断开连接\x1b[0m');
    }
  }, [disconnect, isTerminalReady]);

  const clearTerminal = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const focusTerminal = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  // 自动聚焦终端
  useEffect(() => {
    if (isTerminalReady && isConnected) {
      const timer = setTimeout(() => {
        focusTerminal();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isTerminalReady, isConnected, focusTerminal]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
    };
  }, []);

  // 暴露控制方法给父组件
  useImperativeHandle(ref, () => ({
    connectToHost,
    disconnectFromHost,
    clearTerminal,
    focusTerminal,
    connectionState,
    isConnected,
    isConnecting,
    isReconnecting,
    session,
    error
  }), [connectToHost, disconnectFromHost, clearTerminal, focusTerminal, connectionState, isConnected, isConnecting, isReconnecting, session, error]);

  // 终端配置 - 使用 useMemo 避免重复创建
  const terminalOptions = useMemo(() => ({
    fontSize: 14,
    rows: 30,
    cols: 100,
    cursorBlink: true,
    allowProposedApi: true
  }), []);

  return (
    <div className={`webshell-terminal h-full ${className}`}>
      <TerminalContainer
        ref={terminalRef}
        className="w-full h-full"
        theme={theme}
        showThemeSelector={false}
        showCopyPaste={false}
        showToolbar={false}
        onReady={handleTerminalReady}
        onData={handleTerminalData}
        onResize={handleTerminalResize}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onThemeChange={handleThemeChange}
        options={terminalOptions}
      />
    </div>
  );
});

WebShellTerminal.displayName = 'WebShellTerminal';

export default WebShellTerminal;