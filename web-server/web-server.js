import users from '../public/bbdd/bbdd.js';             // Trae funciones para acceder a los JSONs de los usuarios
import express from 'express';                          // Es express, para manejar las rutas
import { auth } from './firebase-config.js';            // Son las credenciales de la API para mi cuenta de firebase
import bodyParser from 'body-parser';                   // Permite leer los JSONs entre cliente y servidor
import 'firebase/auth';                                 // Sirve para autenticar a los usuarios a las rutas que acceden
import cookieParser from 'cookie-parser';               // Permite leer las cookies
import http from 'http';                                // 
import { userSockets } from './ws-receiver.js';         // 

// Te da la ruta de un usuario o de su camara
function bbddPath(userId, camId) {
    return camId ? `./public/bbdd/user/${userId}/${camId}` : `./public/bbdd/user/${userId}`;
}

// Exporta la función para iniciar el servidor web
export default function webServer() {
    const app = express();              // Inicializamos el servidor
    const port = 3000;                  // Escogemos un puerto

    app.use(cookieParser());            // Integramos la conversión/analisis de cookies
    app.use(express.json());            // lo mismo pero con jsons
    app.use(bodyParser.json());         // lo mismo que arriba otra vez, podemos quitar uno
    app.use(express.urlencoded());      // Hace que los parametros de los formularios esten disponibles en req.body

    app.set('views', './public/views'); // Declara la carpeta de vistas (donde se guardan los .ejs que vamos a renderizar)
    app.set('view engine', 'ejs');      // Decimos que vamos a usar .ejs

    app.use(express.static('public'));  // Los contenidos de public son accesibles desde el navegador
    app.use(express.static('./public/bbdd')); // Este es redundante, puede quitarse
    app.use('/public/bbdd', express.static('./public/bbdd')); // Este también
    

    // Middleware para autenticar al usuario en rutas privadas
    const ensureAuth = async (req, res, next) => {
        const token = req.cookies?.idToken;                     // Obtenemos el token de las cookies (si lo tiene)
        if (!token) return res.redirect('/login');              // Si no lo tiene lo enviamos a loggearse

        // Verificamos que el token que tiene sea valido
        try {
            const decoded = await auth.verifyIdToken(token);    // Decoficamos el token para validarlos, si falla nos vamos al catch
            req.user = decoded;                                 // Guardamos el usuario obtenido del token/cookie en el request (para usarlo en otras partes)
            // Por defecto he decidido que cada usuario solo pueda acceder a aquellas rutas que llevan su ID (/user/userId/profile por ejemplo)
            if (req.user.uid !== req.params.userId) return res.redirect('/login');
            next();                     // Está correcto, autorizado, continuamos
        } catch (err) {
            res.redirect('/login');     // Si hubo algún error lo enviamos a loggearse
        }
    };

    // Middleware para asegurarnos que el usuario NO este autenticado
    const ensureGuest = async (req, res, next) => {
        console.log("aaa")
        const token = req.cookies?.idToken;                     // Obtenemos el token de las cookies (si lo tiene)
        
        if (!token) return next();                              // Si no lo tiene seguimos
        
        try {
            const decoded = await auth.verifyIdToken(token);    // Dado que ya tiene un token verificamos si es válido, si no lo es vamos al catch
            if(decoded) return res.redirect(`/user/${decoded.uid}`);        // Era valido, lo reenviamos a su perfil
            return next();
        } catch (err) {
            return next();  // Dado que el token no es valido le permitimos seguir
        }
    };

    // Nos devuelve el JSON de cada usuario
    app.get('/user/json', async (req, res) => {
        const token = req.cookies?.idToken;                     // Obtenemos el token de las cookies (si lo tiene)
        if (!token) return { error: "no token" }                                    // Si no lo tiene lo enviamos a loggearse

        // Verificamos que el token que tiene sea valido
        try {
            const decoded = await auth.verifyIdToken(token);    // Decoficamos el token para validarlos, si falla nos vamos al catch
            req.user = decoded;                                 // Guardamos el usuario obtenido del token/cookie en el request (para usarlo en otras partes)
            // Por defecto he decidido que cada usuario solo pueda acceder a aquellas rutas que llevan su ID (/user/userId/profile por ejemplo)
            // Está correcto, autorizado, continuamos
        } catch (err) {
            return { error: err }            //res.redirect('/login');                         // Si hubo algún error lo enviamos a loggearse
        }
        res.json(await users.getUserByID(req.user.uid));    // Le enviamos su JSON
    });


    // POST para reiniciar streams
    app.post('/user/:userId/restart-streams', ensureAuth, async (req, res) => {
        const userId = req.params.userId;                    // Obtemos la ID del usuario desde la URL aunque también está en el req.body

        const sockets = userSockets.get(userId);             // Buscamos el websocket abierto que coincida con la ID del usuario que ha hecho la petición
        if (!sockets || sockets.size === 0) {
            console.log(`No hay websockets abiertos para el usuario ${userId}`);  // No hay ninguno abierto
            return res.json({ error: 'No hay transmisiones en curso'})              
        }

        // Por cada websocket abierto enviar un mensaje de reinicio
        for (const ws of sockets) {             
            if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'restart' }));
            }
        }

        console.log(`Comando de reinicio enviado al usuario ${userId}`);
        res.redirect(`/user/${userId}/cams/`);
    });

    // POST para registrarse, crea el JSON del usuario y sus carpetas
    app.post('/register', async (req, res) => {
        users.createUser(req.body.id, req.body.email);  
    });

    // DELETE para quitar camaras
    app.delete('/user/:userId/cams/delete', ensureAuth, async (req, res) => {
        const camId = req.body.camId;
        
        await users.delCam(req.user.uid, camId);         // La guardamos en el JSON del usuario (donde están todas las camaras)
        res.redirect(`/user/${req.user.uid}/cams/`);     // Le devolvemos a la página de camaras 
    });

    // POST para añadir camaras
    app.post('/user/:userId/cams/add', ensureAuth, async (req, res) => {
        // Blueprint de camara
        const cam = {
            id: req.body.id,
            name: req.body.name,
            ip: req.body.ip,
            user: req.body.user,
            password: req.body.password
        };

        await users.addCam(req.user.uid, cam);           // La guardamos en el JSON del usuario (donde están todas las camaras)
        res.redirect(`/user/${req.user.uid}/cams/`);     // Le devolvemos a la página de camaras 
    });

    

    // GET para loggearse
    app.get('/login/', ensureGuest, (req, res) => {
        console.log("ssss")
        res.render('login');
    });

    // GET para regstrarse
    app.get('/register', ensureGuest, (req, res) => {
        res.render('register');
    });

    

    // GET para la página de perfil del usuario
    app.get('/user/:userId', ensureAuth, async (req, res) => {
        const userId = req.params.userId;               // Le pillamos la ID de la url, también podemos del req.user (nos la da el ensureAuth)
        const user = await users.getUserByID(userId);   // Obtenemos el JSON del usuario (por si luego queremos pasar mas info)
        res.render("profile", { id: userId });          // De momento solo mostramos la página con su ID
    });

    // GET para la página de camaras
    app.get('/user/:userId/cams', ensureAuth, async (req, res) => {
        const userId = req.params.userId;               // Pillamos la ID del usuario de la url (o del req.user)
        const user = await users.getUserByID(userId);   // Obtenemos su JSON

        // Renderizamos la página con sus camaras
        res.render('cams', {
            cams: user.cams || [],
            id: userId
        });
    });

    // GET para configurar camaras (añadir, editar, etc.)
    app.get('/user/:userId/cams/conf', ensureAuth, async (req, res) => {
        const userId = req.params.userId;               // Pillamos la ID del usuario de la url aunque también podemos del req.user
        res.render("cam-conf.ejs", { id: userId, camId: "" });     // Renderizamos la página
    });

    app.get('/user/:userId/cams/conf/:camId', ensureAuth, async (req, res) => {
        const userId = req.params.userId;               // Pillamos la ID del usuario de la url aunque también podemos del req.user
        const camId = req.params.camId
        res.render("cam-conf.ejs", { id: userId, camId: camId });     // Renderizamos la página
    });

    // GET para la página de una camara en particular, transimison
    app.get('/user/:userId/cams/:camId', ensureAuth, async (req, res) => {
        const { userId, camId } = req.params;                               // Pillamos su ID de usuario y de camara de la URL

        try {
            const user = await users.getUserByID(userId);                   // Obtenemos su JSON
            const cam = user.cams.find(cam => cam.id === camId);            // Le buscamos la camara con esa ID en su JSON
            if (!cam) return res.status(404).send("Camera not found");      // Si no existe pues ERROR
            const otherCams = user.cams.filter(cam => cam.id !== camId);    // Guardamos las demas camaras en un array (es para previews)

            // Renderizamos la página 
            res.render("cam-x.ejs", {
                id: userId,
                cam,
                otherCams
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err });
        }
    });

    // GET para loggearse
    app.get('/', (req, res) => {
        // TODO poner cosas chulas explictaivas
        res.redirect('/login');    // Renderizamos la página
    });

    // GET para los archivos HLS de transmisión en vivo
    app.get('/public/bbdd/user/:userId/:camId/index.m3u8', (req, res) => {
        // Les he puesto un delay artificial por probar si solucionaba errores de lectura cuando los archivos aun estaban siendo escritos
        setTimeout(() => {
            res.sendFile(bbddPath(req.params.userId, req.params.camId) + '/index.m3u8');
        }, 1000);
    });

    app.get('/download', function(req, res){
        const file = './public/downloads/CameraManager.exe';
        res.download(file); // Descarga del ejecutable
    });

    const server = http.createServer(app);  // Creamos un servidor http que contenga la app de express
    return { server, port };                // La función devuelve el servidor y su puerto
}