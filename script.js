// 할일목록을 저장할 배열
let todos = [];
let todoIdCounter = 1;

// 전역 변수
let currentUser = null;
let currentMode = 'personal'; // 'personal' 또는 'team'
let teamTodos = [];
let teamMessages = [];
let users = {};

// DOM 요소들
const authModal = document.getElementById('authModal');
const mainApp = document.getElementById('mainApp');
const todoInput = document.getElementById('todoInput');
const dueDateInput = document.getElementById('dueDateInput');
const timeSelection = document.getElementById('timeSelection');
const hourInput = document.getElementById('hourInput');
const minuteInput = document.getElementById('minuteInput');
const shareOptions = document.getElementById('shareOptions');
const todoList = document.getElementById('todoList');
const emptyState = document.getElementById('emptyState');
const totalTodos = document.getElementById('totalTodos');
const completedTodos = document.getElementById('completedTodos');
const teamChatSection = document.getElementById('teamChatSection');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    // 구글 API 초기화
    initializeGoogleAuth();
    
    // 사용자 인증 확인
    checkAuth();
    
    // 시간 선택기 초기화
    initializeTimeSelectors();
    
    // 인증 탭 이벤트 리스너
    setupAuthTabs();
    
    // 모드 전환 이벤트 리스너
    setupModeSwitch();
    
    // 채팅 입력 이벤트 리스너
    setupChatInput();
    
    // Enter 키 이벤트 리스너
    todoInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addTodo();
        }
    });
    
    // 빠른 날짜 선택 버튼 이벤트 리스너
    const quickDateBtns = document.querySelectorAll('.quick-date-btn[data-days], .quick-date-btn[data-type]');
    quickDateBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const days = this.getAttribute('data-days');
            const type = this.getAttribute('data-type');
            
            if (days !== null) {
                selectQuickDate(parseInt(days));
            } else if (type) {
                selectQuickDate(type);
            }
        });
    });
    
    // 날짜 피커 변경 이벤트 리스너
    dueDateInput.addEventListener('change', function() {
        if (this.value) {
            // 빠른 날짜 버튼들 비활성화
            const quickBtns = document.querySelectorAll('.quick-date-btn[data-days]');
            quickBtns.forEach(btn => btn.classList.remove('active'));
            
            // "다른 날짜" 버튼 활성화
            const customBtn = document.querySelector('.custom-date-btn');
            if (customBtn) {
                customBtn.classList.add('active');
            }
            
            // 시간 선택기 표시
            showTimeSelection();
        }
    });
});

// 할 일 추가 함수
function addTodo() {
    const todoText = todoInput.value.trim();
    
    if (todoText === '') {
        alert('할 일을 입력해주세요!');
        return;
    }
    
    if (todoText.length > 100) {
        alert('할 일은 100자 이내로 입력해주세요!');
        return;
    }
    
    // 마감일 정보 처리
    const dueDate = dueDateInput.value || null;
    let dueDateTime = null;
    
    // 날짜와 시간이 모두 선택된 경우 datetime 생성
    if (dueDate && hourInput.value !== '' && minuteInput.value !== '') {
        const hour = hourInput.value;
        const minute = minuteInput.value;
        dueDateTime = `${dueDate}T${hour}:${minute}:00`;
    }
    
    // 공유 타입 확인
    const shareType = document.querySelector('input[name="shareType"]:checked')?.value || 'personal';
    
    // 새로운 할 일 객체 생성
    const newTodo = {
        id: todoIdCounter++,
        text: todoText,
        completed: false,
        createdAt: new Date().toISOString(),
        dueDate: dueDate,
        dueTime: dueDateTime ? `${hourInput.value}:${minuteInput.value}` : null,
        dueDateTime: dueDateTime,
        shareType: shareType,
        author: currentUser.username,
        authorName: currentUser.displayName
    };
    
    // 모드에 따라 적절한 배열에 추가
    if (currentMode === 'team' && shareType === 'team') {
        teamTodos.unshift(newTodo);
        saveTeamTodos();
        
        // 팀 채팅에 알림 메시지 추가
        const notificationMessage = {
            id: Date.now() + 1,
            username: 'system',
            displayName: '시스템',
            text: `${currentUser.displayName}님이 새로운 팀 할 일을 추가했습니다: "${todoText}"`,
            timestamp: new Date().toISOString(),
            isSystem: true
        };
        teamMessages.push(notificationMessage);
        saveTeamMessages();
        displayChatMessages();
    } else {
        todos.unshift(newTodo);
        saveTodos();
    }
    
    // 입력 필드 초기화
    todoInput.value = '';
    clearDateSelection();
    
    // 화면 업데이트
    updateDisplay();
    saveTodos();
    
    // 성공 피드백
    showFeedback('할 일이 추가되었습니다! 📝');
}

