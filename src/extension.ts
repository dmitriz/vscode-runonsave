import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import type { ICommand, IConfig, IExecResult, Document } from './model';

function isValidUri(uri: vscode.Uri): boolean {
  try {
    // Ensure the URI is valid and points to a file
    return uri.scheme === 'file' && !!uri.fsPath;
  } catch {
    return false;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const extension = new RunOnSaveExtension(context);
  extension.showOutputMessage();

  vscode.workspace.onDidChangeConfiguration(() => {
    const disposeStatus = extension.showStatusMessage(
      'Run On Save: Reloading config.',
    );
    extension.loadConfig();
    disposeStatus.dispose();
  });

  vscode.commands.registerCommand(
    'extension.emeraldwalk.enableRunOnSave',
    () => {
      extension.isEnabled = true;
    },
  );

  vscode.commands.registerCommand(
    'extension.emeraldwalk.disableRunOnSave',
    () => {
      extension.isEnabled = false;
    },
  );

  function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
    let timeout: NodeJS.Timeout | null = null;
    return ((...args: any[]) => {
      if (timeout) {clearTimeout(timeout);}
      timeout = setTimeout(async () => {
        try {
          await fn(...args);
        } catch (error) {
          console.error('Error executing debounced function:', error);
        }
      }, delay);
    }) as T;
  }

  const debouncedRunCommands = debounce(async (document: vscode.TextDocument) => {
    try {
      await extension.runCommands(document);
    } catch (error) {
      console.error('Error executing runCommands:', error);
    }
  }, 300);

  // Handle onDidOpenTextDocument event with debouncing and error handling
  vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
    extension.showOutputMessage(`File opened: ${document.fileName}`);
    debouncedRunCommands(document);
  });

  // Handle onDidSaveTextDocument event with debouncing and error handling
  vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    extension.showOutputMessage(`File saved: ${document.fileName}`);
    debouncedRunCommands(document);
  });

  // Handle onDidChangeTextDocument event with debouncing and error handling
  vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
    extension.showOutputMessage(`File changed: ${event.document.fileName}`);
    debouncedRunCommands(event.document);
  });

  // Keep notebook support but we're not modifying it as it's not mentioned in the issue
  vscode.workspace.onDidSaveNotebookDocument((document: vscode.NotebookDocument) => {
    extension.runCommands(document);
  });
}

