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

let allQuestions = [];
let activeQuizQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let bookmarked = new Set();
let timerInterval = null;
let timeRemaining = 0;
let reviewMode = false;
let selectedCount = 25;
let currentLang = 'hi'; 
let currentUser = null;
let currentCaptchaAnswer = 0;

const $ = id => document.getElementById(id);
const authView = $('authView');
const setupView = $('setupView');
const quizView = $('quizView');
const resultView = $('resultView');
const subjectCards = [...document.querySelectorAll('.subject-card')];
const countCards = [...document.querySelectorAll('.count-card')];

function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  currentCaptchaAnswer = num1 + num2;
  const captchaLabel = $('captchaLabel');
  if (captchaLabel) captchaLabel.textContent = `Security Check: What is ${num1} + ${num2}?`;
}

document.addEventListener('DOMContentLoaded', () => {
  generateCaptcha();
  const savedTheme = localStorage.getItem('kaushalji_theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  $('themeToggleBtn').textContent = savedTheme === 'dark' ? '☀️ Light' : '🌙 Dark';

  const showLoginTab = $('showLoginTab');
  const showRegisterTab = $('showRegisterTab');
  const registerExtraFields = $('registerExtraFields');
  const emailLoginBtn = $('emailLoginBtn');
  const emailRegisterBtn = $('emailRegisterBtn');

  if (showRegisterTab && showLoginTab) {
    showRegisterTab.addEventListener('click', () => {
      registerExtraFields.style.display = 'flex';
      showRegisterTab.className = 'btn btn-primary btn-sm';
      showLoginTab.className = 'btn btn-secondary btn-sm';
      emailLoginBtn.style.display = 'none';
      emailRegisterBtn.style.display = 'block';
      generateCaptcha();
    });
    showLoginTab.addEventListener('click', () => {
      registerExtraFields.style.display = 'none';
      showLoginTab.className = 'btn btn-primary btn-sm';
      showRegisterTab.className = 'btn btn-secondary btn-sm';
      emailRegisterBtn.style.display = 'none';
      emailLoginBtn.style.display = 'block';
    });
  }

  const appInfoBtn = $('appInfoBtn');
  const appInfoModal = $('appInfoModal');
  const closeModalBtn = $('closeModalBtn');
  const closeModalFooterBtn = $('closeModalFooterBtn');
  const modalLiveDateTime = $('modalLiveDateTime');
  let timeIntervalId = null;

  function updateModalDateTime() {
    if (modalLiveDateTime) {
      const now = new Date();
      modalLiveDateTime.textContent = now.toLocaleString('en-IN', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
      });
    }
  }

  if (appInfoBtn && appInfoModal) {
    appInfoBtn.addEventListener('click', () => {
      appInfoModal.style.display = 'flex';
      updateModalDateTime();
      timeIntervalId = setInterval(updateModalDateTime, 1000);
    });
  }

  const closeModal = () => {
    if (appInfoModal) {
      appInfoModal.style.display = 'none';
      if (timeIntervalId) clearInterval(timeIntervalId);
    }
  };

  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (closeModalFooterBtn) closeModalFooterBtn.addEventListener('click', closeModal);
  if (appInfoModal) {
    appInfoModal.addEventListener('click', (e) => { if (e.target === appInfoModal) closeModal(); });
  }
});

function convertImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

