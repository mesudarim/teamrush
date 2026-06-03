import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { app } from './config'

export const auth = getAuth(app)
const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export const signInWithGoogle = () => signInWithPopup(auth, provider)
export const signOutAdmin = () => signOut(auth)
export const onAdminAuthChange = (cb) => onAuthStateChanged(auth, cb)
