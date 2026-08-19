importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// TODO: Replace with your actual Firebase Web App Configuration
// (Found in Firebase Console -> Project Settings -> General -> Your Apps (Web App))
const firebaseConfig = {
  apiKey: "AIzaSyAONpq8bn8JRWn_CcnZchCtUFJY_73UzoU",
  authDomain: "telecrm-8ea20.firebaseapp.com",
  projectId: "telecrm-8ea20",
  storageBucket: "telecrm-8ea20.appspot.com",
  messagingSenderId: "104839193606",
  appId: "1:104839193606:web:cfa33651adf7dc9b2c0f87"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/vite.svg',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
