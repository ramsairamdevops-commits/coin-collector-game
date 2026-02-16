import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  databaseURL: "YOUR_DB_URL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

window.sendOTP = () => {
  const phone = document.getElementById("phone").value;
  window.recaptchaVerifier = new RecaptchaVerifier(auth,'recaptcha',{});
  signInWithPhoneNumber(auth, phone, window.recaptchaVerifier)
    .then(result => window.confirmationResult = result);
};

window.verifyOTP = () => {
  const code = document.getElementById("otp").value;
  window.confirmationResult.confirm(code).then(res => {
    document.getElementById("loginPage").style.display="none";
    document.getElementById("app").style.display="block";
    loadProducts();
    startCartListener(res.user.uid);
  });
};

async function loadProducts(){
  const snap = await getDocs(collection(db,"products"));
  snap.forEach(docSnap=>{
    const p = docSnap.data();
    document.getElementById("products").innerHTML += `
      <div class="card">
        <img src="${p.image}" width="100%">
        <h4>${p.name}</h4>
        <p>₹${p.price}</p>
        <button onclick="addToCart('${docSnap.id}',${p.price})">Add</button>
      </div>`;
  });
}

window.addToCart = async(id,price)=>{
  const user = auth.currentUser;
  const cartRef = doc(db,"carts",user.uid,"items",id);
  const snap = await getDoc(cartRef);

  if(snap.exists()){
    await updateDoc(cartRef,{ quantity: increment(1) });
  } else {
    await setDoc(cartRef,{ quantity:1, price:price });
  }
};

window.startCartListener=(uid)=>{
  onSnapshot(collection(db,"carts",uid,"items"),snap=>{
    document.getElementById("cartCount").innerText=snap.size;
  });
};

window.toggleCart=()=>{
  document.getElementById("cartPanel").classList.toggle("active");
};

window.payNow=()=>{
  var options={
    key:"YOUR_RAZORPAY_KEY",
    amount:50000,
    currency:"INR",
    name:"My Shop",
    handler:function(response){
      alert("Payment Success");
      startTracking();
    }
  };
  var rzp=new Razorpay(options);
  rzp.open();
};

let map,marker;
function initMap(){
  map=new google.maps.Map(document.getElementById("map"),{
    center:{lat:17.3850,lng:78.4867},
    zoom:14
  });
  marker=new google.maps.Marker({
    position:{lat:17.3850,lng:78.4867},
    map:map
  });
}
window.onload=initMap;

window.startTracking=()=>{
  const driverRef=ref(rtdb,"driverLocation/driver1");
  onValue(driverRef,snap=>{
    const loc=snap.val();
    if(loc) marker.setPosition(loc);
  });
};
