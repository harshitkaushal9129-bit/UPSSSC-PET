import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
let selectedYear=null; 
let currentLang='hi'; 
let currentUser = null;

const $=id=>document.getElementById(id);
const authView=$('authView'),setupView=$('setupView'),quizView=$('quizView'),resultView=$('resultView');
const subjectCards=[...document.querySelectorAll('.subject-card')],countCards=[...document.querySelectorAll('.count-card:not(.year-card)')];

// Live Universal Header Stats Tracker
function initGlobalSysHeader() {
  setInterval(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const dateStr = now.toLocaleDateString();
    if($('sysTimeDisplay')) $('sysTimeDisplay').textContent = `🕒 ${timeStr}`;
    if($('sysDateDisplay')) $('sysDateDisplay').textContent = `📅 ${dateStr}`;
  }, 1000);

  setInterval(() => {
    const speed = (Math.random() * 2.5 + 0.1).toFixed(2);
    if($('sysNetSpeed')) $('sysNetSpeed').textContent = `⚡ ${speed} MB/s`;
  }, 3000);

  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      const updateBattery = () => {
        const level = Math.round(battery.level * 100);
        const charging = battery.charging ? '⚡' : '🔋';
        if($('sysBattery')) $('sysBattery').textContent = `${charging} ${level}%`;
        if($('modalPowerStatus')) $('modalPowerStatus').textContent = `${level}%`;
      };
      updateBattery();
      battery.addEventListener('levelchange', updateBattery);
      battery.addEventListener('chargingchange', updateBattery);
    });
  }

  const infoModal = $('systemInfoModalOverlay');
  const qrModal = $('qrModalOverlay');

  $('openInfoModalBtn').addEventListener('click', () => { infoModal.classList.remove('hidden'); });
  $('closeInfoModalBtn').addEventListener('click', () => { infoModal.classList.add('hidden'); });
  $('qrSupportBtn').addEventListener('click', () => { qrModal.classList.remove('hidden'); });
  $('closeQrModalBtn').addEventListener('click', () => { qrModal.classList.add('hidden'); });

  window.addEventListener('click', (e) => {
    if(e.target === infoModal) infoModal.classList.add('hidden');
    if(e.target === qrModal) qrModal.classList.add('hidden');
  });
}
initGlobalSysHeader();

// Share App Functionality
const shareAppBtn = $('shareAppBtn');
if (shareAppBtn) {
  shareAppBtn.addEventListener('click', async () => {
    const shareData = {
      title: 'UPSSSC PET Exam Quiz Prep - Kaushalji',
      text: 'UPSSSC PET Exam ki taiyari ke liye best free quiz portal try karein!',
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('App link clipboard par copy ho gaya hai!');
      } catch (err) {
        alert('Link copy nahi ho saka.');
      }
    }
  });
}

// Toggle Register Extra Fields visibility when clicking Register button
let isRegisterMode = false;
$('emailRegisterBtn').addEventListener('click', () => {
  const extraFields = $('regExtraFields');
  if (!isRegisterMode) {
    extraFields.classList.remove('hidden');
    $('emailRegisterBtn').textContent = "Submit Registration";
    $('emailLoginBtn').textContent = "Back to Login";
    isRegisterMode = true;
  } else {
    const name = $('regName').value.trim();
    const email = $('authEmail').value.trim().toLowerCase();
    const password = $('authPassword').value;
    const mobile = $('regMobile').value.trim();
    const photoInput = $('regPhoto');

    if(!name || !email || !password || !mobile) {
      alert('Kripya sabhi fields bharein!');
      return;
    }

    let users = JSON.parse(localStorage.getItem('kaushalji_users') || '[]');
    if (users.some(u => u.email === email)) {
      alert('Yeh Email ID pehle se registered hai! Kripya Login karein.');
      return;
    }

    const reader = new FileReader();
    const saveUserData = (photoDataUrl) => {
      const newUser = {
        name,
        email,
        password,
        mobile,
        photoURL: photoDataUrl || 'https://via.placeholder.com/40',
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      localStorage.setItem('kaushalji_users', JSON.stringify(users));
      localStorage.setItem('kaushalji_active_user', JSON.stringify(newUser));
      alert('Registration successful!');
      checkAuthSession();
    };

    if (photoInput.files && photoInput.files[0]) {
      reader.onload = function(e) { saveUserData(e.target.result); };
      reader.readAsDataURL(photoInput.files[0]);
    } else {
      saveUserData(null);
    }
  }
});

// Email Login Form Submit Handler (LocalStorage)
$('emailAuthForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (isRegisterMode) return;

  const email = $('authEmail').value.trim().toLowerCase();
  const password = $('authPassword').value;

  const users = JSON.parse(localStorage.getItem('kaushalji_users') || '[]');
  const foundUser = users.find(u => u.email === email && u.password === password);

  if (foundUser) {
    localStorage.setItem('kaushalji_active_user', JSON.stringify(foundUser));
    alert('Login successful!');
    checkAuthSession();
  } else {
    alert('Invalid Email ID or Password!');
  }
});

