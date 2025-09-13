# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a client-side Todo List application built with vanilla HTML, CSS, and JavaScript. The application runs entirely in the browser with no server dependencies and uses localStorage for persistence.

## Architecture

The application follows a simple three-file structure:
- `index.html` - Main HTML document with Korean UI text
- `style.css` - All styling with gradient backgrounds and hover effects
- `script.js` - Single TodoApp class managing all functionality

### Core Components

**TodoApp Class** (`script.js`): 
- Main application controller that handles all todo operations
- Uses localStorage for data persistence
- Manages DOM manipulation and event handling
- Global `app` instance is exposed for inline event handlers

**Data Model**:
- Todo items have: `id` (timestamp), `text`, `completed` (boolean), `createdAt` (ISO string)
- Data is stored as JSON array in localStorage under 'todos' key

**UI Features**:
- Empty state display when no todos exist
- Real-time statistics (total/completed/remaining counts)
- Korean language interface
- Responsive design with gradient styling

## Running the Application

Open `index.html` directly in any modern web browser. No build process or server required.

To open programmatically on Windows:
```bash
start index.html
```

## Development Notes

- No package.json dependencies (empty packages object)
- Uses inline event handlers (`onchange`, `onclick`) referencing global `app` instance
- DOM elements are referenced by ID and cached in constructor
- XSS protection via `escapeHtml()` method for user input
- New todos are prepended (unshift) to display most recent first