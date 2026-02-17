/* ============================
   잼재미 어린이집 - 애플리케이션
   ============================ */

// ============================
// Firebase 초기화
// ============================
const firebaseConfig = {
    apiKey: "AIzaSyD4z9INQCui_o1L28cAH3vMbLM8fpbOH_k",
    authDomain: "jamjaemi-daycare.firebaseapp.com",
    projectId: "jamjaemi-daycare",
    storageBucket: "jamjaemi-daycare.firebasestorage.app",
    messagingSenderId: "551568726005",
    appId: "1:551568726005:web:2f4bfa45284e403d20f2bc",
    databaseURL: "https://jamjaemi-daycare-default-rtdb.firebaseio.com"
};

firebase.initializeApp(firebaseConfig);
const firebaseDB = firebase.database();
let firebaseReady = false;
let syncInProgress = false;

// ============================
// 데이터 관리 (localStorage + Firebase 동기화)
// ============================
const DB = {
    get(key, fallback = []) {
        try {
            const data = localStorage.getItem('jamjaemi_' + key);
            return data ? JSON.parse(data) : fallback;
        } catch { return fallback; }
    },
    set(key, value) {
        localStorage.setItem('jamjaemi_' + key, JSON.stringify(value));
        // Firebase에도 동기화
        if (firebaseReady && !syncInProgress) {
            firebaseDB.ref('jamjaemi/' + key).set(value).catch(err => {
                console.warn('Firebase 저장 실패:', err);
            });
        }
    },
    remove(key) {
        localStorage.removeItem('jamjaemi_' + key);
        if (firebaseReady && !syncInProgress) {
            firebaseDB.ref('jamjaemi/' + key).remove().catch(err => {
                console.warn('Firebase 삭제 실패:', err);
            });
        }
    }
};

// Firebase에서 초기 데이터 로드 + 실시간 리스너
function initFirebaseSync() {
    const ref = firebaseDB.ref('jamjaemi');

    // 전체 데이터 한번 가져오기
    ref.once('value').then(snapshot => {
        const data = snapshot.val();
        if (data) {
            syncInProgress = true;
            // Firebase 데이터를 localStorage에 캐시
            Object.keys(data).forEach(key => {
                localStorage.setItem('jamjaemi_' + key, JSON.stringify(data[key]));
            });
            syncInProgress = false;
            console.log('Firebase → localStorage 동기화 완료');
            // 페이지 새로고침 (데이터 적용)
            refreshCurrentPage();
        } else {
            // Firebase에 데이터가 없으면 localStorage 데이터를 Firebase에 업로드
            uploadAllToFirebase();
        }
        firebaseReady = true;
    }).catch(err => {
        console.warn('Firebase 연결 실패, 로컬 모드로 동작:', err);
        firebaseReady = false;
    });

    // 실시간 변경 리스너
    ref.on('value', snapshot => {
        if (!firebaseReady) return;
        const data = snapshot.val();
        if (data) {
            syncInProgress = true;
            Object.keys(data).forEach(key => {
                localStorage.setItem('jamjaemi_' + key, JSON.stringify(data[key]));
            });
            syncInProgress = false;
            refreshCurrentPage();
        }
    });
}

function uploadAllToFirebase() {
    const keys = ['events', 'schedules', 'yearlyThemes', 'aboutData', 'musicData', 'initialized'];
    const data = {};
    keys.forEach(key => {
        const val = DB.get(key, null);
        if (val !== null) {
            data[key] = val;
        }
    });
    if (Object.keys(data).length > 0) {
        firebaseDB.ref('jamjaemi').set(data).then(() => {
            console.log('localStorage → Firebase 업로드 완료');
        }).catch(err => console.warn('Firebase 업로드 실패:', err));
    }
}

function refreshCurrentPage() {
    if (currentPage === 'home') loadRecentEvents();
    if (currentPage === 'about') loadAboutPage();
    if (currentPage === 'events') loadEventsTimeline();
    if (currentPage === 'schedule') { loadYearlySchedule(); loadMonthlyCalendar(); }
}