// 할 일 완료/미완료 토글
function toggleTodo(id) {
    let todo = null;
    let todoArray = null;
    
    if (currentMode === 'team') {
        todo = teamTodos.find(t => t.id === id);
        todoArray = teamTodos;
    } else {
        todo = todos.find(t => t.id === id);
        todoArray = todos;
    }
    
    if (todo) {
        todo.completed = !todo.completed;
        updateDisplay();
        
        if (currentMode === 'team') {
            saveTeamTodos();
        } else {
            saveTodos();
        }
        
        const message = todo.completed ? '완료했습니다! 🎉' : '미완료로 변경했습니다.';
        showFeedback(message);
    }
}

// 할 일 삭제
function deleteTodo(id) {
    if (confirm('정말로 이 할 일을 삭제하시겠습니까?')) {
        if (currentMode === 'team') {
            teamTodos = teamTodos.filter(t => t.id !== id);
            saveTeamTodos();
        } else {
            todos = todos.filter(t => t.id !== id);
            saveTodos();
        }
        updateDisplay();
        showFeedback('할 일이 삭제되었습니다. 🗑️');
    }
}

// 완료된 항목들 삭제
function clearCompleted() {
    const completedCount = todos.filter(t => t.completed).length;
    
    if (completedCount === 0) {
        alert('완료된 항목이 없습니다.');
        return;
    }
    
    if (confirm(`완료된 ${completedCount}개의 항목을 삭제하시겠습니까?`)) {
        todos = todos.filter(t => !t.completed);
        updateDisplay();
        saveTodos();
        showFeedback('완료된 항목들이 삭제되었습니다. ✨');
    }
}

// 모든 항목 삭제
function clearAll() {
    if (todos.length === 0) {
        alert('삭제할 항목이 없습니다.');
        return;
    }
    
    if (confirm('모든 할 일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        todos = [];
        todoIdCounter = 1;
        updateDisplay();
        saveTodos();
        showFeedback('모든 할 일이 삭제되었습니다. 🆕');
    }
}

// 화면 업데이트
function updateDisplay() {
    updateTodoList();
    updateStats();
    updateEmptyState();
}

// 할일 목록 업데이트
function updateTodoList() {
    todoList.innerHTML = '';
    
    // 현재 모드에 따라 표시할 할일 목록 선택
    let currentTodos = [];
    if (currentMode === 'team') {
        currentTodos = teamTodos;
    } else {
        currentTodos = todos;
    }
    
    // 날짜별로 정렬
    const sortedTodos = sortTodosByDate([...currentTodos]);
    
    sortedTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        // 날짜 및 시간 정보 처리
        let dateInfo = '';
        if (todo.dueDate) {
            const dueDate = new Date(todo.dueDate);
            const today = new Date();
            const timeDiff = dueDate.getTime() - today.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            let dateClass = '';
            let dateText = formatDate(dueDate);
            
            // 시간 정보가 있으면 추가
            if (todo.dueTime) {
                dateText += ` ${todo.dueTime}`;
            }
            
            if (daysDiff < 0) {
                dateClass = 'overdue';
                dateText = `${Math.abs(daysDiff)}일 지남`;
                if (todo.dueTime) {
                    dateText += ` (${todo.dueTime})`;
                }
            } else if (daysDiff === 0) {
                dateClass = 'due-today';
                dateText = '오늘';
                if (todo.dueTime) {
                    dateText += ` ${todo.dueTime}`;
                }
            } else if (daysDiff <= 3) {
                dateClass = 'due-soon';
                dateText = `${daysDiff}일 남음`;
                if (todo.dueTime) {
                    dateText += ` (${todo.dueTime})`;
                }
            }
            
            dateInfo = `<span class="todo-date ${dateClass}">${dateText}</span>`;
        }
        
        // 작성자 정보 (팀 모드에서만 표시)
        let authorInfo = '';
        if (currentMode === 'team' && todo.authorName) {
            authorInfo = `<span class="todo-author">by ${todo.authorName}</span>`;
        }
        
        li.innerHTML = `
            <div class="todo-checkbox ${todo.completed ? 'completed' : ''}" 
                 onclick="toggleTodo(${todo.id})"></div>
            <span class="todo-text ${todo.completed ? 'completed' : ''}">${escapeHtml(todo.text)}</span>
            ${authorInfo}
            ${dateInfo}
            <button class="todo-delete" onclick="deleteTodo(${todo.id})" title="삭제">×</button>
        `;
        todoList.appendChild(li);
    });
}

