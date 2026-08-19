import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestFirebaseNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Use the VAPID Key provided by the user
      const currentToken = await getToken(messaging, { 
        vapidKey: 'BLS0Og4HrNOAbwdyaUB-Ays1yksQaJUWhZpwOCXx7_40EcAdwDOjL4zaKCGVnbJLm9MO6mJGrxFURAC2_37zHFY' 
      });
      if (currentToken) {
        return currentToken;
      } else {
        console.warn('No registration token available.');
      }
    } else {
        console.warn('Notification permission not granted.');
    }
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
  }
  return null;
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
