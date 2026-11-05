import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsSV2NvqEyXEk92xHNfi9MCPbQxPDvm8g",
  authDomain: "competitive-exams-by-kaushalji.firebaseapp.com",
  projectId: "competitive-exams-by-kaushalji",
  storageBucket: "competitive-exams-by-kaushalji.firebasestorage.app",
  messagingSenderId: "951680951005",
  appId: "1:951680951005:web:60903dd04be26eede37134",
  measurementId: "G-PS04MZCTNJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let allQuestions=[],activeQuizQuestions=[],currentIndex=0,userAnswers={},bookmarked=new Set(),timerInterval=null,timeRemaining=0,reviewMode=false;
let selectedCount=25;
let currentLang='hi'; 
let currentUser = null;
let currentCaptchaAnswer = 0;

const $=id=>document.getElementById(id);
const authView=$('authView'),setupView=$('setupView'),quizView=$('quizView'),resultView=$('resultView');
const subjectCards=[...document.querySelectorAll('.subject-card')],countCards=[...document.querySelectorAll('.count-card')];

// --- CAPTCHA GENERATOR ---
function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  currentCaptchaAnswer = num1 + num2;
  const captchaLabel = $('captchaLabel');
  if (captchaLabel) {
    captchaLabel.textContent = `Security Check: What is ${num1} + ${num2}?`;
  }
}

// Toggle between Login and Register tabs inside Auth View
document.addEventListener('DOMContentLoaded', () => {
  generateCaptcha();
  
  // Create Tabs dynamically if not present in HTML
  const authCard = document.querySelector('.auth-card') || authView;
  if (authCard && !$('authTabsContainer')) {
    const tabHTML = document.createElement('div');
    tabHTML.id = 'authTabsContainer';
    tabHTML.style.cssText = "display:flex; gap:10px; margin-bottom:1rem; border-bottom:2px solid var(--border); padding-bottom:0.5rem;";
    tabHTML.innerHTML = `
      <button id="showLoginTab" class="btn btn-primary btn-sm" style="flex:1;">Login</button>
      <button id="showRegisterTab" class="btn btn-secondary btn-sm" style="flex:1;">Register / Signup</button>
    `;
    authCard.prepend(tabHTML);

    // Add extra fields container for Register
    const extraFields = document.createElement('div');
    extraFields.id = 'registerExtraFields';
    extraFields.style.display = 'none';
    extraFields.style.flexDirection = 'column';
    extraFields.style.gap = '0.75rem';
    extraFields.style.marginTop = '0.75rem';
    extraFields.innerHTML = `
      <input type="text" id="regFullName" class="option-btn" placeholder="Full Name (Pura Naam)" style="padding:0.7rem; width:100%;">
      <input type="tel" id="regMobile" class="option-btn" placeholder="Mobile Number (Mobile No.)" style="padding:0.7rem; width:100%;">
      <label style="font-size:0.85rem; font-weight:600; color:var(--muted);">Profile Photo Upload:</label>
      <input type="file" id="regProfilePic" accept="image/*" class="option-btn" style="padding:0.5rem; width:100%;">
      <div style="display:flex; align-items:center; gap:10px; background:color-mix(in srgb, var(--primary) 10%, var(--card-bg)); padding:0.6rem; border-radius:8px;">
        <span id="captchaLabel" style="font-weight:700; font-size:0.9rem;">Security Check: 5 + 3?</span>
        <input type="number" id="regCaptchaInput" class="option-btn" placeholder="Ans" style="width:80px; padding:0.4rem; text-align:center;">
      </div>
    `;
    
    // Insert before submit buttons or email input
    const emailInput = $('authEmail');
    if (emailInput && emailInput.parentNode) {
      emailInput.parentNode.insertBefore(extraFields, emailInput);
    }

    let isRegisterMode = false;
    $('showRegisterTab').addEventListener('click', () => {
      isRegisterMode = true;
      extraFields.style.display = 'flex';
      $('showRegisterTab').className = 'btn btn-primary btn-sm';
      $('showLoginTab').className = 'btn btn-secondary btn-sm';
      $('emailLoginBtn').style.display = 'none';
      $('emailRegisterBtn').style.display = 'block';
      generateCaptcha();
    });

    $('showShowLoginTab' || 'showLoginTab').addEventListener('click', () => {
      isRegisterMode = false;
      extraFields.style.display = 'none';
      $('showLoginTab').className = 'btn btn-primary btn-sm';
      $('showRegisterTab').className = 'btn btn-secondary btn-sm';
      $('emailRegisterBtn').style.display = 'none';
      $('emailLoginBtn').style.display = 'block';
    });
    
    // Initially hide register button
    const regBtn = $('emailRegisterBtn');
    if(regBtn) regBtn.style.display = 'none';
  }
});

