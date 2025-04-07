import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws'

export default function wsReceiver () {
    // WebSocket server setup
    const wss = new WebSocketServer({ port: 8080 });

    let fileBuffers = {};

    // Handling WebSocket connection from Server A
    wss.on('connection', (ws) => {
        console.log('Server  connected');
        
        let currentFileStream = null;
        let currentFileName = null;
        
        ws.on('message', (message) => {
            let data;
            let receiveFolder;
            let userId, camId;
            receiveFolder = bbddPath(userId, camId);
            console.log(data);
            try {
                data = JSON.parse(message);
                console.log(data)
            } catch (err) {
                console.error('Failed to parse message:', err);
                return;
            }
            
            if (data.type === 'chunk') {
                // Handle file chunk with metadata
                const { fileId, userId, camId, fileName, mimeType, fileSize, chunk } = data.data;
                
                if (!fileBuffers[fileId]) {
                    // Initialize the file buffer if it's the first chunk for this file
                    fileBuffers[fileId] = {
                        userId,
                        camId,
                        fileName,
                        mimeType,
                        fileSize,
                        buffer: Buffer.alloc(0), // Create an empty buffer for file data
                    };
                }
                
                // Append the chunk to the corresponding file's buffer
                const buffer = Buffer.from(chunk, 'base64');
                fileBuffers[fileId].buffer = Buffer.concat([fileBuffers[fileId].buffer, buffer]);
                
                console.log(`Received chunk for ${fileName} (ID: ${fileId}), total size: ${fileBuffers[fileId].buffer.length} bytes`);
                
                // Optionally, handle progress or manage file completion here
                if (fileBuffers[fileId].buffer.length === fileSize) {
                    // Write the file to disk when it is fully received
                    const filePath = path.join(receiveFolder, fileName);
                    fs.writeFileSync(filePath, fileBuffers[fileId].buffer);
                    console.log(`File ${fileName} written to disk.`);
                    
                    // Clear the buffer after the file is written
                    delete fileBuffers[fileId];
                }
            }
            
            if (data.type === 'delete') {
                // Handle file deletion request from Server A
                const fileNameToDelete = data.data.fileName;
                userId = data.data.userId;
                camId = data.data.camId;
                console.log(data, data.data);
                const filePathToDelete = path.join(receiveFolder, fileNameToDelete);
                
                fs.unlink(filePathToDelete, (err) => {
                    if (err) {
                        console.error(`Failed to delete file ${fileNameToDelete}:`, err);
                    } else {
                        console.log(`File ${fileNameToDelete} deleted successfully from Server B`);
                    }
                });
            }
        });
        
        ws.on('close', () => {
            if (currentFileStream) {
                currentFileStream.end();
                console.log(`Received and saved file: ${currentFileName}`);
            }
        });
        
        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
        });
    });
    console.log('Servidor de recepción está escuchando en ws://localhost:8080');
}