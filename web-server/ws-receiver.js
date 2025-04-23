import fs from 'fs';                        // Esto para manipular el sistema de archivos   
import path from 'path';                    // Esto para convertir rutas relativas a absolutas, unir rutas, etc
import { WebSocketServer } from 'ws';       // Nos permite usar websockets
import { auth } from './firebase-config.js';// Incluye nuestra autenticficación de firebase

export const userSockets = new Map();       // Crea una especie de aray/diccionario que en base a una clave devuelve un valor

// Nos da la ruta de la carpeta de un usuario o de su camara en base a las IDs
function bbddPath(userId, camId) {
    return camId ? `./public/bbdd/user/${userId}/${camId}` : `./public/bbdd/user/${userId}`;
}

// Verifica un token
async function verifyFirebaseToken(token) {
    try {
        const decodedToken = await auth.verifyIdToken(token);               // Lo intenta validar con firebase
        return decodedToken;                                                // Devuelve token decodificado (es el usuario)
    } catch (error) {
        console.error('Ha fallado la verificación: ', error);               // Si falla 
        return null;
    }
}

// Exporta la función para crear un servidor websocket
export default function wsReceiver(server) {
    console.log("Escuchando en websocket")
    const wss = new WebSocketServer({ server });         // Crea el servidor de recepción con el mismo puerto que express

    const fileBuffers = new Map(); // Asocia un archivo con sus chunks o trozos
    const authMap = new WeakMap(); // Asocia una sesión de websocket a un usuario

    // Se ejecuta en cada conexión
    wss.on('connection', (ws) => {
        console.log('--Un cliente conectado--');

        // Se ejecuta en cada mensaje del cliente
        ws.on('message', async (message) => {
            let parsed; // Inicializamos una variable para parsear los mensajes JSON
            try {
                parsed = JSON.parse(message);   // Parseamos
            } catch (err) {
                console.error('Fallo al leer JSON: ', err);
                return;
            }

            const { type, data } = parsed;      // Extraemos el tipo de mensaje y su información

            // Al principio de cada conexión se autoriza la conexión con su token
            if (type === 'auth') {
                
                const { userId, token } = data; // Extraemos la is de usuario y el token (deben coincidir)

                // Si no hay token adios
                if (!token) {
                    console.warn('⚠️ Missing token in auth message');
                    ws.close(4001, 'Authentication token required');
                    return;
                }

                const decodedToken = await verifyFirebaseToken(token);          // Obtenemos el toekn decodificado

                // Si no es valido o no coincide adios
                if (!decodedToken || decodedToken.uid !== userId) {             
                    console.warn(`🚫 Unauthorized access attempt: ${decodedToken ? decodedToken.uid : 'invalid token'}`);
                    ws.close(4002, 'Unauthorized');
                    return;
                }

                const userFolder = `./public/bbdd/user/${userId}`;              // La carpeta de usuario en el servidor (en base a su ID)
                if (!fs.existsSync(userFolder)) {                               
                    console.warn(`🚫 Folder for user ${userId} does not exist`);
                    ws.close(4003, 'User folder does not exist');
                    return;
                }

                authMap.set(ws, { userId, token });

                if (!userSockets.has(userId)) {
                    userSockets.set(userId, new Set());
                }
                userSockets.get(userId).add(ws);

                console.log(`✅ Authenticated user ${userId}`);
                return;
            }

            const auth = authMap.get(ws);
            if (!auth) {
                console.warn('🔒 Unauthorized client tried to send data');
                ws.close(4004, 'Unauthorized');
                return;
            }

            if (type === 'chunk') {
                const { fileId, userId, camId, fileName, mimeType, fileSize, chunk } = data;

                if (userId !== auth.userId) {
                    console.warn(`🚫 Mismatched userId in chunk: expected ${auth.userId}, got ${userId}`);
                    return;
                }

                if (!fileBuffers.has(fileId)) {
                    fileBuffers.set(fileId, {
                        userId,
                        camId,
                        fileName,
                        mimeType,
                        fileSize,
                        buffer: Buffer.alloc(0)
                    });
                }

                const fileInfo = fileBuffers.get(fileId);
                const buffer = Buffer.from(chunk, 'base64');
                fileInfo.buffer = Buffer.concat([fileInfo.buffer, buffer]);

                console.log(`📥 Chunk received for ${fileName}, total size: ${fileInfo.buffer.length}`);

                if (fileInfo.buffer.length === fileInfo.fileSize) {
                    const folder = bbddPath(userId, camId);
                    fs.mkdirSync(folder, { recursive: true });

                    const filePath = path.join(folder, fileName);
                    fs.writeFileSync(filePath, fileInfo.buffer);
                    console.log(`✅ File ${fileName} saved to ${filePath}`);

                    fileBuffers.delete(fileId);
                }
            }

            if (type === 'delete') {
                const { fileName, userId, camId } = data;

                if (userId !== auth.userId) {
                    console.warn(`🚫 Mismatched userId in delete: expected ${auth.userId}, got ${userId}`);
                    return;
                }

                const filePath = path.join(bbddPath(userId, camId), fileName);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error(`❌ Failed to delete file ${fileName}:`, err);
                    } else {
                        console.log(`🗑️ File ${fileName} deleted from ${filePath}`);
                    }
                });
            }
        });

        ws.on('close', () => {
            console.log('❎ WebSocket disconnected');
            const auth = authMap.get(ws);
            if (auth?.userId) {
                const set = userSockets.get(auth.userId);
                if (set) {
                    set.delete(ws);
                    if (set.size === 0) {
                        userSockets.delete(auth.userId);
                    }
                }
            }
            authMap.delete(ws);
        });

        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
        });
    });
}