// 통계 업데이트
function updateStats() {
    let currentTodos = [];
    if (currentMode === 'team') {
        currentTodos = teamTodos;
    } else {
        currentTodos = todos;
    }
    
    const total = currentTodos.length;
    const completed = currentTodos.filter(t => t.completed).length;
    
    totalTodos.textContent = `총 ${total}개`;
    completedTodos.textContent = `완료 ${completed}개`;
}

// 빈 상태 표시 업데이트
function updateEmptyState() {
    let currentTodos = [];
    if (currentMode === 'team') {
        currentTodos = teamTodos;
    } else {
        currentTodos = todos;
    }
    
    if (currentTodos.length === 0) {
        emptyState.classList.remove('hidden');
        todoList.style.display = 'none';
    } else {
        emptyState.classList.add('hidden');
        todoList.style.display = 'block';
    }
}

// 로컬 스토리지에 저장
function saveTodos() {
    try {
        localStorage.setItem('todos', JSON.stringify(todos));
        localStorage.setItem('todoIdCounter', todoIdCounter.toString());
    } catch (error) {
        console.error('할 일 저장 중 오류가 발생했습니다:', error);
    }
}

// 로컬 스토리지에서 불러오기
function loadTodos() {
    try {
        const savedTodos = localStorage.getItem('todos');
        const savedCounter = localStorage.getItem('todoIdCounter');
        
        if (savedTodos) {
            todos = JSON.parse(savedTodos);
        }
        
        if (savedCounter) {
            todoIdCounter = parseInt(savedCounter);
        }
    } catch (error) {
        console.error('할 일 불러오기 중 오류가 발생했습니다:', error);
        todos = [];
        todoIdCounter = 1;
    }
}

// HTML 이스케이프 함수 (XSS 방지)
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 날짜 포맷팅 함수
function formatDate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
}

// 할 일을 날짜 및 시간별로 정렬하는 함수
function sortTodosByDate(todoArray) {
    return todoArray.sort((a, b) => {
        // 1. 완료된 할 일은 맨 아래로
        if (a.completed !== b.completed) {
            return a.completed - b.completed;
        }
        
        // 2. 마감일이 있는 할 일 우선
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        
        // 3. 둘 다 마감일이 있으면 날짜/시간 순으로 정렬
        if (a.dueDate && b.dueDate) {
            const dateA = new Date(a.dueDate);
            const dateB = new Date(b.dueDate);
            
            // 날짜가 다른 경우 날짜 순으로 정렬
            if (dateA.toDateString() !== dateB.toDateString()) {
                return dateA.getTime() - dateB.getTime();
            }
            
            // 같은 날짜인 경우: 시간이 있는 할 일이 시간이 없는 할 일보다 우선
            const hasTimeA = !!a.dueTime;
            const hasTimeB = !!b.dueTime;
            
            if (hasTimeA && !hasTimeB) return -1;  // A에만 시간이 있으면 A가 우선
            if (!hasTimeA && hasTimeB) return 1;   // B에만 시간이 있으면 B가 우선
            
            // 둘 다 시간이 있거나 둘 다 시간이 없는 경우 정확한 DateTime으로 비교
            const dateTimeA = getEffectiveDateTime(a);
            const dateTimeB = getEffectiveDateTime(b);
            
            if (dateTimeA.getTime() !== dateTimeB.getTime()) {
                return dateTimeA.getTime() - dateTimeB.getTime();
            }
        }
        
        // 4. 마감일이 같거나 둘 다 없으면 생성일 순으로 정렬 (최신 순)
        const createdA = new Date(a.createdAt);
        const createdB = new Date(b.createdAt);
        return createdB.getTime() - createdA.getTime();
    });
}