// Google Sign-In via Firebase
$('googleLoginBtn').addEventListener('click', () => {
  signInWithPopup(auth, provider).catch((error) => {
    console.error("Google Auth Error:", error);
    alert("Google Login failed: " + error.message);
  });
});

// Check Active Session (LocalStorage or Firebase)
function checkAuthSession() {
  const localUser = localStorage.getItem('kaushalji_active_user');
  if (localUser) {
    currentUser = JSON.parse(localUser);
    renderUserProfileHeader(currentUser.name, currentUser.email, currentUser.photoURL, currentUser.mobile, true);
    authView.classList.add('hidden');
    setupView.classList.remove('hidden');
  } else {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        let userAge = '';
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) { userAge = userSnap.data().age || ''; }
        } catch(err) { console.error(err); }

        renderUserProfileHeader(user.displayName || 'User', user.email, user.photoURL || 'https://via.placeholder.com/40', 'Google User', false);
        authView.classList.add('hidden');
        setupView.classList.remove('hidden');
      } else {
        if (!localStorage.getItem('kaushalji_active_user')) {
          currentUser = null;
          $('authContainer').innerHTML = '';
          setupView.classList.add('hidden');
          quizView.classList.add('hidden');
          resultView.classList.add('hidden');
          authView.classList.remove('hidden');
        }
      }
    });
  }
}

