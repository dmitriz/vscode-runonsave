# 📝 Extension Blueprint (vscode-runonevents)

> 🧪 **Experimental Project**
> This blueprint is experimental and subject to change.

- 🔥 Fork `vscode-runonevents` (<https://github.com/dmitriz/vscode-runonevents>) to create a custom extension with minimal modifications.
- ♟️ Use webpack compressors in GitHub Actions and produce best optimizations
- ❌ Remove run on changes that duplicate save

## Specs

- This extension is based on [VS Code API](https://code.visualstudio.com/api/references/vscode-api).
- It follows VS Code's extension development pattern.

## Features 

This extension runs commands when events occur in VS Code (file opened, saved, or content changed).

### Configuration

A full configuration has the following structure:

```json
{
  "dmitriz.runonevents": {
    "autoClearConsole": true,
    "shell": "/bin/bash",
    "commands": [
      {
        "match": ".*\\.txt$",
        "notMatch": "node_modules",
        "cmd": "echo 'Hello ${file}'",
        "isAsync": true
      }
    ],
    "message": "Run command for ${file}",
    "messageAfter": "Command finished for ${file}",
    "showElapsed": true
  }
}
```

## Tasks

- Run Tests
  - `npm test`

## Next steps

- 🔥 Fork `vscode-runonevents` (<https://github.com/dmitriz/vscode-runonevents>) to create a custom extension with minimal modifications.
- ♟️ Make it better than the original with modern techniques and tools.

## Other ideas

- Throttling to prevent running commands too frequently on changes
- Support for Pattern Lab and other static site generators
- Add more event types beyond save and open
