// User state
let currentUser = null;
let currentSessionId = null;
let countdownInterval = null;
let html5QrcodeScanner = null;

// --- Device Helper ---
function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

// --- Auth Functions ---

function toggleView() {
    const loginCard = document.getElementById('loginCard');
    const registerCard = document.getElementById('registerCard');
    if (loginCard.style.display === 'none') {
        loginCard.style.display = 'block';
        registerCard.style.display = 'none';
    } else {
        loginCard.style.display = 'none';
        registerCard.style.display = 'block';
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceId: getDeviceId() })
    });
    const data = await res.json();
    
    if (data.success) {
        window.location.href = '/dashboard';
    } else {
        document.getElementById('loginMessage').innerText = data.message;
    }
}

async function register() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    
    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();
    
    const msgEl = document.getElementById('registerMessage');
    if (data.success) {
        msgEl.innerText = "Account created! You can now login.";
        msgEl.style.color = "green";
        setTimeout(toggleView, 1500);
    } else {
        msgEl.innerText = data.message;
        msgEl.style.color = "red";
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
}

async function checkSession() {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    
    if (data.success) {
        currentUser = data.user;
        setupDashboard();
    } else {
        window.location.href = '/';
    }
}

function setupDashboard() {
    if (!currentUser) return;
    
    document.getElementById('welcome').innerText = `Welcome, ${currentUser.name}`;
    
    if (currentUser.role === 'teacher') {
        document.getElementById('teacherView').style.display = 'block';
    } else {
        document.getElementById('studentView').style.display = 'block';
        initQRScanner();
    }
}

// --- Teacher Functions ---
async function createSession() {
    const subject = document.getElementById('subjectInput').value;
    if (!subject) return alert('Please enter a subject.');

    const res = await fetch('/api/attendance/session/create', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject })
    });
    const data = await res.json();
    
    if (data.success) {
        currentSessionId = data.session.sessionId; // Using the random string sessionId
        document.getElementById('attendanceList').innerHTML = '';
        
        // Setup QR Code image
        const qrImg = document.getElementById('qrCodeImg');
        qrImg.src = data.qrCodeDataUrl;
        qrImg.style.display = 'block';
        
        // Setup Timer UI
        document.getElementById('qrExpired').style.display = 'none';
        document.getElementById('qrExpired').innerText = 'Session Expired!'; // reset text
        const timerEl = document.getElementById('qrTimer');
        timerEl.style.display = 'block';
        
        // Setup Buttons and Indicators
        document.getElementById('endSessionBtn').style.display = 'block';
        document.getElementById('startSessionBtn').style.display = 'none';
        document.getElementById('activeSessionIndicator').style.display = 'block';
        document.getElementById('activeSubjectName').innerText = subject;
        
        let timeLeft = 30;
        timerEl.innerText = timeLeft + 's';
        
        if (countdownInterval) clearInterval(countdownInterval);
        
        countdownInterval = setInterval(() => {
            timeLeft--;
            timerEl.innerText = timeLeft + 's';
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                qrImg.style.display = 'none';
                timerEl.style.display = 'none';
                document.getElementById('qrExpired').style.display = 'block';
            }
        }, 1000);
    } else {
        alert(data.message);
    }
}

async function endSession() {
    if (!currentSessionId) return;
    
    const res = await fetch('/api/attendance/session/end', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId })
    });
    const data = await res.json();
    
    if (data.success) {
        // UI cleanup
        if (countdownInterval) clearInterval(countdownInterval);
        document.getElementById('qrCodeImg').style.display = 'none';
        document.getElementById('qrTimer').style.display = 'none';
        document.getElementById('qrExpired').style.display = 'block';
        document.getElementById('qrExpired').innerText = 'Session Manually Ended!';
        
        // Buttons & Indicators
        document.getElementById('endSessionBtn').style.display = 'none';
        document.getElementById('startSessionBtn').style.display = 'block';
        document.getElementById('activeSessionIndicator').style.display = 'none';
    } else {
        alert(data.message);
    }
}

