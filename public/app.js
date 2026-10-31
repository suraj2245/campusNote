const appRoot = document.getElementById('app');
const toastContainer = document.getElementById('toastContainer');
const ReactRoot = ReactDOM.createRoot ? ReactDOM.createRoot(appRoot) : null;

function renderShell(markup) {
  if (ReactRoot) {
    ReactDOM.flushSync(() => {
      ReactRoot.render(
        React.createElement('div', {
          className: 'app-shell',
          dangerouslySetInnerHTML: { __html: markup },
        })
      );
    });
    return;
  }

  appRoot.innerHTML = markup;
}

const state = {
  token: localStorage.getItem('campusNotesToken') || '',
  user: JSON.parse(localStorage.getItem('campusNotesUser') || 'null'),
  studentView: 'dashboard',
  adminView: 'dashboard',
  adminTheme: localStorage.getItem('campusNotesAdminTheme') === 'dark' ? 'dark' : 'light',
  browseMaterials: [],
  studentUploads: [],
  studentDownloads: [],
  studentSavedMaterials: [],
  studentSettings: null,
  studentSettingsPromise: null,
  settingsPageError: '',
  savedActivity: JSON.parse(localStorage.getItem('campusNotesSavedActivity') || '[]'),
  studentSearch: '',
  teacherMaterials: [],
  teacherView: 'dashboard',
  teacherProfile: null,
  teacherPreferences: null,
  teacherEngagement: null,
  teacherNotifications: [],
  teacherPortalLoaded: false,
  teacherSearch: '',
  teacherMaterialContext: null,
  teacherEngagementPeriod: '30',
  savedMaterials: JSON.parse(localStorage.getItem('campusNotesSaved') || '[]'),
};

appRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;

  const downloadButton = event.target.closest('[data-download-material]');
  if (downloadButton) {
    downloadStudyMaterial(downloadButton.getAttribute('data-download-material'));
    return;
  }

  const studentNav = event.target.closest('[data-student-nav]');
  if (studentNav) {
    setStudentView(studentNav.getAttribute('data-student-nav'));
    return;
  }

  const teacherNav = event.target.closest('[data-teacher-nav]');
  if (teacherNav) {
    state.teacherMaterialContext = null;
    setTeacherView(teacherNav.getAttribute('data-teacher-nav'));
    return;
  }

  if (event.target.closest('[data-logout]') && window.confirm('Are you sure you want to logout?')) {
    clearAuthSession();
  }
});

const SUBJECT_CATALOG = {
  '1st Year': {
    'Semester 1': [
      'Engineering Mathematics I', 'Engineering Physics', 'Engineering Chemistry',
      'Engineering Graphics and Design', 'Basic Electrical Engineering',
      'Programming for Problem Solving', 'C Programming', 'Environmental Science',
      'Professional Communication', 'Engineering Mechanics', 'Introduction to Engineering',
    ],
    'Semester 2': [
      'Engineering Mathematics II', 'Applied Physics', 'Applied Chemistry',
      'Basic Electronics Engineering', 'Workshop Practice', 'Engineering Mechanics',
      'Problem Solving with Python', 'C++ Programming', 'Basic Civil Engineering',
      'Basic Mechanical Engineering', 'Basic Computer Engineering',
      'Engineering Drawing', 'Communication Skills',
    ],
  },
  '2nd Year': {
    'Semester 3': [
      'Data Structures', 'Object Oriented Programming', 'Discrete Mathematics',
      'Digital Logic Design', 'Electronic Devices and Circuits', 'Network Analysis',
      'Engineering Mathematics III', 'Thermodynamics', 'Fluid Mechanics',
      'Strength of Materials', 'Surveying', 'Building Materials and Construction',
      'Materials Science', 'Electrical Machines I', 'Signals and Systems',
      'Database Management Systems', 'Analog Electronics',
    ],
    'Semester 4': [
      'Algorithms', 'Database Management Systems', 'Computer Organization and Architecture',
      'Operating Systems', 'Analog Circuits', 'Microprocessors and Microcontrollers',
      'Electrical Machines II', 'Power Systems I', 'Control Systems',
      'Manufacturing Processes', 'Fluid Mechanics', 'Structural Analysis',
      'Geotechnical Engineering', 'Theory of Machines', 'Probability and Statistics',
      'Object Oriented Programming', 'Engineering Mathematics IV',
    ],
  },
  '3rd Year': {
    'Semester 5': [
      'Software Engineering', 'Compiler Design', 'Computer Networks',
      'Theory of Computation', 'Artificial Intelligence', 'Machine Learning',
      'Web Technologies', 'Database Systems', 'Embedded Systems',
      'Digital Signal Processing', 'Communication Systems', 'Power Systems II',
      'Power Electronics', 'Electrical Measurements and Instrumentation',
      'Heat Transfer', 'Machine Design', 'Design of Concrete Structures',
      'Transportation Engineering', 'Geotechnical Engineering',
    ],
    'Semester 6': [
      'Artificial Intelligence', 'Machine Learning', 'Information Security',
      'Cloud Computing', 'Distributed Systems', 'Mobile Application Development',
      'Computer Graphics', 'Internet of Things', 'VLSI Design',
      'Microcontrollers and Embedded Systems', 'Control Engineering',
      'Electrical Power Distribution', 'Renewable Energy Systems',
      'Refrigeration and Air Conditioning', 'Production Engineering',
      'Design of Steel Structures', 'Water Resources Engineering',
      'Environmental Engineering', 'Operations Research',
    ],
  },
  '4th Year': {
    'Semester 7': [
      'Cloud Computing', 'Cybersecurity', 'Big Data Analytics',
      'Deep Learning', 'Natural Language Processing', 'Advanced Database Systems',
      'Wireless Communication', 'Antenna and Wave Propagation',
      'Advanced VLSI Design', 'Smart Grid Technologies', 'High Voltage Engineering',
      'Electric Vehicles', 'Robotics and Automation', 'Finite Element Analysis',
      'Automobile Engineering', 'Earthquake Resistant Design',
      'Construction Management', 'Renewable Energy Engineering',
      'Industrial Engineering', 'Engineering Project Management',
    ],
    'Semester 8': [
      'Capstone Project', 'Industrial Training', 'Seminar', 'Research Methodology',
      'Professional Ethics', 'Entrepreneurship Development', 'Advanced Robotics',
      'Blockchain Technology', 'Computer Vision', 'Data Mining',
      'Advanced Power System Protection', 'Power Plant Engineering',
      'Mechatronics', 'Advanced Structural Design', 'Remote Sensing and GIS',
      'Sustainable Engineering', 'Supply Chain Management',
    ],
  },
};

const IT_AI_SUBJECTS = new Set([
  'Engineering Mathematics I', 'Engineering Mathematics II',
  'Engineering Mathematics III', 'Engineering Mathematics IV',
  'Programming for Problem Solving', 'C Programming', 'Problem Solving with Python',
  'C++ Programming', 'Basic Computer Engineering', 'Discrete Mathematics',
  'Data Structures', 'Object Oriented Programming', 'Digital Logic Design',
  'Algorithms', 'Database Management Systems', 'Computer Organization and Architecture',
  'Operating Systems', 'Probability and Statistics', 'Software Engineering',
  'Compiler Design', 'Computer Networks', 'Theory of Computation',
  'Artificial Intelligence', 'Machine Learning', 'Web Technologies',
  'Database Systems', 'Information Security', 'Cloud Computing',
  'Distributed Systems', 'Mobile Application Development', 'Computer Graphics',
  'Internet of Things', 'Cybersecurity', 'Big Data Analytics', 'Deep Learning',
  'Natural Language Processing', 'Advanced Database Systems', 'Capstone Project',
  'Industrial Training', 'Seminar', 'Research Methodology', 'Professional Ethics',
  'Entrepreneurship Development', 'Blockchain Technology', 'Computer Vision',
  'Data Mining',
]);

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function getSubjectOptions() {
  return Object.values(SUBJECT_CATALOG)
    .flatMap((semesters) => Object.values(semesters).flat())
    .filter((subject) => IT_AI_SUBJECTS.has(subject))
    .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)
    .join('');
}

function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (state.token) {
    headers.set('Authorization', `Bearer ${state.token}`);
  }

  return fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  }).then(async (response) => {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      throw new Error(payload?.message || 'Request failed.');
    }
    if (!contentType.includes('application/json')) {
      throw new Error('The server returned an unexpected response. Restart CampusNotes and try again.');
    }
    return payload;
  });
}

