# Railpack Deployment Plan

## Issue
Railpack 0.17.2 cannot determine how to build the app because `start.sh` script is missing.

## Solution
Create a `start.sh` script that tells Railpack how to build and run the multi-part application.

## Files to Create

### 1. start.sh (Root Directory)
A shell script that:
- Installs frontend dependencies and builds the React app
- Installs backend Python dependencies
- Starts the backend server with gunicorn

## Implementation Steps

1. **Create start.sh** - Build and run script for Railpack
2. **Make start.sh executable** - Set execute permissions

## Expected Behavior After Fix
- Railpack will detect start.sh and use it to build and run the app
- Frontend will be built with `npm run build` in the frontend directory
- Backend will be started with `gunicorn wsgi:app` in the backend directory

## Status: ✅ COMPLETED

- [x] Created start.sh script
- [x] Made script executable with chmod +x