async function refreshAttendance() {
    if (!currentSessionId) return alert('No active session.');
    const res = await fetch(`/api/attendance/session/${currentSessionId}`);
    const data = await res.json();
    if (data.success) {
        const list = document.getElementById('attendanceList');
        list.innerHTML = '';
        if (data.records.length === 0) {
            list.innerHTML = '<li>No attendance recorded yet.</li>';
        }
        data.records.forEach(record => {
            const li = document.createElement('li');
            li.innerHTML = `
                ${record.studentId.name} (${record.studentId.email})
                <button onclick="resetDevice('${record.studentId._id}')" class="btn-danger" style="padding: 6px 12px; font-size: 0.8rem; margin-left: 15px; width: auto; margin-top: 0;">Reset Device</button>
            `;
            list.appendChild(li);
        });
    }
}

async function resetDevice(studentId) {
    if (!confirm("Are you sure you want to reset this student's device binding?")) return;
    
    const res = await fetch(`/api/attendance/reset-device/${studentId}`, { method: 'POST' });
    const data = await res.json();
    alert(data.message);
}

// --- Report Functions ---
function switchTeacherTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'live') {
        document.getElementById('tabLive').style.display = 'block';
        document.getElementById('tabReports').style.display = 'none';
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
    } else {
        document.getElementById('tabLive').style.display = 'none';
        document.getElementById('tabReports').style.display = 'block';
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
    }
}

let reportDataStore = []; // store for csv export

async function fetchReport() {
    const dateVal = document.getElementById('reportDate').value;
    const url = dateVal ? `/api/attendance/report?date=${dateVal}` : '/api/attendance/report';
    
    const res = await fetch(url);
    const data = await res.json();
    
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';
    
    if (data.success) {
        reportDataStore = data.records;
        
        if (reportDataStore.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No records found.</td></tr>';
            return;
        }
        
        reportDataStore.forEach(record => {
            const tr = document.createElement('tr');
            const d = new Date(record.sessionId.createdAt).toLocaleDateString();
            const subject = record.sessionId.subject;
            const name = record.studentId.name;
            const email = record.studentId.email;
            
            tr.innerHTML = `<td>${d}</td><td>${subject}</td><td>${name}</td><td>${email}</td>`;
            tbody.appendChild(tr);
        });
    } else {
        alert(data.message);
    }
}

function downloadCSV() {
    if (reportDataStore.length === 0) {
        return alert("No data to export. Please fetch a report first.");
    }
    
    const headers = ["Date", "Subject", "Student Name", "Email"];
    const rows = reportDataStore.map(record => [
        new Date(record.sessionId.createdAt).toLocaleDateString(),
        record.sessionId.subject,
        record.studentId.name,
        record.studentId.email
    ]);
    
    const csvContent = [
        headers.join(","),
        ...rows.map(e => e.map(item => `"${item}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance_report.csv";
    a.click();
    URL.revokeObjectURL(url);
}

// --- Student Functions ---

function initQRScanner() {
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    }
}

function onScanSuccess(decodedText, decodedResult) {
    console.log(`Scan result: ${decodedText}`);
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => console.error("Failed to clear scanner", error));
    }
    markAttendance(decodedText);
}

function onScanFailure(error) {
    // Ignore normal scan failures
}

// --- GPS Location Helper (Placeholder) ---
// TODO: Implement actual browser Geolocation API logic in the future
async function getLocation() {
    return { lat: null, lng: null };
}

async function markAttendance(sessionId) {
    if (!sessionId) return;
    document.getElementById('studentMsg').innerText = "Processing...";
    document.getElementById('studentMsg').style.color = '#333';
    
    try {
        // Fetch current location before submitting
        const location = await getLocation();

        const res = await fetch('/api/attendance/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, deviceId: getDeviceId(), location })
        });
        const data = await res.json();
        const msgEl = document.getElementById('studentMsg');
        
        if (data.success) {
            msgEl.innerText = "";
            document.getElementById('fallbackInputContainer').style.display = 'none';
            document.getElementById('reader').style.display = 'none';
            document.getElementById('successAnimation').style.display = 'block';
        } else {
            msgEl.innerText = data.message;
            msgEl.style.color = 'red';
            
            if (document.getElementById('successAnimation').style.display === 'none') {
                html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
                html5QrcodeScanner.render(onScanSuccess, onScanFailure);
            }
        }
    } catch (err) {
        document.getElementById('studentMsg').innerText = "Network error. Please try again.";
        document.getElementById('studentMsg').style.color = 'red';
    }
}