// ============================
// 이미지 압축 함수
// ============================
function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 리사이즈
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================
// 초기 데이터 (샘플)
// ============================
function initSampleData() {
    if (DB.get('initialized', false)) return;

    const sampleEvents = [
        {
            id: 1, name: '봄맞이 소풍', date: '2026-04-15', category: '봄',
            location: '서울숲 공원', desc: '따뜻한 봄을 맞아 서울숲에서 즐거운 소풍을 다녀왔습니다. 아이들이 자연을 만끽하며 뛰어놀았어요!',
            photos: []
        },
        {
            id: 2, name: '여름 물놀이 축제', date: '2026-07-20', category: '여름',
            location: '어린이집 운동장', desc: '시원한 물놀이로 더위를 날린 즐거운 하루! 워터슬라이드와 물풍선 놀이를 즐겼습니다.',
            photos: []
        },
        {
            id: 3, name: '가을 운동회', date: '2025-10-10', category: '가을',
            location: '어린이집 강당', desc: '알록달록 가을 하늘 아래 펼쳐진 재미있는 운동회! 부모님과 함께 즐거운 시간을 보냈습니다.',
            photos: []
        },
        {
            id: 4, name: '크리스마스 발표회', date: '2025-12-23', category: '겨울',
            location: '어린이집 강당', desc: '아이들이 준비한 사랑스러운 크리스마스 공연! 노래, 율동, 연극으로 가득 찬 감동의 무대였습니다.',
            photos: []
        },
        {
            id: 5, name: '졸업식', date: '2026-02-14', category: '특별',
            location: '어린이집 강당', desc: '코끼리반 친구들의 졸업을 진심으로 축하합니다! 앞으로도 잼재미 어린이집이 항상 응원할게요.',
            photos: []
        }
    ];

    const sampleSchedules = [
        { id: 1, name: '신학기 적응 프로그램', date: '2026-03-02', type: '교육', theme: '새 친구와 인사해요', desc: '새 학기 시작! 새로운 교실과 친구들에게 적응하는 시간' },
        { id: 2, name: '학부모 오리엔테이션', date: '2026-03-05', type: '상담', theme: '', desc: '신학기 교육 방향 안내 및 학부모 상담' },
        { id: 3, name: '봄 소풍', date: '2026-04-15', type: '체험', theme: '봄과 자연', desc: '서울숲 공원 봄 소풍' },
        { id: 4, name: '어린이날 행사', date: '2026-05-05', type: '행사', theme: '우리 모두 소중해요', desc: '어린이날 기념 특별 행사' },
        { id: 5, name: '여름 물놀이', date: '2026-07-20', type: '행사', theme: '시원한 여름', desc: '물놀이 축제' },
        { id: 6, name: '가을 운동회', date: '2026-10-10', type: '행사', theme: '가을 운동회', desc: '학부모 참여 가을 운동회' },
        { id: 7, name: '크리스마스 발표회', date: '2026-12-23', type: '행사', theme: '사랑의 크리스마스', desc: '크리스마스 발표회 및 파티' },
        { id: 8, name: '졸업식', date: '2027-02-14', type: '특별', theme: '축하해요 졸업', desc: '코끼리반 졸업식' }
    ];

    const sampleThemes = {
        2026: {
            1: '겨울과 새해', 2: '소중한 나', 3: '봄이 왔어요',
            4: '동물 친구들', 5: '나와 가족', 6: '우리 동네',
            7: '여름과 건강', 8: '교통기관', 9: '가을과 열매',
            10: '우리나라', 11: '지구와 환경', 12: '겨울과 크리스마스'
        }
    };

    const defaultAboutData = {
        directorName: '김사랑',
        directorRole: '원장',
        directorGreeting: '안녕하세요, 잼재미 어린이집 원장 김사랑입니다.\n\n저희 어린이집은 아이들이 행복하게 뛰어놀며 자연스럽게 배우는 환경을 만들기 위해 최선을 다하고 있습니다.\n\n"놀이가 곧 배움"이라는 철학 아래, 아이 한 명 한 명의 개성과 잠재력을 존중하며 사랑으로 보육합니다.\n\n학부모님들과 함께 아이들의 밝은 미래를 만들어가겠습니다. 감사합니다.',
        directorPhoto: '',
        educationPhilosophy: '잼재미 어린이집은 "놀이가 곧 배움"이라는 철학 아래, 아이들이 자유롭게 탐색하고 스스로 배워가는 환경을 만듭니다. 누리과정을 바탕으로 한 통합적 놀이 중심 교육을 실천합니다.'
    };

    DB.set('events', sampleEvents);
    DB.set('schedules', sampleSchedules);
    DB.set('yearlyThemes', sampleThemes);
    DB.set('aboutData', defaultAboutData);
    DB.set('initialized', true);
}

// ============================
// 페이지 전환
// ============================
let currentPage = 'home';

function showPage(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');

    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const links = document.querySelectorAll('.nav-links a');
    links.forEach(a => {
        if (a.getAttribute('onclick') && a.getAttribute('onclick').includes(page)) {
            a.classList.add('active');
        }
    });

    document.getElementById('navLinks').classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (page === 'home') loadRecentEvents();
    if (page === 'about') loadAboutPage();
    if (page === 'events') loadEventsTimeline();
    if (page === 'schedule') { loadYearlySchedule(); loadMonthlyCalendar(); }
    if (page === 'admin') { /* 로그인 체크 */ }
}

function toggleMobileMenu() {
    document.getElementById('navLinks').classList.toggle('show');
}