class RunOnSaveExtension {
  private _outputChannel: vscode.OutputChannel;
  private _context: vscode.ExtensionContext;
  private _config: IConfig;
  private _stateLock: Promise<void> = Promise.resolve();

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._outputChannel = vscode.window.createOutputChannel('Run On Save');
    this.loadConfig();
  }

  private async _withLock<T>(fn: () => Promise<T>): Promise<T> {
    const release = this._stateLock;
    let resolveLock: () => void;
    this._stateLock = new Promise((resolve) => (resolveLock = resolve));

    try {
      await release;
      return await fn();
    } finally {
      resolveLock();
    }
  }

  /** Recursive call to run commands. */
  private async _runCommands(
    commandsOrig: Array<ICommand>,
    document: Document,
  ): Promise<void> {
    const cmds = [...commandsOrig];

    const startMs = performance.now();
    let pendingCount = cmds.length;

    const onCmdComplete = (cfg: ICommand, res: IExecResult) => {
      --pendingCount;
      this.showOutputMessageIfDefined(cfg.messageAfter);
      this.showOutputMessageIfDefined(
        cfg.showElapsed && `Elapsed ms: ${res.elapsedMs}`,
      );

      if (cfg.autoShowOutputPanel === 'error' && res.statusCode !== 0) {
        this._outputChannel.show(true);
      }

      if (pendingCount === 0) {
        this.showOutputMessageIfDefined(this._config.messageAfter);

        const totalElapsedMs = performance.now() - startMs;
        this.showOutputMessageIfDefined(
          this._config.showElapsed && `Total elapsed ms: ${totalElapsedMs}`,
        );
      }
    };

    this.showOutputMessageIfDefined(this._config?.message);

    while (cmds.length > 0) {
      const cfg = cmds.shift();

      this.showOutputMessageIfDefined(cfg.message);

      if (cfg.autoShowOutputPanel === 'always') {
        this._outputChannel.show(true);
      }

      if (cfg.cmd == null) {
        onCmdComplete(cfg, { elapsedMs: 0, statusCode: 0 });
        continue;
      }

      const cmdPromise = this._getExecPromise(cfg, document);

      // TODO: `isAsync` should probably be named something like `isParallel`,
      // but will have to think about how to not make that a breaking change
      const isParallel = cfg.isAsync;

      if (isParallel) {
        // If this is marked as parallel, don't `await` the promise
        void cmdPromise.then((elapsedMs) => {
          onCmdComplete(cfg, elapsedMs);
        });

        continue;
      }

      // for serial commands wait till complete
      const elapsedMs = await cmdPromise;

      onCmdComplete(cfg, elapsedMs);
    }
  }

  private _getExecPromise(
    cfg: ICommand,
    document: Document,
  ): Promise<IExecResult> {
    return new Promise((resolve) => {
      const startMs = performance.now();

      const child = exec(cfg.cmd, this._getExecOption(document));
      child.stdout.on('data', (data) => this._outputChannel.append(data));
      child.stderr.on('data', (data) => this._outputChannel.append(data));
      child.on('error', (e) => {
        this.showOutputMessage(e.message);
        // Don't reject since we want to be able to chain and handle
        // message properties even if this errors
        // Returns a status code different than zero to optionally show output
        // panel with error
        resolve({ elapsedMs: performance.now() - startMs, statusCode: 1 });
      });
      child.on('exit', (statusCode) => {
        resolve({ elapsedMs: performance.now() - startMs, statusCode });
      });
    });
  }

  private _getExecOption(document: Document): {
    shell: string;
    cwd: string;
  } {
    return {
      shell: this.shell,
      cwd: this._getWorkspaceFolderPath(document.uri),
    };
  }

  private _getWorkspaceFolderPath(uri: vscode.Uri) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

    // NOTE: rootPath seems to be deprecated but seems like the best fallback so that
    // single project workspaces still work. If I come up with a better option, I'll change it.
    return workspaceFolder
      ? workspaceFolder.uri.fsPath
      : vscode.workspace.rootPath;
  }

  public get isEnabled(): boolean {
    return !!this._context.globalState.get('isEnabled', true);
  }
  public set isEnabled(value: boolean) {
    this._context.globalState.update('isEnabled', value);
    this.showOutputMessage();
  }

  public get shell(): string {
    return this._config.shell;
  }

  public get autoClearConsole(): boolean {
    return !!this._config.autoClearConsole;
  }

  public get commands(): Array<ICommand> {
    return this._config.commands || [];
  }

  public loadConfig(): void {
    this._config = <IConfig>(
      (<any>vscode.workspace.getConfiguration('emeraldwalk.runonsave'))
    );
  }

  /**
   * Show message in output channel
   */
  public showOutputMessage(message?: string): void {
    message =
      message || `Run On Save ${this.isEnabled ? 'enabled' : 'disabled'}.`;
    this._outputChannel.appendLine(message);
  }

  /**
   * Show message in output channel if it is defined and not `false`.
   */
  public showOutputMessageIfDefined(message?: string | null | false): void {
    if (!message) {
      return;
    }

    this.showOutputMessage(message);
  }

  /**
   * Show message in status bar and output channel.
   * Return a disposable to remove status bar message.
   */
  public showStatusMessage(message: string): vscode.Disposable {
    this.showOutputMessage(message);
    return vscode.window.setStatusBarMessage(message);
  }

  public async runCommands(document: Document): Promise<void> {
    if (this.autoClearConsole) {
      this._outputChannel.clear();
    }

    if (!this.isEnabled || this.commands.length === 0) {
      this.showOutputMessage();
      return;
    }

    const validatedUri = isValidUri(document.uri);
    if (!validatedUri) {
      console.error('Invalid document URI:', document.uri);
      return;
    }

    const match = (pattern: string) =>
      pattern &&
      pattern.length > 0 &&
      new RegExp(pattern).test(document.uri.fsPath);

    const commandConfigs = this.commands.filter((cfg) => {
      const matchPattern = cfg.match || '';
      const negatePattern = cfg.notMatch || '';

      const isMatch = matchPattern.length === 0 || match(matchPattern);
      const isNegate = negatePattern.length > 0 && match(negatePattern);

      return !isNegate && isMatch;
    });

    if (commandConfigs.length === 0) {
      return;
    }

    await this._withLock(async () => {
      const commands: Array<ICommand> = [];
      for (const cfg of commandConfigs) {
        let cmdStr = cfg.cmd;

        const extName = path.extname(document.uri.fsPath);
        const workspaceFolderPath = this._getWorkspaceFolderPath(document.uri);
        const relativeFile = path.relative(
          workspaceFolderPath,
          document.uri.fsPath,
        );

        if (cmdStr) {
          cmdStr = cmdStr.replace(/\${file}/g, `${document.uri.fsPath}`);
          cmdStr = cmdStr.replace(/\${workspaceRoot}/g, workspaceFolderPath);
          cmdStr = cmdStr.replace(/\${workspaceFolder}/g, workspaceFolderPath);
          cmdStr = cmdStr.replace(
            /\${fileBasename}/g,
            path.basename(document.uri.fsPath),
          );
          cmdStr = cmdStr.replace(
            /\${fileDirname}/g,
            path.dirname(document.uri.fsPath),
          );
          cmdStr = cmdStr.replace(/\${fileExtname}/g, extName);
          cmdStr = cmdStr.replace(
            /\${fileBasenameNoExt}/g,
            path.basename(document.uri.fsPath, extName),
          );
          cmdStr = cmdStr.replace(/\${relativeFile}/g, relativeFile);
          cmdStr = cmdStr.replace(/\${cwd}/g, process.cwd());

          cmdStr = cmdStr.replace(
            /\${env\.([^}]+)}/g,
            (sub: string, envName: string) => {
              return process.env[envName];
            },
          );
        }

        commands.push({
          message: cfg.message,
          messageAfter: cfg.messageAfter,
          cmd: cmdStr,
          isAsync: !!cfg.isAsync,
          showElapsed: cfg.showElapsed,
          autoShowOutputPanel: cfg.autoShowOutputPanel,
        });
      }

      await this._runCommands(commands, document);
    });
  }
}
