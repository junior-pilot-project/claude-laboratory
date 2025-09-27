# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a dynamic developer project board/dashboard system that automatically scans and displays multiple developers' projects. The system uses a 2-tier folder structure where developer folders (tier 1) contain project folders (tier 2), and only projects with an `index.html` file are considered valid projects.

## Architecture

### Server Architecture (server.js)

Professional class-based Node.js architecture:

- `ProjectBoardServer` - Main server class with graceful shutdown capabilities
- `ProjectScanner` - Real-time filesystem scanning (no build step required)
- `Router` - Request routing with CORS support
- `StaticFileServer` - Secure static file serving (prevents directory traversal attacks)
- `ResponseHelper` - HTTP response utilities
- `Logger` - Emoji-based logging system

### Client Architecture (script.js)

Simple functional JavaScript approach:

- Vanilla JavaScript DOM manipulation (no framework dependencies)
- Real-time API consumption from `/api/projects`
- Filtering by developer and search terms
- Toggle between list and grouped views

### File Structure

```
root/
├── server.js          # Node.js server (class-based)
├── index.html          # Main dashboard
├── style.css           # Responsive grid layout
├── script.js           # Client logic (functional)
├── package.json        # Node.js dependencies
└── [developer-folder]/
    └── [project-folder]/
        └── index.html  # Required for project detection
```

## Development Commands

### Running the Application

```bash
npm start          # Production mode
npm run dev        # Development mode (same as start)
node server.js     # Direct execution
```

### Server Details

- Runs on `http://localhost:8000` by default
- API endpoint: `/api/projects` - Returns JSON of all detected projects
- Environment variables: `PORT`, `HOST`
- 2-tier folder scanning: developer/project/index.html pattern

## Key Implementation Details

### Project Detection Logic

The server automatically scans for folders containing `index.html` files in this pattern:
`./[developer-name]/[project-name]/index.html`

Projects without `index.html` are ignored. All developer folders are listed in statistics even if they contain no valid projects.

### Security Features

- Directory traversal attack prevention in static file serving
- Path validation for base directory
- Graceful error handling with proper HTTP status codes

## API Response Format

```json
{
  "generated": "2024-01-01T12:00:00.000Z",
  "totalCount": 6,
  "developerCount": 8,
  "developerStats": {
    "developer1": 2,
    "developer2": 0
  },
  "projects": [
    {
      "folderName": "project-name",
      "developer": "developer-name",
      "folderPath": "./developer/project/",
      "indexPath": "./developer/project/index.html",
      "category": "project",
      "lastModified": "2024-01-01T12:00:00.000Z",
      "size": 1024
    }
  ]
}
```

## Race Condition Handling

This system is designed to handle race conditions in project detection and file system scanning:

- Real-time filesystem monitoring without build steps
- Atomic project scanning operations
- Graceful handling of concurrent file system changes
- Thread-safe project detection logic