async function downloadStudyMaterial(materialId) {
  const openInBrowser = state.studentSettings?.preferences?.study?.downloadPreference === 'open';
  const previewWindow = openInBrowser ? window.open('about:blank', '_blank') : null;
  if (openInBrowser && !previewWindow) {
    showToast('Your browser blocked the new tab. Allow pop-ups or choose Download file in Study Preferences.', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/materials/${encodeURIComponent(materialId)}/download`, {
      headers: { Authorization: `Bearer ${state.token}` },
      credentials: 'same-origin',
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'Unable to download this study material.');
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.location.href = objectUrl;
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      state.studentDownloads = await apiFetch('/my-downloads');
      renderStudentRecentActivity();
      return;
    }
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/i);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = match?.[1] || 'study-material';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    state.studentDownloads = await apiFetch('/my-downloads');
    renderStudentRecentActivity();
  } catch (error) {
    previewWindow?.close();
    showToast(error.message, 'error');
  }
}

function populateActualBrowseFilters() {
  const branchEl = document.getElementById('filterBranch');
  if (!branchEl) return;
  const selectedBranch = branchEl.value;
  const branches = [...new Set(state.browseMaterials.map((item) => item.branch).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  branchEl.innerHTML = ['<option value="">All branches</option>', ...branches.map((branch) => `<option value="${escapeHtml(branch)}">${escapeHtml(branch)}</option>`)].join('');
  if (branches.includes(selectedBranch)) branchEl.value = selectedBranch;
}

function setAuthSession(token, user) {
  state.token = token;
  state.user = user;
  state.studentSettings = null;
  state.studentSettingsPromise = null;
  state.teacherView = 'dashboard';
  state.teacherProfile = null;
  state.teacherPreferences = null;
  state.teacherEngagement = null;
  state.teacherNotifications = [];
  state.teacherPortalLoaded = false;
  localStorage.setItem('campusNotesToken', token);
  localStorage.setItem('campusNotesUser', JSON.stringify(user));
}

function clearAuthSession() {
  state.token = '';
  state.user = null;
  localStorage.removeItem('campusNotesToken');
  localStorage.removeItem('campusNotesUser');
  state.studentView = 'dashboard';
  state.adminView = 'dashboard';
  state.studentSettings = null;
  state.studentSettingsPromise = null;
  state.teacherProfile = null;
  state.teacherPreferences = null;
  state.teacherEngagement = null;
  state.teacherNotifications = [];
  state.teacherPortalLoaded = false;
  window.location.hash = '#/';
}

function reloadUser() {
  if (!state.token) return;
  apiFetch('/me')
    .then((response) => {
      state.user = response.user;
      localStorage.setItem('campusNotesUser', JSON.stringify(response.user));
    })
    .catch(() => {
      clearAuthSession();
    });
}

function setRoute(path) {
  window.location.hash = path;
}

function bindRenderedForm(formId, handler) {
  const attach = () => {
    const form = document.getElementById(formId);
    if (!form) return false;
    form.addEventListener('submit', handler);
    return true;
  };

  if (!attach()) {
    requestAnimationFrame(attach);
  }
}

function renderLanding() {
  renderShell(`
    <header class="header">
      <div class="container nav">
        <div class="brand">
          <div class="brand-mark">N</div>
          <div class="brand-text">
            <span>CampusNotes</span>
            <small>Academic Exchange</small>
          </div>
        </div>
        <div class="nav-actions">
          <button class="secondary-btn" onclick="setRoute('#/student-login')">Student Portal</button>
          <button class="secondary-btn" onclick="setRoute('#/teacher-login')">Teacher Portal</button>
          <button class="primary-btn" onclick="setRoute('#/admin-login')">Admin Portal</button>
        </div>
      </div>
    </header>

    <main class="container hero">
      <section class="hero-grid">
        <div class="hero-copy">
          <div class="kicker">CampusNotes</div>
          <h1>Share smarter study material with your <span class="highlight">college community.</span></h1>
          <p>
            Discover approved resources, upload classroom materials, and help students access useful notes,
            previous papers, practical files, and academic references in one professional platform.
          </p>
          <div class="hero-actions">
            <button class="primary-btn" onclick="setRoute('#/student-login')">Open Student Portal</button>
            <button class="secondary-btn" onclick="setRoute('#/teacher-login')">Teacher Login</button>
            <button class="secondary-btn" onclick="setRoute('#/admin-login')">Admin Login</button>
          </div>
          <div class="metrics">
            <div class="metric-card">
              <strong>0</strong>
              <span>Approved materials</span>
            </div>
            <div class="metric-card">
              <strong>0</strong>
              <span>Students online</span>
            </div>
            <div class="metric-card">
              <strong>0</strong>
              <span>Pending reviews</span>
            </div>
          </div>
        </div>
        <div class="hero-visual">
          <div class="visual-panel">
            <div class="visual-header">
              <strong>Library</strong>
              <span class="pill success">3 categories</span>
            </div>
            <div class="visual-list">
              <div class="visual-item">
                <div class="visual-icon">📘</div>
                <div>
                  <strong>Subject Notes</strong>
                  <small>Semester notes • All branches</small>
                </div>
                <span class="pill success">Popular</span>
              </div>
              <div class="visual-item">
                <div class="visual-icon">📝</div>
                <div>
                  <strong>Previous Year Question Paper</strong>
                  <small>Past papers • All semesters</small>
                </div>
                <span class="pill success">Updated</span>
              </div>
              <div class="visual-item">
                <div class="visual-icon">🧪</div>
                <div>
                  <strong>Manual Lab</strong>
                  <small>Practical guides • Lab files</small>
                </div>
                <span class="pill warning">Shared</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <section class="container portal-grid">
      <div class="card">
        <div class="kicker">For Students</div>
        <h3>Register and upload study resources</h3>
        <p>Browse approved notes, submit materials for admin review, and manage your academic uploads.</p>
        <button class="primary-btn" onclick="setRoute('#/student-login')">Student Login</button>
      </div>
      <div class="card">
        <div class="kicker">For Teachers</div>
        <h3>Access your assigned subject</h3>
        <p>Create a teacher account linked to your subject and sign in to the teacher portal.</p>
        <button class="primary-btn" onclick="setRoute('#/teacher-login')">Teacher Login</button>
      </div>
      <div class="card">
        <div class="kicker">For Admin</div>
        <h3>Review and control study uploads</h3>
        <p>Approve submissions, monitor student activity, and enable or disable student uploads at any time.</p>
        <button class="secondary-btn" onclick="setRoute('#/admin-login')">Admin Login</button>
      </div>
    </section>
  `);
}

function renderStudentLogin() {
  renderShell(`
    <div class="form-shell">
      <div class="container">
        <div class="form-box">
          <div class="form-header">
            <div>
              <div class="kicker">Student Portal</div>
              <h2>Login to CampusNotes</h2>
            </div>
            <button class="ghost-btn" onclick="setRoute('#/')">Back to home</button>
          </div>
          <form id="studentLoginForm">
            <div class="form-grid">
              <div class="form-group full">
                <label for="studentIdentifier">Email / Student ID</label>
                <input id="studentIdentifier" name="emailOrStudentId" type="text" placeholder="Enter your email or student ID" required />
              </div>
              <div class="form-group full">
                <label for="studentPassword">Password</label>
                <input id="studentPassword" name="password" type="password" placeholder="Enter your password" required />
              </div>
            </div>
            <div class="form-actions">
              <label style="display:flex;align-items:center;gap:0.5rem;">
                <input type="checkbox" name="remember" />
                <span>Remember Me</span>
              </label>
              <a class="helper-link" href="#">Forgot Password</a>
            </div>
            <div class="form-actions" style="margin-top:1.5rem;">
              <button class="primary-btn" type="submit">Login</button>
              <button type="button" class="secondary-btn" onclick="setRoute('#/student-register')">Create Account</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `);

  bindRenderedForm('studentLoginForm', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      emailOrStudentId: form.emailOrStudentId.value.trim(),
      password: form.password.value,
    };

    try {
      const response = await apiFetch('/auth/student-login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthSession(response.token, response.user);
      showToast('Welcome back to CampusNotes.');
      state.studentView = 'dashboard';
      setRoute('#/student-dashboard');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function renderTeacherLogin() {
  renderShell(`
    <div class="form-shell">
      <div class="container">
        <div class="form-box">
          <div class="form-header">
            <div>
              <div class="kicker">Teacher Portal</div>
              <h2>Subject-wise teacher login</h2>
            </div>
            <button class="ghost-btn" onclick="setRoute('#/')">Back to home</button>
          </div>
          <form id="teacherLoginForm">
            <div class="form-grid">
              <div class="form-group full">
                <label for="teacherLoginEmail">Email</label>
                <input id="teacherLoginEmail" name="email" type="email" placeholder="Enter your teacher email" autocomplete="username" required />
              </div>
              <div class="form-group full">
                <label for="teacherLoginSubject">Subject</label>
                <select id="teacherLoginSubject" name="subject" required>
                  <option value="">Select your assigned subject</option>
                  ${getSubjectOptions()}
                </select>
              </div>
              <div class="form-group full">
                <label for="teacherLoginPassword">Password</label>
                <input id="teacherLoginPassword" name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required />
              </div>
            </div>
            <div class="form-actions" style="margin-top:1.5rem;">
              <button class="primary-btn" type="submit">Login to Teacher Portal</button>
              <button type="button" class="secondary-btn" onclick="setRoute('#/teacher-register')">Create Teacher Account</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `);

  bindRenderedForm('teacherLoginForm', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    try {
      const response = await apiFetch('/auth/teacher-login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.value.trim(),
          subject: form.subject.value,
          password: form.password.value,
        }),
      });
      setAuthSession(response.token, response.user);
      showToast(`Welcome to the ${response.user.subject} teacher portal.`);
      setRoute('#/teacher-dashboard');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function renderTeacherRegister() {
  renderShell(`
    <div class="form-shell">
      <div class="container">
        <div class="form-box">
          <div class="form-header">
            <div>
              <div class="kicker">Teacher Portal</div>
              <h2>Create your teacher account</h2>
            </div>
            <button class="ghost-btn" onclick="setRoute('#/teacher-login')">Already registered?</button>
          </div>
          <form id="teacherRegisterForm">
            <div class="form-grid">
              <div class="form-group full">
                <label for="teacherFullName">Full Name</label>
                <input id="teacherFullName" name="fullName" type="text" autocomplete="name" required />
              </div>
              <div class="form-group full">
                <label for="teacherEmail">Email</label>
                <input id="teacherEmail" name="email" type="email" autocomplete="email" required />
              </div>
              <div class="form-group full">
                <label for="teacherSubject">Assigned Subject</label>
                <select id="teacherSubject" name="subject" required>
                  <option value="">Select your subject</option>
                  ${getSubjectOptions()}
                </select>
              </div>
              <div class="form-group">
                <label for="teacherRegisterPassword">Password</label>
                <input id="teacherRegisterPassword" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required />
              </div>
              <div class="form-group">
                <label for="teacherConfirmPassword">Confirm Password</label>
                <input id="teacherConfirmPassword" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required />
              </div>
            </div>
            <div class="form-actions" style="margin-top:1.5rem;">
              <button class="primary-btn" type="submit">Create Teacher Account</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `);

  bindRenderedForm('teacherRegisterForm', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    try {
      const response = await apiFetch('/auth/teacher-register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName.value.trim(),
          email: form.email.value.trim(),
          subject: form.subject.value,
          password: form.password.value,
          confirmPassword: form.confirmPassword.value,
        }),
      });
      setAuthSession(response.token, response.user);
      showToast('Teacher account created successfully.');
      setRoute('#/teacher-dashboard');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function renderTeacherDashboardLegacy() {
  const teacher = state.user;
  renderShell(`
    <div class="form-shell">
      <div class="container">
        <div class="form-box">
          <div class="form-header">
            <div>
              <div class="kicker">Teacher Portal</div>
              <h2>Welcome, ${escapeHtml(teacher.name)}</h2>
            </div>
            <button class="ghost-btn" onclick="logoutStudent()">Log out</button>
          </div>
          <div class="card">
            <div class="kicker">Your assigned subject</div>
            <h3>${escapeHtml(teacher.subject || 'Subject not available')}</h3>
            <p>Upload subject notes or lecture videos for your students. New uploads are published after administrator approval.</p>
            <p><strong>Email:</strong> ${escapeHtml(teacher.email)}</p>
          </div>
          <section class="teacher-upload-section">
            <div class="status-row">
              <h3>Share teaching material</h3>
            </div>
            <form id="teacherUploadForm" class="panel">
              <div class="form-grid">
                <div class="form-group">
                  <label for="teacherMaterialTitle">Title</label>
                  <input id="teacherMaterialTitle" name="title" maxlength="160" required />
                </div>
                <div class="form-group">
                  <label for="teacherMaterialType">Material type</label>
                  <select id="teacherMaterialType" name="materialType" required>
                    <option value="Subject Notes">Subject Notes</option>
                    <option value="Lecture Video">Lecture Video</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Assigned subject</label>
                  <input value="${escapeHtml(teacher.subject || '')}" readonly />
                </div>
                <div class="form-group">
                  <label for="teacherMaterialBranch">Branch</label>
                  <input id="teacherMaterialBranch" name="branch" required />
                </div>
                <div class="form-group">
                  <label for="teacherMaterialYear">Year</label>
                  <select id="teacherMaterialYear" name="year" required>
                    <option value="">Select year</option>
                    <option>1st Year</option>
                    <option>2nd Year</option>
                    <option>3rd Year</option>
                    <option>4th Year</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="teacherMaterialSemester">Semester</label>
                  <select id="teacherMaterialSemester" name="semester" required>
                    <option value="">Select semester</option>
                    ${Array.from({ length: 8 }, (_, index) => `<option>Semester ${index + 1}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group full">
                  <label for="teacherMaterialDescription">Description</label>
                  <textarea id="teacherMaterialDescription" name="description" maxlength="2000"></textarea>
                </div>
                <div class="form-group" id="teacherVideoSourceGroup" hidden>
                  <label for="teacherVideoSource">Lecture video source</label>
                  <select id="teacherVideoSource">
                    <option value="upload">Upload a video</option>
                    <option value="link">Link to YouTube or another platform</option>
                  </select>
                </div>
                <div class="form-group full">
                  <label id="teacherFileLabel" for="teacherMaterialFile">Notes file</label>
                  <input id="teacherMaterialFile" type="file" name="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" required />
                  <small id="teacherFileHelp">Accepted notes formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG. Maximum 25 MB.</small>
                </div>
                <div class="form-group full" id="teacherVideoUrlGroup" hidden>
                  <label for="teacherVideoUrl">Lecture video URL</label>
                  <input id="teacherVideoUrl" name="videoUrl" type="url" placeholder="https://www.youtube.com/watch?v=..." />
                  <small>Use a direct HTTP or HTTPS video link from YouTube or another video platform.</small>
                </div>
              </div>
              <div class="student-upload-notice">New uploads are not published immediately. You can follow their review status in My Uploads.</div>
              <div class="form-actions" style="margin-top:1.25rem;">
                <button class="primary-btn" type="submit">Submit teaching material</button>
              </div>
            </form>
          </section>
          <section class="teacher-materials-section">
            <div class="status-row">
              <h3>Your teaching materials</h3>
              <button class="secondary-btn small-btn" type="button" onclick="loadTeacherMaterials()">Refresh</button>
            </div>
            <div class="panel"><div id="teacherMaterialsList"></div></div>
          </section>
        </div>
      </div>
    </div>
  `);
  bindTeacherActions();
}

function bindTeacherActions() {
  const form = document.getElementById('teacherUploadForm');
  if (!form) return;

  const typeSelect = document.getElementById('teacherMaterialType');
  const sourceSelect = document.getElementById('teacherVideoSource');
  const fileInput = document.getElementById('teacherMaterialFile');
  const fileLabel = document.getElementById('teacherFileLabel');
  const fileHelp = document.getElementById('teacherFileHelp');
  const sourceGroup = document.getElementById('teacherVideoSourceGroup');
  const urlGroup = document.getElementById('teacherVideoUrlGroup');
  const urlInput = document.getElementById('teacherVideoUrl');

  const updateMaterialFields = () => {
    const isVideo = typeSelect.value === 'Lecture Video';
    const isLink = isVideo && sourceSelect.value === 'link';
    sourceGroup.hidden = !isVideo;
    urlGroup.hidden = !isLink;
    urlInput.required = isLink;
    fileInput.hidden = isLink;
    fileInput.required = !isLink;
    fileLabel.hidden = isLink;
    fileHelp.hidden = isLink;
    if (isLink) fileInput.value = '';
    if (isVideo) {
      fileLabel.textContent = 'Lecture video file';
      fileInput.accept = '.mp4,.webm,.mov,.m4v';
      fileHelp.textContent = 'Accepted video formats: MP4, WEBM, MOV, M4V. Maximum 250 MB.';
    } else {
      fileLabel.textContent = 'Notes file';
      fileInput.accept = '.pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png';
      fileHelp.textContent = 'Accepted notes formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG. Maximum 25 MB.';
    }
  };

  typeSelect.addEventListener('change', updateMaterialFields);
  sourceSelect.addEventListener('change', updateMaterialFields);
  updateMaterialFields();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const response = await apiFetch('/teacher/materials', {
        method: 'POST',
        body: new FormData(form),
      });
      showToast(response.message);
      form.reset();
      updateMaterialFields();
      loadTeacherMaterials();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  loadTeacherMaterials();
}

async function loadTeacherMaterialsLegacy() {
  try {
    const materials = await apiFetch('/teacher/materials');
    state.teacherMaterials = materials;
    const list = document.getElementById('teacherMaterialsList');
    if (!list) return;

    if (!materials.length) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>You haven't shared any teaching materials yet.</h3>
          <p>Your notes and lecture videos will appear here after you submit them.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Title</th><th>Type</th><th>Uploaded</th><th>Status</th><th>Resource</th></tr>
          </thead>
          <tbody>
            ${materials.map((item) => `
              <tr>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.materialType)}</td>
                <td>${new Date(item.uploadedAt).toLocaleDateString()}</td>
                <td><span class="badge ${escapeHtml(String(item.status).toLowerCase())}">${escapeHtml(item.status)}</span></td>
                <td>${item.videoUrl
                  ? `<a class="secondary-btn small-btn" href="${escapeHtml(item.videoUrl)}" target="_blank" rel="noopener noreferrer">Open video</a>`
                  : item.fileUrl
                    ? `<a class="secondary-btn small-btn" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener noreferrer">${item.materialType === 'Lecture Video' ? 'Watch video' : 'Open file'}</a>`
                    : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderTeacherDashboard() {
  const views = {
    dashboard: [`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${(state.teacherProfile?.name || state.user?.name || 'Teacher').split(' ')[0]}!`, 'Welcome to the CampusNotes Teacher Portal.', 'Your teaching resources at a glance.'],
    subjects: ['My Subjects', 'Your assigned subject and its material coverage.'],
    upload: ['Upload Materials', 'Share resources with students in your assigned subject.'],
    materials: ['My Materials', 'Manage resources you have uploaded.'],
    status: ['Approval Status', 'Track review decisions and administrator feedback.'],
    engagement: ['Student Engagement', 'Download activity for your approved materials.'],
    notifications: ['Notifications', 'Updates about review decisions and material changes.'],
    profile: ['My Profile', 'Manage your permitted contact information.'],
    settings: ['Settings', 'Personalize your teacher portal experience.'],
  };
  const view = state.teacherView || 'dashboard';
  const [title, subtitle, dashboardGreeting] = views[view] || views.dashboard;
  const heading = view === 'dashboard' ? dashboardGreeting : title;
  const savedTheme = state.teacherPreferences?.appearance?.theme || 'system';
  const theme = savedTheme === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : savedTheme;
  const description = view === 'dashboard'
    ? `${subtitle} ${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}`
    : subtitle;
  const teacher = state.teacherProfile || state.user || {};
  const unread = state.teacherNotifications.filter((item) => !item.isRead).length;
  renderShell(`
    <div class="portal-shell teacher-shell" data-theme="${escapeHtml(theme)}">
      <aside class="sidebar"><div class="brand"><div class="brand-mark">N</div><div class="brand-text"><span>CampusNotes</span><small>Teacher Portal</small></div></div>
        <nav class="sidebar-nav" aria-label="Teacher navigation">
          ${[['dashboard','▦','Dashboard'],['subjects','▤','My Subjects'],['upload','↑','Upload Materials'],['materials','▧','My Materials'],['status','◷','Approval Status'],['engagement','↗','Student Engagement'],['notifications','♧','Notifications'],['profile','♙','My Profile'],['settings','⚙','Settings']].map(([key,icon,label])=>`<button type="button" class="nav-item ${view===key?'active':''}" data-teacher-nav="${key}" ${view===key?'aria-current="page"':''}><span class="teacher-nav-icon">${icon}</span><span>${label}</span>${key==='notifications'&&unread?`<i class="teacher-nav-count">${unread}</i>`:''}</button>`).join('')}
          <button type="button" class="nav-item" data-teacher-logout><span class="teacher-nav-icon">↪</span><span>Logout</span></button>
        </nav>
      </aside>
      <main class="portal-main teacher-main">
        <header class="teacher-topbar">
          <div class="teacher-heading"><div class="student-eyebrow">CampusNotes Teacher Portal</div><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p></div>
          <form id="teacherGlobalSearch" class="teacher-global-search" role="search"><span>⌕</span><input id="teacherSearchInput" type="search" value="${escapeHtml(state.teacherSearch)}" placeholder="Search your materials..." aria-label="Search teacher materials" /><button type="submit">Search</button></form>
          <div class="teacher-topbar-actions"><button type="button" class="teacher-notification-button" data-teacher-nav="notifications" aria-label="Notifications">♧${unread?`<i>${unread}</i>`:''}</button><button type="button" class="teacher-profile-button" data-teacher-nav="profile"><span class="teacher-avatar">${teacher.profilePicture?`<img src="${escapeHtml(teacher.profilePicture)}" alt="" />`:escapeHtml((teacher.name||'T').slice(0,1).toUpperCase())}</span><span><strong>${escapeHtml(teacher.name||'Teacher')}</strong><small>${escapeHtml(teacher.subject||'Teacher account')}</small></span></button></div>
        </header>
        <div id="teacherPortalContent">${getTeacherViewMarkup(view)}</div>
      </main>
    </div>
    <dialog id="teacherMaterialEditDialog" class="teacher-dialog"><form id="teacherMaterialEditForm"><input type="hidden" name="id" /><h2>Edit material</h2><p>Changes to an existing material are sent to administrators for review.</p><div class="teacher-form-grid"><label>Title<input name="title" maxlength="160" required /></label><label>Material type<select name="materialType">${teacherMaterialTypeOptions()}</select></label><label>Branch<input name="branch" required /></label><label>Year<select name="year" required>${teacherYearOptions()}</select></label><label>Semester<select name="semester" required>${teacherSemesterOptions()}</select></label><label class="teacher-full-field">Description<textarea name="description" rows="3" maxlength="2000"></textarea></label></div><div class="teacher-form-actions"><button class="primary-btn" type="submit">Save and resubmit</button><button class="secondary-btn" type="button" data-close-teacher-dialog>Cancel</button></div></form></dialog>
  `);
  bindTeacherPortalActions();
  ensureTeacherPortalData();
}

function teacherMaterialTypeOptions(selected = '') {
  return ['Subject Notes','Lecture Notes','Assignments','Question Papers','Previous Year Question Paper','Practical Files','Lab Manuals','Reference Materials','Manual Lab','Lecture Video']
    .map((type)=>`<option value="${escapeHtml(type)}" ${selected===type?'selected':''}>${escapeHtml(type)}</option>`).join('');
}

function teacherYearOptions(selected = '') {
  return ['1st Year','2nd Year','3rd Year','4th Year'].map((year)=>`<option value="${year}" ${selected===year?'selected':''}>${year}</option>`).join('');
}

function teacherSemesterOptions(selected = '') {
  return Array.from({length:8},(_,index)=>`Semester ${index+1}`).map((semester)=>`<option value="${semester}" ${selected===semester?'selected':''}>${semester}</option>`).join('');
}

function teacherMaterialTable(items, emptyText = 'No teaching materials found.') {
  if (!items.length) return `<div class="teacher-empty"><span>▤</span><h3>${escapeHtml(emptyText)}</h3><p>Upload a resource or adjust the search and filters.</p><button type="button" class="primary-btn small-btn" data-teacher-nav="upload">Upload material</button></div>`;
  return `<div class="teacher-table-wrap"><table class="teacher-table"><thead><tr><th>Material</th><th>Subject</th><th>Type</th><th>Uploaded</th><th>Status</th><th>Actions</th></tr></thead><tbody>${items.map((item)=>`<tr><td><strong>${escapeHtml(item.title)}</strong>${item.rejectionReason?`<small class="teacher-feedback">${escapeHtml(item.rejectionReason)}</small>`:''}</td><td>${escapeHtml(item.subject)}</td><td>${escapeHtml(item.materialType)}</td><td>${new Date(item.uploadedAt).toLocaleDateString()}</td><td><span class="teacher-status ${String(item.status).toLowerCase()}">${escapeHtml(item.status)}</span></td><td class="teacher-row-actions">${item.videoUrl?`<a class="secondary-btn small-btn" href="${escapeHtml(item.videoUrl)}" target="_blank" rel="noopener noreferrer">Open</a>`:item.fileUrl?`<a class="secondary-btn small-btn" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener noreferrer">Preview</a>`:''}<button type="button" class="secondary-btn small-btn" data-edit-teacher-material="${item.id}">Edit</button><button type="button" class="danger-btn small-btn" data-delete-teacher-material="${item.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
}

function getTeacherViewMarkup(view) {
  const materials = state.teacherMaterials;
  const teacher = state.teacherProfile || state.user || {};
  const assignedSubject = teacher.subject || 'Assigned subject not available';
  const counts = {
    total: materials.length,
    approved: materials.filter((item)=>item.status==='Approved').length,
    pending: materials.filter((item)=>item.status==='Pending').length,
    rejected: materials.filter((item)=>item.status==='Rejected').length,
  };
  const search=state.teacherSearch.toLowerCase();
  const context=state.teacherMaterialContext;
  const matched = materials.filter((item)=>
    (!search||[item.title,item.subject,item.materialType,item.branch,item.year,item.semester,item.status].join(' ').toLowerCase().includes(search))
    &&(!context||(item.branch||'Branch not specified')===context.branch
      &&(item.year||'Year not specified')===context.year
      &&(item.semester||'Semester not specified')===context.semester));
  const filters = `<div class="teacher-filter-bar"><input type="search" id="teacherMaterialsSearch" value="${escapeHtml(state.teacherSearch)}" placeholder="Search title, subject or type..." aria-label="Search materials" /><select id="teacherStatusFilter"><option value="">All statuses</option>${['Approved','Pending','Rejected'].map((status)=>`<option value="${status}">${status}</option>`).join('')}</select><select id="teacherSubjectFilter"><option value="">All subjects</option>${[...new Set(materials.map((item)=>item.subject))].map((subject)=>`<option>${escapeHtml(subject)}</option>`).join('')}</select><select id="teacherSortMaterials"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>`;

  if (view === 'dashboard') return `
    <section class="teacher-stat-grid">${[['Total Materials',counts.total,'▤','blue'],['Approved',counts.approved,'✓','green'],['Pending',counts.pending,'◷','amber'],['Rejected',counts.rejected,'!','rose']].map(([label,count,icon,color])=>`<article class="teacher-stat-card"><span class="teacher-stat-icon ${color}">${icon}</span><small>${label}</small><strong>${count.toLocaleString()}</strong></article>`).join('')}</section>
    <section class="teacher-dashboard-grid"><div class="teacher-panel"><div class="teacher-panel-heading"><div><h2>Recent uploads</h2><p>Your latest teaching resources and review status.</p></div><button type="button" class="teacher-link-button" data-teacher-nav="materials">View all →</button></div>${teacherMaterialTable([...materials].sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt)).slice(0,5),'No materials uploaded yet.')}</div><aside class="teacher-dashboard-aside"><div class="teacher-panel"><div class="teacher-panel-heading"><div><h2>Assigned subject</h2><p>Admin-controlled subject assignment</p></div></div><div class="teacher-subject-feature"><span>▤</span><div><strong>${escapeHtml(assignedSubject)}</strong><small>${materials.length} materials shared</small></div></div><button type="button" class="secondary-btn small-btn" data-teacher-nav="subjects">View subject details</button></div><div class="teacher-panel"><div class="teacher-panel-heading"><div><h2>Quick actions</h2><p>Get back to teaching.</p></div></div><div class="teacher-quick-actions"><button data-teacher-nav="upload">＋ Upload material</button><button data-teacher-nav="materials">▧ Manage materials</button><button data-teacher-nav="status">◷ View approval status</button></div></div></aside></section>`;

  if (view === 'subjects') {
    const contexts=[...new Set(materials.map((item)=>`${item.branch||'Branch not specified'}|${item.year||'Year not specified'}|${item.semester||'Semester not specified'}`))];
    return `<section class="teacher-panel"><div class="teacher-panel-heading"><div><h2>Assigned teaching subject</h2><p>Subject assignment is controlled by your administrator and cannot be changed here.</p></div><span class="teacher-status approved">Assigned</span></div><div class="teacher-subject-detail"><span class="teacher-subject-mark">▤</span><div><small>Assigned subject</small><h2>${escapeHtml(assignedSubject)}</h2><p>Subject code is not configured in the current assignment model.</p></div></div><div class="teacher-filter-bar"><input id="teacherSubjectSearch" type="search" placeholder="Search branch or semester..." /><select id="teacherSubjectBranch"><option value="">All branches</option>${[...new Set(materials.map((item)=>item.branch).filter(Boolean))].map((branch)=>`<option>${escapeHtml(branch)}</option>`).join('')}</select><select id="teacherSubjectSemester"><option value="">All semesters</option>${[...new Set(materials.map((item)=>item.semester).filter(Boolean))].map((semester)=>`<option>${escapeHtml(semester)}</option>`).join('')}</select></div><div id="teacherSubjectCards" class="teacher-subject-cards">${contexts.length?contexts.map((context)=>{const [branch,year,semester]=context.split('|');const count=materials.filter((item)=>item.branch===branch&&item.year===year&&item.semester===semester).length;return `<article data-subject-context="${escapeHtml(context.toLowerCase())}" data-subject-name="${escapeHtml(assignedSubject.toLowerCase())}"><span class="teacher-subject-mark">▤</span><strong>${escapeHtml(assignedSubject)}</strong><small>${escapeHtml(branch)} · ${escapeHtml(year)} · ${escapeHtml(semester)}</small><b>${count} materials</b><button type="button" class="secondary-btn small-btn" data-subject-context-filter="${escapeHtml(context)}">View materials</button></article>`}).join(''):'<div class="teacher-empty"><h3>No material coverage yet</h3><p>Upload a resource to show its academic branch and semester here.</p></div>'}</div></section>`;
  }
  if (view === 'upload') return `<section class="teacher-panel"><div class="teacher-panel-heading"><div><h2>Upload teaching material</h2><p>Materials are assigned to your admin-controlled subject and published immediately.</p></div></div><form id="teacherUploadForm" class="teacher-upload-form"><div class="teacher-form-grid"><label>Material Title<input name="title" maxlength="160" required /></label><label>Material Type<select id="teacherMaterialType" name="materialType" required>${teacherMaterialTypeOptions()}</select></label><label>Assigned Subject<input value="${escapeHtml(assignedSubject)}" readonly /></label><label>Branch / Department<input name="branch" value="${escapeHtml(teacher.department||'')}" maxlength="120" required /></label><label>Academic Year<select name="year" required><option value="">Select year</option>${teacherYearOptions()}</select></label><label>Semester<select name="semester" required><option value="">Select semester</option>${teacherSemesterOptions()}</select></label><label class="teacher-full-field">Description<textarea name="description" maxlength="2000" rows="4"></textarea></label><label class="teacher-full-field teacher-drop-zone" id="teacherDropZone"><span class="teacher-file-icon">↑</span><strong>Drag and drop your teaching material</strong><small id="teacherFileName">PDF, DOC, DOCX, PPT, PPTX, JPG, PNG · up to 25 MB</small><input type="file" id="teacherMaterialFile" name="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" required /><span class="secondary-btn small-btn">Browse file</span><button type="button" id="teacherClearFile" class="teacher-clear-file" hidden>Clear file</button></label><label class="teacher-full-field" id="teacherVideoUrlGroup" hidden>Lecture video URL<input name="videoUrl" type="url" placeholder="https://..." /></label></div><div class="teacher-progress" id="teacherUploadProgress" hidden><div><span>Uploading material</span><strong id="teacherProgressLabel">0%</strong></div><progress id="teacherProgressBar" max="100" value="0"></progress></div><div class="teacher-form-actions"><button type="submit" class="primary-btn" id="teacherUploadSubmit">Upload material</button><button type="reset" class="secondary-btn">Clear form</button></div><p class="teacher-form-note">New uploads are published immediately. Editing an existing resource sends its revision to administrator review.</p></form></section>`;
  if (view === 'materials' || view === 'status') {
    const items = view==='status' ? matched.filter((item)=>!document.getElementById('teacherStatusFilter')?.value||item.status===document.getElementById('teacherStatusFilter')?.value) : matched;
    if (view==='status') return `<section class="teacher-panel"><div class="teacher-panel-heading"><div><h2>Review progress</h2><p>Submission status, review dates and administrator feedback.</p></div><button type="button" class="secondary-btn small-btn" data-refresh-teacher-materials>Refresh</button></div>${filters}<div id="teacherReviewList" class="teacher-review-list">${items.length?items.map((item)=>`<article><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.subject)} · ${escapeHtml(item.materialType)} · Submitted ${new Date(item.uploadedAt).toLocaleDateString()}</p>${item.lastReviewedAt?`<small>Last reviewed ${new Date(item.lastReviewedAt).toLocaleDateString()}</small>`:'<small>No administrator review is recorded.</small>'}${item.lastAdminFeedback?`<blockquote>${escapeHtml(item.lastAdminFeedback)}</blockquote>`:''}</div><span class="teacher-status ${String(item.status).toLowerCase()}">${escapeHtml(item.status)}</span><div class="teacher-row-actions">${item.fileUrl?`<a class="secondary-btn small-btn" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener noreferrer">Preview</a>`:''}${item.status==='Rejected'?`<button type="button" class="secondary-btn small-btn" data-edit-teacher-material="${item.id}">Edit & resubmit</button>`:''}</div></article>`).join(''):'<div class="teacher-empty"><h3>No submissions match this filter</h3></div>'}</div></section>`;
    return `<section class="teacher-panel"><div class="teacher-panel-heading"><div><h2>All my materials</h2><p>Search, filter, preview, edit or remove your teaching resources.</p></div><button type="button" class="secondary-btn small-btn" data-refresh-teacher-materials>Refresh</button></div>${filters}<div id="teacherMaterialsTable">${teacherMaterialTable(items)}</div></section>`;
  }
  if (view === 'engagement') {
    const data=state.teacherEngagement;
    return `<section class="teacher-panel"><div class="teacher-panel-heading"><div><h2>Student engagement</h2><p>Aggregated activity for your approved materials. Student identities are not shown.</p></div><select id="teacherEngagementPeriod"><option value="7" ${state.teacherEngagementPeriod==='7'?'selected':''}>Last 7 days</option><option value="30" ${state.teacherEngagementPeriod==='30'?'selected':''}>Last 30 days</option><option value="90" ${state.teacherEngagementPeriod==='90'?'selected':''}>Last 3 months</option><option value="all" ${state.teacherEngagementPeriod==='all'?'selected':''}>All time</option></select></div><div id="teacherEngagementContent">${data?`<div class="teacher-engagement-stats"><article><small>Total downloads</small><strong>${data.downloads}</strong></article><article><small>Unique students</small><strong>${data.uniqueStudents}</strong></article><article><small>Total views</small><strong>${data.viewTrackingAvailable?data.views:'Not tracked'}</strong></article><article><small>Most downloaded</small><strong>${escapeHtml(data.popular[0]?.title||'—')}</strong></article></div><div class="teacher-engagement-grid"><div><h3>Downloads by subject</h3>${data.bySubject.length?data.bySubject.map((item)=>`<p class="teacher-bar-row"><span>${escapeHtml(item.subject)}</span><b>${item.downloads}</b><i style="--bar:${Math.max(4,Math.min(100,data.downloads?item.downloads/data.downloads*100:0))}%"></i></p>`).join(''):'<p class="teacher-muted">No downloads in this period.</p>'}</div><div><h3>Popular materials</h3>${data.popular.length?data.popular.slice(0,5).map((item)=>`<p class="teacher-popular-row"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subject)}</small></span><b>${item.downloads} downloads</b></p>`).join(''):'<p class="teacher-muted">No approved materials yet.</p>'}</div></div><p class="teacher-form-note">The current platform does not record material views; no view statistics are estimated.</p>`:'<div class="teacher-loading">Loading engagement data...</div>'}</div></section>`;
  }
  if (view === 'notifications') return `<section class="teacher-panel"><div class="teacher-panel-heading"><div><h2>Notifications</h2><p>Administrator review updates for your materials.</p></div><button type="button" class="secondary-btn small-btn" data-mark-all-teacher-notifications>Mark all as read</button></div><div class="teacher-notification-list">${state.teacherNotifications.length?state.teacherNotifications.map((item)=>`<article class="${item.isRead?'read':'unread'}"><span class="teacher-notification-dot"></span><div><strong>${escapeHtml(item.type.replaceAll('_',' '))}</strong><p>${escapeHtml(item.message)}</p><small>${new Date(item.createdAt).toLocaleString()}</small></div><div>${!item.isRead?`<button class="secondary-btn small-btn" data-read-teacher-notification="${item.id}">Mark read</button>`:''}<button class="danger-btn small-btn" data-delete-teacher-notification="${item.id}">Delete</button></div></article>`).join(''):'<div class="teacher-empty"><span>♧</span><h3>You are all caught up</h3><p>Review updates appear here. Platform announcements are not configured.</p></div>'}</div></section>`;
  if (view === 'profile') return `<section class="teacher-panel"><div class="teacher-panel-heading"><div><h2>Teacher profile</h2><p>Subject assignment and account role are admin-controlled.</p></div></div><form id="teacherProfileForm"><div class="teacher-profile-picture-row"><span class="teacher-avatar large">${teacher.profilePicture?`<img src="${escapeHtml(teacher.profilePicture)}" alt="Profile picture" />`:escapeHtml((teacher.name||'T').slice(0,1).toUpperCase())}</span><label>Profile picture<input type="file" name="profilePicture" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG or WebP · up to 5 MB</small></label></div><div class="teacher-form-grid"><label>Full Name<input name="name" maxlength="100" required value="${escapeHtml(teacher.name||'')}" /></label><label>Email Address<input name="email" type="email" maxlength="254" required value="${escapeHtml(teacher.email||'')}" /></label><label>Mobile Number<input name="phone" type="tel" value="${escapeHtml(teacher.phone||'')}" /></label><label>College Name<input name="collegeName" maxlength="120" value="${escapeHtml(teacher.collegeName||'')}" /></label><label>Department<input name="department" maxlength="120" value="${escapeHtml(teacher.department||'')}" /></label><label>Assigned Subject<input value="${escapeHtml(teacher.subject||'')}" readonly /></label></div><div class="teacher-form-actions"><button class="primary-btn" type="submit">Save profile</button><button class="secondary-btn" type="reset">Cancel</button></div></form></section>`;
  if (view === 'settings') {
    const p=state.teacherPreferences||{notifications:{approvalUpdates:true,rejectionUpdates:true,announcements:true,email:true},appearance:{theme:'system'},privacy:{profileVisibility:'campus'}};
    return `<section class="teacher-settings-grid"><div class="teacher-panel"><h2>Notification preferences</h2><form id="teacherPreferencesForm">${[['approvalUpdates','Approval updates'],['rejectionUpdates','Rejection updates'],['announcements','Admin announcements'],['email','Email notifications']].map(([key,label])=>`<label class="teacher-setting-row"><span>${label}</span><input type="checkbox" name="${key}" ${p.notifications[key]?'checked':''} /></label>`).join('')}<label class="teacher-settings-field">Appearance theme<select name="theme"><option value="light" ${p.appearance.theme==='light'?'selected':''}>Light mode</option><option value="dark" ${p.appearance.theme==='dark'?'selected':''}>Dark mode</option><option value="system" ${p.appearance.theme==='system'?'selected':''}>System default</option></select></label><label class="teacher-settings-field">Profile visibility<select name="profileVisibility"><option value="campus" ${p.privacy.profileVisibility==='campus'?'selected':''}>Campus members</option><option value="private" ${p.privacy.profileVisibility==='private'?'selected':''}>Private</option></select></label><button class="primary-btn" type="submit">Save settings</button></form><p class="teacher-form-note">Email delivery and cross-device session listing are not supported by the current authentication system.</p></div><div class="teacher-panel"><h2>Change password</h2><form id="teacherPasswordForm" class="teacher-password-form"><label>Current password<input name="currentPassword" type="password" required autocomplete="current-password" /></label><label>New password<input name="newPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password" /></label><label>Confirm new password<input name="confirmPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password" /></label><button class="primary-btn" type="submit">Change password</button></form><details class="teacher-faq"><summary>Help and frequently asked questions</summary><p>Teacher uploads are published immediately. Editing an existing material sends it for administrator review. Subject assignments cannot be changed here.</p></details><form id="teacherSupportForm" class="teacher-support-form"><h3>Report a problem</h3><label>Issue title<input name="title" maxlength="120" required /></label><label>Category<select name="category"><option>Account</option><option>Materials</option><option>Engagement</option><option>Technical issue</option><option>Other</option></select></label><label>Description<textarea name="description" minlength="10" maxlength="5000" rows="4" required></textarea></label><button class="secondary-btn" type="submit">Contact support</button></form></div></section>`;
  }
  return '<div class="teacher-loading">Loading teacher portal...</div>';
}

function bindTeacherPortalActions() {
  document.querySelectorAll('[data-teacher-logout]').forEach((button)=>button.addEventListener('click',()=>{
    if(window.confirm('Are you sure you want to log out?'))clearAuthSession();
  }));
  document.getElementById('teacherGlobalSearch')?.addEventListener('submit',(event)=>{
    event.preventDefault();
    state.teacherSearch=document.getElementById('teacherSearchInput').value.trim();
    state.teacherMaterialContext=null;
    setTeacherView('materials');
  });
  document.querySelectorAll('[data-refresh-teacher-materials],[data-refresh-teacher-portal]').forEach((button)=>button.addEventListener('click',()=>ensureTeacherPortalData(true)));
  document.getElementById('teacherMaterialsSearch')?.addEventListener('input',(event)=>{
    state.teacherSearch=event.currentTarget.value;
    state.teacherMaterialContext=null;
    renderTeacherMaterialFilters();
    renderTeacherReviewFilters();
  });
  ['teacherStatusFilter','teacherSubjectFilter','teacherSortMaterials'].forEach((id)=>document.getElementById(id)?.addEventListener('change',()=>renderTeacherMaterialFilters()));
  document.getElementById('teacherStatusFilter')?.addEventListener('change',renderTeacherReviewFilters);
  document.getElementById('teacherSubjectFilter')?.addEventListener('change',renderTeacherReviewFilters);
  document.getElementById('teacherSortMaterials')?.addEventListener('change',renderTeacherReviewFilters);
  ['teacherSubjectSearch','teacherSubjectBranch','teacherSubjectSemester'].forEach((id)=>document.getElementById(id)?.addEventListener(id==='teacherSubjectSearch'?'input':'change',filterTeacherSubjectCards));
  document.getElementById('teacherEngagementPeriod')?.addEventListener('change',(event)=>{
    state.teacherEngagementPeriod=event.currentTarget.value;
    loadTeacherEngagement();
  });
  bindTeacherMaterialActions(document.getElementById('teacherPortalContent'));
  document.querySelectorAll('[data-mark-all-teacher-notifications]').forEach((button)=>button.addEventListener('click',()=>updateTeacherNotifications('/teacher/notifications/read-all','PATCH')));
  document.querySelectorAll('[data-read-teacher-notification]').forEach((button)=>button.addEventListener('click',()=>updateTeacherNotifications(`/teacher/notifications/${button.dataset.readTeacherNotification}/read`,'PATCH')));
  document.querySelectorAll('[data-delete-teacher-notification]').forEach((button)=>button.addEventListener('click',()=>updateTeacherNotifications(`/teacher/notifications/${button.dataset.deleteTeacherNotification}`,'DELETE')));
  document.querySelectorAll('[data-close-teacher-dialog]').forEach((button)=>button.addEventListener('click',()=>document.getElementById('teacherMaterialEditDialog')?.close()));
  document.querySelectorAll('[data-subject-context-filter]').forEach((button)=>button.addEventListener('click',()=>{
    const [branch,year,semester]=button.dataset.subjectContextFilter.split('|');
    state.teacherSearch='';
    state.teacherMaterialContext={branch,year,semester};
    setTeacherView('materials');
  }));
  const upload=document.getElementById('teacherUploadForm');
  if(upload)bindTeacherUploadForm(upload);
  document.getElementById('teacherMaterialEditForm')?.addEventListener('submit',submitTeacherMaterialEdit);
  document.getElementById('teacherProfileForm')?.addEventListener('submit',submitTeacherProfile);
  document.getElementById('teacherPreferencesForm')?.addEventListener('submit',submitTeacherPreferences);
  document.getElementById('teacherPasswordForm')?.addEventListener('submit',submitTeacherPassword);
  document.getElementById('teacherSupportForm')?.addEventListener('submit',submitTeacherSupportReport);
}

async function ensureTeacherPortalData(force=false) {
  if(state.teacherPortalLoaded&&!force)return;
  const content=document.getElementById('teacherPortalContent');
  if(content)content.setAttribute('aria-busy','true');
  try{
    const [materials,profile,settings]=await Promise.all([
      apiFetch('/teacher/materials'),
      apiFetch('/teacher/profile'),
      apiFetch('/teacher/settings'),
    ]);
    state.teacherMaterials=materials;
    state.teacherProfile=profile.user;
    state.user={...state.user,...profile.user};
    state.teacherPreferences=settings.preferences;
    localStorage.setItem('campusNotesUser',JSON.stringify(state.user));
    state.teacherPortalLoaded=true;
    renderTeacherDashboard();
    if(state.teacherView==='engagement')loadTeacherEngagement();
    if(state.teacherView==='notifications')loadTeacherNotifications();
  }catch(error){
    if(content)content.innerHTML=`<div class="teacher-error" role="alert">${escapeHtml(error.message)} <button type="button" class="secondary-btn small-btn" data-refresh-teacher-portal>Try again</button></div>`;
    showToast(error.message,'error');
  }
}

function setTeacherView(view) {
  if(!['dashboard','subjects','upload','materials','status','engagement','notifications','profile','settings'].includes(view))return;
  state.teacherView=view;
  renderTeacherDashboard();
  if(state.teacherPortalLoaded&&view==='engagement')loadTeacherEngagement();
  if(state.teacherPortalLoaded&&view==='notifications')loadTeacherNotifications();
}

function applyTeacherTheme() {
  const choice=state.teacherPreferences?.appearance?.theme||'system';
  const theme=choice==='system'?(window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'):choice;
  document.querySelectorAll('.teacher-shell').forEach((shell)=>{shell.dataset.theme=theme;});
}

async function loadTeacherMaterials() {
  state.teacherPortalLoaded=false;
  await ensureTeacherPortalData(true);
}

function renderTeacherMaterialFilters() {
  const container=document.getElementById('teacherMaterialsTable');
  if(!container)return;
  const status=document.getElementById('teacherStatusFilter')?.value||'';
  const subject=document.getElementById('teacherSubjectFilter')?.value||'';
  const sort=document.getElementById('teacherSortMaterials')?.value||'newest';
  const search=state.teacherSearch.toLowerCase();
  const items=state.teacherMaterials.filter((item)=>{
    const values=[item.title,item.subject,item.materialType,item.branch,item.year,item.semester,item.status].join(' ').toLowerCase();
    return(!search||values.includes(search))&&(!status||item.status===status)&&(!subject||item.subject===subject)
      &&(!state.teacherMaterialContext||(item.branch||'Branch not specified')===state.teacherMaterialContext.branch
        &&(item.year||'Year not specified')===state.teacherMaterialContext.year
        &&(item.semester||'Semester not specified')===state.teacherMaterialContext.semester);
  }).sort((a,b)=>sort==='oldest'?new Date(a.uploadedAt)-new Date(b.uploadedAt):new Date(b.uploadedAt)-new Date(a.uploadedAt));
  container.innerHTML=teacherMaterialTable(items);
  bindTeacherMaterialActions(container);
}

function bindTeacherMaterialActions(container) {
  container?.querySelectorAll('[data-edit-teacher-material]').forEach((button)=>button.addEventListener('click',()=>openTeacherMaterialEditor(Number(button.dataset.editTeacherMaterial))));
  container?.querySelectorAll('[data-delete-teacher-material]').forEach((button)=>button.addEventListener('click',()=>deleteTeacherMaterial(Number(button.dataset.deleteTeacherMaterial))));
}

function renderTeacherReviewFilters() {
  const list=document.getElementById('teacherReviewList');
  if(!list)return;
  const status=document.getElementById('teacherStatusFilter')?.value||'';
  const subject=document.getElementById('teacherSubjectFilter')?.value||'';
  const sort=document.getElementById('teacherSortMaterials')?.value||'newest';
  const search=state.teacherSearch.toLowerCase();
  const items=state.teacherMaterials.filter((item)=>{
    const text=[item.title,item.subject,item.materialType,item.branch,item.year,item.semester,item.status].join(' ').toLowerCase();
    return(!search||text.includes(search))&&(!status||item.status===status)&&(!subject||item.subject===subject)
      &&(!state.teacherMaterialContext||(item.branch||'Branch not specified')===state.teacherMaterialContext.branch
        &&(item.year||'Year not specified')===state.teacherMaterialContext.year
        &&(item.semester||'Semester not specified')===state.teacherMaterialContext.semester);
  }).sort((a,b)=>sort==='oldest'?new Date(a.uploadedAt)-new Date(b.uploadedAt):new Date(b.uploadedAt)-new Date(a.uploadedAt));
  const statusBadge=(value)=>`<span class="teacher-status ${String(value).toLowerCase()}">${escapeHtml(value)}</span>`;
  list.innerHTML=items.length?items.map((item)=>`<article><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.subject)} · ${escapeHtml(item.materialType)} · Submitted ${new Date(item.uploadedAt).toLocaleDateString()}</p>${item.lastReviewedAt?`<small>Last reviewed ${new Date(item.lastReviewedAt).toLocaleDateString()}</small>`:'<small>No administrator review is recorded.</small>'}${item.lastAdminFeedback?`<blockquote>${escapeHtml(item.lastAdminFeedback)}</blockquote>`:''}</div>${statusBadge(item.status)}<div class="teacher-row-actions">${item.fileUrl?`<a class="secondary-btn small-btn" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener noreferrer">Preview</a>`:''}${item.status==='Rejected'?`<button type="button" class="secondary-btn small-btn" data-edit-teacher-material="${item.id}">Edit & resubmit</button>`:''}</div></article>`).join(''):'<div class="teacher-empty"><h3>No submissions match this filter</h3></div>';
  bindTeacherMaterialActions(list);
}

function filterTeacherSubjectCards() {
  const search=document.getElementById('teacherSubjectSearch')?.value.toLowerCase()||'';
  const branch=document.getElementById('teacherSubjectBranch')?.value.toLowerCase()||'';
  const semester=document.getElementById('teacherSubjectSemester')?.value.toLowerCase()||'';
  document.querySelectorAll('#teacherSubjectCards article[data-subject-context]').forEach((card)=>{
    const context=card.dataset.subjectContext;
    card.hidden=Boolean((search&&!context.includes(search))||(branch&&!context.includes(branch))||(semester&&!context.includes(semester)));
  });
}

function bindTeacherUploadForm(form) {
  const type=form.elements.materialType;
  const file=form.elements.file;
  const zone=document.getElementById('teacherDropZone');
  const videoUrlGroup=document.getElementById('teacherVideoUrlGroup');
  const fileName=document.getElementById('teacherFileName');
  const clearFile=document.getElementById('teacherClearFile');
  const updateType=()=>{
    const video=type.value==='Lecture Video';
    videoUrlGroup.hidden=!video;
    file.accept=video?'.mp4,.webm,.mov,.m4v':'.pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png';
    file.required=!video||!form.elements.videoUrl.value;
    if(!video)form.elements.videoUrl.value='';
  };
  const showFile=(selected)=>{
    fileName.textContent=selected?`${selected.name} · ${(selected.size/1048576).toFixed(2)} MB`:'PDF, DOC, DOCX, PPT, PPTX, JPG, PNG · up to 25 MB';
    clearFile.hidden=!selected;
  };
  type.addEventListener('change',updateType);
  form.elements.videoUrl.addEventListener('input',()=>{file.required=type.value==='Lecture Video'&&!form.elements.videoUrl.value;});
  file.addEventListener('change',()=>showFile(file.files[0]));
  clearFile.addEventListener('click',()=>{file.value='';showFile(null);});
  form.addEventListener('reset',()=>setTimeout(()=>{showFile(null);updateType();},0));
  zone.addEventListener('dragover',(event)=>{event.preventDefault();zone.classList.add('dragging');});
  zone.addEventListener('dragleave',()=>zone.classList.remove('dragging'));
  zone.addEventListener('drop',(event)=>{
    event.preventDefault();zone.classList.remove('dragging');
    if(event.dataTransfer.files.length){file.files=event.dataTransfer.files;showFile(file.files[0]);}
  });
  updateType();
  form.addEventListener('submit',(event)=>{
    event.preventDefault();
    const selected=file.files[0];
    const limit=type.value==='Lecture Video'?250:25;
    if(selected&&selected.size>limit*1048576){showToast(`File size exceeds the ${limit} MB limit.`,'error');return;}
    const submit=document.getElementById('teacherUploadSubmit');
    const progress=document.getElementById('teacherUploadProgress');
    const progressBar=document.getElementById('teacherProgressBar');
    const progressLabel=document.getElementById('teacherProgressLabel');
    submit.disabled=true;progress.hidden=false;
    const request=new XMLHttpRequest();
    request.open('POST','/api/teacher/materials');
    request.setRequestHeader('Authorization',`Bearer ${state.token}`);
    request.upload.addEventListener('progress',(e)=>{
      if(!e.lengthComputable)return;
      const percent=Math.round(e.loaded/e.total*100);
      progressBar.value=percent;progressLabel.textContent=`${percent}%`;
    });
    request.addEventListener('load',()=>{
      let payload={};try{payload=JSON.parse(request.responseText);}catch{}
      if(request.status<200||request.status>=300)showToast(payload.message||'Unable to upload teaching material.','error');
      else{showToast(payload.message);form.reset();ensureTeacherPortalData(true);}
      submit.disabled=false;progress.hidden=true;
    });
    request.addEventListener('error',()=>{showToast('Upload failed because the server could not be reached.','error');submit.disabled=false;progress.hidden=true;});
    request.send(new FormData(form));
  });
}

async function loadTeacherEngagement() {
  state.teacherEngagement=null;
  try{
    state.teacherEngagement=await apiFetch(`/teacher/engagement?period=${encodeURIComponent(state.teacherEngagementPeriod)}`);
    if(state.teacherView==='engagement')renderTeacherDashboard();
  }catch(error){showToast(error.message,'error');}
}

async function loadTeacherNotifications() {
  try{
    state.teacherNotifications=await apiFetch('/teacher/notifications');
    if(state.teacherView==='notifications')renderTeacherDashboard();
  }catch(error){showToast(error.message,'error');}
}

async function updateTeacherNotifications(path,method) {
  try{const response=await apiFetch(path,{method});showToast(response.message);await loadTeacherNotifications();}
  catch(error){showToast(error.message,'error');}
}

function openTeacherMaterialEditor(id) {
  const material=state.teacherMaterials.find((item)=>Number(item.id)===id);
  const dialog=document.getElementById('teacherMaterialEditDialog');
  if(!material||!dialog)return;
  const form=dialog.querySelector('form');
  form.elements.id.value=String(material.id);
  form.elements.title.value=material.title;
  form.elements.materialType.innerHTML=teacherMaterialTypeOptions(material.materialType);
  form.elements.branch.value=material.branch||'';
  form.elements.year.innerHTML=teacherYearOptions(material.year);
  form.elements.semester.innerHTML=teacherSemesterOptions(material.semester);
  form.elements.description.value=material.description||'';
  dialog.showModal();
}

async function submitTeacherMaterialEdit(event) {
  event.preventDefault();
  const form=event.currentTarget;
  try{
    const response=await apiFetch(`/teacher/materials/${form.elements.id.value}`,{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(form).entries()))});
    document.getElementById('teacherMaterialEditDialog').close();
    showToast(response.message);
    await loadTeacherMaterials();
  }catch(error){showToast(error.message,'error');}
}

async function deleteTeacherMaterial(id) {
  const material=state.teacherMaterials.find((item)=>Number(item.id)===id);
  if(!material||!window.confirm(`Delete "${material.title}"? This removes its associated download and rating records.`))return;
  try{const response=await apiFetch(`/teacher/materials/${id}`,{method:'DELETE'});showToast(response.message);await loadTeacherMaterials();}
  catch(error){showToast(error.message,'error');}
}

async function submitTeacherProfile(event) {
  event.preventDefault();
  const form=event.currentTarget;
  const image=form.elements.profilePicture.files[0];
  if(image&&(image.size>5*1048576||!['image/jpeg','image/png','image/webp'].includes(image.type))){showToast('Choose a JPG, PNG or WebP image up to 5 MB.','error');return;}
  try{
    const fields=Object.fromEntries([...new FormData(form).entries()].filter(([key])=>key!=='profilePicture'));
    const response=await apiFetch('/teacher/profile',{method:'PUT',body:JSON.stringify(fields)});
    state.teacherProfile=response.user;state.user={...state.user,...response.user};
    if(image){const data=new FormData();data.append('profilePicture',image);const picture=await apiFetch('/teacher/profile-picture',{method:'POST',body:data});state.teacherProfile.profilePicture=picture.profilePicture;state.user.profilePicture=picture.profilePicture;}
    localStorage.setItem('campusNotesUser',JSON.stringify(state.user));
    showToast('Teacher profile saved.');renderTeacherDashboard();
  }catch(error){showToast(error.message,'error');}
}

async function submitTeacherPreferences(event) {
  event.preventDefault();
  const form=event.currentTarget;
  const preferences={
    notifications:Object.fromEntries([...form.querySelectorAll('input[type="checkbox"]')].map((input)=>[input.name,input.checked])),
    appearance:{theme:form.elements.theme.value},
    privacy:{profileVisibility:form.elements.profileVisibility.value},
  };
  try{
    const response=await apiFetch('/teacher/settings',{method:'PUT',body:JSON.stringify({preferences})});
    state.teacherPreferences=response.preferences;applyTeacherTheme();showToast(response.message);renderTeacherDashboard();
  }catch(error){showToast(error.message,'error');}
}

async function submitTeacherPassword(event) {
  event.preventDefault();
  const form=event.currentTarget;
  if(form.elements.newPassword.value!==form.elements.confirmPassword.value){showToast('New password and confirmation do not match.','error');return;}
  try{
    const response=await apiFetch('/teacher/password',{method:'PUT',body:JSON.stringify({currentPassword:form.elements.currentPassword.value,newPassword:form.elements.newPassword.value})});
    showToast(response.message);clearAuthSession();
  }catch(error){showToast(error.message,'error');}
}

async function submitTeacherSupportReport(event) {
  event.preventDefault();
  const form=event.currentTarget;
  try{
    const response=await apiFetch('/teacher/support-reports',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form).entries()))});
    form.reset();showToast(response.message);
  }catch(error){showToast(error.message,'error');}
}

function renderStudentRegister() {
  renderShell(`
    <div class="form-shell">
      <div class="container">
        <div class="form-box">
          <div class="form-header">
            <div>
              <div class="kicker">Student Portal</div>
              <h2>Create your account</h2>
            </div>
            <button class="ghost-btn" onclick="setRoute('#/student-login')">Already registered?</button>
          </div>
          <form id="studentRegisterForm">
            <div class="form-grid">
              <div class="form-group">
                <label for="fullName">Full Name</label>
                <input id="fullName" name="fullName" type="text" required />
              </div>
              <div class="form-group">
                <label for="studentId">Student / College ID</label>
                <input id="studentId" name="studentId" type="text" required />
              </div>
              <div class="form-group">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div class="form-group">
                <label for="phone">Phone Number</label>
                <input id="phone" name="phone" type="tel" />
              </div>
              <div class="form-group">
                <label for="branch">Branch</label>
                <select id="branch" name="branch" required>
                  <option value="">Select your branch</option>
                  <option>Artificial Intelligence and Data Science</option>
                  <option>Artificial Intelligence and Machine Learning</option>
                  <option>Computer Science and Engineering</option>
                  <option>Computer Science and Business Systems</option>
                  <option>Computer Science and Design</option>
                  <option>Computer Engineering</option>
                  <option>Cyber Security</option>
                  <option>Data Science</option>
                  <option>Information Technology</option>
                  <option>Information Science and Engineering</option>
                  <option>Internet of Things</option>
                  <option>Software Engineering</option>
                </select>
              </div>
              <div class="form-group">
                <label for="year">Year</label>
                <select id="year" name="year" required>
                  <option value="">Select</option>
                  <option>1st Year</option>
                  <option>2nd Year</option>
                  <option>3rd Year</option>
                  <option>4th Year</option>
                </select>
              </div>
              <div class="form-group">
                <label for="semester">Semester</label>
                <select id="semester" name="semester" required>
                  <option value="">Select</option>
                  <option>Semester 1</option>
                  <option>Semester 2</option>
                  <option>Semester 3</option>
                  <option>Semester 4</option>
                  <option>Semester 5</option>
                  <option>Semester 6</option>
                  <option>Semester 7</option>
                  <option>Semester 8</option>
                </select>
              </div>
              <div class="form-group">
                <label for="registerPassword">Password</label>
                <input id="registerPassword" name="password" type="password" required />
              </div>
              <div class="form-group full">
                <label for="confirmPassword">Confirm Password</label>
                <input id="confirmPassword" name="confirmPassword" type="password" required />
              </div>
            </div>
            <div class="form-actions" style="margin-top:1.5rem;">
              <button class="primary-btn" type="submit">Create Account</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `);

  bindRenderedForm('studentRegisterForm', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      fullName: form.fullName.value,
      studentId: form.studentId.value,
      email: form.email.value,
      phone: form.phone.value,
      branch: form.branch.value,
      year: form.year.value,
      semester: form.semester.value,
      password: form.password.value,
      confirmPassword: form.confirmPassword.value,
    };

    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthSession(response.token, response.user);
      showToast('Account created successfully.');
      setRoute('#/student-dashboard');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function renderAdminLogin() {
  renderShell(`
    <div class="form-shell">
      <div class="container">
        <div class="form-box">
          <div class="form-header">
            <div>
              <div class="kicker">Admin Portal</div>
              <h2>Administrator Login</h2>
            </div>
            <button class="ghost-btn" onclick="setRoute('#/')">Back to home</button>
          </div>
          <form id="adminLoginForm">
            <div class="form-grid">
              <div class="form-group full">
                <label for="adminUsername">Username</label>
                <input id="adminUsername" name="username" type="text" placeholder="Enter any username" value="admin" required />
              </div>
              <div class="form-group full">
                <label for="adminPassword">Password</label>
                <input id="adminPassword" name="password" type="password" placeholder="Enter admin password" required />
              </div>
            </div>
            <div class="form-actions" style="margin-top:1.5rem;">
              <button type="submit" class="primary-btn">Access Admin Portal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `);

  bindRenderedForm('adminLoginForm', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const response = await apiFetch('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({
          username: form.username.value,
          password: form.password.value,
        }),
      });
      setAuthSession(response.token, response.user);
      showToast('Admin access granted.');
      setRoute('#/admin-dashboard');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function renderStudentDashboard() {
  const view = state.studentView || 'dashboard';
  const content = getStudentViewMarkup(view);
  const userName = state.user?.name || 'Student';
  const firstName = userName.split(' ')[0];
  const views = {
    dashboard: [`Welcome back, ${firstName}`, 'Here is what is happening with your study resources.'],
    browse: ['Explore Notes', 'Find approved study notes shared by your campus community.'],
    upload: ['Upload Notes', 'Share useful study materials with your classmates.'],
    'my-uploads': ['My Uploads', 'Track the review status of the materials you have shared.'],
    saved: ['Saved Notes', 'Your bookmarked study materials, all in one place.'],
    history: ['Download History', 'Revisit study materials you have downloaded.'],
    profile: ['My Profile', 'Your student account information.'],
    settings: [studentSettingsText('Settings'), studentSettingsText('Manage your account and personalize your CampusNotes experience.')],
  };
  const [pageTitle, pageDescription] = views[view] || views.dashboard;

  renderShell(`
    <div class="portal-shell student-shell"
      data-theme="${escapeHtml(state.studentSettings?.preferences?.appearance?.theme || 'system')}"
      data-language="${escapeHtml(state.studentSettings?.preferences?.appearance?.language || 'en')}"
      data-font-size="${escapeHtml(state.studentSettings?.preferences?.appearance?.fontSize || 'medium')}">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">N</div>
          <div class="brand-text">
            <span>CampusNotes</span>
            <small>Student Portal</small>
          </div>
        </div>
        <nav class="sidebar-nav">
          ${['dashboard','browse','upload','my-uploads','saved','history','profile','settings'].map((item) => {
            const titles = {
              dashboard: ['▦', 'Dashboard'],
              browse: ['⌕', 'Explore Notes'],
              upload: ['↑', 'Upload Notes'],
              'my-uploads': ['▤', 'My Uploads'],
              saved: ['♡', 'Saved Notes'],
              history: ['↻', 'Download History'],
              profile: ['♙', 'My Profile'],
              settings: ['⚙', studentSettingsText('Settings')],
            };
            return `<button class="nav-item ${view === item ? 'active' : ''}" data-student-nav="${item}" ${view === item ? 'aria-current="page"' : ''}><span class="student-nav-icon" aria-hidden="true">${titles[item][0]}</span><span>${titles[item][1]}</span></button>`;
          }).join('')}
          <button class="nav-item" data-logout="student"><span class="student-nav-icon" aria-hidden="true">↪</span><span>Logout</span></button>
        </nav>
      </aside>
      <main class="portal-main student-main">
        <header class="student-topbar">
          <div class="student-greeting">
            <div class="student-eyebrow">CampusNotes Student Portal</div>
            <h1>${escapeHtml(pageTitle)}</h1>
            <p>${escapeHtml(pageDescription)}</p>
          </div>
          <form id="studentGlobalSearch" class="student-global-search" role="search">
            <span aria-hidden="true">⌕</span>
            <input id="studentGlobalSearchInput" type="search" placeholder="Search notes, subjects..." aria-label="Search study notes" value="${view === 'browse' ? escapeHtml(state.studentSearch || '') : ''}" />
            <button type="submit">Search</button>
          </form>
          <div class="student-topbar-actions">
            <button type="button" class="student-notification" data-student-nav="my-uploads" aria-label="View upload updates" title="Upload updates"><span aria-hidden="true">♧</span><i id="studentNotificationCount" hidden></i></button>
            <button type="button" class="student-profile-chip" data-student-nav="profile" aria-label="Open student profile">
              <span class="student-avatar">${state.user?.profilePicture ? `<img src="${escapeHtml(state.user.profilePicture)}" alt="" />` : escapeHtml(userName.slice(0, 1).toUpperCase())}</span>
              <span><strong>${escapeHtml(userName)}</strong><small>Student</small></span>
            </button>
          </div>
        </header>
        ${content}
      </main>
    </div>
  `);

  bindStudentActions();
  initializeStudentSettings();
  const globalSearch = document.getElementById('studentGlobalSearch');
  globalSearch?.addEventListener('submit', (event) => {
    event.preventDefault();
    state.studentSearch = document.getElementById('studentGlobalSearchInput').value.trim();
    state.studentView = 'browse';
    renderStudentDashboard();
  });
}

function getStudentViewMarkup(view) {
  switch (view) {
    case 'browse':
      return `
        <section class="student-section student-library">
          <div class="student-section-heading">
            <div><h2>Explore approved notes</h2><p>Only materials reviewed and approved by an administrator are shown.</p></div>
            <button class="secondary-btn small-btn" onclick="loadBrowseMaterials()">Refresh notes</button>
          </div>
          <div class="panel student-filter-panel">
          <div class="form-grid student-filter-grid">
            <div class="form-group">
              <label for="browseSearch">Search notes</label>
              <input id="browseSearch" type="search" placeholder="Search title or subject" value="${escapeHtml(state.studentSearch || '')}" />
            </div>
            <div class="form-group">
              <label for="filterBranch">Branch</label>
              <select id="filterBranch">
                <option value="">All</option>
              </select>
            </div>
            <div class="form-group">
              <label>Year</label>
              <select id="filterYear">
                <option value="">Select year</option>
                <option>1st Year</option>
                <option>2nd Year</option>
                <option>3rd Year</option>
                <option>4th Year</option>
              </select>
            </div>
            <div class="form-group">
              <label>Semester</label>
              <select id="filterSemester">
                <option value="">Select semester</option>
                <option>Semester 1</option>
                <option>Semester 2</option>
                <option>Semester 3</option>
                <option>Semester 4</option>
                <option>Semester 5</option>
                <option>Semester 6</option>
                <option>Semester 7</option>
                <option>Semester 8</option>
              </select>
            </div>
            <div class="form-group">
              <label>Subject</label>
              <select id="filterSubject" disabled>
                <option value="">Select year and semester first</option>
              </select>
            </div>
            <div class="form-group">
              <label for="sortMaterials">Sort by</label>
              <select id="sortMaterials">
                <option value="top-rated">Highest rated first</option>
                <option value="newest">Newest first</option>
              </select>
            </div>
          </div>
          <div id="materialsList" class="material-grid"></div>
          </div>
        </section>
      `;
    case 'upload':
      return `
        <div class="status-row">
          <h2>Upload Material</h2>
        </div>
        <div class="panel">
          <form id="uploadForm">
            <div class="form-grid">
              <div class="form-group">
                <label>Material Title</label>
                <input name="title" required />
              </div>
              <div class="form-group">
                <label>Year</label>
                <select name="year" id="uploadYear" required>
                  <option value="">Select</option>
                  <option>1st Year</option>
                  <option>2nd Year</option>
                  <option>3rd Year</option>
                  <option>4th Year</option>
                </select>
              </div>
              <div class="form-group">
                <label>Semester</label>
                <select name="semester" id="uploadSemester" required>
                  <option value="">Select</option>
                  <option>Semester 1</option>
                  <option>Semester 2</option>
                  <option>Semester 3</option>
                  <option>Semester 4</option>
                  <option>Semester 5</option>
                  <option>Semester 6</option>
                  <option>Semester 7</option>
                  <option>Semester 8</option>
                </select>
              </div>
              <div class="form-group">
                <label>Subject</label>
                <select name="subject" id="uploadSubject" required disabled>
                  <option value="">Select year and semester first</option>
                </select>
              </div>
              <div class="form-group full">
                <label>Description</label>
                <textarea name="description"></textarea>
              </div>
              <div class="form-group">
                <label>Branch</label>
                <input name="branch" required />
              </div>
              <div class="form-group">
                <label>Material Type</label>
                <select name="materialType" required>
                  <option value="">Select</option>
                  <option>Subject Notes</option>
                  <option>Previous Year Question Paper</option>
                  <option>Manual Lab</option>
                </select>
              </div>
              <div class="form-group full">
                <label for="studentPdfFile">PDF study material</label>
                <input id="studentPdfFile" type="file" name="file" accept="application/pdf,.pdf" required />
                <small class="student-form-hint">Upload a PDF up to 25 MB. Your note will be pending until an administrator reviews it.</small>
              </div>
            </div>
            <div class="student-upload-notice">New uploads are not published immediately. You can follow their review status in My Uploads.</div>
            <div class="form-actions" style="margin-top:1.25rem;">
              <button class="primary-btn" type="submit">Submit Material</button>
            </div>
          </form>
        </div>
      `;
    case 'my-uploads':
      return `
        <div class="status-row">
          <h2>My Uploads</h2>
          <button class="secondary-btn small-btn" onclick="loadStudentUploads()">Refresh</button>
        </div>
        <div class="panel">
          <div id="myUploadsList"></div>
        </div>
      `;
    case 'saved':
      return `
        <section class="student-section">
          <div class="student-section-heading"><div><h2>Your saved notes</h2><p>Quickly return to resources you bookmarked.</p></div><button class="secondary-btn small-btn" onclick="setStudentView('browse')">Explore notes</button></div>
          <div class="panel">
          <div id="savedMaterialsList"></div>
          </div>
        </section>
      `;
    case 'history':
      return `
        <section class="student-section">
          <div class="student-section-heading"><div><h2>Your recent downloads</h2><p>Download history is linked to your student account.</p></div><button class="secondary-btn small-btn" onclick="loadStudentDownloadHistory()">Refresh history</button></div>
          <div class="panel"><div id="studentDownloadHistory"></div></div>
        </section>
      `;
    case 'profile':
      return `
        <div class="status-row">
          <h2>My Profile</h2>
        </div>
        <div class="panel">
          <div class="form-grid">
            <div class="form-group">
              <label>Full Name</label>
              <input value="${escapeHtml(state.user?.name || '')}" readonly />
            </div>
            <div class="form-group">
              <label>Student ID</label>
              <input value="${escapeHtml(state.user?.studentId || '')}" readonly />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input value="${escapeHtml(state.user?.email || '')}" readonly />
            </div>
            <div class="form-group">
              <label>Role</label>
              <input value="Student" readonly />
            </div>
          </div>
        </div>
      `;
    case 'settings':
      return `
        <section class="student-settings-page" id="studentSettingsPage" aria-live="polite">
          <div class="student-loading">${studentSettingsText('Loading your settings...')}</div>
        </section>
      `;
    default:
      return `
        <div id="studentDashboardError" class="student-error student-dashboard-error" role="alert" hidden></div>
        <section class="student-stat-grid" aria-label="Study resource statistics">
          <article class="student-stat-card"><span class="student-stat-icon blue" aria-hidden="true">▤</span><span class="student-stat-label">Available notes</span><strong id="studentAvailableCount">—</strong><small>Approved for students</small></article>
          <article class="student-stat-card"><span class="student-stat-icon violet" aria-hidden="true">↑</span><span class="student-stat-label">My uploads</span><strong id="studentUploadsCount">—</strong><small>Materials you shared</small></article>
          <article class="student-stat-card"><span class="student-stat-icon amber" aria-hidden="true">◷</span><span class="student-stat-label">Pending reviews</span><strong id="studentPendingCount">—</strong><small>Awaiting approval</small></article>
          <article class="student-stat-card"><span class="student-stat-icon rose" aria-hidden="true">♡</span><span class="student-stat-label">Saved notes</span><strong id="studentSavedCount">—</strong><small>Bookmarked resources</small></article>
        </section>
        <section class="student-section">
          <div class="student-section-heading"><div><h2>Explore by subject</h2><p>Find approved notes in the subjects you are studying.</p></div><button class="student-text-link" onclick="setStudentView('browse')">View all notes <span aria-hidden="true">→</span></button></div>
          <div id="studentSubjectCategories" class="student-subject-grid"><div class="student-loading">Loading subjects...</div></div>
        </section>
        <section class="student-section">
          <div class="student-section-heading"><div><h2>Recently uploaded notes</h2><p>Newly approved study resources from your campus community.</p></div><button class="student-text-link" onclick="setStudentView('browse')">Explore notes <span aria-hidden="true">→</span></button></div>
          <div id="studentRecentNotes" class="student-recent-grid"><div class="student-loading">Loading notes...</div></div>
        </section>
        <div class="student-dashboard-columns">
          <section class="student-section">
            <div class="student-section-heading"><div><h2>My upload activity</h2><p>Follow the review status of your submissions.</p></div><button class="student-text-link" onclick="setStudentView('my-uploads')">All uploads <span aria-hidden="true">→</span></button></div>
            <div class="panel student-activity-panel"><div id="studentRecentUploads"><div class="student-loading">Loading uploads...</div></div></div>
          </section>
          <div class="student-dashboard-side">
            <section class="student-section">
              <div class="student-section-heading"><div><h2>Quick actions</h2><p>Continue where you left off.</p></div></div>
              <div class="panel student-quick-actions">
                <button type="button" class="student-quick-action" onclick="setStudentView('browse')"><span class="quick-action-icon blue">⌕</span><span><strong>Explore notes</strong><small>Browse the approved library</small></span><b aria-hidden="true">→</b></button>
                <button type="button" class="student-quick-action" onclick="setStudentView('upload')"><span class="quick-action-icon violet">↑</span><span><strong>Upload new notes</strong><small>Share a PDF with classmates</small></span><b aria-hidden="true">→</b></button>
                <button type="button" class="student-quick-action" onclick="setStudentView('saved')"><span class="quick-action-icon rose">♡</span><span><strong>View saved notes</strong><small>Open your bookmarks</small></span><b aria-hidden="true">→</b></button>
              </div>
            </section>
            <section class="student-section">
              <div class="student-section-heading"><div><h2>Recent activity</h2><p>Your latest downloads, saves and uploads.</p></div></div>
              <div class="panel student-activity-panel"><div id="studentRecentActivity"><div class="student-loading">Loading activity...</div></div></div>
            </section>
          </div>
        </div>
        <section class="student-section student-saved-section">
          <div class="student-section-heading"><div><h2>Saved notes</h2><p>Keep useful resources close at hand.</p></div><button class="student-text-link" onclick="setStudentView('saved')">View saved <span aria-hidden="true">→</span></button></div>
          <div id="studentSavedPreview" class="student-saved-preview-list"></div>
        </section>
        <div class="student-info-note"><span aria-hidden="true">ℹ</span><span>Student uploads are reviewed by an administrator before they appear in Explore Notes.</span>
          </div>
      `;
  }
}

const STUDENT_SETTINGS_MR = {
  Settings: 'सेटिंग्ज',
  'Manage your account and personalize your CampusNotes experience.': 'तुमचे खाते व्यवस्थापित करा आणि CampusNotes अनुभव वैयक्तिकृत करा.',
  'Loading your settings...': 'तुमची सेटिंग्ज लोड होत आहेत...',
  Account: 'खाते',
  Notifications: 'सूचना',
  Appearance: 'दिसणे',
  'Privacy & Security': 'गोपनीयता आणि सुरक्षा',
  'Study Preferences': 'अभ्यास प्राधान्ये',
  'Help & Support': 'मदत आणि सहाय्य',
  'Save Changes': 'बदल जतन करा',
  Cancel: 'रद्द करा',
  'Personal Information': 'वैयक्तिक माहिती',
  'Change Password': 'पासवर्ड बदला',
  'Profile Visibility': 'प्रोफाइल दृश्यमानता',
  'Download History': 'डाउनलोड इतिहास',
  'Contact Support': 'सहाय्याशी संपर्क साधा',
  'Report a Problem': 'समस्या नोंदवा',
  'Delete Account': 'खाते हटवा',
};

function studentSettingsText(value) {
  return state.studentSettings?.preferences?.appearance?.language === 'mr'
    ? (STUDENT_SETTINGS_MR[value] || value)
    : value;
}

function defaultStudentPreferences() {
  return {
    notifications: {
      uploadApproved: true,
      uploadRejected: true,
      newMaterials: true,
      downloadActivity: false,
      announcements: true,
      email: true,
    },
    appearance: { theme: 'system', language: 'en', fontSize: 'medium' },
    privacy: { profileVisibility: 'campus' },
    study: {
      downloadPreference: 'download',
      preferredSubjects: [],
      defaultBranch: '',
      defaultYear: '',
      defaultSemester: '',
      savedNotesFirst: false,
    },
  };
}

function applyStudentPreferences(preferences = state.studentSettings?.preferences) {
  if (!preferences) return;
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const activeTheme = preferences.appearance.theme === 'system'
    ? (systemDark ? 'dark' : 'light')
    : preferences.appearance.theme;
  document.querySelectorAll('.student-shell').forEach((shell) => {
    shell.dataset.theme = activeTheme;
    shell.dataset.themeChoice = preferences.appearance.theme;
    shell.dataset.language = preferences.appearance.language;
    shell.dataset.fontSize = preferences.appearance.fontSize;
  });
}

function loadStudentSettingsData() {
  if (state.studentSettings) return Promise.resolve(state.studentSettings);
  if (state.studentSettingsPromise) return state.studentSettingsPromise;

  state.studentSettingsPromise = apiFetch('/student/settings')
    .then((data) => {
      state.studentSettings = {
        ...data,
        preferences: { ...defaultStudentPreferences(), ...data.preferences },
      };
      state.user = { ...state.user, ...data.user };
      localStorage.setItem('campusNotesUser', JSON.stringify(state.user));
      applyStudentPreferences();
      return state.studentSettings;
    })
    .finally(() => {
      state.studentSettingsPromise = null;
    });
  return state.studentSettingsPromise;
}

function initializeStudentSettings() {
  if (state.user?.role !== 'student') return;
  loadStudentSettingsData()
    .then(() => {
      if (viewIsLoaded('settings')) {
        const title = document.querySelector('.student-greeting h1');
        const subtitle = document.querySelector('.student-greeting p');
        if (title) title.textContent = studentSettingsText('Settings');
        if (subtitle) subtitle.textContent = studentSettingsText('Manage your account and personalize your CampusNotes experience.');
        document.querySelector('.student-shell [data-student-nav="settings"] span:last-child')?.replaceChildren(studentSettingsText('Settings'));
        renderStudentSettingsPage();
      }
    })
    .catch((error) => {
      console.error('Load student settings error:', error);
      if (viewIsLoaded('settings')) {
        const page = document.getElementById('studentSettingsPage');
        if (page) {
          page.innerHTML = `<div class="student-error" role="alert">${escapeHtml(error.message)} <button type="button" class="secondary-btn small-btn" data-retry-student-settings>Try again</button></div>`;
          page.querySelector('[data-retry-student-settings]')?.addEventListener('click', () => {
            state.studentSettings = null;
            initializeStudentSettings();
          });
        }
      } else {
        showToast(error.message, 'error');
      }
    });
}

function renderStudentSettingsPage() {
  const page = document.getElementById('studentSettingsPage');
  if (!page || !state.studentSettings) return;
  const user = state.studentSettings.user;
  const preferences = state.studentSettings.preferences;
  const pictureMarkup = user.profilePicture
    ? `<img src="${escapeHtml(user.profilePicture)}" alt="Profile picture preview" />`
    : escapeHtml((user.name || 'S').trim().slice(0, 1).toUpperCase());
  const subjects = [...new Set(Object.values(SUBJECT_CATALOG).flatMap((years) => Object.values(years).flat()))]
    .sort((a, b) => a.localeCompare(b));
  const notificationRows = [
    ['uploadApproved', 'Upload approved', 'Know when an administrator approves your upload.'],
    ['uploadRejected', 'Upload rejected', 'Receive a status update if an upload is rejected.'],
    ['newMaterials', 'New study materials', 'Get updates when new materials are published.'],
    ['downloadActivity', 'Download activity', 'Receive a record when you download a resource.'],
    ['announcements', 'Platform announcements', 'Hear about important CampusNotes updates.'],
    ['email', 'Email notifications', 'Allow account and platform email notifications.'],
  ];

  page.innerHTML = `
    <div class="student-settings-intro">
      <div><h2>${studentSettingsText('Settings')}</h2><p>${studentSettingsText('Manage your account and personalize your CampusNotes experience.')}</p></div>
    </div>
    <div class="student-settings-layout">
      <nav class="student-settings-nav" aria-label="Settings categories">
        <button type="button" data-settings-jump="settings-account">${studentSettingsText('Account')}</button>
        <button type="button" data-settings-jump="settings-notifications">${studentSettingsText('Notifications')}</button>
        <button type="button" data-settings-jump="settings-appearance">${studentSettingsText('Appearance')}</button>
        <button type="button" data-settings-jump="settings-privacy">${studentSettingsText('Privacy & Security')}</button>
        <button type="button" data-settings-jump="settings-study">${studentSettingsText('Study Preferences')}</button>
        <button type="button" data-settings-jump="settings-help">${studentSettingsText('Help & Support')}</button>
      </nav>
      <div class="student-settings-sections">
        <section class="student-settings-card" id="settings-account">
          <div class="student-settings-heading"><div><h3>${studentSettingsText('Personal Information')}</h3><p>Keep your student profile and academic details up to date.</p></div></div>
          <form id="studentProfileSettingsForm">
            <div class="student-profile-editor">
              <div class="student-profile-picture" id="studentProfilePicturePreview">${pictureMarkup}</div>
              <div><label class="student-settings-label" for="studentProfilePicture">Profile Picture</label><input id="studentProfilePicture" name="profilePicture" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG or WebP, up to 5 MB.</small></div>
            </div>
            <div class="student-settings-form-grid">
              <label class="student-settings-field">Full Name<input name="name" required maxlength="100" autocomplete="name" value="${escapeHtml(user.name || '')}" /></label>
              <label class="student-settings-field">Email Address<input name="email" type="email" required maxlength="254" autocomplete="email" value="${escapeHtml(user.email || '')}" /></label>
              <label class="student-settings-field">Mobile Number<input name="phone" type="tel" maxlength="20" autocomplete="tel" value="${escapeHtml(user.phone || '')}" placeholder="+91 98765 43210" /></label>
              <label class="student-settings-field">College Name<input name="collegeName" maxlength="120" value="${escapeHtml(user.collegeName || '')}" /></label>
              <label class="student-settings-field">Branch / Department<input name="branch" required maxlength="120" value="${escapeHtml(user.branch || '')}" /></label>
              <label class="student-settings-field">Academic Year<select name="year" required>
                <option value="">Select year</option>
                ${['1st Year', '2nd Year', '3rd Year', '4th Year'].map((year) => `<option value="${year}" ${user.year === year ? 'selected' : ''}>${year}</option>`).join('')}
              </select></label>
              <label class="student-settings-field">Semester<select name="semester" required>
                <option value="">Select semester</option>
                ${Array.from({ length: 8 }, (_, index) => `Semester ${index + 1}`).map((semester) => `<option value="${semester}" ${user.semester === semester ? 'selected' : ''}>${semester}</option>`).join('')}
              </select></label>
              <label class="student-settings-field">Student ID<input value="${escapeHtml(user.studentId || '')}" readonly aria-readonly="true" /><small>Your student ID cannot be changed here.</small></label>
            </div>
            <div class="student-settings-actions"><button type="submit" class="primary-btn">${studentSettingsText('Save Changes')}</button><button type="button" class="secondary-btn" data-settings-cancel="profile">${studentSettingsText('Cancel')}</button></div>
          </form>
        </section>

        <section class="student-settings-card">
          <div class="student-settings-heading"><div><h3>${studentSettingsText('Change Password')}</h3><p>Confirm your current password before choosing a new one.</p></div></div>
          <form id="studentPasswordSettingsForm">
            <div class="student-settings-form-grid">
              <label class="student-settings-field">Current Password<input name="currentPassword" type="password" required autocomplete="current-password" /></label>
              <label class="student-settings-field">New Password<input name="newPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password" /><small>Use at least 8 characters.</small></label>
              <label class="student-settings-field">Confirm New Password<input name="confirmPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password" /></label>
            </div>
            <label class="student-settings-check"><input type="checkbox" data-show-passwords /> Show password fields</label>
            <div class="student-settings-actions"><button type="submit" class="primary-btn">${studentSettingsText('Change Password')}</button><button type="reset" class="secondary-btn">Cancel</button></div>
          </form>
        </section>

        <section class="student-settings-card" id="settings-notifications">
          <div class="student-settings-heading"><div><h3>${studentSettingsText('Notifications')}</h3><p>Choose the CampusNotes updates you want to receive.</p></div></div>
          <form id="studentNotificationsSettingsForm">
            <div class="student-settings-options">
              ${notificationRows.map(([key, title, description]) => `
                <label class="student-setting-toggle"><span><strong>${title}</strong><small>${description}</small></span><input type="checkbox" name="${key}" role="switch" ${preferences.notifications[key] ? 'checked' : ''} /><span class="student-toggle-track" aria-hidden="true"></span></label>
              `).join('')}
            </div>
            <div class="student-settings-actions"><button type="submit" class="primary-btn">${studentSettingsText('Save Changes')}</button><button type="button" class="secondary-btn" data-settings-cancel="preferences">${studentSettingsText('Cancel')}</button></div>
          </form>
        </section>

        <section class="student-settings-card" id="settings-appearance">
          <div class="student-settings-heading"><div><h3>${studentSettingsText('Appearance')}</h3><p>Personalize how CampusNotes looks on this device.</p></div></div>
          <form id="studentAppearanceSettingsForm">
            <div class="student-settings-form-grid">
              <label class="student-settings-field">Theme<select name="theme"><option value="light" ${preferences.appearance.theme === 'light' ? 'selected' : ''}>Light Mode</option><option value="dark" ${preferences.appearance.theme === 'dark' ? 'selected' : ''}>Dark Mode</option><option value="system" ${preferences.appearance.theme === 'system' ? 'selected' : ''}>System Default</option></select></label>
              <label class="student-settings-field">Language<select name="language"><option value="en" ${preferences.appearance.language === 'en' ? 'selected' : ''}>English</option><option value="mr" ${preferences.appearance.language === 'mr' ? 'selected' : ''}>मराठी (Marathi)</option></select></label>
              <label class="student-settings-field">Font Size<select name="fontSize"><option value="small" ${preferences.appearance.fontSize === 'small' ? 'selected' : ''}>Small</option><option value="medium" ${preferences.appearance.fontSize === 'medium' ? 'selected' : ''}>Medium</option><option value="large" ${preferences.appearance.fontSize === 'large' ? 'selected' : ''}>Large</option></select></label>
            </div>
            <div class="student-settings-actions"><button type="submit" class="primary-btn">${studentSettingsText('Save Changes')}</button><button type="button" class="secondary-btn" data-settings-cancel="preferences">${studentSettingsText('Cancel')}</button></div>
          </form>
        </section>

        <section class="student-settings-card" id="settings-privacy">
          <div class="student-settings-heading"><div><h3>${studentSettingsText('Privacy & Security')}</h3><p>Manage how your student profile is shared and review account security details.</p></div></div>
          <form id="studentPrivacySettingsForm">
            <label class="student-settings-field student-settings-inline-field">${studentSettingsText('Profile Visibility')}<select name="profileVisibility"><option value="campus" ${preferences.privacy.profileVisibility === 'campus' ? 'selected' : ''}>Campus members</option><option value="private" ${preferences.privacy.profileVisibility === 'private' ? 'selected' : ''}>Private</option></select></label>
            <p class="student-settings-note">When set to Private, your name is shown as “Student” on shared material listings. Administrators can still identify upload owners for review.</p>
            <div class="student-settings-actions"><button type="submit" class="primary-btn">${studentSettingsText('Save Changes')}</button><button type="button" class="secondary-btn" data-settings-cancel="preferences">${studentSettingsText('Cancel')}</button></div>
          </form>
          <div class="student-security-grid">
            <article><span class="student-settings-icon" aria-hidden="true">⌁</span><div><strong>Active session</strong><small>This signed-in browser session expires ${state.studentSettings.session?.expiresAt ? new Date(state.studentSettings.session.expiresAt).toLocaleString() : 'after the standard session period'}.</small></div><button type="button" class="secondary-btn small-btn" data-student-signout>Sign out</button></article>
            <article><span class="student-settings-icon" aria-hidden="true">✓</span><div><strong>Account security</strong><small>Student account · ${escapeHtml(user.email || '')}. Passwords are never displayed here.</small></div><button type="button" class="student-text-link" data-settings-jump="settings-account">${studentSettingsText('Change Password')}</button></article>
          </div>
          <p class="student-settings-note">This authentication system does not track sessions across devices, so only this browser session can be ended here.</p>
          <div class="student-danger-zone"><div><h4>${studentSettingsText('Delete Account')}</h4><p>Deleting your account also removes your uploaded materials and saved account activity. This cannot be undone.</p></div><button type="button" class="danger-btn" data-open-delete-account>Delete account</button></div>
        </section>

        <section class="student-settings-card" id="settings-study">
          <div class="student-settings-heading"><div><h3>${studentSettingsText('Study Preferences')}</h3><p>Set defaults for finding and opening study materials.</p></div></div>
          <form id="studentStudySettingsForm">
            <div class="student-settings-form-grid">
              <label class="student-settings-field">Default Download Preference<select name="downloadPreference"><option value="download" ${preferences.study.downloadPreference === 'download' ? 'selected' : ''}>Download file</option><option value="open" ${preferences.study.downloadPreference === 'open' ? 'selected' : ''}>Open in browser</option></select></label>
              <label class="student-settings-field">Default Branch<input name="defaultBranch" maxlength="100" list="studentBranchOptions" value="${escapeHtml(preferences.study.defaultBranch || '')}" /><datalist id="studentBranchOptions">${[...new Set([user.branch, ...state.browseMaterials.map((item) => item.branch)].filter(Boolean))].map((branch) => `<option value="${escapeHtml(branch)}"></option>`).join('')}</datalist></label>
              <label class="student-settings-field">Default Academic Year<select name="defaultYear"><option value="">No default</option>${['1st Year', '2nd Year', '3rd Year', '4th Year'].map((year) => `<option value="${year}" ${preferences.study.defaultYear === year ? 'selected' : ''}>${year}</option>`).join('')}</select></label>
              <label class="student-settings-field">Default Semester<select name="defaultSemester"><option value="">No default</option>${Array.from({ length: 8 }, (_, index) => `Semester ${index + 1}`).map((semester) => `<option value="${semester}" ${preferences.study.defaultSemester === semester ? 'selected' : ''}>${semester}</option>`).join('')}</select></label>
              <label class="student-settings-field student-settings-subjects">Preferred Subjects<select name="preferredSubjects" multiple size="6" aria-describedby="preferredSubjectsHint">${subjects.map((subject) => `<option value="${escapeHtml(subject)}" ${preferences.study.preferredSubjects.includes(subject) ? 'selected' : ''}>${escapeHtml(subject)}</option>`).join('')}</select><small id="preferredSubjectsHint">Select one or more subjects. Use Ctrl (Windows) or Command (Mac) for multiple selections.</small></label>
            </div>
            <label class="student-settings-check"><input type="checkbox" name="savedNotesFirst" ${preferences.study.savedNotesFirst ? 'checked' : ''} /> Show my saved notes first when browsing approved materials</label>
            <div class="student-settings-actions"><button type="submit" class="primary-btn">${studentSettingsText('Save Changes')}</button><button type="button" class="secondary-btn" data-settings-cancel="preferences">${studentSettingsText('Cancel')}</button><button type="button" class="secondary-btn" data-student-nav="history">${studentSettingsText('Download History')}</button></div>
          </form>
        </section>

        <section class="student-settings-card" id="settings-help">
          <div class="student-settings-heading"><div><h3>${studentSettingsText('Help & Support')}</h3><p>Find answers or send the CampusNotes team a report.</p></div></div>
          <div class="student-help-links">
            <details><summary>Frequently Asked Questions</summary><div class="student-help-copy"><p><strong>Why is my upload not visible?</strong> Student materials remain pending until an administrator reviews them.</p><p><strong>Where can I find downloads?</strong> Open Download History in the student navigation or use the button in Study Preferences.</p><p><strong>How do I update my account?</strong> Edit Personal Information above and save your changes.</p></div></details>
            <details><summary>About CampusNotes</summary><div class="student-help-copy"><p>CampusNotes helps students share academic notes and approved study resources with their campus community.</p></div></details>
            <details><summary>Terms & Conditions</summary><div class="student-help-copy"><p>Use CampusNotes to share lawful, relevant academic materials. Respect the rights and privacy of other students. Uploaded materials are reviewed before they are published.</p></div></details>
            <details><summary>Privacy Policy</summary><div class="student-help-copy"><p>Your account details, saved materials, and download activity are stored to operate your student account. Passwords are stored as hashes and are not displayed. You can request account deletion below; deletion also removes materials you uploaded.</p></div></details>
          </div>
          <form id="studentSupportReportForm" class="student-support-form">
            <h4>${studentSettingsText('Report a Problem')}</h4>
            <div class="student-settings-form-grid">
              <label class="student-settings-field">Issue Title<input name="title" required maxlength="120" /></label>
              <label class="student-settings-field">Issue Category<select name="category" required><option>Account</option><option>Uploads</option><option>Downloads</option><option>Technical issue</option><option>Other</option></select></label>
              <label class="student-settings-field student-settings-full">Issue Description<textarea name="description" rows="4" required minlength="10" maxlength="5000" placeholder="Describe what happened and what you expected."></textarea></label>
            </div>
            <div class="student-settings-actions"><button type="submit" class="primary-btn">${studentSettingsText('Contact Support')}</button><button type="reset" class="secondary-btn">Cancel</button></div>
          </form>
        </section>
      </div>
    </div>
    <dialog class="student-delete-dialog" id="studentDeleteAccountDialog">
      <form id="studentDeleteAccountForm">
        <div class="student-settings-heading"><div><h3>${studentSettingsText('Delete Account')}</h3><p>This permanently deletes your account and the materials you uploaded.</p></div></div>
        <label class="student-settings-field">Current Password<input name="currentPassword" type="password" required autocomplete="current-password" /></label>
        <label class="student-settings-field">Type DELETE to confirm<input name="confirmation" required autocomplete="off" /></label>
        <div class="student-settings-actions"><button type="submit" class="danger-btn">Permanently delete account</button><button type="button" class="secondary-btn" data-close-delete-account>Cancel</button></div>
      </form>
    </dialog>
  `;
  applyStudentPreferences(preferences);
  bindStudentSettingsActions();
}

function bindStudentSettingsActions() {
  const page = document.getElementById('studentSettingsPage');
  if (!page) return;

  page.querySelectorAll('[data-settings-jump]').forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById(button.getAttribute('data-settings-jump'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  page.querySelectorAll('[data-settings-cancel]').forEach((button) => {
    button.addEventListener('click', () => renderStudentSettingsPage());
  });

  const profileForm = page.querySelector('#studentProfileSettingsForm');
  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const profilePicture = form.elements.profilePicture.files[0];
    if (form.elements.phone.value.trim() && !/^\+?[0-9\s().-]{7,20}$/.test(form.elements.phone.value.trim())) {
      showToast('Enter a valid mobile number with 7 to 20 characters.', 'error');
      form.elements.phone.focus();
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Saving...';
    try {
      const response = await apiFetch('/student/settings/profile', {
        method: 'PUT',
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      state.studentSettings.user = response.user;
      state.user = { ...state.user, ...response.user };
      if (profilePicture) {
        const imageData = new FormData();
        imageData.append('profilePicture', profilePicture);
        const pictureResponse = await apiFetch('/student/settings/profile-picture', { method: 'POST', body: imageData });
        state.studentSettings.user.profilePicture = pictureResponse.profilePicture;
        state.user.profilePicture = pictureResponse.profilePicture;
      }
      localStorage.setItem('campusNotesUser', JSON.stringify(state.user));
      showToast('Your profile has been saved.');
      renderStudentDashboard();
    } catch (error) {
      showToast(error.message, 'error');
      submit.disabled = false;
      submit.textContent = studentSettingsText('Save Changes');
    }
  });

  const profilePictureInput = page.querySelector('#studentProfilePicture');
  profilePictureInput?.addEventListener('change', () => {
    const file = profilePictureInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      profilePictureInput.value = '';
      showToast('Choose a JPG, PNG, or WebP image up to 5 MB.', 'error');
      return;
    }
    const preview = page.querySelector('#studentProfilePicturePreview');
    const reader = new FileReader();
    reader.onload = () => {
      preview.innerHTML = `<img src="${escapeHtml(reader.result)}" alt="Profile picture preview" />`;
    };
    reader.readAsDataURL(file);
  });

  const passwordForm = page.querySelector('#studentPasswordSettingsForm');
  passwordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.elements.newPassword.value !== form.elements.confirmPassword.value) {
      showToast('Your new password and confirmation do not match.', 'error');
      form.elements.confirmPassword.focus();
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Saving...';
    try {
      const response = await apiFetch('/student/settings/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: form.elements.currentPassword.value,
          newPassword: form.elements.newPassword.value,
        }),
      });
      form.reset();
      showToast(response.message);
      clearAuthSession();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = studentSettingsText('Change Password');
    }
  });

  page.querySelector('[data-show-passwords]')?.addEventListener('change', (event) => {
    page.querySelectorAll('#studentPasswordSettingsForm input[type="password"], #studentPasswordSettingsForm input[type="text"]')
      .forEach((input) => { input.type = event.currentTarget.checked ? 'text' : 'password'; });
  });

  page.querySelector('#studentNotificationsSettingsForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const notifications = Object.fromEntries([...form.querySelectorAll('input[role="switch"]')].map((input) => [input.name, input.checked]));
    saveStudentPreferenceGroup('notifications', notifications);
  });

  const appearanceForm = page.querySelector('#studentAppearanceSettingsForm');
  appearanceForm?.addEventListener('change', () => {
    const appearance = Object.fromEntries(new FormData(appearanceForm).entries());
    applyStudentPreferences({ ...state.studentSettings.preferences, appearance });
  });
  appearanceForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveStudentPreferenceGroup('appearance', Object.fromEntries(new FormData(appearanceForm).entries()));
  });

  page.querySelector('#studentPrivacySettingsForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveStudentPreferenceGroup('privacy', Object.fromEntries(new FormData(event.currentTarget).entries()));
  });

  page.querySelector('#studentStudySettingsForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const study = Object.fromEntries(new FormData(form).entries());
    study.preferredSubjects = [...form.elements.preferredSubjects.selectedOptions].map((option) => option.value);
    study.savedNotesFirst = form.elements.savedNotesFirst.checked;
    saveStudentPreferenceGroup('study', study);
  });

  page.querySelector('#studentSupportReportForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Sending...';
    try {
      const response = await apiFetch('/student/settings/reports', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      form.reset();
      showToast(response.message);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = studentSettingsText('Contact Support');
    }
  });

  const deleteDialog = page.querySelector('#studentDeleteAccountDialog');
  page.querySelector('[data-open-delete-account]')?.addEventListener('click', () => deleteDialog?.showModal());
  page.querySelector('[data-close-delete-account]')?.addEventListener('click', () => deleteDialog?.close());
  page.querySelector('[data-student-signout]')?.addEventListener('click', () => {
    if (window.confirm('Sign out of this CampusNotes session?')) clearAuthSession();
  });
  page.querySelector('#studentDeleteAccountForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.elements.confirmation.value.trim() !== 'DELETE') {
      showToast('Type DELETE exactly to confirm account removal.', 'error');
      form.elements.confirmation.focus();
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Deleting...';
    try {
      const response = await apiFetch('/student/settings/account', {
        method: 'DELETE',
        body: JSON.stringify({
          currentPassword: form.elements.currentPassword.value,
          confirmation: form.elements.confirmation.value.trim(),
        }),
      });
      showToast(response.message);
      clearAuthSession();
    } catch (error) {
      showToast(error.message, 'error');
      submit.disabled = false;
      submit.textContent = 'Permanently delete account';
    }
  });
}

