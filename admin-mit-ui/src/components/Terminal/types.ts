import { ITerminalOptions } from '@xterm/xterm';

export interface TerminalTheme {
  name: string;
  displayName: string;
  options: Partial<ITerminalOptions>;
}

export interface TerminalProps {
  className?: string;
  theme?: string;
  onReady?: (terminal: any) => void;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onCopy?: (text: string) => void;
  onPaste?: (text: string) => void;
  options?: Partial<ITerminalOptions>;
}

export interface TerminalContainerProps {
  className?: string;
  theme?: string;
  showThemeSelector?: boolean;
  showCopyPaste?: boolean;
  showToolbar?: boolean;
  onThemeChange?: (theme: string) => void;
  onReady?: (terminal: any) => void;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onCopy?: (text: string) => void;
  onPaste?: (text: string) => void;
  options?: Partial<ITerminalOptions>;
}