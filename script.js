import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
let currentCaptcha = '';

const $=id=>document.getElementById(id);
const authView=$('authView'),setupView=$('setupView'),quizView=$('quizView'),resultView=$('resultView');
const subjectCards=[...document.querySelectorAll('.subject-card')],countCards=[...document.querySelectorAll('.count-card')];

// --- SYSTEM STATS & INFO MODAL ---
function initSystemStats() {
  // Live Date/Time & QR Code setup
  const upiString = "upi://pay?pa=mandavikaushal913@okaxis&pn=Kaushalji&cu=INR";
  if($('upiQrImg')) {
    $('upiQrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(upiString)}`;
  }

  setInterval(() => {
    const now = new Date();
    if($('modalLiveTime')) $('modalLiveTime').textContent = now.toLocaleTimeString();
  }, 1000);

  // Battery Status API
  if (navigator.getBattery) {
    navigator.getBattery().then(battery => {
      const updateBattery = () => {
        const pct = Math.round(battery.level * 100);
        if($('sysBattery')) $('sysBattery').textContent = `⚡ Battery: ${pct}%`;
        if($('modalBattery')) $('modalBattery').textContent = `${pct}% ${battery.charging ? '(Charging 🔌)' : ''}`;
      };
      updateBattery();
      battery.addEventListener('levelchange', updateBattery);
      battery.addEventListener('chargingchange', updateBattery);
    });
  } else {
    if($('sysBattery')) $('sysBattery').textContent = `⚡ Battery: N/A`;
    if($('modalBattery')) $('modalBattery').textContent = `Not supported by browser`;
  }

  // Network Connection status
  const updateNetwork = () => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const speed = conn ? `${conn.downlink || 'Fast'} Mbps (${conn.effectiveType || '4G'})` : 'Online';
    if($('sysNetwork')) $('sysNetwork').textContent = `📶 ${navigator.onLine ? 'Online' : 'Offline'}`;
    if($('modalNetwork')) $('modalNetwork').textContent = speed;
  };
  updateNetwork();
  window.addEventListener('online', updateNetwork);
  window.addEventListener('offline', updateNetwork);

  // Modal Event Listeners
  if($('sysInfoBtn')) {
    $('sysInfoBtn').addEventListener('click', () => $('appInfoModal').classList.remove('hidden'));
  }
  if($('closeModalBtn')) {
    $('closeModalBtn').addEventListener('click', () => $('appInfoModal').classList.add('hidden'));
  }
  window.addEventListener('click', (e) => {
    if(e.target === $('appInfoModal')) $('appInfoModal').classList.add('hidden');
  });

  // Share App Button
  if($('shareAppBtn')) {
    $('shareAppBtn').addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'UPSSSC PET Quiz Master',
            text: 'Prepare for UPSSSC PET 2026 with mock tests and quizzes!',
            url: window.location.href,
          });
        } catch (err) { console.log('Share canceled'); }
      } else {
        navigator.clipboard.writeText(window.location.href);
        alert('📋 App Link Copied to Clipboard!');
      }
    });
  }
}

// --- CAPTCHA GENERATOR ---
function generateCaptcha() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let captcha = '';
  for (let i = 0; i < 6; i++) {
    captcha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  currentCaptcha = captcha;
  if ($('captchaBox')) $('captchaBox').textContent = captcha;
}

// --- AUTHENTICATION STATE HANDLER ---
function checkAuthStatus() {
  const localUser = localStorage.getItem('local_quiz_user');
  if (localUser) {
    currentUser = JSON.parse(localUser);
    renderUserProfile(currentUser);
    return;
  }

  onAuthStateChanged(auth, (user) => {
    if (user && !localStorage.getItem('local_quiz_user')) {
      currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Google User',
        photoURL: user.photoURL || 'https://via.placeholder.com/40',
        mobile: 'N/A'
      };
      renderUserProfile(currentUser);
    } else if (!localUser) {
      currentUser = null;
      renderLoggedOutState();
    }
  });
}