async function saveStudentPreferenceGroup(group, values) {
  const preferences = JSON.parse(JSON.stringify(state.studentSettings.preferences));
  preferences[group] = values;
  const formId = {
    notifications: 'studentNotificationsSettingsForm',
    appearance: 'studentAppearanceSettingsForm',
    privacy: 'studentPrivacySettingsForm',
    study: 'studentStudySettingsForm',
  }[group];
  const submit = document.querySelector(`#${formId} button[type="submit"]`);
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Saving...';
  }
  try {
    const response = await apiFetch('/student/settings/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    });
    state.studentSettings.preferences = response.preferences;
    applyStudentPreferences(response.preferences);
    showToast(response.message);
    if (group === 'appearance') renderStudentDashboard();
    else renderStudentSettingsPage();
  } catch (error) {
    applyStudentPreferences();
    renderStudentSettingsPage();
    showToast(error.message, 'error');
  }
}

function bindStudentActions() {
  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fileInput = uploadForm.elements.file;
      const file = fileInput.files[0];
      if (!file || (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf'))) {
        showToast('Choose a PDF study material to upload.', 'error');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        showToast('PDF uploads are limited to 25 MB.', 'error');
        return;
      }

      const submitButton = uploadForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Uploading...';
      const formData = new FormData(uploadForm);

      try {
        const response = await fetch('/api/materials', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${state.token}`,
          },
          body: formData,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || 'Upload failed.');
        }

        showToast(payload.message || 'Upload submitted successfully.');
        state.studentView = 'my-uploads';
        renderStudentDashboard();
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        if (submitButton.isConnected) {
          submitButton.disabled = false;
          submitButton.textContent = 'Submit Material';
        }
      }
    });
  }

  const browseSearch = document.getElementById('browseSearch');
  if (browseSearch) {
    browseSearch.addEventListener('input', () => {
      state.studentSearch = browseSearch.value;
      renderMaterialCards();
    });
  }

  ['filterBranch', 'filterYear', 'filterSemester', 'filterSubject'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        if (id === 'filterYear' || id === 'filterSemester') {
          populateBrowseSubjectFilter();
        }
        renderMaterialCards();
      });
    }
  });

  const sortMaterials = document.getElementById('sortMaterials');
  if (sortMaterials) {
    sortMaterials.addEventListener('change', renderMaterialCards);
  }

  const uploadYear = document.getElementById('uploadYear');
  const uploadSemester = document.getElementById('uploadSemester');
  if (uploadYear && uploadSemester) {
    [uploadYear, uploadSemester].forEach((el) => {
      el.addEventListener('change', populateUploadSubjectOptions);
    });
    populateUploadSubjectOptions();
  }

  if (viewIsLoaded('browse')) {
    populateBrowseSubjectFilter();
    loadBrowseMaterials();
  }
  if (viewIsLoaded('my-uploads')) {
    loadStudentUploads();
  }
  if (viewIsLoaded('saved')) {
    const list = document.getElementById('savedMaterialsList');
    if (list) list.innerHTML = '<div class="student-loading">Loading your saved notes...</div>';
    loadStudentSavedMaterials();
  }
  if (viewIsLoaded('history')) {
    loadStudentDownloadHistory();
  }
  if (viewIsLoaded('dashboard')) {
    loadStudentDashboard();
  }
}

function viewIsLoaded(viewName) {
  return state.studentView === viewName;
}

function setStudentView(view) {
  state.studentView = view;
  renderStudentDashboard();
}

async function loadDashboardCounts() {
  return loadStudentDashboard();
}

async function loadStudentDashboard() {
  try {
    const [materials, uploads, downloads, savedMaterials] = await Promise.all([
      apiFetch('/materials'),
      apiFetch('/my-materials'),
      apiFetch('/my-downloads'),
      apiFetch('/my-saved-materials'),
    ]);
    state.browseMaterials = materials.filter((item) => item.status === 'Approved');
    state.studentUploads = uploads;
    state.studentDownloads = downloads;
    state.studentSavedMaterials = savedMaterials;
    state.savedMaterials = savedMaterials.map((item) => Number(item.id));

    const legacySavedIds = JSON.parse(localStorage.getItem('campusNotesSaved') || '[]')
      .map(Number)
      .filter((id) => state.browseMaterials.some((item) => Number(item.id) === id));
    const savedIds = new Set(state.savedMaterials);
    for (const id of legacySavedIds) {
      if (savedIds.has(id)) continue;
      await apiFetch(`/materials/${id}/save`, {
        method: 'PUT',
        body: JSON.stringify({ saved: true }),
      });
    }
    if (legacySavedIds.some((id) => !savedIds.has(id))) {
      state.studentSavedMaterials = await apiFetch('/my-saved-materials');
      state.savedMaterials = state.studentSavedMaterials.map((item) => Number(item.id));
    }
    localStorage.setItem('campusNotesSaved', JSON.stringify(state.savedMaterials));

    const pending = uploads.filter((item) => item.status === 'Pending').length;
    const counts = {
      studentAvailableCount: state.browseMaterials.length,
      studentUploadsCount: uploads.length,
      studentPendingCount: pending,
      studentSavedCount: state.studentSavedMaterials.length,
    };
    Object.entries(counts).forEach(([id, count]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = count.toLocaleString();
    });

    const notification = document.getElementById('studentNotificationCount');
    if (notification) {
      notification.textContent = String(pending);
      notification.hidden = pending === 0;
    }

    renderStudentDashboardData();
    const errorBanner = document.getElementById('studentDashboardError');
    if (errorBanner) errorBanner.hidden = true;
  } catch (error) {
    const errorBanner = document.getElementById('studentDashboardError');
    if (errorBanner) {
      errorBanner.innerHTML = `${escapeHtml(error.message)} <button type="button" class="secondary-btn small-btn" onclick="loadStudentDashboard()">Try again</button>`;
      errorBanner.hidden = false;
    }
    const containers = ['studentSubjectCategories', 'studentRecentNotes', 'studentRecentUploads', 'studentRecentActivity'];
    containers.forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.innerHTML = `<div class="student-error" role="alert">${escapeHtml(error.message)} <button type="button" class="secondary-btn small-btn" onclick="loadStudentDashboard()">Try again</button></div>`;
    });
  }
}

function renderStudentDashboardData() {
  const categories = document.getElementById('studentSubjectCategories');
  if (categories) {
    const counts = new Map();
    state.browseMaterials.forEach((material) => {
      if (material.subject) counts.set(material.subject, (counts.get(material.subject) || 0) + 1);
    });
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
    categories.innerHTML = entries.length ? entries.map(([subject, count], index) => `
      <button type="button" class="student-subject-card" data-subject-search="${escapeHtml(subject)}">
        <span class="subject-icon subject-icon-${index % 4}" aria-hidden="true">${escapeHtml(subject.trim().charAt(0).toUpperCase())}</span>
        <span><strong>${escapeHtml(subject)}</strong><small>${count} ${count === 1 ? 'note' : 'notes'}</small></span>
        <span class="subject-arrow" aria-hidden="true">→</span>
      </button>
    `).join('') : '<div class="student-empty">Approved subject notes will appear here when available.</div>';
    categories.querySelectorAll('[data-subject-search]').forEach((button) => {
      button.addEventListener('click', () => {
        state.studentSearch = button.getAttribute('data-subject-search');
        setStudentView('browse');
      });
    });
  }

  const recentNotes = document.getElementById('studentRecentNotes');
  if (recentNotes) {
    const notes = [...state.browseMaterials].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(0, 3);
    recentNotes.innerHTML = notes.length ? notes.map((item) => `
      <article class="student-note-card">
        <div class="student-pdf-preview"><span aria-hidden="true">${/\.pdf$/i.test(item.fileUrl || '') ? 'PDF' : 'NOTE'}</span><small>${escapeHtml(item.materialType || 'Study material')}</small></div>
        <div class="student-note-body">
          <div class="student-note-meta"><span>${escapeHtml(item.subject)}</span><span>${new Date(item.uploadedAt).toLocaleDateString()}</span></div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>Shared by ${escapeHtml(item.uploadedByName || (item.uploadedByRole === 'teacher' ? 'Teacher' : 'Student'))}</p>
          <div class="student-note-footer">
            <span class="student-note-branch">${escapeHtml(item.branch || 'CampusNotes')} · ${escapeHtml(item.semester || '')}</span>
            ${item.fileUrl && item.materialType !== 'Lecture Video'
              ? `<button type="button" class="primary-btn small-btn" data-download-material="${item.id}">Download</button>`
              : item.videoUrl
                ? `<a class="primary-btn small-btn" href="${escapeHtml(item.videoUrl)}" target="_blank" rel="noopener noreferrer">Open</a>`
                : ''}
          </div>
        </div>
      </article>
    `).join('') : '<div class="student-empty">There are no approved notes to show yet. Try exploring again later.</div>';
  }

  const uploads = document.getElementById('studentRecentUploads');
  if (uploads) {
    const recent = [...state.studentUploads].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(0, 4);
    uploads.innerHTML = recent.length ? recent.map((item) => `
      <div class="student-upload-row">
        <span class="student-upload-file" aria-hidden="true">PDF</span>
        <span class="student-upload-info"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subject)} · ${new Date(item.uploadedAt).toLocaleDateString()}</small></span>
        <span class="student-status-badge ${escapeHtml(String(item.status).toLowerCase())}">${escapeHtml(item.status)}</span>
      </div>
    `).join('') : '<div class="student-empty">You have not uploaded any notes yet. Share your first PDF when you are ready.</div>';
  }

  const savedPreview = document.getElementById('studentSavedPreview');
  if (savedPreview) {
    const saved = state.studentSavedMaterials.slice(0, 3);
    savedPreview.innerHTML = saved.length ? saved.map((item) => `
      <article class="student-saved-row">
        <span class="student-upload-file" aria-hidden="true">PDF</span>
        <span class="student-upload-info"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subject)} · ${escapeHtml(item.semester || '')}</small></span>
        <button type="button" class="secondary-btn small-btn" onclick="setStudentView('saved')">Open</button>
      </article>
    `).join('') : '<div class="student-empty">Your saved notes will appear here.</div>';
  }

  renderStudentRecentActivity();
}

function renderStudentRecentActivity() {
  const list = document.getElementById('studentRecentActivity');
  if (!list) return;
  const activities = [
    ...state.studentDownloads.map((item) => ({
      type: 'download',
      title: item.title,
      detail: item.subject,
      timestamp: item.downloadedAt,
    })),
    ...state.savedActivity.map((item) => ({
      type: item.action === 'removed' ? 'removed' : 'saved',
      title: item.title || 'Study material',
      detail: item.action === 'removed' ? 'Removed from saved notes' : 'Added to saved notes',
      timestamp: item.at,
    })),
    ...state.studentSavedMaterials.map((item) => ({
      type: 'saved',
      title: item.title,
      detail: 'Saved to your notes',
      timestamp: item.savedAt,
    })),
    ...state.studentUploads.map((item) => ({
      type: 'upload',
      title: item.title,
      detail: `Upload ${String(item.status || 'pending').toLowerCase()}`,
      timestamp: item.uploadedAt,
    })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 6);

  list.innerHTML = activities.length ? activities.map((item) => `
    <div class="student-activity-row">
      <span class="student-activity-icon ${item.type}" aria-hidden="true">${item.type === 'download' ? '↓' : item.type === 'upload' ? '↑' : '♡'}</span>
      <span class="student-activity-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span>
      <time>${new Date(item.timestamp).toLocaleDateString()}</time>
    </div>
  `).join('') : '<div class="student-empty">Your downloads, saved notes and upload updates will appear here.</div>';
}

async function loadBrowseMaterials() {
  const list = document.getElementById('materialsList');
  if (list) list.innerHTML = '<div class="student-loading">Loading approved notes...</div>';
  try {
    const materials = await apiFetch('/materials');
    state.browseMaterials = materials.filter((item) => item.status === 'Approved');
    populateActualBrowseFilters();
    const study = state.studentSettings?.preferences?.study;
    const branchFilter = document.getElementById('filterBranch');
    const yearFilter = document.getElementById('filterYear');
    const semesterFilter = document.getElementById('filterSemester');
    if (branchFilter && !branchFilter.value && study?.defaultBranch) {
      if (![...branchFilter.options].some((option) => option.value === study.defaultBranch)) {
        const preferredBranch = document.createElement('option');
        preferredBranch.value = study.defaultBranch;
        preferredBranch.textContent = study.defaultBranch;
        branchFilter.append(preferredBranch);
      }
      branchFilter.value = study.defaultBranch;
    }
    if (yearFilter && !yearFilter.value && study?.defaultYear) yearFilter.value = study.defaultYear;
    if (semesterFilter && !semesterFilter.value && study?.defaultSemester) semesterFilter.value = study.defaultSemester;
    populateBrowseSubjectFilter();
    renderMaterialCards();
    if (viewIsLoaded('saved')) renderSavedMaterials();
  } catch (error) {
    if (list) list.innerHTML = `<div class="student-error" role="alert">${escapeHtml(error.message)} <button type="button" class="secondary-btn small-btn" onclick="loadBrowseMaterials()">Try again</button></div>`;
    showToast(error.message, 'error');
  }
}

function populateBrowseSubjectFilter() {
  const yearEl = document.getElementById('filterYear');
  const semesterEl = document.getElementById('filterSemester');
  const subjectEl = document.getElementById('filterSubject');
  if (!yearEl || !semesterEl || !subjectEl) return;

  const selectedYear = yearEl.value;
  const selectedSemester = semesterEl.value;

  if (!selectedYear || !selectedSemester) {
    subjectEl.innerHTML = '<option value="">Select year and semester first</option>';
    subjectEl.disabled = true;
    return;
  }

  const subjects = [...new Set([
    ...(SUBJECT_CATALOG[selectedYear]?.[selectedSemester] || []),
    ...state.browseMaterials
      .filter((item) => item.year === selectedYear && item.semester === selectedSemester)
      .map((item) => item.subject)
      .filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b));

  subjectEl.innerHTML = ['<option value="">All subjects</option>', ...subjects.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)].join('');
  subjectEl.disabled = subjects.length === 0;
}

function populateUploadSubjectOptions() {
  const yearEl = document.getElementById('uploadYear');
  const semesterEl = document.getElementById('uploadSemester');
  const subjectEl = document.getElementById('uploadSubject');
  if (!yearEl || !semesterEl || !subjectEl) return;

  const selectedYear = yearEl.value;
  const selectedSemester = semesterEl.value;

  if (!selectedYear || !selectedSemester) {
    subjectEl.innerHTML = '<option value="">Select year and semester first</option>';
    subjectEl.disabled = true;
    return;
  }

  const subjectOptions = (SUBJECT_CATALOG[selectedYear]?.[selectedSemester] || [])
    .filter((subject) => IT_AI_SUBJECTS.has(subject));
  subjectEl.innerHTML = ['<option value="">Select subject</option>', ...subjectOptions.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)].join('');
  subjectEl.disabled = false;
}

function renderMaterialCards() {
  const list = document.getElementById('materialsList');
  if (!list) return;

  const search = document.getElementById('browseSearch')?.value.toLowerCase() || '';
  const branch = document.getElementById('filterBranch')?.value || '';
  const year = document.getElementById('filterYear')?.value || '';
  const semester = document.getElementById('filterSemester')?.value || '';
  const subject = document.getElementById('filterSubject')?.value || '';

  const filtered = state.browseMaterials.filter((item) => {
    const matchesSearch = !search || [item.title, item.subject, item.branch, item.materialType, item.uploadedByName].join(' ').toLowerCase().includes(search);
    const matchesBranch = !branch || item.branch === branch;
    const matchesYear = !year || item.year === year;
    const matchesSemester = !semester || item.semester === semester;
    const matchesSubject = !subject || item.subject === subject;
    return matchesSearch && matchesBranch && matchesYear && matchesSemester && matchesSubject;
  });
  const sorted = [...filtered];
  const preferredSubjects = state.studentSettings?.preferences?.study?.preferredSubjects || [];
  const savedNotesFirst = state.studentSettings?.preferences?.study?.savedNotesFirst;
  if (savedNotesFirst || preferredSubjects.length) {
    sorted.sort((a, b) => {
      const savedPriority = savedNotesFirst
        ? Number(state.savedMaterials.includes(Number(b.id))) - Number(state.savedMaterials.includes(Number(a.id)))
        : 0;
      const subjectPriority = Number(preferredSubjects.includes(b.subject)) - Number(preferredSubjects.includes(a.subject));
      return savedPriority || subjectPriority || new Date(b.uploadedAt) - new Date(a.uploadedAt);
    });
  }
  if (document.getElementById('sortMaterials')?.value !== 'newest') {
    sorted.sort((a, b) =>
      Number(b.averageRating || 0) - Number(a.averageRating || 0)
      || Number(b.ratingCount || 0) - Number(a.ratingCount || 0)
      || new Date(b.uploadedAt) - new Date(a.uploadedAt)
    );
  } else {
    sorted.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  if (!sorted.length) {
    list.innerHTML = `
      <div class="empty-state">
        <h3>📚 No study materials available yet.</h3>
        <p>Approved notes and lecture videos shared by your teachers and classmates will appear here.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = sorted.map((item) => {
    const saved = state.savedMaterials.includes(item.id);
    const canRate = item.materialType === 'Subject Notes'
      && !(item.uploadedByRole === 'student' && Number(item.uploadedBy) === Number(state.user?.id));
    return `
      <article class="material-card">
        <div class="material-top">
          <div class="status-row">
            <h4>${escapeHtml(item.title)}</h4>
            <span class="badge approved">Approved</span>
          </div>
          <div class="material-meta">
            <span>${escapeHtml(item.subject)}</span>
            <span>•</span>
            <span>${escapeHtml(item.branch)}</span>
            <span>•</span>
            <span>${escapeHtml(item.semester)}</span>
          </div>
        </div>
        <div class="material-body">
          <p>${escapeHtml(item.description || 'No description available.')}</p>
          <div class="material-meta">
            <span>Type: ${escapeHtml(item.materialType)}</span>
            <span>•</span>
            <span>By: ${escapeHtml(item.uploadedByName || (item.uploadedByRole === 'teacher' ? 'Teacher' : 'Student'))}</span>
          </div>
          ${item.materialType === 'Subject Notes' ? `
            <div class="rating-summary">
              <strong>★ ${Number(item.averageRating || 0).toFixed(1)}</strong>
              <span>${Number(item.ratingCount || 0) ? `${item.ratingCount} ${Number(item.ratingCount) === 1 ? 'rating' : 'ratings'}` : 'Not rated yet'}</span>
            </div>
            ${canRate ? `
              <div class="note-rating" role="group" aria-label="Rate these notes from 1 to 5 stars">
                <span>Your rating</span>
                ${[1, 2, 3, 4, 5].map((rating) => `
                  <button class="rating-star ${rating <= Number(item.myRating || 0) ? 'selected' : ''}"
                    type="button" data-rate-material="${item.id}" data-rating="${rating}"
                    aria-label="Rate ${rating} out of 5 stars" aria-pressed="${Number(item.myRating || 0) === rating}">★</button>
                `).join('')}
              </div>
            ` : ''}
          ` : ''}
          ${item.materialType === 'Lecture Video' && item.fileUrl
            ? `<video class="material-video" controls preload="metadata" src="${escapeHtml(item.fileUrl)}">Your browser does not support video playback.</video>`
            : ''}
          <div class="material-footer">
            <small>${new Date(item.uploadedAt).toLocaleDateString()}</small>
            <div class="actions">
              ${item.videoUrl
                ? `<a class="primary-btn small-btn" href="${escapeHtml(item.videoUrl)}" target="_blank" rel="noopener noreferrer">Watch lecture</a>`
                : item.fileUrl
                  ? item.materialType === 'Lecture Video'
                    ? `<a class="primary-btn small-btn" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener noreferrer">Open video</a>`
                    : `<button type="button" class="primary-btn small-btn" data-download-material="${item.id}">Download</button>`
                  : ''}
              <button type="button" class="secondary-btn small-btn" data-save-material="${item.id}">${saved ? 'Saved' : 'Save'}</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('[data-save-material]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.getAttribute('data-save-material'));
      const material = state.browseMaterials.find((item) => Number(item.id) === id);
      await toggleSavedMaterial(id, material?.title);
      renderMaterialCards();
      if (viewIsLoaded('dashboard')) {
        updateStudentSavedCount();
        renderStudentDashboardData();
      }
    });
  });
  bindMaterialRatingButtons();
}

