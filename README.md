# Oatmeal MUSH Client

Oatmeal is a modern, web-based MUSH/MUD client that runs in your browser. It provides a clean, user-friendly interface for connecting to MUSH, MUD, MOO, and similar text-based multiplayer environments.

## Features

- **Clean Terminal Interface**: Distraction-free and easy to read text formatting
- **ANSI Color Support**: Full support for ANSI color codes and formatting
- **Pueblo Protocol Support**: HTML content rendering for supported servers
- **Command History**: Easily recall and re-use previous commands
- **Saved Connections**: Store and quickly connect to your favorite servers
- **Session Logging**: Record your gameplay sessions with automatic timestamps
- **Auto-reconnect**: Automatically try to reconnect if the connection is lost
- **Spellcheck**: Built-in spellchecking for the command input
- **Multi-line Input**: Supports up to 5 lines of input with 128K character capacity
- **Responsive Design**: Works on desktop and tablet devices

## Installation

### Prerequisites

- Python 3.11 or higher
- Flask
- Flask-SocketIO

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/oatmeal-mush-client.git
   cd oatmeal-mush-client
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
   
   Or use Python's project management:
   ```
   pip install .
   ```

3. Run the application:
   ```
   python app.py
   ```

4. Open your browser and navigate to `http://localhost:5000`

## Usage

### Connecting to a Server

1. Enter the host and port in the sidebar
2. Click the "Connect" button
3. Start typing commands in the input area at the bottom
4. Press Enter to send commands (or Shift+Enter for a new line)

### Saving Connections

1. Enter a host and port
2. Add a name for the connection
3. Click "Save"
4. Click on saved connections to load them quickly

### Session Logging

1. (Optional) Enter a custom filename in the "Log Filename" field
2. Click "Start Logging" to begin recording
3. Click "Stop Logging" when finished
4. Enable "Auto-log on connect" to automatically start logging when connecting

### Other Features

- Toggle sidebar to maximize screen space
- Adjust font size in settings
- Enable/disable ANSI color support
- Toggle Pueblo HTML support
- Enable/disable auto-reconnect
- View and reuse command history

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Attribution

If you modify and redistribute this software, please maintain attribution to the original authors.

## Disclaimer

This client is not affiliated with any particular MUSH, MUD, or MOO server or software. It is a general-purpose client that can connect to any compatible server.