// Render Profile Header
function renderUserProfileHeader(name, email, photo, mobile, isLocal) {
  const authContainer = $('authContainer');
  authContainer.innerHTML = `
    <div class="profile-dropdown-container" style="position:relative; display:inline-block;">
      <button id="profileToggleBtn" class="profile-icon-btn" style="background:none; border:2px solid var(--primary); border-radius:50%; width:40px; height:40px; cursor:pointer; overflow:hidden; display:flex; align-items:center; justify-content:center;">
        <img src="${photo}" alt="Profile" style="width:100%; height:100%; object-fit:cover;">
      </button>
      <div id="profileDropdownMenu" class="profile-dropdown-menu" style="position:absolute; right:0; top:50px; background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:1rem; width:280px; box-shadow:0 10px 25px rgba(0,0,0,0.3); display:none; z-index:100; flex-direction:column; gap:0.75rem;">
        <div style="display:flex; align-items:center; gap:0.75rem; border-bottom:1px solid var(--border); padding-bottom:0.75rem;">
          <img src="${photo}" alt="User" style="width:45px; height:45px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);">
          <div style="overflow:hidden;">
            <h4 style="font-size:0.95rem; font-weight:700; color:var(--text);">${name}</h4>
            <p style="font-size:0.75rem; color:var(--muted); word-break:break-all;">${email}</p>
            <p style="font-size:0.75rem; color:var(--primary); font-weight:600; margin-top:2px;">📱 ${mobile}</p>
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
    profileDropdownMenu.style.display = profileDropdownMenu.style.display === 'flex' ? 'none' : 'flex';
  });

  window.addEventListener('click', () => { profileDropdownMenu.style.display = 'none'; });
  profileDropdownMenu.addEventListener('click', (e) => e.stopPropagation());

  $('logoutBtn').addEventListener('click', () => {
    if (isLocal) {
      localStorage.removeItem('kaushalji_active_user');
      currentUser = null;
      checkAuthSession();
    } else {
      signOut(auth).then(() => {
        currentUser = null;
        checkAuthSession();
      });
    }
  });
}

// Load Questions & Automatically Generate Unique IDs
async function initApp(){
  try{
    const res=await fetch('questions.json');
    if(!res.ok) throw new Error('questions.json could not be loaded');
    const rawData = await res.json();
    
    allQuestions = rawData.map((q, index) => ({
      id: index + 1,
      ...q
    }));

    if($('questionBankInfo')) $('questionBankInfo').textContent=`Question bank loaded: ${allQuestions.length} questions.`;
    renderDynamicYearButtons();
  }catch(err){
    if($('questionBankInfo')) $('questionBankInfo').textContent='Could not load questions.json. Use a local web server.';
    console.error(err);
  }
  checkAuthSession();
  registerSW();
}

function renderDynamicYearButtons() {
  const yearGrid = $('yearGrid');
  if(!yearGrid) return;
  yearGrid.innerHTML = '';

  const yearsSet = new Set();
  allQuestions.forEach(q => { yearsSet.add(q.year || 2026); });
  const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

  sortedYears.forEach(year => {
    const btn = document.createElement('button');
    btn.className = 'count-card year-card';
    btn.dataset.year = year;
    btn.innerHTML = `<b>${year}</b><span>PET Exam Set</span><small>📜 Question Bank</small>`;
    
    btn.addEventListener('click', () => {
      document.querySelectorAll('.year-card').forEach(c => c.classList.remove('selected'));
      btn.classList.add('selected');
      selectedYear = year;
      
      const dynamicContainer = $('dynamicCountAndStartContainer');
      if(dynamicContainer) {
        dynamicContainer.style.display = 'block';
        dynamicContainer.scrollIntoView({ behavior: 'smooth' });
      }
    });
    yearGrid.appendChild(btn);
  });
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

countCards.forEach(card=>card.addEventListener('click',()=>{
  countCards.forEach(c=>c.classList.remove('selected'));
  card.classList.add('selected');
  selectedCount=Number(card.dataset.count);
}));

$('startQuizBtn').addEventListener('click',()=>{
  if(!selectedYear){alert('Kripya pehle exam year select karein!');return;}
  if(!allQuestions.length){alert('Question bank load nahi hua.');return;}
  
  const chosen=subjectCards.slice(1).filter(c=>c.querySelector('input').checked).map(c=>c.querySelector('input').value);
  
  let pool = allQuestions.filter(q => String(q.year || 2026) === String(selectedYear));
  if(!subjectCards[0].querySelector('input').checked && chosen.length > 0) {
    pool = pool.filter(q => chosen.includes(q.subject));
  }

  if(!pool.length){alert('Selected year aur subjects ke liye questions available nahi hain.');return;}
  
  pool=[...pool].sort(()=>Math.random()-.5);
  activeQuizQuestions=pool.slice(0,Math.min(selectedCount,pool.length));
  currentIndex=0;userAnswers={};bookmarked.clear();reviewMode=false;
  setupView.classList.add('hidden');resultView.classList.add('hidden');quizView.classList.remove('hidden');
  timeRemaining=Math.ceil(activeQuizQuestions.length*72);$('timerDisplay').textContent=formatTime(timeRemaining);
  startTimer();renderPalette();loadQuestion(0);
});

function formatTime(seconds){
  return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
}

function startTimer(){
  clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    timeRemaining--; 
    $('timerDisplay').textContent=formatTime(Math.max(0,timeRemaining));
    if(timeRemaining<=0){clearInterval(timerInterval);finishQuiz();}
  },1000);
}

function loadQuestion(index){
  if(reviewMode) { renderAllReviewQuestions(); return; }

  const q=activeQuizQuestions[index];
  if(!q)return;

  $('questionCategory').textContent=(q.subject || 'General').toUpperCase();
  $('quizSubjectBadge').textContent=`UPSSSC PET (${selectedYear})`;

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
    if(userAnswers[index]===idx) btn.classList.add('selected');
    btn.addEventListener('click',()=>selectOption(index,idx));
    container.appendChild(btn);
  });

  $('bookmarkBtn').textContent=bookmarked.has(index)?'🔖 Bookmarked':'🔖 Bookmark';
  $('explanationBox').classList.add('hidden');
  $('explanationText').textContent = '';

  $('prevQuestionBtn').disabled=index===0;
  $('nextQuestionBtn').disabled=index===activeQuizQuestions.length-1;
  updatePalette();
}

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
    if(idx===currentIndex) btn.classList.add('current');
    if(userAnswers[idx]!==undefined) btn.classList.add('answered');
    if(bookmarked.has(idx)) btn.classList.add('bookmarked');
  });
}

$('bookmarkBtn').addEventListener('click',()=>{
  if(bookmarked.has(currentIndex)) bookmarked.delete(currentIndex);
  else bookmarked.add(currentIndex);
  loadQuestion(currentIndex);
});

$('prevQuestionBtn').addEventListener('click',()=>{if(currentIndex>0){currentIndex--;loadQuestion(currentIndex)}});
$('nextQuestionBtn').addEventListener('click',()=>{if(currentIndex<activeQuizQuestions.length-1){currentIndex++;loadQuestion(currentIndex)}});
$('clearOptionBtn').addEventListener('click',()=>{delete userAnswers[currentIndex];loadQuestion(currentIndex)});

$('submitQuizBtn').addEventListener('click',()=>{
  if(confirm('Kya aap test submit karna chahte hain?')) finishQuiz();
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
    if(!bySubject[s]) bySubject[s]={total:0,correct:0,wrong:0,unanswered:0};
    bySubject[s].total++;
    if(userAnswers[i]===undefined){unanswered++;bySubject[s].unanswered++;}
    else if(userAnswers[i]===q.answer){correct++;bySubject[s].correct++;}
    else{wrong++;bySubject[s].wrong++;}
  });

  const score=correct-wrong*.25;
  const accuracy=correct+wrong?Math.round(correct/(correct+wrong)*100):0;
  
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
    let history = JSON.parse(localStorage.getItem('kaushalji_quiz_history') || '[]');
    history.push({
      email: currentUser.email || currentUser.displayName,
      examYear: selectedYear,
      score: score.toFixed(2),
      correct,
      wrong,
      accuracy,
      date: new Date().toLocaleString()
    });
    localStorage.setItem('kaushalji_quiz_history', JSON.stringify(history));
  }
}

$('restartQuizBtn').addEventListener('click',()=>{
  resultView.classList.add('hidden');
  setupView.classList.remove('hidden');
  $('dynamicCountAndStartContainer').style.display = 'none';
  selectedYear = null;
  renderDynamicYearButtons();
});

$('reviewAnswersBtn').addEventListener('click',()=>{
  reviewMode=true;
  resultView.classList.add('hidden');
  quizView.classList.remove('hidden');
  loadQuestion(0);
});

function renderAllReviewQuestions() {
  $('quizSubjectBadge').textContent = `Review (${selectedYear})`;
  $('quizQuestionCountText').textContent = `Total: ${activeQuizQuestions.length}`;
  $('timerDisplay').parentElement.parentElement.classList.add('hidden');
  $('questionPaletteAside').classList.add('hidden');
  $('quizMainLayoutContainer').style.gridTemplateColumns = '1fr';
  $('printReviewBtn').classList.remove('hidden');

  const containerWrapper = $('quizQuestionContainerWrapper');
  containerWrapper.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:2px solid var(--border); padding-bottom:1rem;">
      <h2>📖 Test Review & Answer Key</h2>
      <button id="backToResultBtn" class="btn btn-secondary btn-sm">🔙 Back</button>
    </div>
    <div id="allReviewListContainer" style="display:flex; flex-direction:column; gap:1.5rem;"></div>
  `;

  $('backToResultBtn').addEventListener('click', () => {
    quizView.classList.add('hidden');
    resultView.classList.remove('hidden');
    $('timerDisplay').parentElement.parentElement.classList.remove('hidden');
    $('questionPaletteAside').classList.remove('hidden');
    $('quizMainLayoutContainer').style.gridTemplateColumns = '';
    $('printReviewBtn').classList.add('hidden');
  });

  const listContainer = $('allReviewListContainer');
  activeQuizQuestions.forEach((q, index) => {
    const qText = (typeof q.question === 'object') ? (q.question[currentLang] || q.question.en || '') : q.question;
    const optionsArr = (typeof q.options === 'object' && !Array.isArray(q.options)) ? (q.options[currentLang] || q.options.en || []) : q.options;
    const expl = (typeof q.explanation === 'object') ? (q.explanation[currentLang] || q.explanation.en || 'No explanation.') : (q.explanation || 'No explanation.');
    const userAns = userAnswers[index];
    const correctAns = q.answer;

    let optionsHtml = '';
    optionsArr.forEach((opt, oIdx) => {
      let bStyle = "padding:0.6rem 1rem; border:1px solid var(--border); border-radius:8px; margin-bottom:0.3rem; background:var(--card-bg);";
      if(oIdx === correctAns) bStyle += "border-color:var(--success); color:var(--success); font-weight:700;";
      else if(oIdx === userAns) bStyle += "border-color:var(--danger); color:var(--danger); font-weight:700;";
      optionsHtml += `<div style="${bStyle}">${String.fromCharCode(65+oIdx)}. ${opt}</div>`;
    });

    const card = document.createElement('div');
    card.style.cssText = "background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:1rem;";
    card.innerHTML = `<strong>Q.${index+1}</strong> <p style="margin:0.4rem 0;">${qText}</p>${optionsHtml}<p style="font-size:0.85rem; color:var(--muted); margin-top:0.5rem;"><strong>Explanation:</strong> ${expl}</p>`;
    listContainer.appendChild(card);
  });
}

$('printReviewBtn').addEventListener('click', () => { window.print(); });

$('themeToggleBtn').addEventListener('click',()=>{
  const dark=document.body.getAttribute('data-theme')==='dark';
  document.body.setAttribute('data-theme',dark?'light':'dark');
  $('themeToggleBtn').textContent=dark?'🌙 Dark':'☀️ Light';
});

function registerSW(){
  if('serviceWorker' in navigator && location.protocol!=='file:'){
    navigator.serviceWorker.register('sw.js').catch(err=>console.log('SW failed:',err));
  }
}

initApp();