// ============================
// 홈 - 최근 행사
// ============================
function loadRecentEvents() {
    const events = DB.get('events');
    const grid = document.getElementById('recentEventsGrid');

    if (events.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📷</div><h3>아직 등록된 행사가 없습니다</h3></div>';
        return;
    }

    const sorted = [...events].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    const categoryEmojis = { '봄': '🌸', '여름': '☀️', '가을': '🍂', '겨울': '❄️', '특별': '🎉' };

    grid.innerHTML = sorted.map(event => {
        const emoji = categoryEmojis[event.category] || '📸';
        const photoCount = (event.photos || []).length;
        const thumbHtml = photoCount > 0
            ? `<img src="${event.photos[0]}" alt="${event.name}">`
            : `<span>${emoji}</span>`;

        return `
            <div class="recent-event-card" onclick="showPage('events')">
                <div class="event-thumb">
                    ${thumbHtml}
                    <span class="event-category-badge">${emoji} ${event.category}</span>
                </div>
                <div class="event-card-body">
                    <h3>${event.name}</h3>
                    <div class="event-card-date"><i class="fas fa-calendar-alt"></i> ${formatDate(event.date)}</div>
                    <p class="event-card-desc">${event.desc.substring(0, 60)}${event.desc.length > 60 ? '...' : ''}</p>
                    ${photoCount > 0 ? `<p class="event-photo-count"><i class="fas fa-camera"></i> 사진 ${photoCount}장</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ============================
// 소개 페이지 동적 렌더링
// ============================
function loadAboutPage() {
    const aboutData = DB.get('aboutData', {});
    const directorCardEl = document.getElementById('directorCard');
    const aboutContentEl = document.getElementById('aboutContent');

    const directorName = aboutData.directorName || '';
    const directorRole = aboutData.directorRole || '';
    const directorGreeting = aboutData.directorGreeting || '';
    const directorPhoto = aboutData.directorPhoto || '';

    if (directorName || directorGreeting) {
        const photoHtml = directorPhoto
            ? `<img src="${directorPhoto}" alt="${directorName}">`
            : `<i class="fas fa-user-circle director-photo-placeholder"></i>`;

        directorCardEl.innerHTML = `
            <div class="director-card">
                <div class="director-photo">
                    ${photoHtml}
                </div>
                <div class="director-info">
                    <h3 class="director-name">${directorName}</h3>
                    <div class="director-role">${directorRole}</div>
                    <p class="director-greeting">${directorGreeting}</p>
                </div>
            </div>
        `;
    } else {
        directorCardEl.innerHTML = '';
    }

    const philosophy = aboutData.educationPhilosophy || '잼재미 어린이집은 "놀이가 곧 배움"이라는 철학 아래, 아이들이 자유롭게 탐색하고 스스로 배워가는 환경을 만듭니다.';

    aboutContentEl.innerHTML = `
        <div class="about-card mission-card">
            <div class="about-card-icon">🌱</div>
            <h3>교육 철학</h3>
            <p>${philosophy}</p>
        </div>
        <div class="about-card">
            <div class="about-card-icon">👨‍👩‍👧‍👦</div>
            <h3>반 구성</h3>
            <div class="class-list">
                <div class="class-item"><span class="class-emoji">🐣</span><span class="class-name">병아리반</span><span class="class-age">만 1세</span></div>
                <div class="class-item"><span class="class-emoji">🐰</span><span class="class-name">토끼반</span><span class="class-age">만 2세</span></div>
                <div class="class-item"><span class="class-emoji">🦊</span><span class="class-name">여우반</span><span class="class-age">만 3세</span></div>
                <div class="class-item"><span class="class-emoji">🦁</span><span class="class-name">사자반</span><span class="class-age">만 4세</span></div>
                <div class="class-item"><span class="class-emoji">🐘</span><span class="class-name">코끼리반</span><span class="class-age">만 5세</span></div>
            </div>
        </div>
        <div class="about-card">
            <div class="about-card-icon">⏰</div>
            <h3>하루 일과</h3>
            <div class="schedule-timeline">
                <div class="timeline-item"><span class="time">07:30</span> 등원 및 자유놀이</div>
                <div class="timeline-item"><span class="time">09:30</span> 오전 간식</div>
                <div class="timeline-item"><span class="time">10:00</span> 오전 교육활동</div>
                <div class="timeline-item"><span class="time">11:30</span> 점심 식사</div>
                <div class="timeline-item"><span class="time">12:30</span> 낮잠 및 휴식</div>
                <div class="timeline-item"><span class="time">15:00</span> 오후 간식</div>
                <div class="timeline-item"><span class="time">15:30</span> 오후 활동 / 특별활동</div>
                <div class="timeline-item"><span class="time">16:30</span> 자유놀이 및 귀가</div>
                <div class="timeline-item"><span class="time">19:30</span> 연장보육 마감</div>
            </div>
        </div>
        <div class="about-card">
            <div class="about-card-icon">🏆</div>
            <h3>시설 안내</h3>
            <div class="facility-grid">
                <div class="facility-item"><i class="fas fa-video"></i> CCTV 완비</div>
                <div class="facility-item"><i class="fas fa-wind"></i> 공기청정기</div>
                <div class="facility-item"><i class="fas fa-tree"></i> 야외 놀이터</div>
                <div class="facility-item"><i class="fas fa-book-reader"></i> 도서 공간</div>
                <div class="facility-item"><i class="fas fa-music"></i> 음악실</div>
                <div class="facility-item"><i class="fas fa-dumbbell"></i> 체육 공간</div>
            </div>
        </div>
    `;
}

// ============================
// 관리자 - 소개 관리
// ============================
function loadAboutAdminForm() {
    const aboutData = DB.get('aboutData', {});
    const nameInput = document.getElementById('adminDirectorName');
    const roleInput = document.getElementById('adminDirectorRole');
    const greetingInput = document.getElementById('adminDirectorGreeting');
    const philosophyInput = document.getElementById('adminEducationPhilosophy');
    const photoPreview = document.getElementById('directorPhotoPreview');

    if (nameInput) nameInput.value = aboutData.directorName || '';
    if (roleInput) roleInput.value = aboutData.directorRole || '';
    if (greetingInput) greetingInput.value = aboutData.directorGreeting || '';
    if (philosophyInput) philosophyInput.value = aboutData.educationPhilosophy || '';

    if (photoPreview) {
        if (aboutData.directorPhoto) {
            photoPreview.innerHTML = `<img src="${aboutData.directorPhoto}" alt="원장 사진">`;
        } else {
            photoPreview.innerHTML = `<i class="fas fa-user-circle"></i><span>사진 없음</span>`;
        }
    }
}

function saveAboutData() {
    const aboutData = {
        directorName: document.getElementById('adminDirectorName').value.trim(),
        directorRole: document.getElementById('adminDirectorRole').value.trim(),
        directorGreeting: document.getElementById('adminDirectorGreeting').value.trim(),
        directorPhoto: DB.get('aboutData', {}).directorPhoto || '',
        educationPhilosophy: document.getElementById('adminEducationPhilosophy').value.trim()
    };
    DB.set('aboutData', aboutData);
    showToast('소개 정보가 저장되었습니다', 'success');
}

function handleDirectorPhotoUpload(files) {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.type.startsWith('image/')) {
        showToast('이미지 파일만 업로드할 수 있습니다', 'error');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('파일 크기는 5MB 이하여야 합니다', 'error');
        return;
    }

    compressImage(file, 400, 0.8).then(dataUrl => {
        const aboutData = DB.get('aboutData', {});
        aboutData.directorPhoto = dataUrl;
        DB.set('aboutData', aboutData);

        const photoPreview = document.getElementById('directorPhotoPreview');
        if (photoPreview) {
            photoPreview.innerHTML = `<img src="${dataUrl}" alt="원장 사진">`;
        }
        showToast('원장 사진이 업로드되었습니다', 'success');
    }).catch(() => showToast('사진 업로드 실패', 'error'));

    document.getElementById('directorPhotoInput').value = '';
}

function removeDirectorPhoto() {
    const aboutData = DB.get('aboutData', {});
    aboutData.directorPhoto = '';
    DB.set('aboutData', aboutData);

    const photoPreview = document.getElementById('directorPhotoPreview');
    if (photoPreview) {
        photoPreview.innerHTML = `<i class="fas fa-user-circle"></i><span>사진 없음</span>`;
    }
    showToast('원장 사진이 삭제되었습니다', 'success');
}

// ============================
// 음악 플레이어
// ============================
let isMusicPlaying = false;

function initMusicPlayer() {
    const musicData = DB.get('musicData', null);
    const player = document.getElementById('musicPlayer');
    const audio = document.getElementById('bgMusic');

    if (musicData && musicData.dataUrl) {
        audio.src = musicData.dataUrl;
        audio.volume = 0.5;
        player.style.display = 'flex';
        const titleEl = document.getElementById('musicPlayerTitle');
        if (titleEl) titleEl.textContent = musicData.fileName || '배경 음악';
    } else {
        player.style.display = 'none';
    }
}

function toggleMusic() {
    const audio = document.getElementById('bgMusic');
    const icon = document.getElementById('musicIcon');
    const toggleBtn = document.getElementById('musicToggleBtn');

    if (!audio.src || audio.src === window.location.href) return;

    if (isMusicPlaying) {
        audio.pause();
        isMusicPlaying = false;
        icon.className = 'fas fa-play';
        toggleBtn.classList.remove('playing');
    } else {
        audio.play().then(() => {
            isMusicPlaying = true;
            icon.className = 'fas fa-pause';
            toggleBtn.classList.add('playing');
        }).catch(err => {
            console.log('자동 재생 차단:', err);
            showToast('브라우저 정책으로 자동 재생이 차단되었습니다. 다시 클릭해주세요.', 'error');
        });
    }
}

function setVolume(value) {
    const audio = document.getElementById('bgMusic');
    audio.volume = value / 100;
}

function handleMusicUpload(files) {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.type.startsWith('audio/')) {
        showToast('오디오 파일만 업로드할 수 있습니다', 'error');
        return;
    }
    if (file.size > 15 * 1024 * 1024) {
        showToast('파일 크기는 15MB 이하여야 합니다', 'error');
        return;
    }

    showToast('음악 파일을 업로드하고 있습니다...', 'success');

    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        const musicData = {
            dataUrl: dataUrl,
            fileName: file.name,
            fileSize: file.size,
            uploadDate: new Date().toISOString()
        };
        try {
            DB.set('musicData', musicData);
            initMusicPlayer();
            loadMusicAdminStatus();
            showToast(`"${file.name}" 음악이 업로드되었습니다`, 'success');
        } catch (err) {
            showToast('파일이 너무 큽니다. 더 작은 파일을 업로드해주세요.', 'error');
            console.error('저장 실패:', err);
        }
    };
    reader.readAsDataURL(file);
    document.getElementById('musicFileInput').value = '';
}

