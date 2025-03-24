import os
import json
import logging
import socket
import threading
import time
import re
import datetime
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, disconnect

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_key')
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active connections
mush_connections = {}

# Path to store saved connections
SAVED_CONNECTIONS_FILE = 'saved_connections.json'

# Load saved connections
def load_saved_connections():
    if os.path.exists(SAVED_CONNECTIONS_FILE):
        try:
            with open(SAVED_CONNECTIONS_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading saved connections: {str(e)}")
    return []

# Save connections to file
def save_connections(connections):
    try:
        with open(SAVED_CONNECTIONS_FILE, 'w') as f:
            json.dump(connections, f)
        return True
    except Exception as e:
        logger.error(f"Error saving connections: {str(e)}")
        return False

class MushConnection:
    def __init__(self, host, port, client_id):
        self.host = host
        self.port = port
        self.client_id = client_id
        self.socket = None
        self.connected = False
        self.reader_thread = None
        self.stop_thread = False
        self.command_history = []
        self.max_history = 100
        self.session_log = None
        self.is_logging = False
        self.log_filename = None
        self.autolog = False

    def connect(self):
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((self.host, self.port))
            self.connected = True
            self.stop_thread = False
            self.reader_thread = threading.Thread(target=self.read_from_server)
            self.reader_thread.daemon = True
            self.reader_thread.start()
            return True
        except Exception as e:
            logger.error(f"Connection error: {str(e)}")
            return False

    def disconnect(self):
        self.stop_thread = True
        if self.socket:
            try:
                self.socket.shutdown(socket.SHUT_RDWR)
                self.socket.close()
            except:
                pass
        
        # Close session log if active
        if self.is_logging and self.session_log:
            try:
                self.session_log.write(f"\n--- DISCONNECTED: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---\n")
                self.session_log.close()
                self.session_log = None
                self.is_logging = False
            except Exception as e:
                logger.error(f"Error closing session log: {str(e)}")
        
        self.connected = False
        
    def start_logging(self, filename=None):
        """Start logging the session to a file"""
        if self.is_logging:
            return False, "Already logging to a file"
            
        try:
            if not filename:
                # Generate default filename with timestamp
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"session_log_{self.host}_{timestamp}.txt"
            
            # Create logs directory if it doesn't exist
            os.makedirs('logs', exist_ok=True)
            log_path = os.path.join('logs', filename)
            
            self.session_log = open(log_path, 'w', encoding='utf-8')
            self.is_logging = True
            self.log_filename = log_path
            
            # Write session header
            header = f"--- SESSION LOG START: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---\n"
            header += f"--- SERVER: {self.host}:{self.port} ---\n\n"
            self.session_log.write(header)
            self.session_log.flush()
            
            return True, log_path
        except Exception as e:
            logger.error(f"Error starting session log: {str(e)}")
            return False, str(e)
    
    def stop_logging(self):
        """Stop logging the session"""
        if not self.is_logging or not self.session_log:
            return False, "Not currently logging"
            
        try:
            self.session_log.write(f"\n--- SESSION LOG END: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---\n")
            self.session_log.close()
            self.session_log = None
            self.is_logging = False
            return True, self.log_filename
        except Exception as e:
            logger.error(f"Error stopping session log: {str(e)}")
            return False, str(e)
    
    def log_data(self, text, is_command=False):
        """Log data to the session log file if logging is enabled"""
        if not self.is_logging or not self.session_log:
            return
            
        try:
            timestamp = datetime.datetime.now().strftime("%H:%M:%S")
            if is_command:
                # Mark user commands in the log
                self.session_log.write(f"[{timestamp}] >>> {text}\n")
            else:
                self.session_log.write(f"[{timestamp}] {text}\n")
            self.session_log.flush()
        except Exception as e:
            logger.error(f"Error writing to session log: {str(e)}")
            # If we encounter an error logging, close the log
            try:
                self.session_log.close()
            except:
                pass
            self.session_log = None
            self.is_logging = False

    def send_command(self, command):
        if not self.connected or not self.socket:
            return False
        
        # Add to command history
        if command and command not in self.command_history:
            self.command_history.append(command)
            if len(self.command_history) > self.max_history:
                self.command_history.pop(0)
        
        # Log command if logging is enabled
        if self.is_logging:
            self.log_data(command, is_command=True)
        
        try:
            # Ensure command ends with newline
            if not command.endswith('\n'):
                command += '\n'
            self.socket.sendall(command.encode('utf-8'))
            return True
        except Exception as e:
            logger.error(f"Error sending command: {str(e)}")
            self.connected = False
            return False

    def read_from_server(self):
        """Reads data from the MUSH server and sends it to the client via WebSocket"""
        buffer = bytearray()
        
        while not self.stop_thread and self.connected:
            try:
                # Read data from socket
                data = self.socket.recv(4096)
                if not data:
                    # Connection closed by server
                    socketio.emit('server_disconnect', {'message': 'Server closed the connection'}, 
                                 room=self.client_id)
                    self.connected = False
                    break
                
                # Add to buffer
                buffer.extend(data)
                
                # Process complete lines
                while b'\n' in buffer:
                    line, buffer = buffer.split(b'\n', 1)
                    try:
                        text = line.decode('utf-8')
                        # Emit the received text to the client
                        socketio.emit('server_message', {'text': text}, room=self.client_id)
                        
                        # Log server message if logging is enabled
                        if self.is_logging:
                            self.log_data(text)
                    except UnicodeDecodeError:
                        # Handle encoding issues
                        try:
                            text = line.decode('latin-1')
                            socketio.emit('server_message', {'text': text}, room=self.client_id)
                            
                            # Log server message if logging is enabled
                            if self.is_logging:
                                self.log_data(text)
                        except:
                            logger.error("Failed to decode message from server")
            
            except socket.timeout:
                continue
            except Exception as e:
                if not self.stop_thread:  # Only log if not intentionally stopping
                    logger.error(f"Error reading from server: {str(e)}")
                    # Send connection_lost event with connection info for auto-reconnect
                    socketio.emit('connection_lost', {
                        'error': str(e),
                        'host': self.host,
                        'port': self.port
                    }, room=self.client_id)
                self.connected = False
                break
        
        # If we exit the loop without stop_thread being set, the connection was lost
        if not self.stop_thread and not self.connected:
            # Use connection_lost for unexpected disconnections to trigger auto-reconnect
            socketio.emit('connection_lost', {
                'message': 'Connection to server lost unexpectedly',
                'host': self.host,
                'port': self.port
            }, room=self.client_id)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    client_id = request.sid
    logger.info(f"Client connected: {client_id}")
    emit('connection_status', {'status': 'connected', 'client_id': client_id})

@socketio.on('disconnect')
def handle_disconnect():
    client_id = request.sid
    logger.info(f"Client disconnected: {client_id}")
    
    # Clean up any MUSH connections for this client
    if client_id in mush_connections:
        mush_connections[client_id].disconnect()
        del mush_connections[client_id]

@socketio.on('connect_to_server')
def connect_to_server(data):
    client_id = request.sid
    host = data.get('host')
    port = data.get('port')
    auto_log = data.get('auto_log', False)
    log_filename = data.get('log_filename')
    
    try:
        port = int(port)
    except (ValueError, TypeError):
        emit('connection_error', {'error': 'Invalid port number'})
        return
    
    # Create a new connection
    connection = MushConnection(host, port, client_id)
    
    # Set autolog flag if provided
    if auto_log:
        connection.autolog = True
    
    # Try to connect
    if connection.connect():
        mush_connections[client_id] = connection
        
        # Start logging automatically if auto_log is enabled
        if auto_log:
            success, message = connection.start_logging(log_filename)
            if success:
                emit('logging_started', {'filename': message, 'auto_log': True})
                logger.info(f"Auto-logging started for {client_id} to {message}")
            else:
                logger.error(f"Failed to start auto-logging: {message}")
                # Continue with connection even if logging fails
        
        emit('server_connected', {'host': host, 'port': port})
    else:
        emit('connection_error', {'error': f'Failed to connect to {host}:{port}'})

@socketio.on('disconnect_from_server')
def disconnect_from_server():
    client_id = request.sid
    
    if client_id in mush_connections:
        mush_connections[client_id].disconnect()
        del mush_connections[client_id]
        emit('server_disconnected')
    else:
        emit('connection_error', {'error': 'Not connected to any server'})

@socketio.on('send_command')
def send_command(data):
    client_id = request.sid
    command = data.get('command', '').strip()
    
    if not client_id in mush_connections:
        emit('connection_error', {'error': 'Not connected to any server'})
        return
    
    connection = mush_connections[client_id]
    
    if not connection.connected:
        emit('connection_error', {'error': 'Connection lost, please reconnect'})
        return
    
    if not connection.send_command(command):
        emit('connection_error', {'error': 'Failed to send command'})

@socketio.on('get_command_history')
def get_command_history():
    client_id = request.sid
    
    if client_id in mush_connections:
        history = mush_connections[client_id].command_history
        emit('command_history', {'history': history})
    else:
        emit('command_history', {'history': []})

@socketio.on('save_connection')
def save_connection(data):
    name = data.get('name')
    host = data.get('host')
    port = data.get('port')
    
    if not name or not host or not port:
        emit('connection_error', {'error': 'Missing connection details'})
        return
    
    # Load existing connections
    connections = load_saved_connections()
    
    # Check if connection with this name already exists
    for i, conn in enumerate(connections):
        if conn.get('name') == name:
            # Update existing connection
            connections[i] = {'name': name, 'host': host, 'port': port}
            if save_connections(connections):
                emit('connection_saved', {'name': name, 'host': host, 'port': port})
            else:
                emit('connection_error', {'error': 'Failed to save connection'})
            return
    
    # Add new connection
    connections.append({'name': name, 'host': host, 'port': port})
    
    if save_connections(connections):
        emit('connection_saved', {'name': name, 'host': host, 'port': port})
    else:
        emit('connection_error', {'error': 'Failed to save connection'})

@socketio.on('get_saved_connections')
def get_saved_connections():
    connections = load_saved_connections()
    emit('saved_connections', {'connections': connections})

@socketio.on('delete_connection')
def delete_connection(data):
    name = data.get('name')
    
    if not name:
        emit('connection_error', {'error': 'Missing connection name'})
        return
    
    connections = load_saved_connections()
    connections = [conn for conn in connections if conn.get('name') != name]
    
    if save_connections(connections):
        emit('connection_deleted', {'name': name})
    else:
        emit('connection_error', {'error': 'Failed to delete connection'})

@socketio.on('start_logging')
def start_logging(data):
    client_id = request.sid
    filename = data.get('filename')
    auto_log = data.get('auto_log', False)
    
    if client_id not in mush_connections:
        emit('connection_error', {'error': 'Not connected to any server'})
        return
        
    connection = mush_connections[client_id]
    
    if not connection.connected:
        emit('connection_error', {'error': 'Connection lost, please reconnect'})
        return
    
    # Set autolog flag if requested
    if auto_log:
        connection.autolog = True
    
    # Start logging
    success, message = connection.start_logging(filename)
    
    if success:
        emit('logging_started', {'filename': message, 'auto_log': connection.autolog})
    else:
        emit('connection_error', {'error': f'Failed to start logging: {message}'})

@socketio.on('stop_logging')
def stop_logging():
    client_id = request.sid
    
    if client_id not in mush_connections:
        emit('connection_error', {'error': 'Not connected to any server'})
        return
        
    connection = mush_connections[client_id]
    
    if not connection.is_logging:
        emit('connection_error', {'error': 'Not currently logging'})
        return
    
    success, message = connection.stop_logging()
    
    if success:
        emit('logging_stopped', {'filename': message})
    else:
        emit('connection_error', {'error': f'Failed to stop logging: {message}'})

@socketio.on('get_logging_status')
def get_logging_status():
    client_id = request.sid
    
    if client_id not in mush_connections:
        emit('logging_status', {'is_logging': False, 'auto_log': False, 'filename': None})
        return
        
    connection = mush_connections[client_id]
    
    emit('logging_status', {
        'is_logging': connection.is_logging,
        'auto_log': connection.autolog,
        'filename': connection.log_filename
    })

if __name__ == '__main__':
    import flask_socketio
    # Check SocketIO version to adjust params
    if hasattr(flask_socketio, '__version__'):
        from packaging import version
        if version.parse(flask_socketio.__version__) >= version.parse('5.0.0'):
            socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
        else:
            socketio.run(app, host='0.0.0.0', port=5000, debug=True)
    else:
        socketio.run(app, host='0.0.0.0', port=5000, debug=True)
