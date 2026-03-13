
async function run() {
  const { initializeApp } = await import('firebase/app');
  const { getFirestore, collection, getDocs, limit, query } = await import('firebase/firestore');

  const firebaseConfig = {
    apiKey: "AIzaSyCnZnumIya7lj6FJpT7SfotrY-5VoI96Bg",
    authDomain: "aahaas-marketing.firebaseapp.com",
    projectId: "aahaas-marketing",
    storageBucket: "aahaas-marketing.firebasestorage.app",
    messagingSenderId: "731783572658",
    appId: "1:731783572658:web:5af4c658b90ec04d292dab"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log("Fetching packages from Firestore...");
  const q = query(collection(db, 'packages'), limit(30));
  const snap = await getDocs(q);
  const data = snap.docs.map(d => {
      const payload = d.data();
      return { 
          id: d.id, 
          Package: payload.Package, 
          date_published: payload.date_published,
          'Date Published': payload['Date Published'],
          updatedAt: payload.updatedAt
      };
  });
  console.log("Sample Data:");
  console.log(JSON.stringify(data, null, 2));
}

run()
  .then(() => process.exit(0))
  .catch(err => {
      console.error(err);
      process.exit(1);
  });