function bindMaterialRatingButtons() {
  document.querySelectorAll('[data-rate-material]').forEach((button) => {
    button.addEventListener('click', async () => {
      const materialId = Number(button.getAttribute('data-rate-material'));
      const rating = Number(button.getAttribute('data-rating'));
      try {
        const response = await apiFetch(`/materials/${materialId}/rating`, {
          method: 'PUT',
          body: JSON.stringify({ rating }),
        });
        showToast(response.message);
        await loadBrowseMaterials();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  });
}

async function loadStudentUploads() {
  try {
    const list = document.getElementById('myUploadsList');
    if (list) list.innerHTML = '<div class="student-loading">Loading your uploads...</div>';
    const uploads = await apiFetch('/my-materials');
    state.studentUploads = uploads;
    if (!list) return;

    if (!uploads.length) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>📂 You haven't uploaded any materials yet.</h3>
          <p>Your approved, pending, and rejected files will appear here.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = `
      <div class="table-wrap">
        <table class="student-data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Subject</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${uploads.map((item) => `
              <tr>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.subject)}</td>
                <td>${new Date(item.uploadedAt).toLocaleDateString()}</td>
                <td><span class="badge ${item.status.toLowerCase()}">${item.status}</span></td>
                <td>
                  ${item.fileUrl ? `<a class="secondary-btn small-btn" href="${item.fileUrl}" target="_blank">Download</a>` : ''}
                  ${item.rejectionReason ? `<small>${escapeHtml(item.rejectionReason)}</small>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    const list = document.getElementById('myUploadsList');
    if (list) list.innerHTML = `<div class="student-error" role="alert">${escapeHtml(error.message)} <button type="button" class="secondary-btn small-btn" onclick="loadStudentUploads()">Try again</button></div>`;
    showToast(error.message, 'error');
  }
}

async function loadStudentDownloadHistory() {
  const list = document.getElementById('studentDownloadHistory');
  if (!list) return;
  list.innerHTML = '<div class="student-loading">Loading your download history...</div>';
  try {
    const downloads = await apiFetch('/my-downloads');
    state.studentDownloads = downloads;
    if (!downloads.length) {
      list.innerHTML = '<div class="empty-state"><h3>No downloads yet</h3><p>Download an approved note from Explore Notes and it will appear here.</p><button type="button" class="primary-btn small-btn" data-student-nav="browse">Explore notes</button></div>';
      return;
    }

    list.innerHTML = downloads.map((item) => `
      <article class="student-download-row">
        <span class="student-upload-file" aria-hidden="true">PDF</span>
        <span class="student-upload-info"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subject)} · ${escapeHtml(item.branch || '')} · ${escapeHtml(item.semester || '')}</small></span>
        <time>${new Date(item.downloadedAt).toLocaleString()}</time>
        <button type="button" class="primary-btn small-btn" data-download-material="${item.materialId}">Download again</button>
      </article>
    `).join('');
  } catch (error) {
    list.innerHTML = `<div class="student-error" role="alert">${escapeHtml(error.message)} <button type="button" class="secondary-btn small-btn" onclick="loadStudentDownloadHistory()">Try again</button></div>`;
  }
}

async function loadStudentSavedMaterials() {
  const list = document.getElementById('savedMaterialsList');
  if (!list) return;
  list.innerHTML = '<div class="student-loading">Loading your saved notes...</div>';
  try {
    state.studentSavedMaterials = await apiFetch('/my-saved-materials');
    state.savedMaterials = state.studentSavedMaterials.map((item) => Number(item.id));
    localStorage.setItem('campusNotesSaved', JSON.stringify(state.savedMaterials));
    renderSavedMaterials();
  } catch (error) {
    list.innerHTML = `<div class="student-error" role="alert">${escapeHtml(error.message)} <button type="button" class="secondary-btn small-btn" onclick="loadStudentSavedMaterials()">Try again</button></div>`;
  }
}

function renderSavedMaterials() {
  const list = document.getElementById('savedMaterialsList');
  if (!list) return;

  const saved = state.studentSavedMaterials;
  if (!saved.length) {
    list.innerHTML = `
      <div class="empty-state">
        <h3>💙 No saved materials yet.</h3>
        <p>Bookmarks will appear here when you save study materials.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = saved.map((item) => `
    <div class="material-card">
      <div class="material-top">
        <h4>${escapeHtml(item.title)}</h4>
        <div class="material-meta">
          <span>${escapeHtml(item.subject)}</span>
          <span>•</span>
          <span>${escapeHtml(item.branch)}</span>
        </div>
      </div>
      <div class="material-body">
        ${item.materialType === 'Lecture Video' && item.fileUrl
          ? `<video class="material-video" controls preload="metadata" src="${escapeHtml(item.fileUrl)}">Your browser does not support video playback.</video>`
          : ''}
        <div class="material-footer">
          <small>${new Date(item.uploadedAt).toLocaleDateString()}</small>
          <div class="actions">
            ${item.videoUrl
              ? `<a class="primary-btn small-btn" href="${escapeHtml(item.videoUrl)}" target="_blank" rel="noopener noreferrer">Watch lecture</a>`
              : item.fileUrl
                ? item.materialType === 'Lecture Video'
                  ? `<a class="primary-btn small-btn" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener noreferrer">Open video</a>`
                  : `<button type="button" class="primary-btn small-btn" data-download-material="${item.id}">Download</button>`
                : ''}
            <button class="ghost-btn small-btn" data-remove-saved="${item.id}">Remove</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('[data-remove-saved]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.getAttribute('data-remove-saved'));
      const material = state.studentSavedMaterials.find((item) => Number(item.id) === id);
      const saved = await toggleSavedMaterial(id, material?.title);
      if (!saved) return;
      updateStudentSavedCount();
      renderSavedMaterials();
    });
  });
}

