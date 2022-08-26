# dot-language-server
> [![Build Status](https://travis-ci.com/nikeee/dot-language-server.svg?branch=master)](https://travis-ci.com/nikeee/dot-language-server) ![Dependency Status](https://david-dm.org/nikeee/dot-language-server.svg) [![npm version](https://badge.fury.io/js/dot-language-server.svg)](https://www.npmjs.com/package/dot-language-server)

A language Server for the DOT language/Graphviz.

## Prerequisites

* Node.js `>=16`
* `npm`

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

...and you're done!
