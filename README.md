# dot-language-server [![CI](https://github.com/nikeee/dot-language-server/actions/workflows/CD.yml/badge.svg)](https://github.com/nikeee/dot-language-server/actions/workflows/CD.yml) ![Dependency Status](https://img.shields.io/librariesio/release/npm/dot-language-server) ![npm downloads](https://img.shields.io/npm/dm/dot-language-server)

A language Server for the DOT language/Graphviz.

## Prerequisites
- Node.js `>=18`
- `npm`

## Installation

```Shell
npm i -g dot-language-server
```

If you want to request or implement new features, head over to [dot-language-support](https://github.com/nikeee/dot-language-support).

## Features
#### Refactorings
![Refactorings Demo in Sublime Text](https://raw.githubusercontent.com/nikeee/dot-language-server/master/doc/refactoring.gif)

## Usage

### Visual Studio Code

TODO: There's an Extension for that.

### Sublime Text

1.  Install [LSP support](https://github.com/tomv564/LSP) via `Install Package` -> [`LSP`](https://packagecontrol.io/packages/LSP)
2.  Go to `Preferences: LSP Settings`
3.  Add this to clients:

```JSON
{
	"clients": {
		"dot-language-server": {
			"command": ["dot-language-server", "--stdio"],
			"enabled": true,
			"languageId": "dot",
			"scopes": ["source.dot"],
			"syntaxes": ["Packages/Graphviz/DOT.sublime-syntax"]
		}
	}
}
```
**Note for Windows Users**: You have to append `.cmd` to the first entry in the `command` array (or, if possible, enable shell execution).

### Emacs
For Emacs users, you need to use `lsp-mode` which supports the DOT Language Server out of the box.

...and you're done!