function updateStudentSavedCount() {
  const count = document.getElementById('studentSavedCount');
  if (count) count.textContent = state.savedMaterials.length.toLocaleString();
}

async function toggleSavedMaterial(id, title = '') {
  const existing = state.savedMaterials.includes(id);
  try {
    const response = await apiFetch(`/materials/${id}/save`, {
      method: 'PUT',
      body: JSON.stringify({ saved: !existing }),
    });
    state.studentSavedMaterials = await apiFetch('/my-saved-materials');
    state.savedMaterials = state.studentSavedMaterials.map((item) => Number(item.id));
    state.savedActivity = [{
      id,
      title: title || state.studentSavedMaterials.find((item) => Number(item.id) === id)?.title,
      action: existing ? 'removed' : 'saved',
      at: new Date().toISOString(),
    }, ...state.savedActivity].slice(0, 30);
    localStorage.setItem('campusNotesSaved', JSON.stringify(state.savedMaterials));
    localStorage.setItem('campusNotesSavedActivity', JSON.stringify(state.savedActivity));
    showToast(response.message);
    renderStudentRecentActivity();
    return true;
  } catch (error) {
    showToast(error.message, 'error');
    return false;
  }
}

function escapeHtml(input) {
  return String(input || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function renderAdminDashboard() {
  const view = state.adminView || 'dashboard';
  const userName = state.user?.name || 'Administrator';
  const views = {
    dashboard: ['Dashboard Overview', 'Your CampusNotes moderation and resource activity at a glance.'],
    students: ['Students Management', 'Review student accounts and registration details.'],
    pending: ['Pending Notes Approval', 'Preview submissions and review materials before publishing.'],
    materials: ['All Study Materials', 'Search, filter, and manage submitted learning resources.'],
    approved: ['Approved Notes', 'Materials currently available to students.'],
    rejected: ['Rejected Notes', 'Review rejected materials and their moderation status.'],
    catalog: ['Subjects and Semesters', 'Explore subjects and semesters represented in shared materials.'],
    reports: ['Reports and Analytics', 'Recent registrations, uploads, and most-downloaded resources.'],
    permission: ['Upload Settings', 'Control whether students can submit new study materials.'],
    logs: ['Activity Logs', 'Recent moderation and account activity.'],
    settings: ['Settings', 'Manage your dashboard appearance and platform controls.'],
  };
  const [pageTitle, pageDescription] = views[view] || views.dashboard;

  renderShell(`
    <div class="portal-shell admin-shell" data-theme="${state.adminTheme || 'light'}">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">N</div>
          <div class="brand-text">
            <span>CampusNotes</span>
            <small>Learning Resources</small>
          </div>
        </div>
        <nav class="sidebar-nav">
          ${['dashboard','students','pending','materials','approved','rejected','catalog','reports','permission','settings','logs'].map((item) => {
            const labels = {
              dashboard: ['▦', 'Dashboard Overview'],
              students: ['♙', 'Students Management'],
              pending: ['◷', 'Pending Notes Approval'],
              materials: ['▤', 'All Study Materials'],
              approved: ['✓', 'Approved Notes'],
              rejected: ['×', 'Rejected Notes'],
              catalog: ['⌘', 'Subjects & Semesters'],
              reports: ['▥', 'Reports & Analytics'],
              permission: ['⇧', 'Upload Settings'],
              settings: ['⚙', 'Settings'],
              logs: ['≡', 'Activity Logs'],
            };
            return `<button class="nav-item ${view === item ? 'active' : ''}" data-admin-nav="${item}" ${view === item ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${labels[item][0]}</span><span>${labels[item][1]}</span></button>`;
          }).join('')}
          <button class="nav-item" data-logout="admin"><span class="nav-icon" aria-hidden="true">↪</span><span>Log out</span></button>
        </nav>
      </aside>
      <main class="portal-main">
        <div class="page-header">
          <div>
            <div class="admin-eyebrow">CampusNotes Administration</div>
            <h1>${pageTitle}</h1>
            <p class="page-description">${pageDescription}</p>
          </div>
          <div class="meta">
            <button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch color theme">${state.adminTheme === 'dark' ? '☀ Light mode' : '◐ Dark mode'}</button>
            <div class="user-chip"><span class="user-avatar">${escapeHtml(userName.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(userName)}</strong><small>Administrator</small></span></div>
          </div>
        </div>
        ${getAdminViewMarkup(view)}
      </main>
    </div>
  `);

  bindAdminActions();
}

function getAdminViewMarkup(view) {
  switch (view) {
    case 'pending':
      return `
        <section class="admin-panel">
          <div class="admin-section-heading">
            <div><h2>Awaiting review</h2><p>Check document details and approve only relevant academic resources.</p></div>
            <button class="secondary-btn small-btn" onclick="loadPendingApprovals()">Refresh list</button>
          </div>
          <div id="pendingTable"></div>
        </section>
      `;
    case 'materials':
    case 'approved':
    case 'rejected': {
      const filter = view === 'approved' ? 'Approved' : view === 'rejected' ? 'Rejected' : 'all';
      const heading = view === 'approved' ? 'Published materials' : view === 'rejected' ? 'Rejected submissions' : 'All submitted materials';
      return `
        <section class="admin-panel">
          <div class="admin-section-heading">
            <div><h2>${heading}</h2><p>Filter study resources by title, subject, branch, or semester.</p></div>
            <button class="secondary-btn small-btn" onclick="loadAllMaterials('${filter}')">Refresh list</button>
          </div>
          <div id="materialsTable"></div>
        </section>
      `;
    }
    case 'students':
      return `
        <section class="admin-panel">
          <div class="admin-section-heading">
            <div><h2>Registered students</h2><p>Search student records and manage account access.</p></div>
            <button class="secondary-btn small-btn" onclick="loadStudentsList()">Refresh</button>
          </div>
          <div id="studentsTable"></div>
        </section>
      `;
    case 'permission':
      return `
        <section class="admin-panel">
          <div class="admin-section-heading"><div><h2>Student upload permission</h2><p>Submissions remain subject to administrator approval.</p></div></div>
          <div id="uploadPermissionBox"></div>
        </section>
      `;
    case 'catalog':
      return `
        <section class="admin-panel">
          <div class="admin-section-heading"><div><h2>Academic resource catalog</h2><p>Subjects and semesters are derived from material records already in CampusNotes.</p></div>
            <button class="secondary-btn small-btn" onclick="loadCatalog()">Refresh</button>
          </div>
          <div id="catalogGrid" class="catalog-grid"></div>
        </section>
      `;
    case 'reports':
      return `
        <div id="reportsContent"></div>
      `;
    case 'logs':
      return `
        <section class="admin-panel">
          <div class="admin-section-heading">
            <div><h2>Recent activity</h2><p>Latest account and moderation events.</p></div>
            <button class="secondary-btn small-btn" onclick="loadLogs()">Refresh</button>
          </div>
          <div id="logsTable"></div>
        </section>
      `;
    case 'settings':
      return `
        <section class="admin-panel settings-panel">
          <div class="admin-section-heading"><div><h2>Appearance</h2><p>Choose the dashboard theme for this browser.</p></div></div>
          <button class="secondary-btn" data-theme-toggle>${state.adminTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</button>
          <div class="admin-section-heading settings-subheading"><div><h2>Student submissions</h2><p>Enable or pause new student material uploads.</p></div></div>
          <div id="settingsUploadControl"></div>
        </section>
      `;
    default:
      return `
        <div class="stats-grid admin-stats-grid">
          ${[
            ['totalStudents', 'Registered students', '♙', 'students'],
            ['totalMaterials', 'Uploaded materials', '▤', 'materials'],
            ['pendingMaterials', 'Pending approvals', '◷', 'pending'],
            ['approvedMaterials', 'Approved materials', '✓', 'approved'],
            ['rejectedMaterials', 'Rejected materials', '×', 'rejected'],
            ['totalDownloads', 'Study material downloads', '↓', 'reports'],
          ].map(([key, label, icon, target]) => `
            <button class="stat-card admin-stat-card stat-${key}" data-admin-nav="${target}">
              <span class="stat-icon" aria-hidden="true">${icon}</span>
              <span class="label">${label}</span>
              <strong id="stat-${key}">—</strong>
              <span class="stat-link">View details <span aria-hidden="true">→</span></span>
            </button>
          `).join('')}
        </div>
        <div class="admin-overview-grid">
          <section class="admin-panel">
            <div class="admin-section-heading"><div><h2>Platform activity</h2><p>Student registrations and material uploads · last 7 days</p></div></div>
            <div id="overviewActivity" class="activity-chart"></div>
          </section>
          <section class="admin-panel">
            <div class="admin-section-heading"><div><h2>Most downloaded</h2><p>Popular approved study resources</p></div></div>
            <div id="overviewTopDownloads" class="top-downloads"></div>
          </section>
        </div>
      `;
  }
}

function bindAdminActions() {
  document.querySelectorAll('[data-admin-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-admin-nav');
      state.adminView = next;
      renderAdminDashboard();
    });
  });

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      state.adminTheme = state.adminTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('campusNotesAdminTheme', state.adminTheme);
      renderAdminDashboard();
    });
  });

  if (state.adminView === 'dashboard') {
    loadAdminStats();
  }
  if (state.adminView === 'pending') {
    loadPendingApprovals();
  }
  if (state.adminView === 'materials') {
    loadAllMaterials('all');
  }
  if (state.adminView === 'approved') {
    loadAllMaterials('Approved');
  }
  if (state.adminView === 'rejected') {
    loadAllMaterials('Rejected');
  }
  if (state.adminView === 'students') {
    loadStudentsList();
  }
  if (state.adminView === 'permission') {
    loadUploadPermission();
  }
  if (state.adminView === 'logs') {
    loadLogs();
  }
  if (state.adminView === 'catalog') {
    loadCatalog();
  }
  if (state.adminView === 'reports') {
    loadAnalytics();
  }
  if (state.adminView === 'settings') {
    loadSettingsUploadControl();
  }
}