onAuthStateChanged(auth, async (user) => {
  let activeUser = user;
  const localUserJson = localStorage.getItem('kaushalji_local_user');
  if (!activeUser && localUserJson) {
    try { activeUser = JSON.parse(localUserJson); } catch(e) {}
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
        <button id="profileToggleBtn" class="btn btn-secondary btn-sm" style="display:flex; align-items:center; gap:6px; border-radius:50px; padding:3px 10px;">
          <img src="${userPhoto}" alt="Profile" style="width:26px; height:26px; border-radius:50%; object-fit:cover;">
          <span>${userFullName.split(' ')[0]}</span>
        </button>
        <div id="profileDropdownMenu" class="profile-dropdown-menu">
          <div style="display:flex; gap:10px; align-items:center; border-bottom:1px solid var(--border); padding-bottom:0.75rem;">
            <img src="${userPhoto}" alt="User" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
            <div>
              <h4 style="margin:0; font-size:0.95rem;">${userFullName}</h4>
              <p style="margin:0; font-size:0.75rem; color:var(--muted);">${activeUser.email}</p>
              ${userMobile ? `<p style="margin:0; font-size:0.75rem; color:var(--success);">📱 ${userMobile}</p>` : ''}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.4rem;">
            <label style="font-size:0.75rem;font-weight:600;">Aapki Age (Umar):</label>
            <div style="display:flex;gap:0.4rem;">
              <input type="number" id="userAgeInput" class="btn btn-secondary btn-sm" style="width:100%; text-align:left;" value="${userAge}" placeholder="Age">
              <button id="saveAgeBtn" class="btn btn-primary btn-sm">Save</button>
            </div>
          </div>
          <button id="logoutBtn" class="btn btn-secondary btn-sm btn-block" style="color:var(--danger);">Logout</button>
        </div>
      </div>
    `;

    const profileToggleBtn = $('profileToggleBtn');
    const profileDropdownMenu = $('profileDropdownMenu');
    profileToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdownMenu.classList.toggle('show');
    });
    window.addEventListener('click', () => profileDropdownMenu.classList.remove('show'));
    profileDropdownMenu.addEventListener('click', (e) => e.stopPropagation());

    $('saveAgeBtn').addEventListener('click', async () => {
      const ageVal = $('userAgeInput').value;
      try {
        if(activeUser.uid && !activeUser.isLocal) {
          await setDoc(doc(db, "users", activeUser.uid), {
            uid: activeUser.uid, email: activeUser.email, displayName: userFullName, age: ageVal, updatedAt: serverTimestamp()
          }, { merge: true });
        }
        alert("Age successfully saved!");
        profileDropdownMenu.classList.remove('show');
      } catch(e) { alert("Failed to save age."); }
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
  signInWithPopup(auth, provider).catch((error) => alert("Login failed: " + error.message));
});

$('emailRegisterBtn').addEventListener('click', async () => {
  const email = $('authEmail').value;
  const password = $('authPassword').value;
  const fullName = $('regFullName').value;
  const mobile = $('regMobile').value;
  const captchaInput = parseInt($('regCaptchaInput').value);

  if(!email || !password || !fullName || !mobile) { alert('Kripya Sabhi Fields bharein!'); return; }
  if (isNaN(captchaInput) || captchaInput !== currentCaptchaAnswer) {
    alert('Galat Captcha! Kripya sahi calculation likhein.');
    generateCaptcha();
    return;
  }

  let photoBase64 = 'https://via.placeholder.com/150';
  const fileInput = $('regProfilePic');
  if (fileInput && fileInput.files && fileInput.files[0]) {
    try { photoBase64 = await convertImageToBase64(fileInput.files[0]); } catch(err) {}
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid, email, fullName, mobile, photoURL: photoBase64, createdAt: serverTimestamp()
    });
    alert('Firebase Registration Successful!');
  } catch (error) {
    const localUsers = JSON.parse(localStorage.getItem('kaushalji_registered_users') || '[]');
    if(localUsers.some(u => u.email === email)) { alert('Yeh email pehle se registered hai!'); return; }
    const newUser = { uid: 'local_' + Date.now(), email, password, fullName, mobile, photoURL: photoBase64, isLocal: true };
    localUsers.push(newUser);
    localStorage.setItem('kaushalji_registered_users', JSON.stringify(localUsers));
    localStorage.setItem('kaushalji_local_user', JSON.stringify(newUser));
    alert('Local Registration Successful!');
    window.location.reload();
  }
});

$('emailLoginBtn').addEventListener('click', (e) => {
  e.preventDefault();
  const email = $('authEmail').value;
  const password = $('authPassword').value;
  if(!email || !password) { alert('Kripya Email aur Password bharein!'); return; }

  const localUsers = JSON.parse(localStorage.getItem('kaushalji_registered_users') || '[]');
  const foundUser = localUsers.find(u => u.email === email && u.password === password);
  if (foundUser) {
    localStorage.setItem('kaushalji_local_user', JSON.stringify(foundUser));
    alert('Login Successful!');
    window.location.reload();
    return;
  }

  signInWithEmailAndPassword(auth, email, password).catch((error) => alert("Login Failed: " + error.message));
});

async function initApp() {
  try {
    const res = await fetch('questions.json');
    if(!res.ok) throw new Error('Failed to load questions.json');
    const rawData = await res.json();
    
    // Pro-level safety: Automatically assign dynamic IDs if missing in JSON
    allQuestions = rawData.map((q, idx) => ({
      id: q.id || `q_${idx + 1}`,
      subject: q.subject || 'general',
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation || 'No explanation provided.'
    }));

    $('questionBankInfo').textContent = `Question bank loaded: ${allQuestions.length} questions available.`;
  } catch (err) {
    $('questionBankInfo').textContent = 'Could not load questions.json. Please ensure it is in the root directory.';
    console.error(err);
  }
}

subjectCards.forEach(card => card.addEventListener('click', () => {
  const input = card.querySelector('input');
  if(input.value === 'all') {
    subjectCards.forEach(c => { c.querySelector('input').checked = c === card; c.classList.toggle('selected', c === card); });
  } else {
    const all = subjectCards[0]; all.querySelector('input').checked = false; all.classList.remove('selected');
    input.checked = !input.checked; card.classList.toggle('selected', input.checked);
    const any = subjectCards.slice(1).some(c => c.querySelector('input').checked);
    if(!any) { all.querySelector('input').checked = true; all.classList.add('selected'); }
  }
}));

countCards.forEach(card => card.addEventListener('click', () => {
  countCards.forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  selectedCount = Number(card.dataset.count);
}));

$('startQuizBtn').addEventListener('click', () => {
  if(!allQuestions.length) { alert('Question bank abhi load nahi hua hai.'); return; }
  const chosen = subjectCards.slice(1).filter(c => c.querySelector('input').checked).map(c => c.querySelector('input').value);
  let pool = subjectCards[0].querySelector('input').checked || chosen.length === 0 ? allQuestions : allQuestions.filter(q => chosen.includes(q.subject));
  if(!pool.length) { alert('Selected subjects ke liye koi questions nahi मिले.'); return; }
  
  pool = [...pool].sort(() => Math.random() - .5);
  activeQuizQuestions = pool.slice(0, Math.min(selectedCount, pool.length));
  currentIndex = 0; userAnswers = {}; bookmarked.clear(); reviewMode = false;
  
  setupView.classList.add('hidden'); 
  resultView.classList.add('hidden'); 
  quizView.classList.remove('hidden');
  
  timeRemaining = Math.ceil(activeQuizQuestions.length * 72);
  $('timerDisplay').textContent = formatTime(timeRemaining);
  startTimer(); 
  renderPalette(); 
  loadQuestion(0);
});

function formatTime(seconds) {
  return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeRemaining--; 
    $('timerDisplay').textContent = formatTime(Math.max(0, timeRemaining));
    if(timeRemaining <= 0) { clearInterval(timerInterval); finishQuiz(); }
  }, 1000);
}

function loadQuestion(index) {
  if(reviewMode) { renderAllReviewQuestions(); return; }
  const q = activeQuizQuestions[index];
  if(!q) return;

  $('questionCategory').textContent = (q.subject || 'General').toUpperCase();
  const qText = (typeof q.question === 'object') ? (q.question[currentLang] || q.question.en || '') : q.question;
  $('questionText').textContent = `${index + 1}. ${qText}`;
  $('quizQuestionCountText').textContent = `Question ${index + 1} of ${activeQuizQuestions.length}`;

  const container = $('optionsContainer');
  container.innerHTML = '';
  const optionsArr = (typeof q.options === 'object' && !Array.isArray(q.options)) ? (q.options[currentLang] || q.options.en || []) : q.options;

  optionsArr.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = `${String.fromCharCode(65 + idx)}. ${opt}`;
    if(userAnswers[index] === idx) btn.classList.add('selected');
    btn.addEventListener('click', () => selectOption(index, idx));
    container.appendChild(btn);
  });

  $('bookmarkBtn').textContent = bookmarked.has(index) ? '🔖 Bookmarked' : '🔖 Bookmark';
  $('explanationBox').classList.add('hidden');
  $('prevQuestionBtn').disabled = index === 0;
  $('nextQuestionBtn').disabled = index === activeQuizQuestions.length - 1;
  updatePalette();
}

function renderAllReviewQuestions() {
  $('quizQuestionCountText').textContent = `Total: ${activeQuizQuestions.length} Questions (Review Mode)`;
  $('timerDisplay').parentElement.parentElement.classList.add('hidden');
  $('questionPaletteAside').classList.add('hidden');
  $('quizMainLayoutContainer').style.gridTemplateColumns = '1fr';
  $('printReviewBtn').classList.remove('hidden');

  const containerWrapper = $('quizQuestionContainerWrapper');
  containerWrapper.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--border); padding-bottom:0.75rem;">
      <h3 style="font-size:1.2rem;">📖 Complete Test Review & Answer Key</h3>
      <button id="backToResultTopBtn" class="btn btn-secondary btn-sm">🔙 Back to Results</button>
    </div>
    <div id="allReviewListContainer" style="display:flex; flex-direction:column; gap:1.25rem;"></div>
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
  activeQuizQuestions.forEach((q, index) => {
    const qText = (typeof q.question === 'object') ? (q.question[currentLang] || q.question.en || '') : q.question;
    const optionsArr = (typeof q.options === 'object' && !Array.isArray(q.options)) ? (q.options[currentLang] || q.options.en || []) : q.options;
    const expl = (typeof q.explanation === 'object') ? (q.explanation[currentLang] || q.explanation.en || 'No explanation.') : (q.explanation || 'No explanation.');
    const userAns = userAnswers[index];
    const correctAns = q.answer;

    const card = document.createElement('div');
    card.style.cssText = "background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:1rem; display:flex; flex-direction:column; gap:0.5rem;";
    
    let optionsHtml = '';
    optionsArr.forEach((opt, oIdx) => {
      let bStyle = "padding:0.6rem; border:1px solid var(--border); border-radius:8px; background:var(--card-bg); font-size:0.9rem;";
      if (oIdx === correctAns) bStyle = "padding:0.6rem; border:2px solid var(--success); background:color-mix(in srgb, var(--success) 15%, var(--card-bg)); color:var(--success); font-weight:700;";
      else if (oIdx === userAns) bStyle = "padding:0.6rem; border:2px solid var(--danger); background:color-mix(in srgb, var(--danger) 15%, var(--card-bg)); color:var(--danger); font-weight:700;";
      optionsHtml += `<div style="${bStyle}">${String.fromCharCode(65 + oIdx)}. ${opt}</div>`;
    });

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:700; color:var(--primary);">
        <span>Question ${index + 1} (${q.subject.toUpperCase()})</span>
        <span>${userAns === correctAns ? '✓ Correct' : (userAns === undefined ? '⚪ Unanswered' : '✗ Incorrect')}</span>
      </div>
      <h4 style="font-size:1rem;">${qText}</h4>
      <div style="display:flex; flex-direction:column; gap:4px;">${optionsHtml}</div>
      <p style="font-size:0.85rem; color:var(--muted); background:var(--card-bg); padding:0.5rem; border-radius:6px;"><strong>Explanation:</strong> ${expl}</p>
    `;
    listContainer.appendChild(card);
  });
}

