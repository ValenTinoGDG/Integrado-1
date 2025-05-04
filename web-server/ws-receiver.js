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
                console.log('Fallo al leer JSON: ', err);
                return;
            }

            const { type, data } = parsed;      // Extraemos el tipo de mensaje y su información

            // Al principio de cada conexión se autoriza la conexión con su token
            if (type === 'auth') {
                
                const { userId, token } = data; // Extraemos la is de usuario y el token (deben coincidir)

                // Si no hay token adios
                if (!token) {
                    console.log('Falta el token en el mensaje de autorización');
                    ws.close(4001, 'Token de autentificación requerido');
                    return;
                }

                const decodedToken = await verifyFirebaseToken(token);          // Obtenemos el toekn decodificado

                // Si no es valido o no coincide adios
                if (!decodedToken || decodedToken.uid !== userId) {             
                    console.warn(`Intento de autorización no valido: ${decodedToken ? decodedToken.uid : 'Token invalido'}`);
                    ws.close(4002, 'La autentificación ha fallado');
                    return;
                }

                const userFolder = `./public/bbdd/user/${userId}`;              // La carpeta de usuario en el servidor (en base a su ID)
                if (!fs.existsSync(userFolder)) {                               
                    console.log(`La carpeta requerida del usuario ${userId} no existe`);
                    ws.close(4003, 'No existe la carpeta del usuario');
                    return;
                }

                authMap.set(ws, { userId, token });     // Añadimos un elemento al mapa para guardar la conexión actual

                // Si ya hay un elemento que lleva la misma ID de usuario lo forzamos a añadirse
                if (!userSockets.has(userId)) {
                    userSockets.set(userId, new Set());
                }
                userSockets.get(userId).add(ws);

                console.log(`Usuario autenticado ${userId}`);
                return;
            }

            const auth = authMap.get(ws);
            if (!auth) {
                console.log('Usuario no autorizado ha intentado enviar datos');
                ws.close(4004, 'No autorizado');
                return;
            }

            // Manejo de los mensajes (se envían por trozos o chunks)
            if (type === 'chunk') {
                // Cada chunk tiene estos parametros (aunque userId es redundante porque se obtiene también de la autorización inicial)
                const { fileId, userId, camId, fileName, mimeType, fileSize, chunk } = data;

                // Verificamos que la userId que se intenta acceder coincida con la del usuario autenticado en el socket
                if (userId !== auth.userId) {
                    console.log(`ID de usuario incorrecta: se esperaba ${auth.userId}, se obtuvo ${userId}`);
                    return;
                }

                // Creamos buffers si no hay ya para que se suban los trozos de los archivos a medida que van llegando
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

                console.log(`Chunk recibido de ${fileName}, tamaño total: ${fileInfo.buffer.length}`);

                // Si el archivo se ha subido entero lo quitamos del buffer
                if (fileInfo.buffer.length === fileInfo.fileSize) {
                    const folder = bbddPath(userId, camId);
                    fs.mkdirSync(folder, { recursive: true });

                    const filePath = path.join(folder, fileName);
                    fs.writeFileSync(filePath, fileInfo.buffer);
                    console.log(`Archivo ${fileName} guardado en ${filePath}`);

                    fileBuffers.delete(fileId);
                }
            }

            // Mensajes de borrado (cuando un fragmento de video antiguo ya no queremos que ocupe espacio en el disco)
            // Esto podría administrarse por defecto desde els ervidor en caso de que el transmisor no enviase el mensaje
            if (type === 'delete') {
                // Para borrar solo nos hace falta saber esto
                const { fileName, userId, camId } = data;

                // Verificamos que la ID coincida con la que
                if (userId !== auth.userId) {
                    console.log(`ID de usuario incorrecta: se esperaba ${auth.userId}, se obtuvo ${userId}`);
                    return;
                }

                // Borramos el archivo
                const filePath = path.join(bbddPath(userId, camId), fileName);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.log(`Fallo al borrar archivo ${fileName}:`, err);
                    } else {
                        console.log(`Archivo ${fileName} eliminado de ${filePath}`);
                    }
                });
            }
        });

        // Cuando se cierra el websocket
        ws.on('close', () => {
            console.log('Websocket cerrado');

            // Quitamos las credenciales de este websocket del Map (porque está cerrado y no se va a usar)
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

        // Error de websocket
        ws.on('error', (err) => {                       
            console.error('Error de websocket:', err);
        });
    });
}