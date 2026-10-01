# RPG Maker 9000

RPG Maker 9000 is a free and open source RPG creation tool based on RPG Maker MV and MZ.

It includes a desktop editor for making tile based RPGs and uses an HTML5 and Canvas 2D runtime for running games.

## Features

- Full compatibility with existing MZ/MV projects.
- Tile based map editor
- Pencil, rectangle, ellipse, fill, and shadow drawing tools
- Map, Event, and Region editing modes
- Map tree for organizing maps
- Database editor
- Event system
- Event search
- JavaScript plugin support
- Sound testing
- Resource manager
- Battle testing
- In-editor playtesting
- Project saving and backups
- Optional automatic saving
- Undo and redo
- Map zoom and grid controls
- Game deployment tools
- HTML5 game runtime
- RPG Maker MZ style data and plugin API
- Windows, Linux, and macOS build targets

## About the Project

RPG Maker 9000 is meant to be a free and open source alternative to RPG Maker MV and MZ.

The goal is to keep the editor familiar for people who have used RPG Maker before while also making it easier to modify, experiment with, and contribute to.

Games are made with maps, events, database entries, resources, battles, and JavaScript plugins.

## Installation

You will need Node.js, npm, and Git.

Clone the repository:

```bash
git clone https://github.com/SchizoM1/RPG-Maker-9000.git
cd RPG-Maker-9000
```

Install the dependencies:

```bash
npm install
```

Start the editor:

```bash
npm start
```

## Development

Run the editor in development mode:

```bash
npm run dev
```

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run end to end tests:

```bash
npm run test:e2e
```

## Building

RPG Maker 9000 uses Electron and electron-builder.

Build a distributable version:

```bash
npm run dist
```

Build the application without packaging it:

```bash
npm run dist:dir
```

Build targets currently include:

| Platform | Format |
|---|---|
| Linux | AppImage |
| Windows | NSIS installer |
| macOS | DMG |

Build output is placed in the `dist/` folder.

## Project Structure

```text
RPG-Maker-9000/
├── assets/
├── docs/
├── editor/
├── electron/
├── plugins-examples/
├── runtime/
├── templates/
├── tests/
├── tools/
├── package.json
└── LICENSE
```

### `editor/`

Contains the main RPG Maker 9000 editor.

### `electron/`

Contains the Electron desktop application code.

### `runtime/`

Contains the game runtime used by exported projects.

### `templates/`

Contains files used when creating new projects.

### `plugins-examples/`

Contains example JavaScript plugins.

### `assets/`

Contains included graphics, audio, fonts, and other resources (All rights reserved by Gotcha Gotcha Games, We have no affiliation with them).

## Runtime

Games made with RPG Maker 9000 use an HTML5 Canvas 2D runtime.

The runtime contains systems for things such as:

- Tilemaps
- Windows and menus
- Audio
- Events
- Event interpreters
- Game objects
- Battlers
- Battles
- Sprites
- Scenes
- Plugins
- Effects

The runtime follows a structure similar to RPG Maker so that it feels familiar to people who already know RPG Maker development.

## Plugins

RPG Maker 9000 supports JavaScript plugins.

Example plugins can be found in:

```text
plugins-examples/
```

The runtime is designed around an RPG Maker MZ style data and plugin API.

Existing RPG Maker plugins may need changes before they work properly.

## Creating a Project

To create a project:

1. Open RPG Maker 9000.
2. Choose New Project.
3. Enter a game title.
4. Choose where the project should be saved.
5. Edit your maps, events, and database.
6. Use Playtest to test the game.
7. Use Deployment when you want to export it.

New projects include default graphics and audio resources.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + N` | New Project |
| `Ctrl + O` | Open Project |
| `Ctrl + S` | Save |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Ctrl + X` | Cut Event |
| `Ctrl + C` | Copy Event |
| `Ctrl + V` | Paste Event |
| `Ctrl + F` | Event Search |
| `F5` | Map Mode |
| `F6` | Event Mode |
| `F7` | Region Mode |
| `F9` | Database |
| `F10` | Plugin Manager |
| `F11` | Sound Test |
| `Ctrl + R` | Playtest |
| `Ctrl + 0` | Reset Zoom |
| `G` | Toggle Grid |

## Drawing Tools

| Key | Tool |
|---|---|
| `P` | Pencil |
| `R` | Rectangle |
| `E` | Ellipse |
| `F` | Flood Fill |
| `S` | Shadow Pen |

## Contributing

Contributions are welcome.

If you want to work on the project, fork the repository and create a branch:

```bash
git checkout -b feature/my-feature
```

Make your changes and test them.

Then commit your changes:

```bash
git commit -m "Add my feature"
```

Push the branch:

```bash
git push origin feature/my-feature
```

After that, open a pull request.

Bug reports and feature requests can also be submitted through GitHub Issues.

## License

RPG Maker 9000 is licensed under the MIT License.

See [LICENSE](LICENSE) for the full license text.

Copyright 2026 SchizoM1

## Links

Repository:

https://github.com/SchizoM1/RPG-Maker-9000

Issues:

https://github.com/SchizoM1/RPG-Maker-9000/issues
