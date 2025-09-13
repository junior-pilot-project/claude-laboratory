# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a Seotda (섯다) project - a Korean traditional card game implementation. Seotda is played with 48 cards (hwatu/flower cards) and involves betting, bluffing, and hand rankings similar to poker but with unique Korean cultural elements.

## Key Seotda Game Concepts
- **Cards**: 48 hwatu cards with 12 suits (months) and 4 cards per suit
- **Hand Rankings**: Special combinations like "38광" (3-8 bright), "장땡" (pairs), "끗" (sum modulo 10)
- **Game Flow**: Deal → Betting rounds → Card reveal → Hand comparison
- **Special Rules**: "Go" (calling opponent's bluff), "Ddadang" (final betting round)

## Development Commands
Since this is a new project, common commands will be added as the project structure is established:

```bash
# Package management (when using Node.js)
npm install
npm run dev
npm run build
npm test
npm run lint

# Or if using other frameworks
# Python: pip install -r requirements.txt && python main.py
# Rust: cargo run && cargo test
# Unity: Open in Unity Editor and press Play
```

## Architecture Guidelines

### Game State Management
- Implement clear separation between game rules, state, and UI
- Use event-driven architecture for game actions (deal, bet, reveal, etc.)
- Consider implementing FSM (Finite State Machine) for game phases

### Card System
- Model hwatu cards with suit (month) and type (bright, animal, ribbon, junk)
- Implement hand evaluation with proper Seotda ranking logic
- Handle special combinations and their priorities

### Player Management  
- Support multiple players (typically 2-10 players)
- Track betting amounts, folding status, and hand histories
- Implement dealer rotation system

### UI/UX Considerations
- Display cards with traditional Korean aesthetics
- Provide clear hand ranking explanations for non-Korean players  
- Support both Korean and English interfaces
- Show betting status and pot clearly

## Testing Strategy
- Unit tests for hand evaluation logic
- Integration tests for complete game rounds
- Edge case testing for rare card combinations
- Performance testing for real-time multiplayer scenarios

## Cultural Sensitivity
- Maintain authentic Korean terminology where appropriate
- Provide cultural context in documentation
- Respect traditional game rules while allowing modern variations
- Consider regional rule differences