$('printReviewBtn').addEventListener('click', () => window.print());

function selectOption(qIdx, optIdx) {
  if(reviewMode) return;
  userAnswers[qIdx] = optIdx;
  loadQuestion(qIdx);
}

function renderPalette() {
  const grid = $('paletteGrid');
  grid.innerHTML = '';
  activeQuizQuestions.forEach((_, idx) => {
    const btn = document.createElement('button');
    btn.className = 'palette-btn';
    btn.textContent = idx + 1;
    btn.addEventListener('click', () => { currentIndex = idx; loadQuestion(idx); });
    grid.appendChild(btn);
  });
  updatePalette();
}

function updatePalette() {
  document.querySelectorAll('.palette-btn').forEach((btn, idx) => {
    btn.className = 'palette-btn';
    if(idx === currentIndex) btn.classList.add('current');
    if(userAnswers[idx] !== undefined) btn.classList.add('answered');
    if(bookmarked.has(idx)) btn.classList.add('bookmarked');
  });
}

$('bookmarkBtn').addEventListener('click', () => {
  if(bookmarked.has(currentIndex)) bookmarked.delete(currentIndex);
  else bookmarked.add(currentIndex);
  loadQuestion(currentIndex);
});

$('prevQuestionBtn').addEventListener('click', () => { if(currentIndex > 0) { currentIndex--; loadQuestion(currentIndex); } });
$('nextQuestionBtn').addEventListener('click', () => { if(currentIndex < activeQuizQuestions.length - 1) { currentIndex++; loadQuestion(currentIndex); } });
$('clearOptionBtn').addEventListener('click', () => { delete userAnswers[currentIndex]; loadQuestion(currentIndex); });
$('submitQuizBtn').addEventListener('click', () => { if(confirm('Are you sure you want to submit the test?')) finishQuiz(); });

