import express from 'express';
import { auth } from  './firebase-config.js';  // Import Firebase Admin SDK
import bodyParser from 'body-parser';
import 'firebase/auth';
import { renderFile } from 'ejs';
import wsReceiver from './ws-receiver.js';
import cookieParser from 'cookie-parser';

function bbddPath (userId, camId,) {
    return camId ? `./public/bbdd/users/${userId}/${camId}` : `./public/bbdd/users/${userId}`
}

export default function webServer() {
    const app = express();
    const port = 3000;

    app.use(cookieParser());
    app.use(express.json());
    //app.use(cookieParser());
    app.use(bodyParser.json());
    app.set('views', './public/views')
    app.engine("html", renderFile);

    app.use(express.static('./public/bbdd'));


    app.post('/register', async (req, res) => {
        const { email, password } = req.body;
    
        try {
            const userRecord = await auth.createUser({
                email,
                password,
            });
        
            return res.status(201).send({
                message: 'User registered successfully!',
                user: userRecord,
            });
        } catch (error) {
            console.error('Error registering user:', error);
            return res.status(400).send({ error: error.message });
        }
    });
    
    // User Login Route (Backend Authentication)
    app.post('/login', (req, res) => {
        res.status(200).send({ message: 'User logged in successfully', user: req.user });
    });
    
    // Authentication Middleware (Protect Routes)
    const authenticate = async (req, res, next) => {
        console.log('Cookies:', req.cookies);  // Check cookies in request
        const idToken = req.cookies?.idToken;  // Get token from the cookies
    
        if (!idToken) {
            return res.status(403).send('Authorization token is missing');
        }
    
        try {
            // Verify the Firebase ID Token using Firebase Admin SDK
            const decodedToken = await auth.verifyIdToken(idToken);
            req.user = decodedToken;
            next();
        } catch (error) {
            console.error('Error verifying ID token:', error);
            return res.status(401).send('Unauthorized');
        }
    };
    
    
    // Protected Route (Accessible only for authenticated users)
    app.get('/protected', authenticate, (req, res) => {
        res.status(200).send(`Hello ${req.user.email}, you're authenticated!`);
        const userId = req.user.uid;
        console.log('Authenticated user ID (UID):', userId);                                              // create an <a href> tag to redirect users to this id
                                                                                                          // this will be better
    })

    // Example of a protected route where users can only access their own profile
    app.get('/user/:userId', authenticate, async (req, res) => {
        // Get userId from URL params
        const { userId } = req.params;
        
        // Check if the logged-in user is trying to access their own data
        if (req.user.uid !== userId) {
            return res.status(403).send('Forbidden: You do not have access to this resource');
        }

        // If the user is authorized, send their profile data (this is just a mock)
        res.json({ message: `Welcome ${req.user.email}!`, profile: { userId } });
    });

    app.get('/', (req, res) => {
        res.sendFile('./public/views/index.html');
    });

    app.get('/login', (req, res) => {
        res.render("index.html");
    });

    app.get('/public/bbdd/users/:userId/:camId/index.m3u8', (req, res) => {
        res.sendFile(bbddPath(req.params.userId, req.params.camId) + '/index.m3u8');
    });

    app.post('/register', (req, res) => {

    });

    app.listen(port, () => {
    console.log(`Servidor web está escuchando en ${port}`);
    });



    wsReceiver();
    
    
}