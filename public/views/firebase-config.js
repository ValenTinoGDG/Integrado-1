// firebase-config.js

// Import Firebase functions
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';

// Firebase configuration (use your Firebase project's config)
const firebaseConfig = {
    apiKey: "AIzaSyDFcdxq6AyaTH8JsPdnGGkhhT5Prr6i3tE",
    authDomain: "ip-cam-9711b.firebaseapp.com",
    projectId: "ip-cam-9711b",
    storageBucket: "ip-cam-9711b.firebasestorage.app",
    messagingSenderId: "1033319875515",
    appId: "1:1033319875515:web:dc44e762baabd94eb4ba9e",
    measurementId: "G-6TWBNRPKWK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get the auth instance
const auth = getAuth(app);

// Monitor auth state
onAuthStateChanged(auth, (user) => {
    const messageElement = document.getElementById('message');
    const logoutButton = document.getElementById('logoutButton');

    if (user) {
        messageElement.textContent = `Welcome, ${user.email}!`;
        messageElement.style.display = 'block';
        logoutButton.style.display = 'block';
    } else {
        messageElement.style.display = 'none';
        logoutButton.style.display = 'none';
    }
});

// Separate Registration Function
const registerUser = async (email, password) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log('User registered:', userCredential.user);
        alert('Registration successful!');
    } catch (error) {
        console.error('Error registering:', error.message);
        alert(error.message);
    }
};

// Separate Login Function
const loginUser = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('User logged in:', userCredential.user);
        alert('Login successful!');
    } catch (error) {
        console.error('Error logging in:', error.message);
        alert(error.message);
    }
};

// Separate Logout Function
const logoutUser = async () => {
    try {
        await signOut(auth);
        console.log('User logged out');
        alert('Logout successful!');
    } catch (error) {
        console.error('Error logging out:', error.message);
        alert(error.message);
    }
};

// Export the functions to be used in the main script
export { registerUser, loginUser, logoutUser };