// Helper to convert image file to Base64 for LocalStorage caching
function convertImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

onAuthStateChanged(auth, async (user) => {
  // Check LocalStorage session first if Firebase user is null
  let activeUser = user;
  const localUserJson = localStorage.getItem('kaushalji_local_user');
  if (!activeUser && localUserJson) {
    try {
      activeUser = JSON.parse(localUserJson);
    } catch(e) { console.error(e); }
  }

  currentUser = activeUser;
  const authContainer = $('authContainer');
  
  if (activeUser) {
    let userAge = '';
    let userMobile = activeUser.mobile || '';
    let userFullName = activeUser.displayName || activeUser.fullName || 'User';
    let userPhoto = activeUser.photoURL || 'https://via.placeholder.com/40';

    try {
      if(activeUser.uid && !activeUser.isLocal) {
        const userDocRef = doc(db, "users", activeUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          userAge = userSnap.data().age || '';
          userMobile = userSnap.data().mobile || '';
        }
      }
    } catch(err) { console.error(err); }

    authContainer.innerHTML = `
      <div class="profile-dropdown-container">
        <button id="profileToggleBtn" class="profile-icon-btn" style="display:flex; align-items:center; gap:8px; background:var(--card-bg); border:1px solid var(--border); border-radius:50px; padding:4px 12px; cursor:pointer;">
          <img src="${userPhoto}" alt="Profile" class="profile-icon-img" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
          <span style="font-weight:600; font-size:0.9rem;">${userFullName.split(' ')[0]}</span>
        </button>
        <div id="profileDropdownMenu" class="profile-dropdown-menu">
          <div class="profile-user-info" style="display:flex; gap:10px; align-items:center; margin-bottom:0.75rem; border-bottom:1px solid var(--border); padding-bottom:0.75rem;">
            <img src="${userPhoto}" alt="User" style="width:45px; height:45px; border-radius:50%; object-fit:cover;">
            <div class="profile-user-details">
              <h4 style="margin:0; font-size:1rem;">${userFullName}</h4>
              <p style="margin:0; font-size:0.8rem; color:var(--muted);">${activeUser.email}</p>
              ${userMobile ? `<p style="margin:0; font-size:0.8rem; color:var(--success);">📱 ${userMobile}</p>` : ''}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.4rem; margin-bottom:0.75rem;">
            <label style="font-size:0.8rem;font-weight:600;">Aapki Age (Umar):</label>
            <div style="display:flex;gap:0.4rem;">
              <input type="number" id="userAgeInput" class="option-btn" style="padding:0.4rem;font-size:0.9rem;" value="${userAge}" placeholder="Enter age">
              <button id="saveAgeBtn" class="btn btn-primary btn-sm">Save</button>
            </div>
          </div>
          <button id="logoutBtn" class="btn btn-secondary btn-sm btn-block" style="margin-top:0.3rem;">Logout</button>
        </div>
      </div>
    `;

    const profileToggleBtn = $('profileToggleBtn');
    const profileDropdownMenu = $('profileDropdownMenu');
    profileToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdownMenu.classList.toggle('show');
    });

    window.addEventListener('click', () => {
      profileDropdownMenu.classList.remove('show');
    });

    profileDropdownMenu.addEventListener('click', (e) => e.stopPropagation());

    $('saveAgeBtn').addEventListener('click', async () => {
      const ageVal = $('userAgeInput').value;
      try {
        if(activeUser.uid && !activeUser.isLocal) {
          await setDoc(doc(db, "users", activeUser.uid), {
            uid: activeUser.uid,
            email: activeUser.email,
            displayName: userFullName,
            age: ageVal,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        alert("Age successfully saved!");
        profileDropdownMenu.classList.remove('show');
      } catch(e) {
        console.error("Error saving age:", e);
        alert("Failed to save age.");
      }
    });

    $('logoutBtn').addEventListener('click', async () => {
      localStorage.removeItem('kaushalji_local_user');
      try { await signOut(auth); } catch(e){}
      window.location.reload();
    });
    
    authView.classList.add('hidden');
    setupView.classList.remove('hidden');
  } else {
    authContainer.innerHTML = '';
    setupView.classList.add('hidden');
    quizView.classList.add('hidden');
    resultView.classList.add('hidden');
    authView.classList.remove('hidden');
  }
});

$('googleLoginBtn').addEventListener('click', () => {
  signInWithPopup(auth, provider).catch((error) => {
    console.error("Google Auth Error:", error);
    alert("Login failed: " + error.message);
  });
});

// Custom Registration with LocalStorage & Firebase Support
$('emailRegisterBtn').addEventListener('click', async () => {
  const email = $('authEmail').value;
  const password = $('authPassword').value;
  const fullName = $('regFullName') ? $('regFullName').value : '';
  const mobile = $('regMobile') ? $('regMobile').value : '';
  const captchaInput = $('regCaptchaInput') ? parseInt($('regCaptchaInput').value) : NaN;

  if(!email || !password || !fullName || !mobile) { 
    alert('Kripya Sabhi Fields (Name, Mobile, Email, Password) bharein!'); 
    return; 
  }
  
  if (isNaN(captchaInput) || captchaInput !== currentCaptchaAnswer) {
    alert('Galat Captcha! Kripya sahi calculation likhein.');
    generateCaptcha();
    return;
  }

  let photoBase64 = 'https://via.placeholder.com/150';
  const fileInput = $('regProfilePic');
  if (fileInput && fileInput.files && fileInput.files[0]) {
    try {
      photoBase64 = await convertImageToBase64(fileInput.files[0]);
    } catch(err) {
      console.error("Image conversion error:", err);
    }
  }

  // Try Firebase Registration first
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: email,
      fullName: fullName,
      mobile: mobile,
      photoURL: photoBase64,
      createdAt: serverTimestamp()
    });
    alert('Firebase Registration Successful!');
  } catch (error) {
    console.warn("Firebase registration fallback to LocalStorage:", error.message);
    // Fallback to LocalStorage Auth system
    const localUsers = JSON.parse(localStorage.getItem('kaushalji_registered_users') || '[]');
    if(localUsers.some(u => u.email === email)) {
      alert('Yeh email pehle se registered hai! Kripya Login karein.');
      return;
    }
    const newUser = {
      uid: 'local_' + Date.now(),
      email: email,
      password: password,
      fullName: fullName,
      mobile: mobile,
      photoURL: photoBase64,
      isLocal: true
    };
    localUsers.push(newUser);
    localStorage.setItem('kaushalji_registered_users', JSON.stringify(localUsers));
    localStorage.setItem('kaushalji_local_user', JSON.stringify(newUser));
    alert('Local Registration Successful! Aap login ho chuke hain.');
    window.location.reload();
  }
});