async function finishQuiz() {
  clearInterval(timerInterval);
  quizView.classList.add('hidden');
  resultView.classList.remove('hidden');
  reviewMode = false;

  let correct = 0, wrong = 0, unanswered = 0;
  const bySubject = {};

  activeQuizQuestions.forEach((q, i) => {
    const s = q.subject || 'other';
    if(!bySubject[s]) bySubject[s] = { total: 0, correct: 0, wrong: 0, unanswered: 0 };
    bySubject[s].total++;
    if(userAnswers[i] === undefined) { unanswered++; bySubject[s].unanswered++; }
    else if(userAnswers[i] === q.answer) { correct++; bySubject[s].correct++; }
    else { wrong++; bySubject[s].wrong++; }
  });

  const score = correct - wrong * .25;
  const accuracy = correct + wrong ? Math.round(correct / (correct + wrong) * 100) : 0;
  
  $('finalScore').textContent = score.toFixed(2);
  $('maxScore').textContent = `/ ${activeQuizQuestions.length} Marks`;
  $('statCorrect').textContent = correct;
  $('statWrong').textContent = wrong;
  $('statUnanswered').textContent = unanswered;
  $('statAccuracy').textContent = `${accuracy}%`;

  const breakdown = $('subjectBreakdownContainer');
  breakdown.innerHTML = '';
  Object.entries(bySubject).forEach(([subject, stats]) => {
    const row = document.createElement('div');
    row.style.cssText = "display:flex; justify-content:space-between; background:var(--bg); padding:0.6rem 1rem; border-radius:8px; font-size:0.9rem;";
    row.innerHTML = `<strong>${subject.toUpperCase()}</strong> <span>${stats.correct}/${stats.total} correct</span>`;
    breakdown.appendChild(row);
  });

  if (currentUser && !currentUser.isLocal) {
    try {
      await setDoc(doc(collection(db, "quiz_progress")), {
        uid: currentUser.uid, email: currentUser.email, score, maxMarks: activeQuizQuestions.length, correct, wrong, unanswered, accuracy, timestamp: serverTimestamp()
      });
    } catch (e) { console.error(e); }
  }
}

$('restartQuizBtn').addEventListener('click', () => {
  clearInterval(timerInterval);
  resultView.classList.add('hidden');
  setupView.classList.remove('hidden');
});

$('reviewAnswersBtn').addEventListener('click', () => {
  reviewMode = true;
  resultView.classList.add('hidden');
  quizView.classList.remove('hidden');
  loadQuestion(0);
});

$('themeToggleBtn').addEventListener('click', () => {
  const dark = document.body.getAttribute('data-theme') === 'dark';
  const newTheme = dark ? 'light' : 'dark';
  document.body.setAttribute('data-theme', newTheme);
  localStorage.setItem('kaushalji_theme', newTheme);
  $('themeToggleBtn').textContent = newTheme === 'dark' ? '☀️ Light' : '🌙 Dark';
});

initApp();