function renderUserProfile(user) {
  const authContainer = $('authContainer');
  authContainer.innerHTML = `
    <div class="profile-dropdown-container">
      <button id="profileToggleBtn" class="profile-icon-btn">
        <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="Profile" class="profile-icon-img">
      </button>
      <div id="profileDropdownMenu" class="profile-dropdown-menu">
        <div class="profile-user-info">
          <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="User">
          <div class="profile-user-details">
            <h4>${user.displayName}</h4>
            <p>${user.email}</p>
            <p style="font-size:0.75rem; color:var(--muted);">📱 ${user.mobile || 'No mobile'}</p>
          </div>
        </div>
        <button id="logoutBtn" class="btn btn-secondary btn-sm btn-block" style="margin-top:0.5rem;">Logout</button>
      </div>
    </div>
  `;

  $('profileToggleBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('profileDropdownMenu').classList.toggle('show');
  });

  window.addEventListener('click', () => {
    const menu = $('profileDropdownMenu');
    if(menu) menu.classList.remove('show');
  });

  $('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('local_quiz_user');
    signOut(auth).catch(() => {});
    currentUser = null;
    renderLoggedOutState();
  });
  
  authView.classList.add('hidden');
  setupView.classList.remove('hidden');
}

function renderLoggedOutState() {
  const authContainer = $('authContainer');
  authContainer.innerHTML = '';
  setupView.classList.add('hidden');
  quizView.classList.add('hidden');
  resultView.classList.add('hidden');
  authView.classList.remove('hidden');
  generateCaptcha();
}

// --- TAB SWITCHING (Login / Register) ---
$('showLoginTab').addEventListener('click', () => {
  $('showLoginTab').className = 'btn btn-primary';
  $('showRegisterTab').className = 'btn btn-secondary';
  $('localLoginForm').style.display = 'flex';
  $('localRegisterForm').style.display = 'none';
});

$('showRegisterTab').addEventListener('click', () => {
  $('showRegisterTab').className = 'btn btn-primary';
  $('showLoginTab').className = 'btn btn-secondary';
  $('localRegisterForm').style.display = 'flex';
  $('localLoginForm').style.display = 'none';
  generateCaptcha();
});

$('refreshCaptchaBtn').addEventListener('click', generateCaptcha);

// --- GOOGLE LOGIN ---
$('googleLoginBtn').addEventListener('click', () => {
  signInWithPopup(auth, provider).catch((error) => {
    console.error("Google Auth Error:", error);
    alert("Login failed: " + error.message);
  });
});

// --- LOCAL STORAGE REGISTRATION ---
$('localRegisterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('regName').value.trim();
  const email = $('regEmail').value.trim();
  const mobile = $('regMobile').value.trim();
  const password = $('regPassword').value;
  const photo = $('regPhoto').value.trim() || 'https://via.placeholder.com/40';
  const captchaInput = $('regCaptchaInput').value.trim();

  if (captchaInput !== currentCaptcha) {
    alert('❌ Invalid Captcha Code! Kripya sahi captcha bharein.');
    generateCaptcha();
    return;
  }

  let users = JSON.parse(localStorage.getItem('local_quiz_users') || '[]');
  if (users.some(u => u.email === email)) {
    alert('⚠️ Yeh email pehle se registered hai! Kripya Login karein.');
    return;
  }

  const newUser = { uid: 'local_' + Date.now(), name, email, mobile, password, photo };
  users.push(newUser);
  localStorage.setItem('local_quiz_users', JSON.stringify(users));

  localStorage.setItem('local_quiz_user', JSON.stringify({
    uid: newUser.uid,
    email: newUser.email,
    displayName: newUser.name,
    photoURL: newUser.photo,
    mobile: newUser.mobile
  }));

  alert('✅ Registration Successful!');
  checkAuthStatus();
});

// --- LOCAL STORAGE LOGIN ---
$('localLoginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;

  let users = JSON.parse(localStorage.getItem('local_quiz_users') || '[]');
  const validUser = users.find(u => u.email === email && u.password === password);

  if (validUser) {
    localStorage.setItem('local_quiz_user', JSON.stringify({
      uid: validUser.uid,
      email: validUser.email,
      displayName: validUser.name,
      photoURL: validUser.photo,
      mobile: validUser.mobile
    }));
    alert('🎉 Login Successful!');
    checkAuthStatus();
  } else {
    alert('❌ Invalid Email ya Password! Kripya dobara koshish karein.');
  }
});

// --- INIT APP ---
async function initApp(){
  initSystemStats();
  try{
    const res=await fetch('questions.json');
    if(!res.ok) throw new Error('questions.json could not be loaded');
    allQuestions=await res.json();
    $('questionBankInfo').textContent=`Question bank loaded: ${allQuestions.length} questions.`;
  }catch(err){
    $('questionBankInfo').textContent='Could not load questions.json. Use a local web server (Live Server).';
    console.error(err);
  }
  checkAuthStatus();
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
    if(reviewMode&&idx===currentIndex)btn.setAttribute('aria-current','true');
    else btn.removeAttribute('aria-current');
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

  if (currentUser) {
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
      console.log("Progress saved to Firestore!");
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
