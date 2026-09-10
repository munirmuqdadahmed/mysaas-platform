/* ==========================================
   🏢 SaaS Core - نظام تسجيل دخول حقيقي + عزل بيانات كل عمل
   ==========================================
   هذا الملف يُستخدم بكل صفحات المنصة (signup, login, dashboard, وأي
   صفحة جديدة تضاف لاحقًا زي الكاشير أو المخزون). يوفّر:
   - تسجيل عمل جديد (مطعم/ماركت/صالون...) + حساب مالكه
   - تسجيل الدخول لأي عمل ينتمي له المستخدم
   - دوال جاهزة لقراءة/كتابة بيانات محصورة بالعمل الحالي بس (تلقائيًا)
*/

// 🔴 إعدادات مشروع Firebase: mysaas-platform
const firebaseConfig = {
    apiKey:            "AIzaSyAFlvqwUbLK5Z9y5eHBLknfMkuL2_nkWzk",
    authDomain:        "mysaas-platform-d2a54.firebaseapp.com",
    projectId:         "mysaas-platform-d2a54",
    storageBucket:     "mysaas-platform-d2a54.firebasestorage.app",
    messagingSenderId: "311109513483",
    appId:             "1:311109513483:web:23d02198ce25ef8a47720e",
    measurementId:     "G-1BYKBEGEW8"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// معرّف العمل الحالي (يُحفظ محليًا بعد اختيار/دخول العمل)
function getCurrentBusinessId() {
    return localStorage.getItem('saas_current_business_id') || null;
}
function setCurrentBusinessId(id) {
    localStorage.setItem('saas_current_business_id', id);
}
function clearCurrentBusinessId() {
    localStorage.removeItem('saas_current_business_id');
}

// ==========================================
// 📝 تسجيل عمل جديد (أول مستخدم = المالك تلقائيًا)
// ==========================================
async function signUpNewBusiness(email, password, businessName, businessType) {
    // 1) إنشاء حساب المصادقة
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;

    // 2) إنشاء مستند العمل نفسه
    const businessRef = db.collection('businesses').doc();
    await businessRef.set({
        name:        businessName,
        type:        businessType,      // "مطعم" / "ماركت" / "صالون" / "أخرى"
        ownerUid:    uid,
        memberUids:  [uid],
        createdAt:   Date.now(),
        plan:        'trial',           // لاحقًا: trial / basic / pro
        trialEndsAt: Date.now() + (14 * 24 * 60 * 60 * 1000) // تجربة 14 يوم
    });

    // 3) ربط المستخدم بهذا العمل بحسابه الشخصي
    await db.collection('users').doc(uid).set({
        email,
        businesses: [{ businessId: businessRef.id, role: 'owner', name: businessName }],
        createdAt: Date.now()
    }, { merge: true });

    setCurrentBusinessId(businessRef.id);
    return { uid, businessId: businessRef.id };
}

// ==========================================
// 🔑 تسجيل الدخول
// ==========================================
async function logIn(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const userDoc = await db.collection('users').doc(cred.user.uid).get();
    const businesses = userDoc.exists ? (userDoc.data().businesses || []) : [];
    return { uid: cred.user.uid, businesses };
}

function logOut() {
    clearCurrentBusinessId();
    return auth.signOut();
}

// ==========================================
// 👀 مراقبة حالة تسجيل الدخول (استخدمها بأول كل صفحة محمية)
// ==========================================
function onAuthReady(callback) {
    auth.onAuthStateChanged(user => callback(user));
}

// ==========================================
// 📂 دوال قراءة/كتابة محصورة بالعمل الحالي تلقائيًا
// ==========================================
// بدل ما تكتب db.collection('businesses').doc(businessId).collection('menu_items')
// بكل مكان بالكود، تستخدم هذي الاختصارات فقط - وتضمن العزل تلقائيًا.

function tenantCollection(collectionName) {
    const businessId = getCurrentBusinessId();
    if (!businessId) throw new Error('لا يوجد عمل محدد حاليًا - سجّل الدخول أولًا');
    return db.collection('businesses').doc(businessId).collection(collectionName);
}

function tenantDoc(collectionName, docId) {
    return tenantCollection(collectionName).doc(docId);
}

async function getCurrentBusinessInfo() {
    const businessId = getCurrentBusinessId();
    if (!businessId) return null;
    const doc = await db.collection('businesses').doc(businessId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}