async function loadAdminStats() {
  try {
    const stats = await apiFetch('/dashboard/stats');
    for (const [key, value] of Object.entries(stats)) {
      const node = document.getElementById(`stat-${key}`);
      if (node) node.textContent = Number(value).toLocaleString();
    }
    loadAnalytics();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderActivityChart(container, analytics) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      key,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      registrations: Number(analytics.registrations.find((item) => item.date === key)?.count || 0),
      uploads: Number(analytics.uploads.find((item) => item.date === key)?.count || 0),
    };
  });
  const max = Math.max(1, ...days.flatMap((day) => [day.registrations, day.uploads]));
  container.innerHTML = `
    <div class="chart-legend"><span><i class="legend-dot registrations"></i>Registrations</span><span><i class="legend-dot uploads"></i>Uploads</span></div>
    <div class="chart-bars">${days.map((day) => `
      <div class="chart-day" aria-label="${day.label}: ${day.registrations} registrations, ${day.uploads} uploads">
        <div class="bar-pair">
          <span class="chart-bar registrations" style="height:${Math.max(3, day.registrations / max * 100)}%" title="${day.registrations} registrations"></span>
          <span class="chart-bar uploads" style="height:${Math.max(3, day.uploads / max * 100)}%" title="${day.uploads} uploads"></span>
        </div>
        <small>${day.label}</small>
      </div>
    `).join('')}</div>
  `;
}