// 빠른 날짜 선택 함수
function selectQuickDate(value) {
    let targetDate = new Date();
    let selector = '';
    
    if (typeof value === 'number') {
        // 일 단위 선택 (오늘, 내일)
        targetDate.setDate(targetDate.getDate() + value);
        selector = `.quick-date-btn[data-days="${value}"]`;
    } else if (typeof value === 'string') {
        // 월 단위 선택
        if (value === 'month-end') {
            // 이번 달 마지막 날
            targetDate = getLastDayOfMonth(targetDate);
            selector = `.quick-date-btn[data-type="month-end"]`;
        } else if (value === 'next-month') {
            // 다음 달 첫째 날
            targetDate = getFirstDayOfNextMonth(targetDate);
            selector = `.quick-date-btn[data-type="next-month"]`;
        }
    }
    
    // 날짜를 YYYY-MM-DD 형식으로 변환
    const dateString = targetDate.toISOString().split('T')[0];
    dueDateInput.value = dateString;
    
    // 모든 빠른 날짜 버튼의 active 클래스 제거
    const allQuickBtns = document.querySelectorAll('.quick-date-btn');
    allQuickBtns.forEach(btn => btn.classList.remove('active'));
    
    // 클릭된 버튼에 active 클래스 추가
    const clickedBtn = document.querySelector(selector);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    // 날짜 피커 숨기기
    dueDateInput.classList.add('hidden');
    dueDateInput.classList.remove('visible');
    
    // "다른 날짜" 버튼의 active 상태 제거
    const customBtn = document.querySelector('.custom-date-btn');
    if (customBtn) {
        customBtn.classList.remove('active');
    }
    
    // 시간 선택기 표시
    showTimeSelection();
}

// 날짜 피커 토글 함수
function toggleDatePicker() {
    const isHidden = dueDateInput.classList.contains('hidden');
    
    if (isHidden) {
        // 날짜 피커 보이기
        dueDateInput.classList.remove('hidden');
        dueDateInput.classList.add('visible');
        dueDateInput.focus();
        
        // "다른 날짜" 버튼 활성화
        const customBtn = document.querySelector('.custom-date-btn');
        if (customBtn) {
            customBtn.classList.add('active');
        }
        
        // 다른 빠른 날짜 버튼 비활성화
        const quickBtns = document.querySelectorAll('.quick-date-btn[data-days]');
        quickBtns.forEach(btn => btn.classList.remove('active'));
    } else {
        // 날짜 피커 숨기기
        dueDateInput.classList.add('hidden');
        dueDateInput.classList.remove('visible');
        
        // "다른 날짜" 버튼 비활성화
        const customBtn = document.querySelector('.custom-date-btn');
        if (customBtn) {
            customBtn.classList.remove('active');
        }
    }
}

// 날짜 선택 상태 초기화 함수
function clearDateSelection() {
    dueDateInput.value = '';
    dueDateInput.classList.add('hidden');
    dueDateInput.classList.remove('visible');
    
    const allBtns = document.querySelectorAll('.quick-date-btn');
    allBtns.forEach(btn => btn.classList.remove('active'));
    
    // 시간 선택기도 숨기기
    hideTimeSelection();
}

// 이번 달 마지막 날 계산
function getLastDayOfMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    // 다음 달의 0일 = 이번 달의 마지막 날
    return new Date(year, month + 1, 0);
}

// 다음 달 첫째 날 계산
function getFirstDayOfNextMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    // 다음 달의 1일
    return new Date(year, month + 1, 1);
}

// 시간 선택기 초기화
function initializeTimeSelectors() {
    // 시간 옵션 생성 (0-23시)
    for (let hour = 0; hour < 24; hour++) {
        const option = document.createElement('option');
        option.value = hour.toString().padStart(2, '0');
        option.textContent = `${hour}시`;
        hourInput.appendChild(option);
    }
    
    // 분 옵션 생성 (0, 15, 30, 45분)
    const minutes = ['00', '15', '30', '45'];
    minutes.forEach(minute => {
        const option = document.createElement('option');
        option.value = minute;
        option.textContent = `${minute}분`;
        minuteInput.appendChild(option);
    });
}

// 날짜가 선택되었을 때 시간 선택기 표시
function showTimeSelection() {
    timeSelection.classList.remove('hidden');
    timeSelection.classList.add('visible');
}

