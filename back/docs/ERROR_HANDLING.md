# Error Handling & Logging System

## Overview

The application now implements a centralized error handling and comprehensive logging system with environment-aware error reporting.

## Architecture

### Error Handler Middleware (`src/middleware/errorHandler.middleware.js`)

**Features:**
- Centralized error handling via Express middleware
- Automatic error normalization
- Environment-aware error responses (dev vs prod)
- Structured logging with request context
- Custom `AppError` class for application errors

### Usage

#### Creating Custom Errors

```javascript
import { AppError } from '../middleware/errorHandler.middleware.js';

// Throw an application error with context
throw new AppError(
  'Player not found',
  404,
  { sessionId, gameStateId, avatarIdx }
);
```

#### Wrapping Async Handlers

```javascript
import { asyncHandler } from '../middleware/errorHandler.middleware.js';

// Use asyncHandler to automatically catch and forward errors to middleware
GameStateController.getById = asyncHandler(async (req, res) => {
  const payload = await GameStateService.getById(req.params.gameStateId);
  if (!payload) {
    throw new AppError('Game state not found', 404, { gameStateId });
  }
  return res.status(200).json(payload);
});
```

## Logging Levels

The system uses Winston logging with environment-specific configuration:

### Development
- **Console Output:** Full logs with colors and formatting
- **Log Level:** `debug` (everything is logged)
- **Stack Traces:** Included for all errors
- **Context Data:** Full request body, params, and error context
- **Files:** `logs/error.log` and `logs/all.log`

### Production
- **Console Output:** None (only file-based)
- **Log Level:** `info` and above
- **Stack Traces:** Minimal - only in error.log
- **Context Data:** Limited (no sensitive request data)
- **Files:** `logs/error.log` and `logs/all.log`

## Error Response Format

### Development (Full Context)
```json
{
  "message": "Player not found",
  "status": 404,
  "stack": "Error: Player not found\n    at GameStateController.getPlayerState ...",
  "context": {
    "sessionId": "abc123",
    "gameStateId": "def456",
    "avatarIdx": 1
  }
}
```

### Production (Minimal)
```json
{
  "message": "Player not found",
  "status": 404
}
```

## Server Logs

### Development (Console + Files)
```
2026-01-15 14:32:15 [error] [ErrorHandler] Server Error {
  "timestamp": "2026-01-15T14:32:15.123Z",
  "method": "GET",
  "path": "/game-state/player-state/...",
  "ip": "192.168.1.1",
  "statusCode": 500,
  "message": "Database connection failed",
  "stack": "Error: Database connection failed\n    at PlayerStateService.getPlayerState...",
  "context": {...}
}
```

### Production (Files Only)
```
{"level":"error","message":"[ErrorHandler] Server Error","timestamp":"2026-01-15T14:32:15.123Z","method":"GET","path":"/game-state/player-state/...","statusCode":500,"message":"Database connection failed"}
```

## HTTP Status Code Mapping

| Code | Use Case | Example |
|------|----------|---------|
| 400 | Invalid request/validation failure | "Cannot create game while session is not in progress" |
| 404 | Resource not found | "Player not found", "Card not found" |
| 409 | Conflict/state mismatch | "Game state mismatch detected" |
| 500 | Unexpected server error | Database errors, service failures |

## Best Practices

### ✅ DO

1. **Use AppError for business logic errors:**
   ```javascript
   if (!session) {
     throw new AppError('Session not found', 404, { sessionId });
   }
   ```

2. **Include relevant context:**
   ```javascript
   throw new AppError('Credit settlement failed', 400, {
     gameStateId,
     creditId,
     reason: 'Insufficient funds'
   });
   ```

3. **Log important operations:**
   ```javascript
   log.info('[GameStateController] game started', { gameStateId });
   ```

4. **Use asyncHandler for all route handlers:**
   ```javascript
   GameStateController.create = asyncHandler(async (req, res) => {
     // Errors automatically propagate to middleware
   });
   ```

### ❌ DON'T

1. **Don't use generic errors:**
   ```javascript
   // Bad
   throw new Error('Something went wrong');
   ```

2. **Don't mix manual error handling with asyncHandler:**
   ```javascript
   // Bad - errors won't be caught properly
   GameStateController.create = asyncHandler(async (req, res) => {
     try {
       // ...
     } catch (err) {
       res.status(500).json({ message: 'Error' });
     }
   });
   ```

3. **Don't include sensitive data in logs:**
   ```javascript
   // Bad - passwords/tokens in logs
   log.info('User login', { username, password });
   
   // Good - only safe data
   log.info('User login attempted', { userId, username });
   ```

## Migration Guide

### From Old Error Handling

**Before:**
```javascript
GameStateController.getById = async (req, res, next) => {
  try {
    const payload = await GameStateService.getById(req.params.gameStateId);
    return res.status(200).json(payload);
  } catch (err) {
    log.error('Error:', err);
    return res.status(500).json({ status: 'ko', message: err.message });
  }
};
```

**After:**
```javascript
GameStateController.getById = asyncHandler(async (req, res) => {
  const payload = await GameStateService.getById(req.params.gameStateId);
  if (!payload) {
    throw new AppError('Game state not found', 404, { gameStateId });
  }
  return res.status(200).json(payload);
});
```

## Environment Variables

```bash
# .env
GECO_NODE_ENV=production  # 'development' or 'production'
```

## Monitoring & Debugging

### View Error Logs
```bash
tail -f logs/error.log
tail -f logs/all.log
```

### Debug Mode
In development, full stack traces and context are always logged to console.

### Memory Usage Tracking
The server logs memory usage every hour at INFO level.