function renderTopDownloads(container, materials) {
  container.innerHTML = materials.length ? materials.map((item, index) => `
    <div class="download-row">
      <span class="download-rank">${String(index + 1).padStart(2, '0')}</span>
      <span class="download-title"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subject)}</small></span>
      <span class="download-count">${Number(item.downloads).toLocaleString()}<small>downloads</small></span>
    </div>
  `).join('') : `<div class="empty-state compact-empty">No downloads have been recorded yet.</div>`;
}

function renderStatusComparison(container, statusCounts) {
  const counts = Object.fromEntries(statusCounts.map((item) => [item.status, Number(item.count)]));
  const approved = counts.Approved || 0;
  const rejected = counts.Rejected || 0;
  const total = approved + rejected;
  const approvedPercent = total ? Math.round((approved / total) * 100) : 0;
  const rejectedPercent = total ? 100 - approvedPercent : 0;
  container.innerHTML = `
    <div class="status-comparison">
      <div class="status-comparison-labels"><span><i class="legend-dot registrations"></i>Approved <strong>${approved.toLocaleString()}</strong></span><span><i class="legend-dot rejected-dot"></i>Rejected <strong>${rejected.toLocaleString()}</strong></span></div>
      <div class="status-comparison-track" role="img" aria-label="${approvedPercent}% approved and ${rejectedPercent}% rejected">
        <span class="approved-segment" style="width:${approvedPercent}%"></span><span class="rejected-segment" style="width:${rejectedPercent}%"></span>
      </div>
      <p>${total.toLocaleString()} reviewed ${total === 1 ? 'material' : 'materials'}</p>
    </div>
  `;
}

