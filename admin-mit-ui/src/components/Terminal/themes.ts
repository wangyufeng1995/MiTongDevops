import { TerminalTheme } from './types';

export const terminalThemes: TerminalTheme[] = [
  {
    name: 'default',
    displayName: '默认深黑',
    options: {
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selection: '#388bfd33',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc'
      }
    }
  },
  {
    name: 'dark',
    displayName: 'VS Code 深色',
    options: {
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#aeafad',
        cursorAccent: '#1e1e1e',
        selection: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      }
    }
  },
  {
    name: 'dracula',
    displayName: 'Dracula',
    options: {
      theme: {
        background: '#282a36',
        foreground: '#f8f8f2',
        cursor: '#f8f8f2',
        cursorAccent: '#282a36',
        selection: '#44475a',
        black: '#21222c',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff'
      }
    }
  },
  {
    name: 'monokai',
    displayName: 'Monokai Pro',
    options: {
      theme: {
        background: '#2d2a2e',
        foreground: '#fcfcfa',
        cursor: '#fcfcfa',
        cursorAccent: '#2d2a2e',
        selection: '#403e41',
        black: '#403e41',
        red: '#ff6188',
        green: '#a9dc76',
        yellow: '#ffd866',
        blue: '#fc9867',
        magenta: '#ab9df2',
        cyan: '#78dce8',
        white: '#fcfcfa',
        brightBlack: '#727072',
        brightRed: '#ff6188',
        brightGreen: '#a9dc76',
        brightYellow: '#ffd866',
        brightBlue: '#fc9867',
        brightMagenta: '#ab9df2',
        brightCyan: '#78dce8',
        brightWhite: '#fcfcfa'
      }
    }
  },
  {
    name: 'nord',
    displayName: 'Nord',
    options: {
      theme: {
        background: '#2e3440',
        foreground: '#d8dee9',
        cursor: '#d8dee9',
        cursorAccent: '#2e3440',
        selection: '#434c5e',
        black: '#3b4252',
        red: '#bf616a',
        green: '#a3be8c',
        yellow: '#ebcb8b',
        blue: '#81a1c1',
        magenta: '#b48ead',
        cyan: '#88c0d0',
        white: '#e5e9f0',
        brightBlack: '#4c566a',
        brightRed: '#bf616a',
        brightGreen: '#a3be8c',
        brightYellow: '#ebcb8b',
        brightBlue: '#81a1c1',
        brightMagenta: '#b48ead',
        brightCyan: '#8fbcbb',
        brightWhite: '#eceff4'
      }
    }
  },
  {
    name: 'one-dark',
    displayName: 'One Dark',
    options: {
      theme: {
        background: '#282c34',
        foreground: '#abb2bf',
        cursor: '#528bff',
        cursorAccent: '#282c34',
        selection: '#3e4451',
        black: '#5c6370',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
        brightBlack: '#4b5263',
        brightRed: '#be5046',
        brightGreen: '#98c379',
        brightYellow: '#d19a66',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff'
      }
    }
  }
];

export const getThemeByName = (name: string): TerminalTheme => {
  return terminalThemes.find(theme => theme.name === name) || terminalThemes[0];
};