function deleteMusic() {
    if (!confirm('배경 음악을 삭제하시겠습니까?')) return;

    const audio = document.getElementById('bgMusic');
    audio.pause();
    audio.src = '';
    isMusicPlaying = false;

    const icon = document.getElementById('musicIcon');
    const toggleBtn = document.getElementById('musicToggleBtn');
    icon.className = 'fas fa-play';
    toggleBtn.classList.remove('playing');

    DB.remove('musicData');
    document.getElementById('musicPlayer').style.display = 'none';
    loadMusicAdminStatus();
    showToast('배경 음악이 삭제되었습니다', 'success');
}

function loadMusicAdminStatus() {
    const statusCard = document.getElementById('musicStatusCard');
    const deleteBtn = document.getElementById('deleteMusicBtn');
    if (!statusCard) return;

    const musicData = DB.get('musicData', null);

    if (musicData && musicData.dataUrl) {
        const sizeMB = (musicData.fileSize / (1024 * 1024)).toFixed(2);
        const uploadDate = musicData.uploadDate ? formatDate(musicData.uploadDate.split('T')[0]) : '알 수 없음';
        statusCard.innerHTML = `
            <div class="music-status-icon active"><i class="fas fa-music"></i></div>
            <div class="music-status-info">
                <h4>현재 등록된 음악</h4>
                <p><strong>${musicData.fileName || '알 수 없는 파일'}</strong></p>
                <p>파일 크기: ${sizeMB}MB | 등록일: ${uploadDate}</p>
            </div>
        `;
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else {
        statusCard.innerHTML = `
            <div class="music-status-icon inactive"><i class="fas fa-volume-mute"></i></div>
            <div class="music-status-info">
                <h4>등록된 음악 없음</h4>
                <p>아래에서 배경 음악 파일을 업로드해주세요.</p>
            </div>
        `;
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
}

// ============================
// 행사 갤러리
// ============================
let currentFilter = 'all';

function loadEventsTimeline() {
    const events = DB.get('events');
    const timeline = document.getElementById('eventsTimeline');
    const emptyState = document.getElementById('eventsEmpty');

    let filtered = currentFilter === 'all' ? events : events.filter(e => e.category === currentFilter);
    filtered = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
        timeline.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    const categoryEmojis = { '봄': '🌸', '여름': '☀️', '가을': '🍂', '겨울': '❄️', '특별': '🎉' };

    timeline.innerHTML = filtered.map(event => {
        const emoji = categoryEmojis[event.category] || '📸';
        const photos = event.photos || [];
        return `
            <div class="event-timeline-item" data-category="${event.category}">
                <div class="event-timeline-header" onclick="toggleEventBody(this)">
                    <div class="event-timeline-info">
                        <h3>${emoji} ${event.name}</h3>
                        <div class="event-meta">
                            <span><i class="fas fa-calendar-alt"></i> ${formatDate(event.date)}</span>
                            <span><i class="fas fa-map-marker-alt"></i> ${event.location || '미정'}</span>
                            <span><i class="fas fa-camera"></i> 사진 ${photos.length}장</span>
                            <span><i class="fas fa-tag"></i> ${event.category} 행사</span>
                        </div>
                    </div>
                    <button class="event-timeline-toggle"><i class="fas fa-chevron-down"></i></button>
                </div>
                <div class="event-timeline-body">
                    <p class="event-timeline-desc">${event.desc}</p>
                    <div class="event-photos-grid">
                        ${photos.length > 0
                            ? photos.map((photo, i) => `
                                <div class="event-photo-item" onclick="openPhotoModal(${event.id}, ${i})">
                                    <img src="${photo}" alt="${event.name} 사진 ${i + 1}">
                                </div>
                            `).join('')
                            : '<div class="event-photo-placeholder"><i class="fas fa-image" style="font-size:2rem;color:#ddd;display:block;margin-bottom:0.5rem;"></i>아직 등록된 사진이 없습니다</div>'
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleEventBody(header) {
    const body = header.nextElementSibling;
    const toggle = header.querySelector('.event-timeline-toggle');
    body.classList.toggle('open');
    toggle.classList.toggle('open');
}

function filterEvents(category) {
    currentFilter = category;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadEventsTimeline();
}

// ============================
// 사진 모달
// ============================
let modalPhotos = [];
let modalPhotoIndex = 0;

function openPhotoModal(eventId, photoIndex) {
    const events = DB.get('events');
    const ev = events.find(e => e.id === eventId);
    if (!ev || !ev.photos || ev.photos.length === 0) return;

    modalPhotos = ev.photos;
    modalPhotoIndex = photoIndex;
    updatePhotoModal();
    document.getElementById('photoModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function updatePhotoModal() {
    document.getElementById('modalPhoto').src = modalPhotos[modalPhotoIndex];
    document.getElementById('photoInfo').textContent = `사진 ${modalPhotoIndex + 1} / ${modalPhotos.length}`;
    const thumbnails = document.getElementById('photoThumbnails');
    thumbnails.innerHTML = modalPhotos.map((p, i) =>
        `<img src="${p}" class="${i === modalPhotoIndex ? 'active' : ''}" onclick="modalPhotoIndex=${i};updatePhotoModal()">`
    ).join('');
}

function prevPhoto() {
    modalPhotoIndex = (modalPhotoIndex - 1 + modalPhotos.length) % modalPhotos.length;
    updatePhotoModal();
}

function nextPhoto() {
    modalPhotoIndex = (modalPhotoIndex + 1) % modalPhotos.length;
    updatePhotoModal();
}

function closePhotoModal() {
    document.getElementById('photoModal').classList.remove('show');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePhotoModal();
    if (e.key === 'ArrowLeft') prevPhoto();
    if (e.key === 'ArrowRight') nextPhoto();
});

// ============================
// 교육 계획 - 연간
// ============================
let selectedYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth();

function loadYearlySchedule() {
    document.getElementById('currentYear').textContent = selectedYear;
    const themes = DB.get('yearlyThemes', {});
    const yearThemes = themes[selectedYear] || {};
    const schedules = DB.get('schedules');
    const grid = document.getElementById('yearlyGrid');

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const dotColors = [
        '#1976D2', '#7B1FA2', '#388E3C', '#F57C00',
        '#C62828', '#00838F', '#F9A825', '#283593',
        '#D84315', '#4E342E', '#7B1FA2', '#1976D2'
    ];

    grid.innerHTML = monthNames.map((name, i) => {
        const monthNum = i + 1;
        const theme = yearThemes[monthNum] || '주제 미정';
        const monthSchedules = schedules.filter(s => {
            const d = new Date(s.date);
            return d.getFullYear() === selectedYear && d.getMonth() === i;
        });

        return `
            <div class="month-card" onclick="goToMonth(${i})">
                <div class="month-card-header">
                    <div class="month-number" style="background:${dotColors[i]}">${monthNum}</div>
                    <div>
                        <h3>${name}</h3>
                        <div class="month-theme">${theme}</div>
                    </div>
                </div>
                <div class="month-events-preview">
                    ${monthSchedules.length > 0
                        ? monthSchedules.slice(0, 3).map(s => `
                            <div class="month-event-item">
                                <div class="month-event-dot" style="background:${dotColors[i]}"></div>
                                ${s.name}
                            </div>
                        `).join('') + (monthSchedules.length > 3 ? `<div class="month-event-item" style="color:var(--text-muted);">+${monthSchedules.length - 3}개 더...</div>` : '')
                        : '<div class="month-event-item" style="color:var(--text-muted);">등록된 일정 없음</div>'
                    }
                </div>
            </div>
        `;
    }).join('');
}

function changeYear(delta) {
    selectedYear += delta;
    loadYearlySchedule();
}

function goToMonth(monthIndex) {
    selectedMonth = monthIndex;
    switchScheduleTab('monthly');
    loadMonthlyCalendar();
}

// ============================
// 교육 계획 - 월간
// ============================
function loadMonthlyCalendar() {
    const year = selectedYear;
    const month = selectedMonth;
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    document.getElementById('currentMonth').textContent = `${year}년 ${monthNames[month]}`;

    const schedules = DB.get('schedules');
    const monthSchedules = schedules.filter(s => {
        const d = new Date(s.date);
        return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const today = new Date();

    const typeColors = {
        '교육': '#4ECDC4', '행사': '#FF6B9D', '체험': '#FFD93D',
        '상담': '#A78BFA', '기타': '#B2BEC3', '특별': '#FB923C'
    };

    let calendarHTML = `
        <div class="calendar-header">
            <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
        </div>
        <div class="calendar-body">
    `;

    for (let i = firstDay - 1; i >= 0; i--) {
        calendarHTML += `<div class="calendar-day other-month"><div class="day-number">${daysInPrevMonth - i}</div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeek = new Date(year, month, day).getDay();
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        const daySchedules = monthSchedules.filter(s => s.date === dateStr);

        let classes = ['calendar-day'];
        if (isToday) classes.push('today');
        if (dayOfWeek === 0) classes.push('sunday');
        if (dayOfWeek === 6) classes.push('saturday');

        calendarHTML += `
            <div class="${classes.join(' ')}">
                <div class="day-number">${day}</div>
                <div class="day-events">
                    ${daySchedules.map(s => `<div class="day-event-dot" style="background:${typeColors[s.type] || '#B2BEC3'}" title="${s.name}">${s.name}</div>`).join('')}
                </div>
            </div>
        `;
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
        calendarHTML += `<div class="calendar-day other-month"><div class="day-number">${i}</div></div>`;
    }

    calendarHTML += '</div>';
    document.getElementById('monthlyCalendar').innerHTML = calendarHTML;

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const eventsList = document.getElementById('monthEventsList');

    if (monthSchedules.length === 0) {
        eventsList.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><h3>이 달에 등록된 일정이 없습니다</h3></div>';
    } else {
        eventsList.innerHTML = monthSchedules.map(s => {
            const d = new Date(s.date);
            const color = typeColors[s.type] || '#B2BEC3';
            return `
                <div class="month-event-card" style="border-left-color:${color}">
                    <div class="month-event-date">
                        <div class="day">${d.getDate()}</div>
                        <div class="weekday">${weekDays[d.getDay()]}</div>
                    </div>
                    <div class="month-event-info" style="flex:1;">
                        <h4>${s.name}</h4>
                        <p>${s.desc || ''}</p>
                        ${s.theme ? `<p style="color:var(--primary);font-size:0.8rem;margin-top:0.25rem;"><i class="fas fa-bookmark"></i> ${s.theme}</p>` : ''}
                    </div>
                    <span class="month-event-type" style="background:${color}20;color:${color}">${s.type}</span>
                </div>
            `;
        }).join('');
    }
}

function changeMonth(delta) {
    selectedMonth += delta;
    if (selectedMonth > 11) { selectedMonth = 0; selectedYear++; }
    if (selectedMonth < 0) { selectedMonth = 11; selectedYear--; }
    loadMonthlyCalendar();
}

function switchScheduleTab(tab) {
    document.querySelectorAll('.schedule-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tab + 'Schedule').classList.add('active');
    event && event.target && event.target.classList.add('active');
    if (tab === 'yearly') loadYearlySchedule();
    if (tab === 'monthly') loadMonthlyCalendar();
}

// ============================
// 관리자 - 로그인
// ============================
const ADMIN_PW = '2850';

function adminLoginCheck() {
    const pw = document.getElementById('adminPassword').value;
    if (pw === ADMIN_PW) {
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        loadAdminData();
        showToast('관리자로 로그인되었습니다', 'success');
    } else {
        showToast('비밀번호가 올바르지 않습니다', 'error');
    }
}

function loadAdminData() {
    loadEventAdminList();
    loadPhotoEventSelect();
    loadAdminPhotoGrid();
    loadScheduleAdminList();
    loadYearlyThemeEditor();
    loadAboutAdminForm();
    loadMusicAdminStatus();
    loadStorageSummary();
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.getElementById('admin-' + tab).classList.add('active');
    if (event && event.target) {
        let btn = event.target.closest('.admin-tab');
        if (btn) btn.classList.add('active');
    }

    if (tab === 'about-manage') loadAboutAdminForm();
    if (tab === 'music-manage') loadMusicAdminStatus();
    if (tab === 'photo-manage') { loadAdminPhotoGrid(); loadStorageSummary(); }
}

// ============================
// 관리자 - 사진 용량 관리 UI
// ============================
function loadStorageSummary() {
    const container = document.getElementById('storageSummaryContainer');
    if (!container) return;

    const events = DB.get('events');
    let totalPhotos = 0;
    let totalBytes = 0;
    const eventBreakdown = [];

    events.forEach(ev => {
        const photos = ev.photos || [];
        let eventBytes = 0;
        photos.forEach(p => {
            // base64 문자열 크기 ≈ 실제 바이트의 4/3
            eventBytes += Math.round((p.length || 0) * 3 / 4);
        });
        totalPhotos += photos.length;
        totalBytes += eventBytes;
        if (photos.length > 0) {
            eventBreakdown.push({
                name: ev.name,
                count: photos.length,
                bytes: eventBytes
            });
        }
    });

    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
    const limitMB = 1024; // Firebase 무료 1GB
    const usagePercent = Math.min((totalBytes / (limitMB * 1024 * 1024)) * 100, 100);
    const isWarning = usagePercent > 70;

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / (1024 * 1024)).toFixed(2) + 'MB';
    }

    container.innerHTML = `
        <div class="storage-summary">
            <h3><i class="fas fa-database"></i> 저장 용량 현황</h3>
            <div class="storage-overview">
                <div class="storage-stat">
                    <span class="stat-value">${events.length}</span>
                    <span class="stat-label">전체 행사</span>
                </div>
                <div class="storage-stat">
                    <span class="stat-value">${totalPhotos}</span>
                    <span class="stat-label">전체 사진</span>
                </div>
                <div class="storage-stat">
                    <span class="stat-value">${totalMB}MB</span>
                    <span class="stat-label">사용 용량</span>
                </div>
            </div>
            <div class="storage-progress-wrap">
                <div class="storage-progress-label">
                    <span>사용량 ${totalMB}MB / ${limitMB}MB</span>
                    <span>${usagePercent.toFixed(1)}%</span>
                </div>
                <div class="storage-progress-bar">
                    <div class="storage-progress-fill ${isWarning ? 'warning' : ''}" style="width:${usagePercent}%"></div>
                </div>
            </div>
            ${eventBreakdown.length > 0 ? `
                <h4 style="font-size:0.9rem;color:var(--text-light);margin-bottom:0.5rem;">행사별 용량</h4>
                <div class="storage-breakdown">
                    ${eventBreakdown.sort((a, b) => b.bytes - a.bytes).map(item => `
                        <div class="storage-breakdown-item">
                            <span class="event-name">${item.name}</span>
                            <span class="photo-count">${item.count}장</span>
                            <span class="photo-size">${formatSize(item.bytes)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

// ============================
// 관리자 - 행사 관리
// ============================
function addEvent() {
    const name = document.getElementById('eventName').value.trim();
    const date = document.getElementById('eventDate').value;
    const category = document.getElementById('eventCategory').value;
    const location = document.getElementById('eventLocation').value.trim();
    const desc = document.getElementById('eventDesc').value.trim();

    if (!name || !date) {
        showToast('행사명과 날짜를 입력해주세요', 'error');
        return;
    }

    const events = DB.get('events');
    const newEvent = { id: Date.now(), name, date, category, location, desc, photos: [] };
    events.push(newEvent);
    DB.set('events', events);

    document.getElementById('eventName').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventLocation').value = '';
    document.getElementById('eventDesc').value = '';

    loadEventAdminList();
    loadPhotoEventSelect();
    showToast(`"${name}" 행사가 등록되었습니다`, 'success');
}

function loadEventAdminList() {
    const events = DB.get('events').sort((a, b) => new Date(b.date) - new Date(a.date));
    const list = document.getElementById('eventAdminList');
    const categoryEmojis = { '봄': '🌸', '여름': '☀️', '가을': '🍂', '겨울': '❄️', '특별': '🎉' };

    if (events.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>등록된 행사가 없습니다</p></div>';
        return;
    }

    list.innerHTML = events.map(e => `
        <div class="event-admin-item">
            <div class="admin-item-info">
                <h4>${categoryEmojis[e.category] || ''} ${e.name}</h4>
                <p>${formatDate(e.date)} · ${e.location || '장소 미정'} · 사진 ${(e.photos || []).length}장</p>
            </div>
            <div class="admin-item-actions">
                <button class="btn btn-danger btn-sm" onclick="deleteEvent(${e.id})">
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </div>
        </div>
    `).join('');
}

function deleteEvent(id) {
    if (!confirm('정말로 이 행사를 삭제하시겠습니까?\n관련 사진도 모두 삭제됩니다.')) return;

    let events = DB.get('events');
    events = events.filter(e => e.id !== id);
    DB.set('events', events);

    loadEventAdminList();
    loadPhotoEventSelect();
    loadAdminPhotoGrid();
    loadStorageSummary();
    showToast('행사가 삭제되었습니다', 'success');
}

// ============================
// 관리자 - 사진 관리
// ============================
function loadPhotoEventSelect() {
    const events = DB.get('events').sort((a, b) => new Date(b.date) - new Date(a.date));
    const select1 = document.getElementById('photoEventSelect');
    const select2 = document.getElementById('photoFilterSelect');

    const options = events.map(e => `<option value="${e.id}">${e.name} (${formatDate(e.date)})</option>`).join('');
    select1.innerHTML = '<option value="">행사를 선택하세요</option>' + options;
    select2.innerHTML = '<option value="all">전체 보기</option>' + options;
}

function handlePhotoUpload(files) {
    const eventId = parseInt(document.getElementById('photoEventSelect').value);
    if (!eventId) {
        showToast('먼저 행사를 선택해주세요', 'error');
        return;
    }

    const preview = document.getElementById('uploadPreview');
    let processed = 0;
    const total = files.length;

    showToast(`${total}개 사진 압축 및 업로드 중...`, 'success');

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) { processed++; return; }
        if (file.size > 10 * 1024 * 1024) {
            showToast(`${file.name}이 10MB를 초과합니다`, 'error');
            processed++;
            return;
        }

        // 이미지 압축 후 저장
        compressImage(file, 800, 0.7).then(compressedDataUrl => {
            const events = DB.get('events');
            const ev = events.find(ev => ev.id === eventId);
            if (ev) {
                if (!ev.photos) ev.photos = [];
                ev.photos.push(compressedDataUrl);
                DB.set('events', events);
            }

            const div = document.createElement('div');
            div.className = 'upload-preview-item';
            div.innerHTML = `<img src="${compressedDataUrl}" alt="uploaded"><button class="remove-btn" onclick="this.parentElement.remove()">×</button>`;
            preview.appendChild(div);

            processed++;
            if (processed >= total) {
                loadAdminPhotoGrid();
                loadStorageSummary();
                loadEventAdminList();
                showToast(`${total}개 사진이 업로드되었습니다`, 'success');
            }
        }).catch(err => {
            console.error('압축 실패:', err);
            processed++;
        });
    });

    document.getElementById('photoInput').value = '';
}

function loadAdminPhotoGrid() {
    const events = DB.get('events');
    const filterVal = document.getElementById('photoFilterSelect').value;
    const grid = document.getElementById('adminPhotoGrid');

    let allPhotos = [];
    events.forEach(ev => {
        (ev.photos || []).forEach((photo, i) => {
            if (filterVal === 'all' || String(ev.id) === filterVal) {
                allPhotos.push({ eventId: ev.id, eventName: ev.name, photo, index: i });
            }
        });
    });

    if (allPhotos.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>업로드된 사진이 없습니다</p></div>';
        return;
    }

    grid.innerHTML = allPhotos.map(p => `
        <div class="admin-photo-item">
            <img src="${p.photo}" alt="${p.eventName}">
            <div class="delete-overlay" onclick="deletePhoto(${p.eventId}, ${p.index})">
                <i class="fas fa-trash"></i>
            </div>
        </div>
    `).join('');
}

function filterAdminPhotos() {
    loadAdminPhotoGrid();
}

function deletePhoto(eventId, photoIndex) {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return;

    const events = DB.get('events');
    const ev = events.find(e => e.id === eventId);
    if (ev && ev.photos) {
        ev.photos.splice(photoIndex, 1);
        DB.set('events', events);
    }

    loadAdminPhotoGrid();
    loadEventAdminList();
    loadStorageSummary();
    showToast('사진이 삭제되었습니다', 'success');
}

// 드래그앤드롭 업로드
document.addEventListener('DOMContentLoaded', () => {
    const zone = document.getElementById('uploadZone');
    if (zone) {
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--primary)'; zone.style.background = 'var(--primary-light)'; });
        zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; zone.style.background = ''; });
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.style.borderColor = '';
            zone.style.background = '';
            handlePhotoUpload(e.dataTransfer.files);
        });
    }
});

// ============================
// 관리자 - 일정 관리
// ============================
function addSchedule() {
    const name = document.getElementById('scheduleName').value.trim();
    const date = document.getElementById('scheduleDate').value;
    const type = document.getElementById('scheduleType').value;
    const theme = document.getElementById('scheduleTheme').value.trim();
    const desc = document.getElementById('scheduleDesc').value.trim();

    if (!name || !date) {
        showToast('일정명과 날짜를 입력해주세요', 'error');
        return;
    }

    const schedules = DB.get('schedules');
    schedules.push({ id: Date.now(), name, date, type, theme, desc });
    DB.set('schedules', schedules);

    document.getElementById('scheduleName').value = '';
    document.getElementById('scheduleDate').value = '';
    document.getElementById('scheduleTheme').value = '';
    document.getElementById('scheduleDesc').value = '';

    loadScheduleAdminList();
    showToast(`"${name}" 일정이 추가되었습니다`, 'success');
}

function loadScheduleAdminList() {
    const schedules = DB.get('schedules').sort((a, b) => new Date(a.date) - new Date(b.date));
    const list = document.getElementById('scheduleAdminList');
    const typeEmojis = { '교육': '📚', '행사': '🎉', '체험': '🌿', '상담': '👨‍👩‍👧', '기타': '📌', '특별': '⭐' };

    if (schedules.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>등록된 일정이 없습니다</p></div>';
        return;
    }

    list.innerHTML = schedules.map(s => `
        <div class="schedule-admin-item">
            <div class="admin-item-info">
                <h4>${typeEmojis[s.type] || '📌'} ${s.name}</h4>
                <p>${formatDate(s.date)} · ${s.type}${s.theme ? ' · ' + s.theme : ''}</p>
            </div>
            <div class="admin-item-actions">
                <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function deleteSchedule(id) {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;

    let schedules = DB.get('schedules');
    schedules = schedules.filter(s => s.id !== id);
    DB.set('schedules', schedules);

    loadScheduleAdminList();
    showToast('일정이 삭제되었습니다', 'success');
}

// ============================
// 관리자 - 연간 테마
// ============================
function loadYearlyThemeEditor() {
    const themes = DB.get('yearlyThemes', {});
    const yearThemes = themes[selectedYear] || {};
    const editor = document.getElementById('yearlyThemeEditor');
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    editor.innerHTML = monthNames.map((name, i) => `
        <div class="theme-editor-item">
            <label>${name}</label>
            <input type="text" id="theme_${i + 1}" value="${yearThemes[i + 1] || ''}" placeholder="월간 주제 입력">
        </div>
    `).join('');
}

function saveYearlyThemes() {
    const themes = DB.get('yearlyThemes', {});
    themes[selectedYear] = {};

    for (let i = 1; i <= 12; i++) {
        const input = document.getElementById('theme_' + i);
        if (input && input.value.trim()) {
            themes[selectedYear][i] = input.value.trim();
        }
    }

    DB.set('yearlyThemes', themes);
    showToast(`${selectedYear}년 연간 주제가 저장되었습니다`, 'success');
}

// ============================
// 유틸리티
// ============================
function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}" style="color:${type === 'success' ? 'var(--secondary)' : '#ff4757'}"></i>
        ${message}
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// 스크롤 이벤트
window.addEventListener('scroll', () => {
    const scrollBtn = document.getElementById('scrollTopBtn');
    if (window.scrollY > 300) {
        scrollBtn.classList.add('show');
    } else {
        scrollBtn.classList.remove('show');
    }

    const navbar = document.getElementById('navbar');
    if (window.scrollY > 10) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// 히어로 파티클 생성
function createParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;

    const colors = ['#FF6B9D', '#4ECDC4', '#FFD93D', '#A78BFA', '#FB923C', '#FF9A9E', '#A8EDEA'];

    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        const size = Math.random() * 12 + 4;
        particle.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            opacity: ${Math.random() * 0.3 + 0.1};
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: particleFloat ${Math.random() * 10 + 10}s ease-in-out infinite;
            animation-delay: ${Math.random() * 5}s;
        `;
        container.appendChild(particle);
    }
}

const particleStyle = document.createElement('style');
particleStyle.textContent = `
    @keyframes particleFloat {
        0%, 100% { transform: translate(0, 0) scale(1); }
        25% { transform: translate(30px, -30px) scale(1.1); }
        50% { transform: translate(-20px, 20px) scale(0.9); }
        75% { transform: translate(15px, -15px) scale(1.05); }
    }
`;
document.head.appendChild(particleStyle);

// ============================
// 초기화
// ============================
document.addEventListener('DOMContentLoaded', () => {
    initSampleData();
    createParticles();
    loadRecentEvents();
    initMusicPlayer();
    // Firebase 동기화 시작
    initFirebaseSync();
});