// Custom Login with LocalStorage & Firebase Support
$('emailLoginBtn').addEventListener('click', (e) => {
  e.preventDefault();
  const email = $('authEmail').value;
  const password = $('authPassword').value;
  if(!email || !password) { alert('Kripya Email aur Password bharein!'); return; }

  // Check LocalStorage Users first
  const localUsers = JSON.parse(localStorage.getItem('kaushalji_registered_users') || '[]');
  const foundUser = localUsers.find(u => u.email === email && u.password === password);
  
  if (foundUser) {
    localStorage.setItem('kaushalji_local_user', JSON.stringify(foundUser));
    alert('Login Successful!');
    window.location.reload();
    return;
  }

  // Otherwise try Firebase Signin
  signInWithEmailAndPassword(auth, email, password)
    .catch((error) => {
      alert("Login Failed: " + error.message + "\n(Agar aapne local register kiya tha toh details check karein)");
    });
});

async function initApp(){
  try{
    const res=await fetch('questions.json');
    if(!res.ok) throw new Error('questions.json could not be loaded');
    allQuestions=await res.json();
    $('questionBankInfo').textContent=`Question bank loaded: ${allQuestions.length} questions.`;
  }catch(err){
    $('questionBankInfo').textContent='Could not load questions.json. Use a local web server (Live Server).';
    console.error(err);
  }
  registerSW();
}

subjectCards.forEach(card=>card.addEventListener('click',()=>{
  const input=card.querySelector('input');
  if(input.value==='all'){subjectCards.forEach(c=>{c.querySelector('input').checked=c===card;c.classList.toggle('selected',c===card)});}
  else{
    const all=subjectCards[0];all.querySelector('input').checked=false;all.classList.remove('selected');
    input.checked=!input.checked;card.classList.toggle('selected',input.checked);
    const any=subjectCards.slice(1).some(c=>c.querySelector('input').checked);
    if(!any){all.querySelector('input').checked=true;all.classList.add('selected');}
  }
}));

