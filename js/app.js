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
let isLocalWrite = false; // 내가 쓴 변경인지 추적
let lastSyncHash = ''; // 마지막 동기화 해시 (중복 방지)

// ============================
// 데이터 관리 (localStorage + Firebase 동기화)
// ============================
const SYNC_KEYS = ['events', 'schedules', 'yearlyThemes', 'aboutData', 'musicData', 'homeData', 'categories', 'initialized'];

const DB = {
    get(key, fallback = []) {
        try {
            const data = localStorage.getItem('jamjaemi_' + key);
            return data ? JSON.parse(data) : fallback;
        } catch { return fallback; }
    },
    set(key, value) {
        localStorage.setItem('jamjaemi_' + key, JSON.stringify(value));
        if (firebaseReady && !syncInProgress) {
            isLocalWrite = true;
            firebaseDB.ref('jamjaemi/' + key).set(value).then(() => {
                console.log('Firebase 저장 완료:', key);
                isLocalWrite = false;
            }).catch(err => {
                console.warn('Firebase 저장 실패:', err);
                isLocalWrite = false;
            });
        }
    },
    remove(key) {
        localStorage.removeItem('jamjaemi_' + key);
        if (firebaseReady && !syncInProgress) {
            isLocalWrite = true;
            firebaseDB.ref('jamjaemi/' + key).remove().then(() => {
                isLocalWrite = false;
            }).catch(err => {
                console.warn('Firebase 삭제 실패:', err);
                isLocalWrite = false;
            });
        }
    }
};

// Firebase 동기화
function initFirebaseSync() {
    const ref = firebaseDB.ref('jamjaemi');

    // 1단계: 초기 데이터 로드
    ref.once('value').then(snapshot => {
        const data = snapshot.val();
        if (data) {
            syncInProgress = true;
            Object.keys(data).forEach(key => {
                localStorage.setItem('jamjaemi_' + key, JSON.stringify(data[key]));
            });
            lastSyncHash = JSON.stringify(data).length.toString();
            syncInProgress = false;
            console.log('Firebase → localStorage 초기 동기화 완료');
            refreshCurrentPage();
        } else {
            // Firebase에 데이터 없으면 로컬 데이터 업로드
            uploadAllToFirebase();
        }
        firebaseReady = true;

        // 2단계: 실시간 변경 리스너 (개별 키 단위)
        SYNC_KEYS.forEach(key => {
            firebaseDB.ref('jamjaemi/' + key).on('value', snapshot => {
                // 내가 방금 쓴 변경이면 무시
                if (isLocalWrite || syncInProgress) return;

                const newVal = snapshot.val();
                if (newVal === null) return;

                // 현재 로컬 값과 비교
                const localRaw = localStorage.getItem('jamjaemi_' + key);
                const newRaw = JSON.stringify(newVal);
                if (localRaw === newRaw) return; // 동일하면 무시

                console.log('Firebase 변경 감지:', key);
                syncInProgress = true;
                localStorage.setItem('jamjaemi_' + key, newRaw);
                syncInProgress = false;

                // 페이지 새로고침
                refreshCurrentPage();
            });
        });
    }).catch(err => {
        console.warn('Firebase 연결 실패, 로컬 모드로 동작:', err);
        firebaseReady = false;
    });
}

function uploadAllToFirebase() {
    const data = {};
    SYNC_KEYS.forEach(key => {
        const raw = localStorage.getItem('jamjaemi_' + key);
        if (raw) {
            try { data[key] = JSON.parse(raw); } catch {}
        }
    });
    if (Object.keys(data).length > 0) {
        isLocalWrite = true;
        firebaseDB.ref('jamjaemi').set(data).then(() => {
            console.log('localStorage → Firebase 업로드 완료');
            isLocalWrite = false;
        }).catch(err => {
            console.warn('Firebase 업로드 실패:', err);
            isLocalWrite = false;
        });
    }
}

