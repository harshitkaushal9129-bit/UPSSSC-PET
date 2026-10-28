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

const $=id=>document.getElementById(id);
const authView=$('authView'),setupView=$('setupView'),quizView=$('quizView'),resultView=$('resultView');
const subjectCards=[...document.querySelectorAll('.subject-card')],countCards=[...document.querySelectorAll('.count-card')];

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

    window.addEventListener('click', () => {
      profileDropdownMenu.classList.remove('show');
    });

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
    if(reviewMode){
      if(idx===q.answer)btn.classList.add('correct');
      else if(userAnswers[index]===idx)btn.classList.add('wrong');
    }
    btn.disabled=reviewMode;
    btn.addEventListener('click',()=>selectOption(index,idx));
    container.appendChild(btn);
  });

  $('bookmarkBtn').textContent=bookmarked.has(index)?'🔖 Bookmarked':'🔖 Bookmark';
  
  const explanationBox = $('explanationBox');
  const explanationText = $('explanationText');
  
  if(reviewMode){
    explanationBox.classList.remove('hidden');
    const expl = (typeof q.explanation === 'object') ? (q.explanation[currentLang] || q.explanation.en || 'No explanation provided.') : (q.explanation || 'No explanation provided.');
    explanationText.textContent = expl;
  } else {
    explanationBox.classList.add('hidden');
    explanationText.textContent = '';
  }

  $('prevQuestionBtn').disabled=index===0;
  $('nextQuestionBtn').disabled=index===activeQuizQuestions.length-1;
  $('clearOptionBtn').disabled=reviewMode;
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
  currentIndex=0;
  loadQuestion(0);
  $('submitQuizBtn').textContent='Back to Results';
  $('submitQuizBtn').onclick=()=>{
    quizView.classList.add('hidden');
    resultView.classList.remove('hidden');
    $('submitQuizBtn').textContent='Submit Test';
    $('submitQuizBtn').onclick=()=>{if(confirm('Are you sure you want to submit the test?'))finishQuiz()};
  };
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
