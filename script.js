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

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  const authContainer = $('authContainer');
  if (user) {
    let userAge = '';
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        userAge = userSnap.data().age || '';
      }
    } catch(err) { console.error(err); }

    authContainer.innerHTML = `
      <div class="profile-dropdown-container">
        <button id="profileToggleBtn" class="profile-icon-btn">
          <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="Profile" class="profile-icon-img">
        </button>
        <div id="profileDropdownMenu" class="profile-dropdown-menu">
          <div class="profile-user-info">
            <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="User">
            <div class="profile-user-details">
              <h4>${user.displayName || 'User'}</h4>
              <p>${user.email}</p>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.4rem;">
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

    window.addEventListener('click', () => { profileDropdownMenu.classList.remove('show'); });
    profileDropdownMenu.addEventListener('click', (e) => e.stopPropagation());

    $('saveAgeBtn').addEventListener('click', async () => {
      const ageVal = $('userAgeInput').value;
      try {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'User',
          photoURL: user.photoURL || '',
          age: ageVal,
          updatedAt: serverTimestamp()
        }, { merge: true });
        alert("Age successfully saved to Firebase!");
        profileDropdownMenu.classList.remove('show');
      } catch(e) {
        console.error("Error saving age:", e);
        alert("Failed to save age.");
      }
    });

    $('logoutBtn').addEventListener('click', () => signOut(auth));
    
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

$('emailRegisterBtn').addEventListener('click', () => {
  const email = $('authEmail').value;
  const password = $('authPassword').value;
  if(!email || !password) { alert('Kripya Email aur Password bharein!'); return; }
  createUserWithEmailAndPassword(auth, email, password)
    .catch((error) => alert("Registration Failed: " + error.message));
});

$('emailLoginBtn').addEventListener('click', (e) => {
  e.preventDefault();
  const email = $('authEmail').value;
  const password = $('authPassword').value;
  if(!email || !password) { alert('Kripya Email aur Password bharein!'); return; }
  signInWithEmailAndPassword(auth, email, password)
    .catch((error) => alert("Login Failed: " + error.message));
});

// Load Questions & Dynamically Generate Year Buttons from JSON data
async function initApp(){
  try{
    const res=await fetch('questions.json');
    if(!res.ok) throw new Error('questions.json could not be loaded');
    allQuestions=await res.json();
    if($('questionBankInfo')) $('questionBankInfo').textContent=`Question bank loaded: ${allQuestions.length} questions.`;
    
    // Automatically Extract and Render Years from questions.json
    renderDynamicYearButtons();
  }catch(err){
    if($('questionBankInfo')) $('questionBankInfo').textContent='Could not load questions.json. Use a local web server (Live Server).';
    console.error(err);
  }
  registerSW();
}

function renderDynamicYearButtons() {
  const yearGrid = $('yearGrid');
  if(!yearGrid) return;
  yearGrid.innerHTML = '';

  // Extract unique years from allQuestions (agar kisi question me year na ho toh default 2026 maan lo)
  const yearsSet = new Set();
  allQuestions.forEach(q => {
    yearsSet.add(q.year || 2026);
  });

  // Sort years in descending order (e.g., 2026, 2025, 2024...)
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

countCards.forEach(card=>card.addEventListener('click',()=>{countCards.forEach(c=>c.classList.remove('selected'));card.classList.add('selected');selectedCount=Number(card.dataset.count)}));

$('startQuizBtn').addEventListener('click',()=>{
  if(!selectedYear){alert('Kripya pehle exam year select karein!');return;}
  if(!allQuestions.length){alert('Question bank load nahi hua.');return;}
  
  const chosen=subjectCards.slice(1).filter(c=>c.querySelector('input').checked).map(c=>c.querySelector('input').value);
  
  // Filter by both Subject & Selected Year from JSON
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
  $('quizSubjectBadge').textContent = `Review All (${selectedYear})`;
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
        examYear: selectedYear,
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
registerSW();
