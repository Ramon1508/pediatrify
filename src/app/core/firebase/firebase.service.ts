import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private app: FirebaseApp;
  private authInstance: Auth;
  private firestoreInstance: Firestore;
  private storageInstance: FirebaseStorage;

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.authInstance = getAuth(this.app);
    this.firestoreInstance = getFirestore(this.app);
    this.storageInstance = getStorage(this.app);
  }

  get auth(): Auth {
    return this.authInstance;
  }

  get firestore(): Firestore {
    return this.firestoreInstance;
  }

  get storage(): FirebaseStorage {
    return this.storageInstance;
  }
}
