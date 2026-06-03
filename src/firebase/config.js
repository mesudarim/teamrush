import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth } from 'firebase/auth'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyAwMRnfZanx-N0t8PzZ_LrI2Ka4KerAWos',
  authDomain: 'teamrush.firebaseapp.com',
  projectId: 'teamrush',
  storageBucket: 'teamrush.firebasestorage.app',
  messagingSenderId: '453542664871',
  appId: '1:453542664871:web:ef9c5309210d660f065982',
  measurementId: 'G-397S3MLY7Q',
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const auth = getAuth(app)

// Analytics only in browser
if (typeof window !== 'undefined') {
  getAnalytics(app)
}