async function loadAnalytics() {
  try {
    const analytics = await apiFetch('/dashboard/analytics');
    const activity = document.getElementById('overviewActivity');
    if (activity) renderActivityChart(activity, analytics);
    const topDownloads = document.getElementById('overviewTopDownloads');
    if (topDownloads) renderTopDownloads(topDownloads, analytics.topDownloads);
    const reports = document.getElementById('reportsContent');
    if (reports) {
      reports.innerHTML = `
        <div class="admin-overview-grid report-grid">
          <section class="admin-panel"><div class="admin-section-heading"><div><h2>Approval outcomes</h2><p>Approved versus rejected reviewed materials.</p></div></div><div id="reportsStatusComparison"></div></section>
          <section class="admin-panel"><div class="admin-section-heading"><div><h2>Student registrations & material uploads</h2><p>Daily activity over the last 7 days.</p></div></div><div id="reportsActivity" class="activity-chart"></div></section>
          <section class="admin-panel"><div class="admin-section-heading"><div><h2>Most downloaded materials</h2><p>Based on recorded student downloads.</p></div></div><div id="reportsTopDownloads" class="top-downloads"></div></section>
        </div>`;
      renderStatusComparison(document.getElementById('reportsStatusComparison'), analytics.statusCounts);
      renderActivityChart(document.getElementById('reportsActivity'), analytics);
      renderTopDownloads(document.getElementById('reportsTopDownloads'), analytics.topDownloads);
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadPendingApprovals() {
  try {
    const materials = await apiFetch('/materials?status=Pending');
    const container = document.getElementById('pendingTable');
    if (!container) return;

    if (!materials.length) {
      container.innerHTML = `<div class="empty-state"><h3>✅ No pending submissions.</h3><p>All submitted materials have been reviewed.</p></div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-wrap">
        <table class="approval-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Course</th>
              <th>Details</th>
              <th>Review</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${materials.map((item) => `
              <tr>
                <td data-label="Material">
                  <strong>${escapeHtml(item.title)}</strong>
                  <small>By ${escapeHtml(item.uploadedByName || (item.uploadedByRole === 'teacher' ? 'Teacher' : 'Student'))}</small>
                </td>
                <td data-label="Course">
                  <strong>${escapeHtml(item.subject)}</strong>
                  <small>${escapeHtml(item.branch || '-')}</small>
                </td>
                <td data-label="Details">
                  <strong>${escapeHtml(item.semester || '-')}</strong>
                  <small>${escapeHtml(item.materialType || '-')}</small>
                </td>
                <td data-label="Review">
                  <strong>${new Date(item.uploadedAt).toLocaleDateString()}</strong>
                  <small><span class="badge pending">Pending</span></small>
                </td>
                <td class="approval-action-cell">
                  <div class="actions approval-actions">
                    ${item.videoUrl
                      ? `<a class="secondary-btn small-btn" href="${escapeHtml(item.videoUrl)}" target="_blank" rel="noopener noreferrer">View video</a>`
                      : item.fileUrl && /\.pdf$/i.test(item.fileUrl)
                        ? `<button class="secondary-btn small-btn" data-preview-file="${escapeHtml(item.fileUrl)}">Preview PDF</button>`
                        : item.fileUrl
                          ? `<a class="secondary-btn small-btn" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener noreferrer">View file</a>`
                          : ''}
                    <button class="primary-btn small-btn" data-approve-material="${item.id}">Approve</button>
                    <button class="danger-btn small-btn" data-reject-material="${item.id}">Reject</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div id="pdfPreviewModal" class="pdf-preview-modal" hidden role="dialog" aria-modal="true" aria-label="PDF preview">
        <div class="pdf-preview-dialog">
          <div class="pdf-preview-header"><strong>Document preview</strong><button type="button" class="ghost-btn small-btn" data-close-preview>Close</button></div>
          <iframe title="PDF document preview"></iframe>
        </div>
      </div>
    `;

    document.querySelectorAll('[data-preview-file]').forEach((button) => {
      button.addEventListener('click', () => {
        const modal = document.getElementById('pdfPreviewModal');
        const frame = modal.querySelector('iframe');
        frame.src = button.getAttribute('data-preview-file');
        modal.hidden = false;
      });
    });
    document.querySelector('[data-close-preview]')?.addEventListener('click', () => {
      const modal = document.getElementById('pdfPreviewModal');
      modal.querySelector('iframe').src = 'about:blank';
      modal.hidden = true;
    });

    document.querySelectorAll('[data-approve-material]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = Number(button.getAttribute('data-approve-material'));
        try {
          const response = await apiFetch(`/materials/${id}/approve`, { method: 'PATCH' });
          showToast(response.message);
          loadPendingApprovals();
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
    });

    document.querySelectorAll('[data-reject-material]').forEach((button) => {
      button.addEventListener('click', async () => {
        const reason = prompt('Optional rejection reason:');
        const id = Number(button.getAttribute('data-reject-material'));
        try {
          const response = await apiFetch(`/materials/${id}/reject`, {
            method: 'PATCH',
            body: JSON.stringify({ rejectionReason: reason || 'No reason provided' }),
          });
          showToast(response.message);
          loadPendingApprovals();
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadAllMaterials(statusFilter = 'all') {
  try {
    const materials = await apiFetch(`/materials?status=${encodeURIComponent(statusFilter)}`);
    const container = document.getElementById('materialsTable');
    if (!container) return;

    if (!materials.length) {
      container.innerHTML = `<div class="empty-state"><h3>📚 No materials have been uploaded yet.</h3><p>Approved, pending, and rejected files will appear here once students share them.</p></div>`;
      return;
    }

    container.innerHTML = `
      <div class="admin-filters">
        <label class="search-field"><span aria-hidden="true">⌕</span><input id="materialSearch" type="search" placeholder="Search title, subject, uploader..." aria-label="Search materials" /></label>
        <select id="materialSubjectFilter" aria-label="Filter by subject"><option value="">All subjects</option>${[...new Set(materials.map((item) => item.subject).filter(Boolean))].sort().map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join('')}</select>
        <select id="materialBranchFilter" aria-label="Filter by branch"><option value="">All branches</option>${[...new Set(materials.map((item) => item.branch).filter(Boolean))].sort().map((branch) => `<option value="${escapeHtml(branch)}">${escapeHtml(branch)}</option>`).join('')}</select>
        <select id="materialSemesterFilter" aria-label="Filter by semester"><option value="">All semesters</option>${[...new Set(materials.map((item) => item.semester).filter(Boolean))].sort().map((semester) => `<option value="${escapeHtml(semester)}">${escapeHtml(semester)}</option>`).join('')}</select>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Subject / Branch</th>
              <th>Semester</th>
              <th>Status</th>
              <th>Uploader / Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="adminMaterialRows">
            ${materials.map((item) => `
              <tr data-search="${escapeHtml(`${item.title} ${item.subject} ${item.uploadedByName || ''} ${item.branch || ''}`.toLowerCase())}" data-subject="${escapeHtml(item.subject || '')}" data-branch="${escapeHtml(item.branch || '')}" data-semester="${escapeHtml(item.semester || '')}">
                <td><strong>${escapeHtml(item.title)}</strong><small class="table-subtitle">${escapeHtml(item.materialType || 'Study material')}</small></td>
                <td><strong>${escapeHtml(item.subject)}</strong><small class="table-subtitle">${escapeHtml(item.branch || 'Branch not specified')}</small></td>
                <td>${escapeHtml(item.semester || '-')}</td>
                <td><span class="badge ${escapeHtml(String(item.status).toLowerCase())}">${escapeHtml(item.status)}</span></td>
                <td><strong>${escapeHtml(item.uploadedByName || (item.uploadedByRole === 'teacher' ? 'Teacher' : 'Student'))}</strong><small class="table-subtitle">${new Date(item.uploadedAt).toLocaleDateString()}</small></td>
                <td>
                  <div class="actions">
                    ${item.videoUrl
                      ? `<a class="secondary-btn small-btn" href="${escapeHtml(item.videoUrl)}" target="_blank" rel="noopener noreferrer">View video</a>`
                      : item.fileUrl && /\.pdf$/i.test(item.fileUrl)
                        ? `<button class="secondary-btn small-btn" data-preview-file="${escapeHtml(item.fileUrl)}">Preview PDF</button>`
                        : item.fileUrl
                        ? `<a class="secondary-btn small-btn" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener noreferrer">View file</a>`
                        : ''}
                    <button class="danger-btn small-btn" data-delete-material="${item.id}">Delete</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div id="pdfPreviewModal" class="pdf-preview-modal" hidden role="dialog" aria-modal="true" aria-label="PDF preview">
        <div class="pdf-preview-dialog">
          <div class="pdf-preview-header"><strong>Document preview</strong><button type="button" class="ghost-btn small-btn" data-close-preview>Close</button></div>
          <iframe title="PDF document preview"></iframe>
        </div>
      </div>
    `;

    const applyMaterialFilters = () => {
      const search = document.getElementById('materialSearch').value.trim().toLowerCase();
      const subject = document.getElementById('materialSubjectFilter').value;
      const branch = document.getElementById('materialBranchFilter').value;
      const semester = document.getElementById('materialSemesterFilter').value;
      document.querySelectorAll('#adminMaterialRows tr').forEach((row) => {
        row.hidden = !(row.dataset.search.includes(search)
          && (!subject || row.dataset.subject === subject)
          && (!branch || row.dataset.branch === branch)
          && (!semester || row.dataset.semester === semester));
      });
    };
    document.getElementById('materialSearch').addEventListener('input', applyMaterialFilters);
    document.getElementById('materialSubjectFilter').addEventListener('change', applyMaterialFilters);
    document.getElementById('materialBranchFilter').addEventListener('change', applyMaterialFilters);
    document.getElementById('materialSemesterFilter').addEventListener('change', applyMaterialFilters);

    document.querySelectorAll('[data-preview-file]').forEach((button) => {
      button.addEventListener('click', () => {
        const modal = document.getElementById('pdfPreviewModal');
        modal.querySelector('iframe').src = button.getAttribute('data-preview-file');
        modal.hidden = false;
      });
    });
    document.querySelector('[data-close-preview]')?.addEventListener('click', () => {
      const modal = document.getElementById('pdfPreviewModal');
      modal.querySelector('iframe').src = 'about:blank';
      modal.hidden = true;
    });

    document.querySelectorAll('[data-delete-material]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this material?')) return;
        const id = Number(button.getAttribute('data-delete-material'));
        try {
          const response = await apiFetch(`/materials/${id}`, { method: 'DELETE' });
          showToast(response.message);
          loadAllMaterials(statusFilter);
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadStudentsList() {
  try {
    const students = await apiFetch('/students');
    const container = document.getElementById('studentsTable');
    if (!container) return;

    if (!students.length) {
      container.innerHTML = `<div class="empty-state"><h3>👨‍🎓 No students registered yet.</h3><p>Student accounts will appear here after registration.</p></div>`;
      return;
    }

    const branches = [...new Set(students.map((student) => student.branch).filter(Boolean))].sort();
    container.innerHTML = `
      <div class="admin-filters">
        <label class="search-field"><span aria-hidden="true">⌕</span><input id="studentSearch" type="search" placeholder="Search name, email or student ID..." aria-label="Search students" /></label>
        <select id="studentBranchFilter" aria-label="Filter by branch"><option value="">All branches</option>${branches.map((branch) => `<option value="${escapeHtml(branch)}">${escapeHtml(branch)}</option>`).join('')}</select>
        <select id="studentStatusFilter" aria-label="Filter by account status"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Email</th>
              <th>Branch</th>
              <th>Year / Semester</th>
              <th>Registered</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="adminStudentRows">
            ${students.map((student) => `
              <tr data-search="${escapeHtml(`${student.name} ${student.studentId || ''} ${student.email}`.toLowerCase())}" data-branch="${escapeHtml(student.branch || '')}" data-status="${escapeHtml(student.status || 'active')}">
                <td><strong>${escapeHtml(student.name)}</strong><small class="table-subtitle">${escapeHtml(student.studentId || 'No student ID')}</small></td>
                <td>${escapeHtml(student.email)}</td>
                <td>${escapeHtml(student.branch || '-')}</td>
                <td>${escapeHtml(student.year || '-')}<small class="table-subtitle">${escapeHtml(student.semester || '-')}</small></td>
                <td>${new Date(student.createdAt).toLocaleDateString()}</td>
                <td><span class="badge ${student.status === 'active' ? 'approved' : 'rejected'}">${escapeHtml(student.status || 'active')}</span></td>
                <td>
                  <div class="actions">
                    <button class="secondary-btn small-btn" data-toggle-student-status="${student.id}" data-status="${student.status === 'active' ? 'inactive' : 'active'}">${student.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const applyStudentFilters = () => {
      const search = document.getElementById('studentSearch').value.trim().toLowerCase();
      const branch = document.getElementById('studentBranchFilter').value;
      const status = document.getElementById('studentStatusFilter').value;
      document.querySelectorAll('#adminStudentRows tr').forEach((row) => {
        row.hidden = !(row.dataset.search.includes(search)
          && (!branch || row.dataset.branch === branch)
          && (!status || row.dataset.status === status));
      });
    };
    document.getElementById('studentSearch').addEventListener('input', applyStudentFilters);
    document.getElementById('studentBranchFilter').addEventListener('change', applyStudentFilters);
    document.getElementById('studentStatusFilter').addEventListener('change', applyStudentFilters);

    document.querySelectorAll('[data-toggle-student-status]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = Number(button.getAttribute('data-toggle-student-status'));
        const nextStatus = button.getAttribute('data-status');
        try {
          const response = await apiFetch(`/students/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: nextStatus }),
          });
          showToast(response.message);
          loadStudentsList();
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadCatalog() {
  try {
    const materials = await apiFetch('/materials?status=all');
    const container = document.getElementById('catalogGrid');
    if (!container) return;

    const catalog = new Map();
    materials.forEach((material) => {
      const key = `${material.subject}::${material.branch || 'Branch not specified'}`;
      const entry = catalog.get(key) || {
        subject: material.subject,
        branch: material.branch || 'Branch not specified',
        semesters: new Set(),
        materialCount: 0,
      };
      entry.semesters.add(material.semester || 'Semester not specified');
      entry.materialCount += 1;
      catalog.set(key, entry);
    });

    const entries = [...catalog.values()].sort((a, b) => a.subject.localeCompare(b.subject));
    container.innerHTML = entries.length ? entries.map((entry) => `
      <article class="catalog-card">
        <div class="catalog-card-icon" aria-hidden="true">▤</div>
        <div><h3>${escapeHtml(entry.subject)}</h3><p>${escapeHtml(entry.branch)}</p></div>
        <div class="catalog-card-footer"><span>${[...entry.semesters].map(escapeHtml).join(', ')}</span><strong>${entry.materialCount} ${entry.materialCount === 1 ? 'material' : 'materials'}</strong></div>
      </article>
    `).join('') : `<div class="empty-state"><h3>No subjects yet</h3><p>Subject and semester entries will appear when materials are submitted.</p></div>`;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadSettingsUploadControl() {
  try {
    const response = await apiFetch('/settings/student-uploads');
    const container = document.getElementById('settingsUploadControl');
    if (!container) return;
    const enabled = Boolean(response.enabled);
    container.innerHTML = `
      <div class="settings-control">
        <span class="settings-state"><span class="status-indicator ${enabled ? 'is-on' : 'is-off'}"></span>
          <strong>Student uploads are ${enabled ? 'enabled' : 'paused'}</strong>
        </span>
        <button type="button" class="${enabled ? 'danger-btn' : 'primary-btn'}" data-toggle-settings-uploads="${!enabled}">
          ${enabled ? 'Pause student uploads' : 'Enable student uploads'}
        </button>
      </div>
    `;
    container.querySelector('[data-toggle-settings-uploads]').addEventListener('click', async (event) => {
      const shouldEnable = event.currentTarget.getAttribute('data-toggle-settings-uploads') === 'true';
      try {
        const result = await apiFetch('/settings/student-uploads', {
          method: 'PUT',
          body: JSON.stringify({ enabled: shouldEnable }),
        });
        showToast(result.message);
        loadSettingsUploadControl();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadUploadPermission() {
  try {
    const response = await apiFetch('/settings/student-uploads');
    const box = document.getElementById('uploadPermissionBox');
    if (!box) return;

    const enabled = Boolean(response.enabled);
    box.innerHTML = `
      <div class="status-row">
        <h3>${enabled ? '🟢 Students are currently allowed to upload study material.' : '🔴 Students are currently not allowed to upload study material.'}</h3>
      </div>
      <div class="actions">
        <button class="primary-btn" data-toggle-upload-permission="${enabled ? 'false' : 'true'}">${enabled ? 'Disable uploads' : 'Enable uploads'}</button>
      </div>
    `;

    document.querySelector('[data-toggle-upload-permission]').addEventListener('click', async () => {
      const shouldEnable = document.querySelector('[data-toggle-upload-permission]').getAttribute('data-toggle-upload-permission') === 'true';
      const confirmText = shouldEnable
        ? 'Enable student uploads? Students will be able to submit new study material for approval.'
        : 'Are you sure you want to disable student uploads? Students will no longer be able to submit new study material.';

      if (!confirm(confirmText)) return;

      try {
        const result = await apiFetch('/settings/student-uploads', {
          method: 'PUT',
          body: JSON.stringify({ enabled: shouldEnable }),
        });
        showToast(result.message);
        loadUploadPermission();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadLogs() {
  try {
    const logs = await apiFetch('/activity-logs');
    const container = document.getElementById('logsTable');
    if (!container) return;

    if (!logs.length) {
      container.innerHTML = `<div class="empty-state"><h3>📝 No activity logs yet.</h3><p>Admin actions will appear here.</p></div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>User/Admin</th>
              <th>Date</th>
              <th>Time</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map((log) => `
              <tr>
                <td>${escapeHtml(log.action)}</td>
                <td>${escapeHtml(log.performedBy || 'System')}</td>
                <td>${new Date(log.timestamp).toLocaleDateString()}</td>
                <td>${new Date(log.timestamp).toLocaleTimeString()}</td>
                <td>${escapeHtml(log.targetId || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function routeFromHash() {
  const hash = window.location.hash.slice(1) || '/';
  if (hash === '/') return 'home';
  if (hash === '/student-login') return 'student-login';
  if (hash === '/student-register') return 'student-register';
  if (hash === '/teacher-login') return 'teacher-login';
  if (hash === '/teacher-register') return 'teacher-register';
  if (hash === '/admin-login') return 'admin-login';
  if (hash === '/student-dashboard') return 'student-dashboard';
  if (hash === '/teacher-dashboard') return 'teacher-dashboard';
  if (hash === '/admin-dashboard') return 'admin-dashboard';
  return 'home';
}

function render() {
  const route = routeFromHash();

  if (state.user && state.user.role === 'student' && route === 'student-dashboard') {
    renderStudentDashboard();
    return;
  }

  if (state.user && state.user.role === 'teacher' && route === 'teacher-dashboard') {
    renderTeacherDashboard();
    return;
  }

  if (state.user && state.user.role === 'admin' && route === 'admin-dashboard') {
    renderAdminDashboard();
    return;
  }

  switch (route) {
    case 'student-login':
      renderStudentLogin();
      break;
    case 'student-register':
      renderStudentRegister();
      break;
    case 'teacher-login':
      renderTeacherLogin();
      break;
    case 'teacher-register':
      renderTeacherRegister();
      break;
    case 'admin-login':
      renderAdminLogin();
      break;
    case 'student-dashboard':
      if (state.user?.role === 'student') {
        renderStudentDashboard();
      } else {
        renderStudentLogin();
      }
      break;
    case 'teacher-dashboard':
      if (state.user?.role === 'teacher') {
        renderTeacherDashboard();
      } else {
        renderTeacherLogin();
      }
      break;
    case 'admin-dashboard':
      if (state.user?.role === 'admin') {
        renderAdminDashboard();
      } else {
        renderAdminLogin();
      }
      break;
    default:
      renderLanding();
  }
}

window.addEventListener('hashchange', () => {
  render();
});

window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (state.studentSettings?.preferences?.appearance?.theme === 'system') {
    applyStudentPreferences();
  }
  if (state.teacherPreferences?.appearance?.theme === 'system') {
    applyTeacherTheme();
  }
});

window.addEventListener('load', () => {
  if (state.token && state.user) {
    const role = state.user.role;
    if (role === 'student') {
      setRoute('#/student-dashboard');
    } else if (role === 'teacher') {
      setRoute('#/teacher-dashboard');
    } else if (role === 'admin') {
      setRoute('#/admin-dashboard');
    }
  }
  render();
  reloadUser();
});

window.logoutStudent = () => clearAuthSession();
window.setStudentView = setStudentView;
window.loadBrowseMaterials = loadBrowseMaterials;
window.loadStudentUploads = loadStudentUploads;
window.loadPendingApprovals = loadPendingApprovals;
window.loadAllMaterials = loadAllMaterials;
window.loadStudentsList = loadStudentsList;
window.loadUploadPermission = loadUploadPermission;
window.loadLogs = loadLogs;
window.loadAdminStats = loadAdminStats;