// 시간 선택기 숨기기
function hideTimeSelection() {
    timeSelection.classList.add('hidden');
    timeSelection.classList.remove('visible');
    hourInput.value = '';
    minuteInput.value = '';
}

// 할 일의 실제 DateTime을 반환하는 함수
function getEffectiveDateTime(todo) {
    if (todo.dueDateTime) {
        // 시간이 설정된 경우 정확한 DateTime 사용
        return new Date(todo.dueDateTime);
    } else if (todo.dueDate) {
        // 시간이 없는 경우 해당 날짜의 23:59:59로 설정 (하루 종료 시간)
        const date = new Date(todo.dueDate);
        date.setHours(23, 59, 59, 999);
        return date;
    }
    // 날짜가 없는 경우 (이 경우는 정렬에서 이미 처리됨)
    return new Date(0);
}

// 피드백 메시지 표시
function showFeedback(message) {
    // 기존 피드백 제거
    const existingFeedback = document.querySelector('.feedback-message');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    // 새 피드백 생성
    const feedback = document.createElement('div');
    feedback.className = 'feedback-message';
    feedback.textContent = message;
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    
    // CSS 애니메이션 추가
    if (!document.querySelector('#feedback-styles')) {
        const style = document.createElement('style');
        style.id = 'feedback-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(feedback);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        feedback.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.remove();
            }
        }, 300);
    }, 3000);
}

// 키보드 단축키
document.addEventListener('keydown', function(e) {
    // Ctrl + Enter: 할 일 추가
    if (e.ctrlKey && e.key === 'Enter') {
        addTodo();
    }
    
    // Escape: 입력 필드 초기화
    if (e.key === 'Escape') {
        todoInput.value = '';
        clearDateSelection();
        todoInput.blur();
    }
});

// 입력 필드 포커스 시 전체 선택
todoInput.addEventListener('focus', function() {
    this.select();
});

// 구글 인증 시스템
let isGoogleLoaded = false;

// 구글 API 초기화
function initializeGoogleAuth() {
    // Google API가 로드될 때까지 기다림
    const checkGoogleAPI = () => {
        if (typeof google !== 'undefined' && google.accounts) {
            isGoogleLoaded = true;
            console.log('Google Sign-In API가 로드되었습니다.');
        } else {
            setTimeout(checkGoogleAPI, 100);
        }
    };
    checkGoogleAPI();
}