countCards.forEach(card=>card.addEventListener('click',()=>{countCards.forEach(c=>c.classList.remove('selected'));card.classList.add('selected');selectedCount=Number(card.dataset.count)}));

$('startQuizBtn').addEventListener('click',()=>{
  if(!allQuestions.length){alert('Question bank load nahi hua.');return;}
  const chosen=subjectCards.slice(1).filter(c=>c.querySelector('input').checked).map(c=>c.querySelector('input').value);
  let pool=subjectCards[0].querySelector('input').checked||chosen.length===0?allQuestions:allQuestions.filter(q=>chosen.includes(q.subject));
  if(!pool.length){alert('Selected subjects ke liye questions available nahi hain.');return;}
  pool=[...pool].sort(()=>Math.random()-.5);
  activeQuizQuestions=pool.slice(0,Math.min(selectedCount,pool.length));
  currentIndex=0;userAnswers={};bookmarked.clear();reviewMode=false;
  setupView.classList.add('hidden');resultView.classList.add('hidden');quizView.classList.remove('hidden');
  timeRemaining=Math.ceil(activeQuizQuestions.length*72);$('timerDisplay').textContent=formatTime(timeRemaining);
  startTimer();renderPalette();loadQuestion(0);
});

function formatTime(seconds){return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`}

function startTimer(){
  clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    timeRemaining--; 
    $('timerDisplay').textContent=formatTime(Math.max(0,timeRemaining));
    if(timeRemaining<=0){clearInterval(timerInterval);finishQuiz();}
  },1000);
}

function loadQuestion(index){
  if(reviewMode) {
    renderAllReviewQuestions();
    return;
  }

  const q=activeQuizQuestions[index];
  if(!q)return;

  $('questionCategory').textContent=(q.subject || 'General').replace(/^\w/,c=>c.toUpperCase());
  $('quizSubjectBadge').textContent='UPSSSC PET';

  const questionText = (typeof q.question === 'object') ? (q.question[currentLang] || q.question.en || '') : q.question;
  $('questionText').textContent=`${index+1}. ${questionText}`;
  $('quizQuestionCountText').textContent=`Question ${index+1} of ${activeQuizQuestions.length}`;

  const container=$('optionsContainer');
  container.innerHTML='';

  const optionsArr = (typeof q.options === 'object' && !Array.isArray(q.options)) ? (q.options[currentLang] || q.options.en || []) : q.options;

  optionsArr.forEach((opt,idx)=>{
    const btn=document.createElement('button');
    btn.className='option-btn';
    btn.textContent=`${String.fromCharCode(65+idx)}. ${opt}`;
    if(userAnswers[index]===idx)btn.classList.add('selected');
    btn.disabled=false;
    btn.addEventListener('click',()=>selectOption(index,idx));
    container.appendChild(btn);
  });

  $('bookmarkBtn').textContent=bookmarked.has(index)?'🔖 Bookmarked':'🔖 Bookmark';
  $('explanationBox').classList.add('hidden');
  $('explanationText').textContent = '';

  $('prevQuestionBtn').disabled=index===0;
  $('nextQuestionBtn').disabled=index===activeQuizQuestions.length-1;
  $('clearOptionBtn').disabled=false;
  updatePalette();
}

function renderAllReviewQuestions() {
  $('quizSubjectBadge').textContent = 'Review All Questions';
  $('quizQuestionCountText').textContent = `Total: ${activeQuizQuestions.length} Questions`;
  $('timerDisplay').parentElement.parentElement.classList.add('hidden');
  $('questionPaletteAside').classList.add('hidden');
  $('quizMainLayoutContainer').style.gridTemplateColumns = '1fr';
  $('printReviewBtn').classList.remove('hidden');

  const containerWrapper = $('quizQuestionContainerWrapper');
  containerWrapper.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:2px solid var(--border); padding-bottom:1rem;">
      <h2 style="font-size:1.4rem;">📖 Complete Test Review & Answer Key</h2>
      <button id="backToResultTopBtn" class="btn btn-secondary btn-sm">🔙 Back to Results</button>
    </div>
    <div id="allReviewListContainer" style="display:flex; flex-direction:column; gap:1.5rem;"></div>
  `;

  $('backToResultTopBtn').addEventListener('click', () => {
    quizView.classList.add('hidden');
    resultView.classList.remove('hidden');
    $('timerDisplay').parentElement.parentElement.classList.remove('hidden');
    $('questionPaletteAside').classList.remove('hidden');
    $('quizMainLayoutContainer').style.gridTemplateColumns = '';
    $('printReviewBtn').classList.add('hidden');
    containerWrapper.innerHTML = `
      <div class="question-header"><span id="questionCategory" class="q-category">Subject</span><button id="bookmarkBtn" class="btn btn-secondary btn-sm">🔖 Bookmark</button></div>
      <h3 id="questionText" class="question-text">Loading question...</h3>
      <div id="optionsContainer" class="options-container"></div>
      <div id="explanationBox" class="explanation-box hidden"><strong>Explanation:</strong><p id="explanationText"></p></div>
      <div class="quiz-controls" id="quizControlsBar">
        <button id="prevQuestionBtn" class="btn btn-secondary">Previous</button>
        <button id="clearOptionBtn" class="btn btn-secondary">Clear Selection</button>
        <button id="nextQuestionBtn" class="btn btn-primary">Next</button>
        <button id="submitQuizBtn" class="btn btn-success">Submit Test</button>
      </div>
    `;
  });

  const listContainer = $('allReviewListContainer');
  listContainer.innerHTML = '';

  activeQuizQuestions.forEach((q, index) => {
    const qText = (typeof q.question === 'object') ? (q.question[currentLang] || q.question.en || '') : q.question;
    const optionsArr = (typeof q.options === 'object' && !Array.isArray(q.options)) ? (q.options[currentLang] || q.options.en || []) : q.options;
    const expl = (typeof q.explanation === 'object') ? (q.explanation[currentLang] || q.explanation.en || 'No explanation provided.') : (q.explanation || 'No explanation provided.');
    const userAns = userAnswers[index];
    const correctAns = q.answer;

    const card = document.createElement('div');
    card.style.cssText = "background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem;";
    
    let optionsHtml = '';
    optionsArr.forEach((opt, oIdx) => {
      let btnStyle = "padding:0.7rem 1rem; border:2px solid var(--border); border-radius:10px; background:var(--card-bg); color:var(--text); text-align:left; font-size:0.95rem; margin-bottom:0.4rem;";
      if (oIdx === correctAns) {
        btnStyle = "padding:0.7rem 1rem; border:2px solid var(--success); border-radius:10px; background:color-mix(in srgb, var(--success) 15%, var(--card-bg)); color:var(--success); font-weight:700; text-align:left; font-size:0.95rem; margin-bottom:0.4rem;";
      } else if (oIdx === userAns && userAns !== correctAns) {
        btnStyle = "padding:0.7rem 1rem; border:2px solid var(--danger); border-radius:10px; background:color-mix(in srgb, var(--danger) 15%, var(--card-bg)); color:var(--danger); font-weight:700; text-align:left; font-size:0.95rem; margin-bottom:0.4rem;";
      }
      optionsHtml += `<div style="${btnStyle}">${String.fromCharCode(65+oIdx)}. ${opt}</div>`;
    });

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.75rem; text-transform:uppercase; font-weight:800; color:var(--primary);">Question ${index+1} (${q.subject || 'General'})</span>
        <span style="font-size:0.8rem; font-weight:700; padding:2px 8px; border-radius:6px; background:${userAns === correctAns ? 'color-mix(in srgb, var(--success) 20%, var(--card-bg))' : 'color-mix(in srgb, var(--danger) 20%, var(--card-bg))'}; color:${userAns === correctAns ? 'var(--success)' : 'var(--danger)'};">
          ${userAns === correctAns ? '✓ Correct' : (userAns === undefined ? '⚪ Unanswered' : '✗ Incorrect')}
        </span>
      </div>
      <h4 style="font-size:1.1rem; font-weight:600;">${index+1}. ${qText}</h4>
      <div style="display:flex; flex-direction:column; margin-top:0.3rem;">${optionsHtml}</div>
      <div style="background:color-mix(in srgb, var(--warning) 12%, var(--card-bg)); border-left:4px solid var(--warning); padding:0.8rem; border-radius:6px; margin-top:0.4rem; font-size:0.9rem;">
        <strong>Explanation:</strong> <p style="margin-top:0.2rem; color:var(--muted);">${expl}</p>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

$('printReviewBtn').addEventListener('click', () => { window.print(); });

function selectOption(qIdx,optIdx){
  if(reviewMode)return;
  userAnswers[qIdx]=optIdx;
  loadQuestion(qIdx);
}

function renderPalette(){
  const grid=$('paletteGrid');
  grid.innerHTML='';
  activeQuizQuestions.forEach((_,idx)=>{
    const btn=document.createElement('button');
    btn.className='palette-btn';
    btn.textContent=idx+1;
    btn.addEventListener('click',()=>{currentIndex=idx;loadQuestion(idx)});
    grid.appendChild(btn);
  });
  updatePalette();
}

function updatePalette(){
  document.querySelectorAll('.palette-btn').forEach((btn,idx)=>{
    btn.className='palette-btn';
    if(idx===currentIndex)btn.classList.add('current');
    if(userAnswers[idx]!==undefined)btn.classList.add('answered');
    if(bookmarked.has(idx))btn.classList.add('bookmarked');
  });
}

$('bookmarkBtn').addEventListener('click',()=>{
  if(bookmarked.has(currentIndex))bookmarked.delete(currentIndex);
  else bookmarked.add(currentIndex);
  loadQuestion(currentIndex);
});

$('prevQuestionBtn').addEventListener('click',()=>{if(currentIndex>0){currentIndex--;loadQuestion(currentIndex)}});
$('nextQuestionBtn').addEventListener('click',()=>{if(currentIndex<activeQuizQuestions.length-1){currentIndex++;loadQuestion(currentIndex)}});
$('clearOptionBtn').addEventListener('click',()=>{delete userAnswers[currentIndex];loadQuestion(currentIndex)});

$('submitQuizBtn').addEventListener('click',()=>{
  if(confirm('Are you sure you want to submit the test?'))finishQuiz();
});

async function finishQuiz(){
  clearInterval(timerInterval);
  quizView.classList.add('hidden');
  resultView.classList.remove('hidden');
  reviewMode=false;

  let correct=0,wrong=0,unanswered=0;
  const bySubject={};

  activeQuizQuestions.forEach((q,i)=>{
    const s=q.subject||'other';
    if(!bySubject[s])bySubject[s]={total:0,correct:0,wrong:0,unanswered:0};
    bySubject[s].total++;
    if(userAnswers[i]===undefined){unanswered++;bySubject[s].unanswered++}
    else if(userAnswers[i]===q.answer){correct++;bySubject[s].correct++}
    else{wrong++;bySubject[s].wrong++}
  });

  const score=correct-wrong*.25,accuracy=correct+wrong?Math.round(correct/(correct+wrong)*100):0;
  $('finalScore').textContent=score.toFixed(2);
  $('maxScore').textContent=`/ ${activeQuizQuestions.length} Marks`;
  $('statCorrect').textContent=correct;
  $('statWrong').textContent=wrong;
  $('statUnanswered').textContent=unanswered;
  $('statAccuracy').textContent=`${accuracy}%`;

  $('subjectBreakdownContainer').innerHTML='';
  Object.entries(bySubject).forEach(([subject,stats])=>{
    const row=document.createElement('div');
    row.className='breakdown-row';
    const name=document.createElement('strong');
    name.textContent=subject[0].toUpperCase()+subject.slice(1);
    const detail=document.createElement('span');
    detail.textContent=`${stats.correct}/${stats.total} correct · ${stats.wrong} wrong · ${stats.unanswered} blank`;
    row.append(name,detail);
    $('subjectBreakdownContainer').appendChild(row);
  });

  if (currentUser && !currentUser.isLocal) {
    try {
      await setDoc(doc(collection(db, "quiz_progress")), {
        uid: currentUser.uid,
        email: currentUser.email,
        score: score,
        maxMarks: activeQuizQuestions.length,
        correct: correct,
        wrong: wrong,
        unanswered: unanswered,
        accuracy: accuracy,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Error saving progress: ", e);
    }
  }
}

$('restartQuizBtn').addEventListener('click',()=>{
  clearInterval(timerInterval);
  resultView.classList.add('hidden');
  setupView.classList.remove('hidden');
});

$('reviewAnswersBtn').addEventListener('click',()=>{
  reviewMode=true;
  resultView.classList.add('hidden');
  quizView.classList.remove('hidden');
  loadQuestion(0);
});

$('themeToggleBtn').addEventListener('click',()=>{
  const dark=document.body.getAttribute('data-theme')==='dark';
  document.body.setAttribute('data-theme',dark?'light':'dark');
  $('themeToggleBtn').textContent=dark?'🌙 Dark':'☀️ Light';
});

function registerSW(){
  if('serviceWorker' in navigator && location.protocol!=='file:'){
    navigator.serviceWorker.register('sw.js').catch(err=>console.log('SW registration failed:',err));
  }
}

initApp();
