import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.nio.charset.StandardCharsets;

public class ChatServer {
    private static final int PORT = 8080;
    private static final String WEBSOCKET_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    private Set<ClientHandler> clients = ConcurrentHashMap.newKeySet();
    private ExecutorService executor = Executors.newCachedThreadPool();

    public static void main(String[] args) {
        new ChatServer().start();
    }

    public void start() {
        try (ServerSocket serverSocket = new ServerSocket(PORT)) {
            System.out.println("Chat Server started on port " + PORT);
            System.out.println("WebSocket URL: ws://localhost:" + PORT + "/websocket");

            while (true) {
                Socket clientSocket = serverSocket.accept();
                executor.submit(new ClientHandler(clientSocket, this));
            }
        } catch (IOException e) {
            System.err.println("Server error: " + e.getMessage());
        } finally {
            executor.shutdown();
        }
    }

    public synchronized void addClient(ClientHandler client) {
        clients.add(client);
        System.out.println("Client connected. Total clients: " + clients.size());
        broadcastSystemMessage(client.getUsername() + "님이 입장했습니다.");
    }

    public synchronized void removeClient(ClientHandler client) {
        if (clients.remove(client)) {
            System.out.println("Client disconnected. Total clients: " + clients.size());
            broadcastSystemMessage(client.getUsername() + "님이 퇴장했습니다.");
        }
    }

    public void broadcastMessage(String message, ClientHandler sender) {
        clients.parallelStream()
                .filter(client -> client != sender)
                .forEach(client -> client.sendMessage(message));
    }

    public void broadcastSystemMessage(String message) {
        String systemMessage = String.format(
            "{\"type\":\"system\",\"content\":\"%s\",\"timestamp\":\"%s\"}",
            message, new Date().toString()
        );

        clients.parallelStream()
                .forEach(client -> client.sendMessage(systemMessage));
    }

    static class ClientHandler implements Runnable {
        private Socket socket;
        private ChatServer server;
        private PrintWriter out;
        private BufferedReader in;
        private String username;
        private boolean isWebSocket = false;

        public ClientHandler(Socket socket, ChatServer server) {
            this.socket = socket;
            this.server = server;
            this.username = "User" + socket.getPort();
        }

        @Override
        public void run() {
            try {
                in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                out = new PrintWriter(socket.getOutputStream(), true);

                if (performWebSocketHandshake()) {
                    server.addClient(this);
                    handleWebSocketCommunication();
                }
            } catch (IOException e) {
                System.err.println("Client handler error: " + e.getMessage());
            } finally {
                cleanup();
            }
        }

        private boolean performWebSocketHandshake() throws IOException {
            String line;
            String webSocketKey = null;
            boolean isWebSocketRequest = false;

            while ((line = in.readLine()) != null && !line.isEmpty()) {
                System.out.println("Header: " + line);

                if (line.startsWith("GET") && line.contains("/websocket")) {
                    isWebSocketRequest = true;
                } else if (line.startsWith("Sec-WebSocket-Key:")) {
                    webSocketKey = line.split(": ")[1].trim();
                }
            }

            if (!isWebSocketRequest || webSocketKey == null) {
                return false;
            }

            String acceptKey = generateWebSocketAcceptKey(webSocketKey);

            out.println("HTTP/1.1 101 Switching Protocols");
            out.println("Upgrade: websocket");
            out.println("Connection: Upgrade");
            out.println("Sec-WebSocket-Accept: " + acceptKey);
            out.println();
            out.flush();

            isWebSocket = true;
            System.out.println("WebSocket handshake completed for " + username);
            return true;
        }

        private String generateWebSocketAcceptKey(String webSocketKey) {
            try {
                String concat = webSocketKey + WEBSOCKET_MAGIC;
                MessageDigest md = MessageDigest.getInstance("SHA-1");
                byte[] hash = md.digest(concat.getBytes(StandardCharsets.UTF_8));
                return Base64.getEncoder().encodeToString(hash);
            } catch (NoSuchAlgorithmException e) {
                throw new RuntimeException("SHA-1 algorithm not available", e);
            }
        }

        private void handleWebSocketCommunication() throws IOException {
            InputStream inputStream = socket.getInputStream();

            while (!socket.isClosed()) {
                try {
                    String message = readWebSocketFrame(inputStream);
                    if (message == null) break;

                    processMessage(message);
                } catch (IOException e) {
                    System.out.println("Client disconnected: " + e.getMessage());
                    break;
                }
            }
        }

        private String readWebSocketFrame(InputStream inputStream) throws IOException {
            int firstByte = inputStream.read();
            if (firstByte == -1) return null;

            boolean fin = (firstByte & 0x80) != 0;
            int opcode = firstByte & 0x0F;

            if (opcode == 0x8) return null;

            int secondByte = inputStream.read();
            if (secondByte == -1) return null;

            boolean masked = (secondByte & 0x80) != 0;
            int payloadLength = secondByte & 0x7F;

            if (payloadLength == 126) {
                payloadLength = (inputStream.read() << 8) | inputStream.read();
            } else if (payloadLength == 127) {
                return null;
            }

            byte[] maskKey = new byte[4];
            if (masked) {
                inputStream.read(maskKey);
            }

            byte[] payload = new byte[payloadLength];
            int totalRead = 0;
            while (totalRead < payloadLength) {
                int read = inputStream.read(payload, totalRead, payloadLength - totalRead);
                if (read == -1) throw new IOException("Unexpected end of stream");
                totalRead += read;
            }

            if (masked) {
                for (int i = 0; i < payload.length; i++) {
                    payload[i] ^= maskKey[i % 4];
                }
            }

            return new String(payload, StandardCharsets.UTF_8);
        }

        private void processMessage(String message) {
            System.out.println("Received: " + message);

            try {
                if (message.contains("\"username\":")) {
                    int usernameStart = message.indexOf("\"username\":\"") + 12;
                    int usernameEnd = message.indexOf("\"", usernameStart);
                    if (usernameEnd > usernameStart) {
                        this.username = message.substring(usernameStart, usernameEnd);
                    }
                }

                server.broadcastMessage(message, this);
            } catch (Exception e) {
                System.err.println("Error processing message: " + e.getMessage());
            }
        }

        public void sendMessage(String message) {
            if (!isWebSocket || socket.isClosed()) return;

            try {
                byte[] payload = message.getBytes(StandardCharsets.UTF_8);
                OutputStream outputStream = socket.getOutputStream();

                outputStream.write(0x81);

                if (payload.length < 126) {
                    outputStream.write(payload.length);
                } else if (payload.length < 65536) {
                    outputStream.write(126);
                    outputStream.write((payload.length >> 8) & 0xFF);
                    outputStream.write(payload.length & 0xFF);
                } else {
                    return;
                }

                outputStream.write(payload);
                outputStream.flush();
            } catch (IOException e) {
                System.err.println("Error sending message: " + e.getMessage());
                cleanup();
            }
        }

        public String getUsername() {
            return username;
        }

        private void cleanup() {
            try {
                server.removeClient(this);
                if (socket != null && !socket.isClosed()) {
                    socket.close();
                }
            } catch (IOException e) {
                System.err.println("Cleanup error: " + e.getMessage());
            }
        }
    }
}