// 구글 로그인 콜백 함수
function handleGoogleLogin(response) {
    try {
        handleGoogleAuth(response, 'login');
    } catch (error) {
        console.error('구글 로그인 처리 중 오류:', error);
        alert('구글 로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}

// 구글 회원가입 콜백 함수
function handleGoogleSignup(response) {
    try {
        handleGoogleAuth(response, 'signup');
    } catch (error) {
        console.error('구글 회원가입 처리 중 오류:', error);
        alert('구글 회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}

// 구글 인증 통합 처리 함수
function handleGoogleAuth(response, type) {
    // JWT 토큰을 디코딩하여 사용자 정보 추출
    const credential = response.credential;
    const payload = parseJwt(credential);
    
    console.log(`구글 ${type === 'login' ? '로그인' : '회원가입'} 성공:`, payload);
    
    // 구글 사용자 정보로 사용자 객체 생성
    const googleUser = {
        username: `google_${payload.sub}`, // Google ID를 사용자명으로 사용
        displayName: payload.name || payload.email,
        email: payload.email,
        picture: payload.picture,
        authType: 'google',
        googleId: payload.sub
    };
    
    // 기존 사용자 목록 확인
    const savedUsers = JSON.parse(localStorage.getItem('users') || '{}');
    const existingUser = savedUsers[googleUser.username];
    
    let messageText = '';
    
    if (type === 'signup') {
        if (existingUser) {
            // 이미 존재하는 사용자인 경우
            messageText = `이미 가입된 구글 계정입니다. 로그인됩니다! 환영합니다 ${googleUser.displayName}님! 👋`;
        } else {
            // 새로운 사용자인 경우
            messageText = `구글 회원가입 성공! 환영합니다 ${googleUser.displayName}님! 🎉`;
        }
    } else {
        // 로그인인 경우
        if (existingUser) {
            messageText = `구글 로그인 성공! 환영합니다 ${googleUser.displayName}님! 👋`;
        } else {
            // 처음 로그인하는 사용자는 자동으로 회원가입 처리
            messageText = `구글 계정으로 자동 가입 및 로그인되었습니다! 환영합니다 ${googleUser.displayName}님! 🎉`;
        }
    }
    
    // 사용자 정보 저장 또는 업데이트
    savedUsers[googleUser.username] = {
        ...googleUser,
        createdAt: existingUser?.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
    };
    localStorage.setItem('users', JSON.stringify(savedUsers));
    
    // 현재 사용자로 설정
    currentUser = {
        username: googleUser.username,
        displayName: googleUser.displayName,
        email: googleUser.email,
        picture: googleUser.picture,
        authType: 'google'
    };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // 메인 앱 표시
    showMainApp();
    showFeedback(messageText);
}

// JWT 토큰 파싱 함수
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('JWT 파싱 오류:', error);
        throw new Error('JWT 토큰 파싱에 실패했습니다.');
    }
}

// 인증 시스템
function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
    } else {
        // 개발용: 자동으로 기본 사용자 생성 및 로그인
        createDefaultUser();
        // 또는 간단히 로그인 없이 사용하려면 아래 주석 해제
        // showMainAppWithoutAuth();
    }
}

// 로그인 없이 사용 (개발용)
function showMainAppWithoutAuth() {
    currentUser = { username: 'guest', displayName: '게스트', authType: 'guest' };
    authModal.style.display = 'none';
    mainApp.style.display = 'block';
    updateUserDisplay();
    loadAllData();
    updateDisplay();
    switchMode('personal');
}

// 개발용 기본 사용자 생성
function createDefaultUser() {
    const defaultUser = {
        username: 'user1',
        displayName: '사용자1',
        password: '123456'
    };
    
    // 기본 사용자 저장
    const savedUsers = JSON.parse(localStorage.getItem('users') || '{}');
    if (!savedUsers[defaultUser.username]) {
        savedUsers[defaultUser.username] = {
            ...defaultUser,
            createdAt: new Date().toISOString()
        };
        localStorage.setItem('users', JSON.stringify(savedUsers));
    }
    
    // 자동 로그인
    currentUser = { 
        username: defaultUser.username, 
        displayName: defaultUser.displayName 
    };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    showMainApp();
}

function showAuthModal() {
    authModal.style.display = 'flex';
    mainApp.style.display = 'none';
}

function showMainApp() {
    authModal.style.display = 'none';
    mainApp.style.display = 'block';
    
    // 사용자 정보 표시
    updateUserDisplay();
    
    // 데이터 로드
    loadAllData();
    updateDisplay();
    switchMode(currentMode);
}

// 사용자 표시 업데이트 (프로필 이미지 포함)
function updateUserDisplay() {
    const userDisplay = document.getElementById('userDisplay');
    
    if (currentUser.authType === 'google' && currentUser.picture) {
        // 구글 로그인 사용자의 경우 프로필 이미지와 함께 표시
        userDisplay.innerHTML = `
            <img src="${currentUser.picture}" alt="프로필" class="profile-image">
            <span>${currentUser.displayName}</span>
        `;
    } else {
        // 일반 로그인 사용자
        userDisplay.innerHTML = `<span>${currentUser.displayName}</span>`;
    }
}

function setupAuthTabs() {
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 탭 활성화
            authTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 폼 전환
            authForms.forEach(form => form.classList.remove('active'));
            document.getElementById(targetTab + 'Form').classList.add('active');
        });
    });
}

function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        alert('사용자명과 비밀번호를 입력해주세요.');
        return;
    }
    
    // 간단한 로컬 인증 (실제 서비스에서는 서버 인증 필요)
    const savedUsers = JSON.parse(localStorage.getItem('users') || '{}');
    const user = savedUsers[username];
    
    if (user && user.password === password) {
        currentUser = { username: user.username, displayName: user.displayName };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showMainApp();
        showFeedback('로그인 성공! 👋');
    } else {
        alert('사용자명 또는 비밀번호가 잘못되었습니다.');
    }
}