function refreshCurrentPage() {
    try {
        if (currentPage === 'home') loadHomePage();
        if (currentPage === 'about') loadAboutPage();
        if (currentPage === 'events') loadEventsTimeline();
        if (currentPage === 'schedule') { loadYearlySchedule(); loadMonthlyCalendar(); }
    } catch (e) {
        console.warn('페이지 새로고침 중 오류:', e);
    }
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
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================
// 기본 카테고리
// ============================
function getCategories() {
    return DB.get('categories', [
        { name: '봄', emoji: '🌸' },
        { name: '여름', emoji: '☀️' },
        { name: '가을', emoji: '🍂' },
        { name: '겨울', emoji: '❄️' },
        { name: '특별', emoji: '🎉' }
    ]);
}

function getCategoryEmojis() {
    const cats = getCategories();
    const map = {};
    cats.forEach(c => map[c.name] = c.emoji);
    return map;
}

// ============================
// 기본 홈 데이터
// ============================
function getHomeData() {
    return DB.get('homeData', {
        heroTitle1: '아이들의 꿈이',
        heroTitle2: '무럭무럭 자라는 곳',
        heroSubtitle: '잼재미 어린이집에서 사랑과 배움으로 아이들의 밝은 미래를 함께 만들어갑니다',
        features: [
            { icon: 'fas fa-heart', title: '사랑 가득한 돌봄', desc: '전문 보육교사가 가정 같은 따뜻한 환경에서 아이 한 명 한 명을 소중히 돌봅니다', color1: '#FF9A9E', color2: '#FECFEF' },
            { icon: 'fas fa-palette', title: '창의력 쑥쑥 교육', desc: '놀이 중심의 누리과정으로 아이들의 상상력과 창의력을 키워갑니다', color1: '#A8EDEA', color2: '#FED6E3' },
            { icon: 'fas fa-utensils', title: '건강한 급식', desc: '영양사가 설계한 균형 잡힌 식단으로 건강하고 맛있는 급식을 제공합니다', color1: '#FFD89B', color2: '#19547B' },
            { icon: 'fas fa-shield-alt', title: '안전한 환경', desc: 'CCTV, 공기청정기, 안전매트 등 최신 안전설비를 완비하고 있습니다', color1: '#C3CFE2', color2: '#F5F7FA' }
        ],
        programs: [
            { emoji: '🎨', title: '미술 놀이', desc: '다양한 재료로 자유롭게 표현하며 감성과 창의력을 키워요', badge: '인기' },
            { emoji: '🎵', title: '음악 활동', desc: '노래와 율동으로 리듬감과 사회성을 함께 발달시켜요', badge: '' },
            { emoji: '🌿', title: '자연 탐구', desc: '텃밭 가꾸기, 자연 관찰 등 생태 감수성을 길러요', badge: '' },
            { emoji: '📖', title: '동화 구연', desc: '그림책을 통해 언어 발달과 상상력을 자극해요', badge: '' },
            { emoji: '🤸', title: '체육 활동', desc: '신체 발달에 맞는 운동으로 건강한 몸과 마음을 만들어요', badge: '' },
            { emoji: '🧩', title: '수학 놀이', desc: '놀이를 통해 수학적 사고력과 문제 해결력을 키워요', badge: '' }
        ],
        address: '서울시 OO구 OO로 123',
        phone: '02-1234-5678',
        hours: '평일 07:30 ~ 19:30',
        email: 'jamjaemi@example.com'
    });
}

// ============================
// 초기 데이터 (샘플)
// ============================
function initSampleData() {
    if (DB.get('initialized', false)) return;

    const sampleEvents = [
        { id: 1, name: '봄맞이 소풍', date: '2026-04-15', category: '봄', location: '서울숲 공원', desc: '따뜻한 봄을 맞아 서울숲에서 즐거운 소풍을 다녀왔습니다.', photos: [] },
        { id: 2, name: '여름 물놀이 축제', date: '2026-07-20', category: '여름', location: '어린이집 운동장', desc: '시원한 물놀이로 더위를 날린 즐거운 하루!', photos: [] },
        { id: 3, name: '가을 운동회', date: '2025-10-10', category: '가을', location: '어린이집 강당', desc: '알록달록 가을 하늘 아래 펼쳐진 재미있는 운동회!', photos: [] },
        { id: 4, name: '크리스마스 발표회', date: '2025-12-23', category: '겨울', location: '어린이집 강당', desc: '아이들이 준비한 사랑스러운 크리스마스 공연!', photos: [] },
        { id: 5, name: '졸업식', date: '2026-02-14', category: '특별', location: '어린이집 강당', desc: '코끼리반 친구들의 졸업을 진심으로 축하합니다!', photos: [] }
    ];

    const sampleSchedules = [
        { id: 1, name: '신학기 적응 프로그램', date: '2026-03-02', type: '교육', theme: '새 친구와 인사해요', desc: '새 학기 시작!' },
        { id: 2, name: '학부모 오리엔테이션', date: '2026-03-05', type: '상담', theme: '', desc: '신학기 교육 방향 안내' },
        { id: 3, name: '봄 소풍', date: '2026-04-15', type: '체험', theme: '봄과 자연', desc: '서울숲 공원 봄 소풍' },
        { id: 4, name: '어린이날 행사', date: '2026-05-05', type: '행사', theme: '우리 모두 소중해요', desc: '어린이날 기념 특별 행사' },
        { id: 5, name: '여름 물놀이', date: '2026-07-20', type: '행사', theme: '시원한 여름', desc: '물놀이 축제' },
        { id: 6, name: '가을 운동회', date: '2026-10-10', type: '행사', theme: '가을 운동회', desc: '학부모 참여 가을 운동회' },
        { id: 7, name: '크리스마스 발표회', date: '2026-12-23', type: '행사', theme: '사랑의 크리스마스', desc: '크리스마스 발표회' },
        { id: 8, name: '졸업식', date: '2027-02-14', type: '특별', theme: '축하해요 졸업', desc: '코끼리반 졸업식' }
    ];

    const sampleThemes = {
        2026: { 1:'겨울과 새해', 2:'소중한 나', 3:'봄이 왔어요', 4:'동물 친구들', 5:'나와 가족', 6:'우리 동네', 7:'여름과 건강', 8:'교통기관', 9:'가을과 열매', 10:'우리나라', 11:'지구와 환경', 12:'겨울과 크리스마스' }
    };

    const defaultAboutData = {
        directorName: '김사랑',
        directorRole: '원장',
        directorGreeting: '안녕하세요, 잼재미 어린이집 원장 김사랑입니다.\n\n저희 어린이집은 아이들이 행복하게 뛰어놀며 자연스럽게 배우는 환경을 만들기 위해 최선을 다하고 있습니다.\n\n"놀이가 곧 배움"이라는 철학 아래, 아이 한 명 한 명의 개성과 잠재력을 존중하며 사랑으로 보육합니다.',
        directorPhoto: '',
        educationPhilosophy: '잼재미 어린이집은 "놀이가 곧 배움"이라는 철학 아래, 아이들이 자유롭게 탐색하고 스스로 배워가는 환경을 만듭니다.',
        classes: [
            { emoji: '🐣', name: '병아리반', age: '만 1세' },
            { emoji: '🐰', name: '토끼반', age: '만 2세' },
            { emoji: '🦊', name: '여우반', age: '만 3세' },
            { emoji: '🦁', name: '사자반', age: '만 4세' },
            { emoji: '🐘', name: '코끼리반', age: '만 5세' }
        ],
        dailySchedule: [
            { time: '07:30', activity: '등원 및 자유놀이' },
            { time: '09:30', activity: '오전 간식' },
            { time: '10:00', activity: '오전 교육활동' },
            { time: '11:30', activity: '점심 식사' },
            { time: '12:30', activity: '낮잠 및 휴식' },
            { time: '15:00', activity: '오후 간식' },
            { time: '15:30', activity: '오후 활동 / 특별활동' },
            { time: '16:30', activity: '자유놀이 및 귀가' },
            { time: '19:30', activity: '연장보육 마감' }
        ],
        facilities: [
            { icon: 'fas fa-video', name: 'CCTV 완비' },
            { icon: 'fas fa-wind', name: '공기청정기' },
            { icon: 'fas fa-tree', name: '야외 놀이터' },
            { icon: 'fas fa-book-reader', name: '도서 공간' },
            { icon: 'fas fa-music', name: '음악실' },
            { icon: 'fas fa-dumbbell', name: '체육 공간' }
        ]
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
    document.querySelectorAll('.nav-links a').forEach(a => {
        if (a.getAttribute('onclick') && a.getAttribute('onclick').includes(page)) {
            a.classList.add('active');
        }
    });

    document.getElementById('navLinks').classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (page === 'home') loadHomePage();
    if (page === 'about') loadAboutPage();
    if (page === 'events') loadEventsTimeline();
    if (page === 'schedule') { loadYearlySchedule(); loadMonthlyCalendar(); }
}

function toggleMobileMenu() {
    document.getElementById('navLinks').classList.toggle('show');
}

// ============================
// 홈 페이지 동적 렌더링
// ============================
function loadHomePage() {
    loadHeroSection();
    loadFeaturesSection();
    loadProgramsSection();
    loadContactSection();
    loadRecentEvents();
}

function loadHeroSection() {
    const hd = getHomeData();
    const el = document.getElementById('heroContent');
    if (!el) return;
    el.innerHTML = `
        <h1 class="hero-title">
            <span class="title-line">${hd.heroTitle1 || '아이들의 꿈이'}</span>
            <span class="title-line highlight">${hd.heroTitle2 || '무럭무럭 자라는 곳'}</span>
        </h1>
        <p class="hero-subtitle">${hd.heroSubtitle || ''}</p>
        <div class="hero-buttons">
            <button class="btn btn-primary btn-lg" onclick="showPage('about')">
                <i class="fas fa-heart"></i> 어린이집 알아보기
            </button>
            <button class="btn btn-outline btn-lg" onclick="showPage('events')">
                <i class="fas fa-camera"></i> 행사 사진 보기
            </button>
        </div>
    `;
}

function loadFeaturesSection() {
    const hd = getHomeData();
    const grid = document.getElementById('featuresGrid');
    if (!grid) return;
    const features = hd.features || [];
    grid.innerHTML = features.map(f => `
        <div class="feature-card">
            <div class="feature-icon" style="background: linear-gradient(135deg, ${f.color1 || '#FF9A9E'}, ${f.color2 || '#FECFEF'})">
                <i class="${f.icon || 'fas fa-star'}"></i>
            </div>
            <h3>${f.title}</h3>
            <p>${f.desc}</p>
        </div>
    `).join('');
}

function loadProgramsSection() {
    const hd = getHomeData();
    const grid = document.getElementById('programsGrid');
    if (!grid) return;
    const programs = hd.programs || [];
    grid.innerHTML = programs.map(p => `
        <div class="program-card">
            ${p.badge ? `<div class="program-badge">${p.badge}</div>` : ''}
            <div class="program-emoji">${p.emoji}</div>
            <h3>${p.title}</h3>
            <p>${p.desc}</p>
        </div>
    `).join('');
}

function loadContactSection() {
    const hd = getHomeData();
    const grid = document.getElementById('contactGrid');
    if (!grid) return;

    const address = hd.address || '서울시 OO구 OO로 123';
    const phone = hd.phone || '02-1234-5678';
    const hours = hd.hours || '평일 07:30 ~ 19:30';
    const email = hd.email || 'jamjaemi@example.com';

    grid.innerHTML = `
        <div class="contact-info">
            <div class="contact-item">
                <div class="contact-icon"><i class="fas fa-map-marker-alt"></i></div>
                <div><strong>주소</strong><p>${address}</p></div>
            </div>
            <div class="contact-item">
                <div class="contact-icon"><i class="fas fa-phone"></i></div>
                <div><strong>전화</strong><p>${phone}</p></div>
            </div>
            <div class="contact-item">
                <div class="contact-icon"><i class="fas fa-clock"></i></div>
                <div><strong>운영시간</strong><p>${hours}</p></div>
            </div>
            <div class="contact-item">
                <div class="contact-icon"><i class="fas fa-envelope"></i></div>
                <div><strong>이메일</strong><p>${email}</p></div>
            </div>
        </div>
        <div class="contact-map">
            <div class="kakao-map-container" id="kakaoMapContainer">
                <div class="map-fallback" id="mapFallback">
                    <i class="fas fa-map-marked-alt"></i>
                    <p>지도 로딩 중...</p>
                </div>
            </div>
        </div>
    `;

    // 카카오맵 로드
    loadKakaoMap(address);
}

// ============================
// 카카오맵 연동
// ============================
function loadKakaoMap(address) {
    const container = document.getElementById('kakaoMapContainer');
    const fallback = document.getElementById('mapFallback');
    if (!container) return;

    // 카카오맵 SDK 로드 확인
    if (typeof kakao === 'undefined' || !kakao.maps) {
        // SDK 못 불러온 경우 → 네이버맵 iframe으로 대체
        showMapFallback(address, container);
        return;
    }

    kakao.maps.load(function() {
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(address, function(result, status) {
            if (status === kakao.maps.services.Status.OK) {
                container.innerHTML = '';
                const mapDiv = document.createElement('div');
                mapDiv.style.width = '100%';
                mapDiv.style.height = '100%';
                container.appendChild(mapDiv);

                const coords = new kakao.maps.LatLng(result[0].y, result[0].x);
                const map = new kakao.maps.Map(mapDiv, { center: coords, level: 3 });
                const marker = new kakao.maps.Marker({ map: map, position: coords });
                const infowindow = new kakao.maps.InfoWindow({
                    content: '<div style="padding:5px;font-size:12px;text-align:center;">잼재미 어린이집</div>'
                });
                infowindow.open(map, marker);
            } else {
                showMapFallback(address, container);
            }
        });
    });
}

function showMapFallback(address, container) {
    // 네이버 지도 iframe으로 대체
    const encoded = encodeURIComponent(address);
    container.innerHTML = `
        <iframe
            src="https://map.naver.com/p/search/${encoded}"
            width="100%" height="100%" frameborder="0"
            style="border:0;" allowfullscreen loading="lazy"
            title="지도">
        </iframe>
    `;
}

// ============================
// 홈 - 최근 행사
// ============================
function loadRecentEvents() {
    const events = DB.get('events');
    const grid = document.getElementById('recentEventsGrid');
    if (!grid) return;

    if (events.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📷</div><h3>아직 등록된 행사가 없습니다</h3></div>';
        return;
    }

    const sorted = [...events].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    const categoryEmojis = getCategoryEmojis();

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
                <div class="director-photo">${photoHtml}</div>
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

    const philosophy = aboutData.educationPhilosophy || '';
    const classes = aboutData.classes || [
        { emoji: '🐣', name: '병아리반', age: '만 1세' },
        { emoji: '🐰', name: '토끼반', age: '만 2세' },
        { emoji: '🦊', name: '여우반', age: '만 3세' },
        { emoji: '🦁', name: '사자반', age: '만 4세' },
        { emoji: '🐘', name: '코끼리반', age: '만 5세' }
    ];
    const dailySchedule = aboutData.dailySchedule || [
        { time: '07:30', activity: '등원 및 자유놀이' },
        { time: '09:30', activity: '오전 간식' },
        { time: '10:00', activity: '오전 교육활동' },
        { time: '11:30', activity: '점심 식사' },
        { time: '12:30', activity: '낮잠 및 휴식' },
        { time: '15:00', activity: '오후 간식' },
        { time: '15:30', activity: '오후 활동 / 특별활동' },
        { time: '16:30', activity: '자유놀이 및 귀가' },
        { time: '19:30', activity: '연장보육 마감' }
    ];
    const facilities = aboutData.facilities || [
        { icon: 'fas fa-video', name: 'CCTV 완비' },
        { icon: 'fas fa-wind', name: '공기청정기' },
        { icon: 'fas fa-tree', name: '야외 놀이터' },
        { icon: 'fas fa-book-reader', name: '도서 공간' },
        { icon: 'fas fa-music', name: '음악실' },
        { icon: 'fas fa-dumbbell', name: '체육 공간' }
    ];

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
                ${classes.map(c => `
                    <div class="class-item">
                        <span class="class-emoji">${c.emoji}</span>
                        <span class="class-name">${c.name}</span>
                        <span class="class-age">${c.age}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="about-card">
            <div class="about-card-icon">⏰</div>
            <h3>하루 일과</h3>
            <div class="schedule-timeline">
                ${dailySchedule.map(d => `
                    <div class="timeline-item"><span class="time">${d.time}</span> ${d.activity}</div>
                `).join('')}
            </div>
        </div>
        <div class="about-card">
            <div class="about-card-icon">🏆</div>
            <h3>시설 안내</h3>
            <div class="facility-grid">
                ${facilities.map(f => `
                    <div class="facility-item"><i class="${f.icon}"></i> ${f.name}</div>
                `).join('')}
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

    // 반 구성 에디터
    loadClassEditor(aboutData);
    // 하루 일과 에디터
    loadDailyScheduleEditor(aboutData);
    // 시설 안내 에디터
    loadFacilityEditor(aboutData);
}

function loadClassEditor(aboutData) {
    const classes = aboutData.classes || [
        { emoji: '🐣', name: '병아리반', age: '만 1세' },
        { emoji: '🐰', name: '토끼반', age: '만 2세' },
        { emoji: '🦊', name: '여우반', age: '만 3세' },
        { emoji: '🦁', name: '사자반', age: '만 4세' },
        { emoji: '🐘', name: '코끼리반', age: '만 5세' }
    ];
    const editor = document.getElementById('adminClassEditor');
    if (!editor) return;
    editor.innerHTML = classes.map((c, i) => `
        <div class="admin-editor-item" id="classItem_${i}">
            <input class="input-emoji" value="${c.emoji}" placeholder="🐣" data-field="emoji">
            <input value="${c.name}" placeholder="반 이름" data-field="name">
            <input class="input-sm" value="${c.age}" placeholder="연령" data-field="age">
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

function addClassItem() {
    const editor = document.getElementById('adminClassEditor');
    if (!editor) return;
    const div = document.createElement('div');
    div.className = 'admin-editor-item';
    div.innerHTML = `
        <input class="input-emoji" value="" placeholder="🐣" data-field="emoji">
        <input value="" placeholder="반 이름" data-field="name">
        <input class="input-sm" value="" placeholder="연령" data-field="age">
        <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    editor.appendChild(div);
}

function loadDailyScheduleEditor(aboutData) {
    const schedule = aboutData.dailySchedule || [
        { time: '07:30', activity: '등원 및 자유놀이' }
    ];
    const editor = document.getElementById('adminDailyScheduleEditor');
    if (!editor) return;
    editor.innerHTML = schedule.map((d, i) => `
        <div class="admin-editor-item" id="dailyItem_${i}">
            <input class="input-sm" value="${d.time}" placeholder="07:30" data-field="time">
            <input value="${d.activity}" placeholder="활동 내용" data-field="activity">
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

function addDailyScheduleItem() {
    const editor = document.getElementById('adminDailyScheduleEditor');
    if (!editor) return;
    const div = document.createElement('div');
    div.className = 'admin-editor-item';
    div.innerHTML = `
        <input class="input-sm" value="" placeholder="00:00" data-field="time">
        <input value="" placeholder="활동 내용" data-field="activity">
        <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    editor.appendChild(div);
}

function loadFacilityEditor(aboutData) {
    const facilities = aboutData.facilities || [
        { icon: 'fas fa-video', name: 'CCTV 완비' }
    ];
    const editor = document.getElementById('adminFacilityEditor');
    if (!editor) return;
    editor.innerHTML = facilities.map((f, i) => `
        <div class="admin-editor-item" id="facilityItem_${i}">
            <input class="input-icon" value="${f.icon}" placeholder="fas fa-video" data-field="icon">
            <input value="${f.name}" placeholder="시설명" data-field="name">
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

function addFacilityItem() {
    const editor = document.getElementById('adminFacilityEditor');
    if (!editor) return;
    const div = document.createElement('div');
    div.className = 'admin-editor-item';
    div.innerHTML = `
        <input class="input-icon" value="" placeholder="fas fa-star" data-field="icon">
        <input value="" placeholder="시설명" data-field="name">
        <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    editor.appendChild(div);
}

function saveAboutData() {
    // 반 구성 수집
    const classItems = document.querySelectorAll('#adminClassEditor .admin-editor-item');
    const classes = [];
    classItems.forEach(item => {
        const emoji = item.querySelector('[data-field="emoji"]').value.trim();
        const name = item.querySelector('[data-field="name"]').value.trim();
        const age = item.querySelector('[data-field="age"]').value.trim();
        if (name) classes.push({ emoji, name, age });
    });

    // 하루 일과 수집
    const dailyItems = document.querySelectorAll('#adminDailyScheduleEditor .admin-editor-item');
    const dailySchedule = [];
    dailyItems.forEach(item => {
        const time = item.querySelector('[data-field="time"]').value.trim();
        const activity = item.querySelector('[data-field="activity"]').value.trim();
        if (time && activity) dailySchedule.push({ time, activity });
    });

    // 시설 안내 수집
    const facilityItems = document.querySelectorAll('#adminFacilityEditor .admin-editor-item');
    const facilities = [];
    facilityItems.forEach(item => {
        const icon = item.querySelector('[data-field="icon"]').value.trim();
        const name = item.querySelector('[data-field="name"]').value.trim();
        if (name) facilities.push({ icon: icon || 'fas fa-star', name });
    });

    const aboutData = {
        directorName: document.getElementById('adminDirectorName').value.trim(),
        directorRole: document.getElementById('adminDirectorRole').value.trim(),
        directorGreeting: document.getElementById('adminDirectorGreeting').value.trim(),
        directorPhoto: DB.get('aboutData', {}).directorPhoto || '',
        educationPhilosophy: document.getElementById('adminEducationPhilosophy').value.trim(),
        classes: classes,
        dailySchedule: dailySchedule,
        facilities: facilities
    };
    DB.set('aboutData', aboutData);
    showToast('소개 정보가 저장되었습니다', 'success');
}

function handleDirectorPhotoUpload(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) { showToast('이미지 파일만 업로드할 수 있습니다', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('파일 크기는 5MB 이하여야 합니다', 'error'); return; }

    compressImage(file, 400, 0.8).then(dataUrl => {
        const aboutData = DB.get('aboutData', {});
        aboutData.directorPhoto = dataUrl;
        DB.set('aboutData', aboutData);
        const photoPreview = document.getElementById('directorPhotoPreview');
        if (photoPreview) photoPreview.innerHTML = `<img src="${dataUrl}" alt="원장 사진">`;
        showToast('원장 사진이 업로드되었습니다', 'success');
    }).catch(() => showToast('사진 업로드 실패', 'error'));
    document.getElementById('directorPhotoInput').value = '';
}

function removeDirectorPhoto() {
    const aboutData = DB.get('aboutData', {});
    aboutData.directorPhoto = '';
    DB.set('aboutData', aboutData);
    const photoPreview = document.getElementById('directorPhotoPreview');
    if (photoPreview) photoPreview.innerHTML = `<i class="fas fa-user-circle"></i><span>사진 없음</span>`;
    showToast('원장 사진이 삭제되었습니다', 'success');
}

// ============================
// 관리자 - 홈 화면 관리
// ============================
function loadHomeAdminForm() {
    const hd = getHomeData();
    const t1 = document.getElementById('adminHeroTitle1');
    const t2 = document.getElementById('adminHeroTitle2');
    const sub = document.getElementById('adminHeroSubtitle');
    const addr = document.getElementById('adminAddress');
    const phone = document.getElementById('adminPhone');
    const hours = document.getElementById('adminHours');
    const email = document.getElementById('adminEmail');

    if (t1) t1.value = hd.heroTitle1 || '';
    if (t2) t2.value = hd.heroTitle2 || '';
    if (sub) sub.value = hd.heroSubtitle || '';
    if (addr) addr.value = hd.address || '';
    if (phone) phone.value = hd.phone || '';
    if (hours) hours.value = hd.hours || '';
    if (email) email.value = hd.email || '';

    // 특징 카드 에디터
    loadFeaturesEditor(hd);
    // 프로그램 에디터
    loadProgramsEditor(hd);
}

function loadFeaturesEditor(hd) {
    const features = hd.features || [];
    const editor = document.getElementById('adminFeaturesEditor');
    if (!editor) return;
    editor.innerHTML = features.map((f, i) => `
        <div class="admin-editor-item" id="featureItem_${i}">
            <input class="input-icon" value="${f.icon}" placeholder="fas fa-heart" data-field="icon">
            <input value="${f.title}" placeholder="제목" data-field="title">
            <input value="${f.color1 || '#FF9A9E'}" placeholder="#색상1" data-field="color1" class="input-sm">
            <input value="${f.color2 || '#FECFEF'}" placeholder="#색상2" data-field="color2" class="input-sm">
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
            <textarea data-field="desc" rows="1" placeholder="설명">${f.desc}</textarea>
        </div>
    `).join('');
}

function addFeatureCard() {
    const editor = document.getElementById('adminFeaturesEditor');
    if (!editor) return;
    const div = document.createElement('div');
    div.className = 'admin-editor-item';
    div.innerHTML = `
        <input class="input-icon" value="" placeholder="fas fa-star" data-field="icon">
        <input value="" placeholder="제목" data-field="title">
        <input value="#FF9A9E" placeholder="#색상1" data-field="color1" class="input-sm">
        <input value="#FECFEF" placeholder="#색상2" data-field="color2" class="input-sm">
        <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        <textarea data-field="desc" rows="1" placeholder="설명"></textarea>
    `;
    editor.appendChild(div);
}

function loadProgramsEditor(hd) {
    const programs = hd.programs || [];
    const editor = document.getElementById('adminProgramsEditor');
    if (!editor) return;
    editor.innerHTML = programs.map((p, i) => `
        <div class="admin-editor-item" id="programItem_${i}">
            <input class="input-emoji" value="${p.emoji}" placeholder="🎨" data-field="emoji">
            <input value="${p.title}" placeholder="프로그램명" data-field="title">
            <input class="input-sm" value="${p.badge || ''}" placeholder="배지" data-field="badge">
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
            <textarea data-field="desc" rows="1" placeholder="설명">${p.desc}</textarea>
        </div>
    `).join('');
}

function addProgramCard() {
    const editor = document.getElementById('adminProgramsEditor');
    if (!editor) return;
    const div = document.createElement('div');
    div.className = 'admin-editor-item';
    div.innerHTML = `
        <input class="input-emoji" value="" placeholder="🎨" data-field="emoji">
        <input value="" placeholder="프로그램명" data-field="title">
        <input class="input-sm" value="" placeholder="배지" data-field="badge">
        <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        <textarea data-field="desc" rows="1" placeholder="설명"></textarea>
    `;
    editor.appendChild(div);
}

function saveHomeData() {
    // 특징 카드 수집
    const featureItems = document.querySelectorAll('#adminFeaturesEditor .admin-editor-item');
    const features = [];
    featureItems.forEach(item => {
        const icon = item.querySelector('[data-field="icon"]').value.trim();
        const title = item.querySelector('[data-field="title"]').value.trim();
        const desc = item.querySelector('[data-field="desc"]').value.trim();
        const color1 = item.querySelector('[data-field="color1"]').value.trim();
        const color2 = item.querySelector('[data-field="color2"]').value.trim();
        if (title) features.push({ icon: icon || 'fas fa-star', title, desc, color1, color2 });
    });

    // 프로그램 수집
    const programItems = document.querySelectorAll('#adminProgramsEditor .admin-editor-item');
    const programs = [];
    programItems.forEach(item => {
        const emoji = item.querySelector('[data-field="emoji"]').value.trim();
        const title = item.querySelector('[data-field="title"]').value.trim();
        const desc = item.querySelector('[data-field="desc"]').value.trim();
        const badge = item.querySelector('[data-field="badge"]').value.trim();
        if (title) programs.push({ emoji, title, desc, badge });
    });

    const homeData = {
        heroTitle1: document.getElementById('adminHeroTitle1').value.trim(),
        heroTitle2: document.getElementById('adminHeroTitle2').value.trim(),
        heroSubtitle: document.getElementById('adminHeroSubtitle').value.trim(),
        features: features,
        programs: programs,
        address: document.getElementById('adminAddress').value.trim(),
        phone: document.getElementById('adminPhone').value.trim(),
        hours: document.getElementById('adminHours').value.trim(),
        email: document.getElementById('adminEmail').value.trim()
    };

    DB.set('homeData', homeData);
    showToast('홈 화면 정보가 저장되었습니다', 'success');
}

// ============================
// 관리자 - 카테고리 관리
// ============================
function loadCategoryEditor() {
    const cats = getCategories();
    const editor = document.getElementById('categoryEditor');
    if (!editor) return;
    editor.innerHTML = cats.map((c, i) => `
        <div class="admin-editor-item" id="catItem_${i}">
            <input class="input-emoji" value="${c.emoji}" placeholder="🌸" data-field="emoji">
            <input value="${c.name}" placeholder="카테고리명" data-field="name">
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

function addCategory() {
    const editor = document.getElementById('categoryEditor');
    if (!editor) return;
    const div = document.createElement('div');
    div.className = 'admin-editor-item';
    div.innerHTML = `
        <input class="input-emoji" value="" placeholder="🎈" data-field="emoji">
        <input value="" placeholder="카테고리명" data-field="name">
        <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    editor.appendChild(div);
}

function saveCategories() {
    const items = document.querySelectorAll('#categoryEditor .admin-editor-item');
    const cats = [];
    items.forEach(item => {
        const emoji = item.querySelector('[data-field="emoji"]').value.trim();
        const name = item.querySelector('[data-field="name"]').value.trim();
        if (name) cats.push({ name, emoji: emoji || '📌' });
    });
    DB.set('categories', cats);
    // 카테고리 셀렉트 갱신
    updateCategorySelects();
    loadEventFilters();
    showToast('카테고리가 저장되었습니다', 'success');
}

function updateCategorySelects() {
    const cats = getCategories();
    const eventCatSelect = document.getElementById('eventCategory');
    if (eventCatSelect) {
        eventCatSelect.innerHTML = cats.map(c => `<option value="${c.name}">${c.emoji} ${c.name} 행사</option>`).join('');
    }
}

function loadEventFilters() {
    const cats = getCategories();
    const filtersEl = document.getElementById('eventFilters');
    if (!filtersEl) return;
    let html = `<button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" onclick="filterEvents('all')">전체</button>`;
    cats.forEach(c => {
        html += `<button class="filter-btn ${currentFilter === c.name ? 'active' : ''}" onclick="filterEvents('${c.name}')">${c.emoji} ${c.name}</button>`;
    });
    filtersEl.innerHTML = html;
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
    document.getElementById('bgMusic').volume = value / 100;
}

function handleMusicUpload(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('audio/')) { showToast('오디오 파일만 업로드할 수 있습니다', 'error'); return; }
    if (file.size > 15 * 1024 * 1024) { showToast('파일 크기는 15MB 이하여야 합니다', 'error'); return; }
    showToast('음악 파일을 업로드하고 있습니다...', 'success');
    const reader = new FileReader();
    reader.onload = function(e) {
        const musicData = { dataUrl: e.target.result, fileName: file.name, fileSize: file.size, uploadDate: new Date().toISOString() };
        try {
            DB.set('musicData', musicData);
            initMusicPlayer();
            loadMusicAdminStatus();
            showToast(`"${file.name}" 음악이 업로드되었습니다`, 'success');
        } catch (err) {
            showToast('파일이 너무 큽니다. 더 작은 파일을 업로드해주세요.', 'error');
        }
    };
    reader.readAsDataURL(file);
    document.getElementById('musicFileInput').value = '';
}

function deleteMusic() {
    if (!confirm('배경 음악을 삭제하시겠습니까?')) return;
    const audio = document.getElementById('bgMusic');
    audio.pause(); audio.src = ''; isMusicPlaying = false;
    document.getElementById('musicIcon').className = 'fas fa-play';
    document.getElementById('musicToggleBtn').classList.remove('playing');
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

    // 필터 버튼 갱신
    loadEventFilters();

    let filtered = currentFilter === 'all' ? events : events.filter(e => e.category === currentFilter);
    filtered = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
        timeline.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    const categoryEmojis = getCategoryEmojis();

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
    loadEventsTimeline();
}

// ============================
// 사진 모달 (핀치줌 + 확대/축소)
// ============================
let modalPhotos = [];
let modalPhotoIndex = 0;
let photoZoom = { scale: 1, translateX: 0, translateY: 0 };
let pinchState = { startDist: 0, startScale: 1 };
let panState = { startX: 0, startY: 0, isPanning: false };
let lastTapTime = 0;

function openPhotoModal(eventId, photoIndex) {
    const events = DB.get('events');
    const ev = events.find(e => e.id === eventId);
    if (!ev || !ev.photos || ev.photos.length === 0) return;
    modalPhotos = ev.photos;
    modalPhotoIndex = photoIndex;
    resetZoom();
    updatePhotoModal();
    document.getElementById('photoModal').classList.add('show');
    document.body.style.overflow = 'hidden';
    initPhotoZoom();
}

function updatePhotoModal() {
    const img = document.getElementById('modalPhoto');
    img.src = modalPhotos[modalPhotoIndex];
    resetZoom();
    applyZoomTransform();
    document.getElementById('photoInfo').textContent = `사진 ${modalPhotoIndex + 1} / ${modalPhotos.length}`;
    document.getElementById('photoThumbnails').innerHTML = modalPhotos.map((p, i) =>
        `<img src="${p}" class="${i === modalPhotoIndex ? 'active' : ''}" onclick="modalPhotoIndex=${i};updatePhotoModal()">`
    ).join('');
    // 줌 컨트롤 표시
    updateZoomControls();
}

function resetZoom() {
    photoZoom = { scale: 1, translateX: 0, translateY: 0 };
}

function applyZoomTransform() {
    const img = document.getElementById('modalPhoto');
    if (!img) return;
    img.style.transform = `translate(${photoZoom.translateX}px, ${photoZoom.translateY}px) scale(${photoZoom.scale})`;
    img.style.cursor = photoZoom.scale > 1 ? 'grab' : 'default';
    updateZoomControls();
}

function updateZoomControls() {
    const zoomInfo = document.getElementById('zoomInfo');
    if (zoomInfo) {
        const pct = Math.round(photoZoom.scale * 100);
        zoomInfo.textContent = pct + '%';
        zoomInfo.style.opacity = photoZoom.scale !== 1 ? '1' : '0.5';
    }
}

function zoomPhoto(delta) {
    const newScale = Math.max(0.5, Math.min(5, photoZoom.scale + delta));
    photoZoom.scale = newScale;
    if (newScale <= 1) { photoZoom.translateX = 0; photoZoom.translateY = 0; }
    applyZoomTransform();
}

function zoomPhotoReset() {
    resetZoom();
    applyZoomTransform();
}

function initPhotoZoom() {
    const viewer = document.querySelector('.photo-viewer');
    const img = document.getElementById('modalPhoto');
    if (!viewer || !img) return;

    // 기존 리스너 제거 후 재등록 방지
    if (viewer._zoomInitialized) return;
    viewer._zoomInitialized = true;

    // 모바일: 핀치 줌
    viewer.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchState.startDist = Math.sqrt(dx * dx + dy * dy);
            pinchState.startScale = photoZoom.scale;
        } else if (e.touches.length === 1 && photoZoom.scale > 1) {
            panState.startX = e.touches[0].clientX - photoZoom.translateX;
            panState.startY = e.touches[0].clientY - photoZoom.translateY;
            panState.isPanning = true;
        }
    }, { passive: false });

    viewer.addEventListener('touchmove', function(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const newScale = Math.max(0.5, Math.min(5, pinchState.startScale * (dist / pinchState.startDist)));
            photoZoom.scale = newScale;
            if (newScale <= 1) { photoZoom.translateX = 0; photoZoom.translateY = 0; }
            applyZoomTransform();
        } else if (e.touches.length === 1 && panState.isPanning && photoZoom.scale > 1) {
            e.preventDefault();
            photoZoom.translateX = e.touches[0].clientX - panState.startX;
            photoZoom.translateY = e.touches[0].clientY - panState.startY;
            applyZoomTransform();
        }
    }, { passive: false });

    viewer.addEventListener('touchend', function(e) {
        panState.isPanning = false;
        // 더블 탭 줌
        if (e.touches.length === 0 && e.changedTouches.length === 1) {
            const now = Date.now();
            if (now - lastTapTime < 300) {
                e.preventDefault();
                if (photoZoom.scale > 1) {
                    resetZoom();
                } else {
                    photoZoom.scale = 2.5;
                }
                applyZoomTransform();
            }
            lastTapTime = now;
        }
    }, { passive: false });

    // 데스크탑: 마우스 휠 줌
    viewer.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.3 : 0.3;
        zoomPhoto(delta);
    }, { passive: false });

    // 데스크탑: 드래그 팬
    let mouseDown = false, mouseStartX = 0, mouseStartY = 0;
    viewer.addEventListener('mousedown', function(e) {
        if (photoZoom.scale > 1) {
            mouseDown = true;
            mouseStartX = e.clientX - photoZoom.translateX;
            mouseStartY = e.clientY - photoZoom.translateY;
            img.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });
    viewer.addEventListener('mousemove', function(e) {
        if (mouseDown && photoZoom.scale > 1) {
            photoZoom.translateX = e.clientX - mouseStartX;
            photoZoom.translateY = e.clientY - mouseStartY;
            applyZoomTransform();
        }
    });
    viewer.addEventListener('mouseup', function() { mouseDown = false; img.style.cursor = photoZoom.scale > 1 ? 'grab' : 'default'; });
    viewer.addEventListener('mouseleave', function() { mouseDown = false; });

    // 더블클릭 줌
    viewer.addEventListener('dblclick', function(e) {
        e.preventDefault();
        if (photoZoom.scale > 1) {
            resetZoom();
        } else {
            photoZoom.scale = 2.5;
        }
        applyZoomTransform();
    });
}

function prevPhoto() { modalPhotoIndex = (modalPhotoIndex - 1 + modalPhotos.length) % modalPhotos.length; updatePhotoModal(); }
function nextPhoto() { modalPhotoIndex = (modalPhotoIndex + 1) % modalPhotos.length; updatePhotoModal(); }
function closePhotoModal() {
    document.getElementById('photoModal').classList.remove('show');
    document.body.style.overflow = '';
    resetZoom();
    const viewer = document.querySelector('.photo-viewer');
    if (viewer) viewer._zoomInitialized = false;
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePhotoModal();
    if (e.key === 'ArrowLeft') prevPhoto();
    if (e.key === 'ArrowRight') nextPhoto();
    if (e.key === '+' || e.key === '=') zoomPhoto(0.3);
    if (e.key === '-') zoomPhoto(-0.3);
    if (e.key === '0') zoomPhotoReset();
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
    const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const dotColors = ['#1976D2','#7B1FA2','#388E3C','#F57C00','#C62828','#00838F','#F9A825','#283593','#D84315','#4E342E','#7B1FA2','#1976D2'];

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
                    <div><h3>${name}</h3><div class="month-theme">${theme}</div></div>
                </div>
                <div class="month-events-preview">
                    ${monthSchedules.length > 0
                        ? monthSchedules.slice(0, 3).map(s => `<div class="month-event-item"><div class="month-event-dot" style="background:${dotColors[i]}"></div>${s.name}</div>`).join('') + (monthSchedules.length > 3 ? `<div class="month-event-item" style="color:var(--text-muted);">+${monthSchedules.length - 3}개 더...</div>` : '')
                        : '<div class="month-event-item" style="color:var(--text-muted);">등록된 일정 없음</div>'
                    }
                </div>
            </div>
        `;
    }).join('');
}

function changeYear(delta) { selectedYear += delta; loadYearlySchedule(); }
function goToMonth(monthIndex) { selectedMonth = monthIndex; switchScheduleTab('monthly'); loadMonthlyCalendar(); }

// ============================
// 교육 계획 - 월간
// ============================
function loadMonthlyCalendar() {
    const year = selectedYear;
    const month = selectedMonth;
    const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
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

    const typeColors = { '교육':'#4ECDC4', '행사':'#FF6B9D', '체험':'#FFD93D', '상담':'#A78BFA', '기타':'#B2BEC3', '특별':'#FB923C' };

    let calendarHTML = `<div class="calendar-header"><div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div></div><div class="calendar-body">`;

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
        calendarHTML += `<div class="${classes.join(' ')}"><div class="day-number">${day}</div><div class="day-events">${daySchedules.map(s => `<div class="day-event-dot" style="background:${typeColors[s.type] || '#B2BEC3'}" title="${s.name}">${s.name}</div>`).join('')}</div></div>`;
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
        calendarHTML += `<div class="calendar-day other-month"><div class="day-number">${i}</div></div>`;
    }
    calendarHTML += '</div>';
    document.getElementById('monthlyCalendar').innerHTML = calendarHTML;

    const weekDays = ['일','월','화','수','목','금','토'];
    const eventsList = document.getElementById('monthEventsList');
    if (monthSchedules.length === 0) {
        eventsList.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><h3>이 달에 등록된 일정이 없습니다</h3></div>';
    } else {
        eventsList.innerHTML = monthSchedules.map(s => {
            const d = new Date(s.date);
            const color = typeColors[s.type] || '#B2BEC3';
            return `
                <div class="month-event-card" style="border-left-color:${color}">
                    <div class="month-event-date"><div class="day">${d.getDate()}</div><div class="weekday">${weekDays[d.getDay()]}</div></div>
                    <div class="month-event-info" style="flex:1;"><h4>${s.name}</h4><p>${s.desc || ''}</p>${s.theme ? `<p style="color:var(--primary);font-size:0.8rem;margin-top:0.25rem;"><i class="fas fa-bookmark"></i> ${s.theme}</p>` : ''}</div>
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
    if (event && event.target) event.target.classList.add('active');
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
    loadHomeAdminForm();
    loadEventAdminList();
    loadPhotoEventSelect();
    loadAdminPhotoGrid();
    loadScheduleAdminList();
    loadYearlyThemeEditor();
    loadAboutAdminForm();
    loadCategoryEditor();
    loadMusicAdminStatus();
    loadStorageSummary();
    updateCategorySelects();
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.getElementById('admin-' + tab).classList.add('active');
    if (event && event.target) {
        let btn = event.target.closest('.admin-tab');
        if (btn) btn.classList.add('active');
    }
    if (tab === 'home-manage') loadHomeAdminForm();
    if (tab === 'about-manage') loadAboutAdminForm();
    if (tab === 'music-manage') loadMusicAdminStatus();
    if (tab === 'photo-manage') { loadAdminPhotoGrid(); loadStorageSummary(); }
    if (tab === 'category-manage') loadCategoryEditor();
}

// ============================
// 관리자 - 사진 용량 관리 UI
// ============================
function loadStorageSummary() {
    const container = document.getElementById('storageSummaryContainer');
    if (!container) return;
    const events = DB.get('events');
    let totalPhotos = 0, totalBytes = 0;
    const eventBreakdown = [];
    events.forEach(ev => {
        const photos = ev.photos || [];
        let eventBytes = 0;
        photos.forEach(p => { eventBytes += Math.round((p.length || 0) * 3 / 4); });
        totalPhotos += photos.length;
        totalBytes += eventBytes;
        if (photos.length > 0) eventBreakdown.push({ name: ev.name, count: photos.length, bytes: eventBytes });
    });
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
    const limitMB = 1024;
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
                <div class="storage-stat"><span class="stat-value">${events.length}</span><span class="stat-label">전체 행사</span></div>
                <div class="storage-stat"><span class="stat-value">${totalPhotos}</span><span class="stat-label">전체 사진</span></div>
                <div class="storage-stat"><span class="stat-value">${totalMB}MB</span><span class="stat-label">사용 용량</span></div>
            </div>
            <div class="storage-progress-wrap">
                <div class="storage-progress-label"><span>사용량 ${totalMB}MB / ${limitMB}MB</span><span>${usagePercent.toFixed(1)}%</span></div>
                <div class="storage-progress-bar"><div class="storage-progress-fill ${isWarning ? 'warning' : ''}" style="width:${usagePercent}%"></div></div>
            </div>
            ${eventBreakdown.length > 0 ? `
                <h4 style="font-size:0.9rem;color:var(--text-light);margin-bottom:0.5rem;">행사별 용량</h4>
                <div class="storage-breakdown">${eventBreakdown.sort((a,b) => b.bytes - a.bytes).map(item => `<div class="storage-breakdown-item"><span class="event-name">${item.name}</span><span class="photo-count">${item.count}장</span><span class="photo-size">${formatSize(item.bytes)}</span></div>`).join('')}</div>
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
    if (!name || !date) { showToast('행사명과 날짜를 입력해주세요', 'error'); return; }
    const events = DB.get('events');
    events.push({ id: Date.now(), name, date, category, location, desc, photos: [] });
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
    const categoryEmojis = getCategoryEmojis();
    if (events.length === 0) { list.innerHTML = '<div class="empty-state"><p>등록된 행사가 없습니다</p></div>'; return; }
    list.innerHTML = events.map(e => `
        <div class="event-admin-item">
            <div class="admin-item-info">
                <h4>${categoryEmojis[e.category] || ''} ${e.name}</h4>
                <p>${formatDate(e.date)} · ${e.location || '장소 미정'} · 사진 ${(e.photos || []).length}장</p>
            </div>
            <div class="admin-item-actions">
                <button class="btn btn-danger btn-sm" onclick="deleteEvent(${e.id})"><i class="fas fa-trash"></i> 삭제</button>
            </div>
        </div>
    `).join('');
}

function deleteEvent(id) {
    if (!confirm('정말로 이 행사를 삭제하시겠습니까?\n관련 사진도 모두 삭제됩니다.')) return;
    let events = DB.get('events');
    events = events.filter(e => e.id !== id);
    DB.set('events', events);
    loadEventAdminList(); loadPhotoEventSelect(); loadAdminPhotoGrid(); loadStorageSummary();
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
    if (select1) select1.innerHTML = '<option value="">행사를 선택하세요</option>' + options;
    if (select2) select2.innerHTML = '<option value="all">전체 보기</option>' + options;
}

function handlePhotoUpload(files) {
    const eventId = parseInt(document.getElementById('photoEventSelect').value);
    if (!eventId) { showToast('먼저 행사를 선택해주세요', 'error'); return; }
    const preview = document.getElementById('uploadPreview');
    let processed = 0;
    const total = files.length;
    showToast(`${total}개 사진 압축 및 업로드 중...`, 'success');
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) { processed++; return; }
        if (file.size > 10 * 1024 * 1024) { showToast(`${file.name}이 10MB를 초과합니다`, 'error'); processed++; return; }
        compressImage(file, 800, 0.7).then(compressedDataUrl => {
            const events = DB.get('events');
            const ev = events.find(ev => ev.id === eventId);
            if (ev) { if (!ev.photos) ev.photos = []; ev.photos.push(compressedDataUrl); DB.set('events', events); }
            const div = document.createElement('div');
            div.className = 'upload-preview-item';
            div.innerHTML = `<img src="${compressedDataUrl}" alt="uploaded"><button class="remove-btn" onclick="this.parentElement.remove()">×</button>`;
            preview.appendChild(div);
            processed++;
            if (processed >= total) { loadAdminPhotoGrid(); loadStorageSummary(); loadEventAdminList(); showToast(`${total}개 사진이 업로드되었습니다`, 'success'); }
        }).catch(() => { processed++; });
    });
    document.getElementById('photoInput').value = '';
}

function loadAdminPhotoGrid() {
    const events = DB.get('events');
    const filterVal = document.getElementById('photoFilterSelect') ? document.getElementById('photoFilterSelect').value : 'all';
    const grid = document.getElementById('adminPhotoGrid');
    if (!grid) return;
    let allPhotos = [];
    events.forEach(ev => {
        (ev.photos || []).forEach((photo, i) => {
            if (filterVal === 'all' || String(ev.id) === filterVal) {
                allPhotos.push({ eventId: ev.id, eventName: ev.name, photo, index: i });
            }
        });
    });
    if (allPhotos.length === 0) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>업로드된 사진이 없습니다</p></div>'; return; }
    grid.innerHTML = allPhotos.map(p => `
        <div class="admin-photo-item">
            <img src="${p.photo}" alt="${p.eventName}">
            <div class="delete-overlay" onclick="deletePhoto(${p.eventId}, ${p.index})"><i class="fas fa-trash"></i></div>
        </div>
    `).join('');
}

function filterAdminPhotos() { loadAdminPhotoGrid(); }

function deletePhoto(eventId, photoIndex) {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return;
    const events = DB.get('events');
    const ev = events.find(e => e.id === eventId);
    if (ev && ev.photos) { ev.photos.splice(photoIndex, 1); DB.set('events', events); }
    loadAdminPhotoGrid(); loadEventAdminList(); loadStorageSummary();
    showToast('사진이 삭제되었습니다', 'success');
}

// 드래그앤드롭
document.addEventListener('DOMContentLoaded', () => {
    const zone = document.getElementById('uploadZone');
    if (zone) {
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--primary)'; zone.style.background = 'var(--primary-light)'; });
        zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; zone.style.background = ''; });
        zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = ''; zone.style.background = ''; handlePhotoUpload(e.dataTransfer.files); });
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
    if (!name || !date) { showToast('일정명과 날짜를 입력해주세요', 'error'); return; }
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
    const typeEmojis = { '교육':'📚', '행사':'🎉', '체험':'🌿', '상담':'👨‍👩‍👧', '기타':'📌', '특별':'⭐' };
    if (schedules.length === 0) { list.innerHTML = '<div class="empty-state"><p>등록된 일정이 없습니다</p></div>'; return; }
    list.innerHTML = schedules.map(s => `
        <div class="schedule-admin-item">
            <div class="admin-item-info">
                <h4>${typeEmojis[s.type] || '📌'} ${s.name}</h4>
                <p>${formatDate(s.date)} · ${s.type}${s.theme ? ' · ' + s.theme : ''}</p>
            </div>
            <div class="admin-item-actions">
                <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.id})"><i class="fas fa-trash"></i></button>
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
    const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    if (!editor) return;
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
        if (input && input.value.trim()) themes[selectedYear][i] = input.value.trim();
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
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}" style="color:${type === 'success' ? 'var(--secondary)' : '#ff4757'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// 스크롤 이벤트
window.addEventListener('scroll', () => {
    const scrollBtn = document.getElementById('scrollTopBtn');
    scrollBtn.classList.toggle('show', window.scrollY > 300);
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 10);
});

// 히어로 파티클
function createParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;
    const colors = ['#FF6B9D', '#4ECDC4', '#FFD93D', '#A78BFA', '#FB923C', '#FF9A9E', '#A8EDEA'];
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        const size = Math.random() * 12 + 4;
        particle.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:${colors[Math.floor(Math.random() * colors.length)]};opacity:${Math.random() * 0.3 + 0.1};left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation:particleFloat ${Math.random() * 10 + 10}s ease-in-out infinite;animation-delay:${Math.random() * 5}s;`;
        container.appendChild(particle);
    }
}

const particleStyle = document.createElement('style');
particleStyle.textContent = `@keyframes particleFloat { 0%, 100% { transform: translate(0, 0) scale(1); } 25% { transform: translate(30px, -30px) scale(1.1); } 50% { transform: translate(-20px, 20px) scale(0.9); } 75% { transform: translate(15px, -15px) scale(1.05); } }`;
document.head.appendChild(particleStyle);

// ============================
// 초기화
// ============================
document.addEventListener('DOMContentLoaded', () => {
    initSampleData();
    createParticles();
    loadHomePage();
    initMusicPlayer();
    initFirebaseSync();
});
