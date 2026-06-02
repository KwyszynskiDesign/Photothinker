#!/bin/bash
echo "============================================"
echo "RIP Preview Server - Unix Startup"
echo "============================================"
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Install with:"
    echo "  macOS: brew install python3"
    echo "  Ubuntu/Debian: sudo apt install python3 python3-pip python3-venv"
    exit 1
fi

# Check if venv exists, create if not
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install requirements
echo "Installing dependencies..."
pip install -r requirements.txt --quiet

# Start server
echo ""
echo "Starting server on http://localhost:5000"
echo "Press Ctrl+C to stop"
echo ""
python3 rip_server.py