function signup() {
    const username = document.getElementById('signupUsername').value.trim();
    const displayName = document.getElementById('signupDisplayName').value.trim();
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
    
    // 유효성 검사
    if (!username || !displayName || !password || !passwordConfirm) {
        alert('모든 필드를 입력해주세요.');
        return;
    }
    
    if (username.length < 2 || username.length > 20) {
        alert('사용자명은 2-20자 사이여야 합니다.');
        return;
    }
    
    if (password.length < 6) {
        alert('비밀번호는 6자 이상이어야 합니다.');
        return;
    }
    
    if (password !== passwordConfirm) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }
    
    // 사용자 저장
    const savedUsers = JSON.parse(localStorage.getItem('users') || '{}');
    
    if (savedUsers[username]) {
        alert('이미 존재하는 사용자명입니다.');
        return;
    }
    
    savedUsers[username] = {
        username: username,
        displayName: displayName,
        password: password,
        createdAt: new Date().toISOString()
    };
    
    localStorage.setItem('users', JSON.stringify(savedUsers));
    
    // 자동 로그인
    currentUser = { username: username, displayName: displayName };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    showMainApp();
    showFeedback('회원가입 및 로그인 성공! 🎉');
}

function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        currentUser = null;
        localStorage.removeItem('currentUser');
        showAuthModal();
        
        // 폼 초기화
        document.querySelectorAll('.auth-form input').forEach(input => input.value = '');
    }
}

// 모드 전환 시스템
function setupModeSwitch() {
    document.getElementById('personalModeBtn').addEventListener('click', () => switchMode('personal'));
    document.getElementById('teamModeBtn').addEventListener('click', () => switchMode('team'));
}

function switchMode(mode) {
    currentMode = mode;
    
    // 버튼 상태 업데이트
    document.getElementById('personalModeBtn').classList.toggle('active', mode === 'personal');
    document.getElementById('teamModeBtn').classList.toggle('active', mode === 'team');
    
    // 제목 업데이트
    const title = mode === 'personal' ? '기쁨과소원' : '기쁨과소원 팀';
    document.getElementById('appTitle').textContent = title;
    
    // 공유 옵션 표시/숨김
    if (mode === 'team') {
        shareOptions.classList.remove('hidden');
        teamChatSection.classList.remove('hidden');
    } else {
        shareOptions.classList.add('hidden');
        teamChatSection.classList.add('hidden');
    }
    
    // 해당 모드의 데이터 로드 및 표시
    updateDisplay();
}

// 데이터 관리
function loadAllData() {
    loadTodos();
    loadTeamTodos();
    loadTeamMessages();
}

function loadTeamTodos() {
    try {
        const saved = localStorage.getItem('teamTodos');
        if (saved) {
            teamTodos = JSON.parse(saved);
        }
    } catch (error) {
        console.error('팀 할 일 불러오기 중 오류:', error);
        teamTodos = [];
    }
}

function saveTeamTodos() {
    try {
        localStorage.setItem('teamTodos', JSON.stringify(teamTodos));
    } catch (error) {
        console.error('팀 할 일 저장 중 오류:', error);
    }
}

function loadTeamMessages() {
    try {
        const saved = localStorage.getItem('teamMessages');
        if (saved) {
            teamMessages = JSON.parse(saved);
            displayChatMessages();
        }
    } catch (error) {
        console.error('팀 메시지 불러오기 중 오류:', error);
        teamMessages = [];
    }
}

function saveTeamMessages() {
    try {
        localStorage.setItem('teamMessages', JSON.stringify(teamMessages));
    } catch (error) {
        console.error('팀 메시지 저장 중 오류:', error);
    }
}

// 채팅 시스템
function setupChatInput() {
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

function sendMessage() {
    const messageText = chatInput.value.trim();
    if (!messageText) return;
    
    const message = {
        id: Date.now(),
        username: currentUser.username,
        displayName: currentUser.displayName,
        text: messageText,
        timestamp: new Date().toISOString()
    };
    
    teamMessages.push(message);
    saveTeamMessages();
    displayChatMessages();
    
    chatInput.value = '';
    
    // 메시지 영역 맨 아래로 스크롤
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function displayChatMessages() {
    chatMessages.innerHTML = '<div class="system-message">팀 채팅에 오신 것을 환영합니다!</div>';
    
    teamMessages.forEach(message => {
        const messageDiv = document.createElement('div');
        const isOwn = message.username === currentUser.username;
        messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
        
        const time = new Date(message.timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.innerHTML = `
            <div class="message-header">${isOwn ? '나' : message.displayName} • ${time}</div>
            <div class="message-content">${escapeHtml(message.text)}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
    });
    
    // 스크롤을 맨 아래로
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}
