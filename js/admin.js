/* أفق Platform — Admin/Professor Dashboard */
let adminAction = null, currentAdminUser = null, isSuperAdmin = false, isProfessor = false, myGroupIds = [];

window.addEventListener('DOMContentLoaded', async () => {
  initSettings();
  currentAdminUser = await requireAuth('admin');
  if (!currentAdminUser) return;
  isSuperAdmin = currentAdminUser.role === 'admin';
  isProfessor  = currentAdminUser.role === 'professor';
  if (isProfessor) myGroupIds = DB.getGroupsByProfessor(currentAdminUser.id).map(g => g.id);
  document.getElementById('admin-name-display').textContent = currentAdminUser.name;
  document.getElementById('admin-role-display').textContent = isSuperAdmin ? 'Super Admin' : 'Professor';
  document.getElementById('role-badge').textContent = isSuperAdmin ? 'SUPER ADMIN' : 'PROFESSOR';
  renderSidebar();
  loadAdmin();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAdmin(); });
});

function renderSidebar() {
  const nav = document.getElementById('admin-nav');
  if (isSuperAdmin) {
    nav.innerHTML = `
      <button class="sidebar-link active" onclick="showAdminSection('overview')" id="alink-overview"><span class="s-icon">📊</span> نظرة عامة</button>
      <button class="sidebar-link" onclick="showAdminSection('professors')" id="alink-professors"><span class="s-icon">🎓</span> الأساتذة</button>
      <button class="sidebar-link" onclick="showAdminSection('all-groups')" id="alink-all-groups"><span class="s-icon">📁</span> المجموعات</button>
      <button class="sidebar-link" onclick="showAdminSection('general')" id="alink-general"><span class="s-icon">📋</span> غير المعيّنين <span class="s-badge" id="general-badge">0</span></button>
      <button class="sidebar-link" onclick="showAdminSection('pending')" id="alink-pending"><span class="s-icon">🟡</span> الأفكار المعلقة <span class="s-badge" id="pending-badge">0</span></button>
      <button class="sidebar-link" onclick="showAdminSection('active')" id="alink-active"><span class="s-icon">🚀</span> المشاريع النشطة</button>
      <button class="sidebar-link" onclick="showAdminSection('completed')" id="alink-completed"><span class="s-icon">🏆</span> المشاريع المكتملة</button>
      <button class="sidebar-link" onclick="showAdminSection('users')" id="alink-users"><span class="s-icon">👥</span> جميع المستخدمين</button>`;
  } else {
    nav.innerHTML = `
      <button class="sidebar-link active" onclick="showAdminSection('overview')" id="alink-overview"><span class="s-icon">📊</span> نظرة عامة</button>
      <button class="sidebar-link" onclick="showAdminSection('my-groups')" id="alink-my-groups"><span class="s-icon">📂</span> مجموعاتي</button>
      <button class="sidebar-link" onclick="showAdminSection('pending')" id="alink-pending"><span class="s-icon">🟡</span> الأفكار المعلقة <span class="s-badge" id="pending-badge">0</span></button>
      <button class="sidebar-link" onclick="showAdminSection('active')" id="alink-active"><span class="s-icon">🚀</span> المشاريع النشطة</button>
      <button class="sidebar-link" onclick="showAdminSection('completed')" id="alink-completed"><span class="s-icon">🏆</span> المشاريع المكتملة</button>`;
  }
}

function loadAdmin() {
  if (isProfessor) myGroupIds = DB.getGroupsByProfessor(currentAdminUser.id).map(g => g.id);
  const allProjects = DB.getProjects(), allUsers = DB.getUsers();
  const users = allUsers.filter(u => u.role === 'user');
  const projects = isSuperAdmin ? allProjects : allProjects.filter(p => myGroupIds.includes(p.groupId));
  const pending = projects.filter(p => p.status === 'pending');
  const active  = projects.filter(p => p.status === 'accepted');
  const done    = projects.filter(p => p.status === 'completed');
  const pb = document.getElementById('pending-badge');
  if (pb) { pb.textContent = pending.length; pb.style.display = pending.length ? '' : 'none'; }
  if (isSuperAdmin) {
    const generals = users.filter(u => u.groupId === 'general');
    const gb = document.getElementById('general-badge');
    if (gb) { gb.textContent = generals.length; gb.style.display = generals.length ? '' : 'none'; }
    renderOverview(projects, users, pending, active, done);
    renderProfessors(allUsers.filter(u => u.role === 'professor'));
    renderAllGroups(DB.getGroups(), allUsers);
    renderGeneralStudents(generals, allUsers.filter(u => u.role === 'professor'));
    renderUsers(users, allProjects);
  } else {
    renderOverview(projects, users, pending, active, done);
    renderMyGroups();
  }
  renderPending(pending); renderActive(active); renderCompleted(done);
}

function showAdminSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  const btn = document.getElementById('alink-' + name);
  if (btn) btn.classList.add('active');
}

function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = type === 'success' ? 'var(--success)' : type === 'danger' ? 'var(--danger)' : 'var(--border-light)';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

function renderOverview(projects, users, pending, active, done) {
  document.getElementById('admin-stats').innerHTML = `
    <div class="stat-card"><div><div class="stat-value text-blue">${users.length}</div><div class="stat-label">${t('stat.users')}</div></div><div class="stat-icon">👥</div></div>
    <div class="stat-card"><div><div class="stat-value text-yellow">${pending.length}</div><div class="stat-label">${t('stat.pending')}</div></div><div class="stat-icon">⏳</div></div>
    <div class="stat-card"><div><div class="stat-value text-primary-color">${active.length}</div><div class="stat-label">${t('stat.active')}</div></div><div class="stat-icon">🚀</div></div>
    <div class="stat-card"><div><div class="stat-value text-purple">${done.length}</div><div class="stat-label">${t('stat.completed_count')}</div></div><div class="stat-icon">🏆</div></div>`;
  const subs = [];
  projects.forEach(p => {
    if (p.status === 'pending') subs.push({ time: p.createdAt, msg: `قدّم <strong>${p.userName}</strong> فكرة "${p.projectName}"`, go: 'pending' });
    p.stages.forEach(s => { if (s.status === 'submitted') subs.push({ time: s.submittedAt, msg: `أرسل <strong>${p.userName}</strong> طلب إتمام المرحلة ${s.stageNumber} لـ"${p.projectName}"`, go: 'active' }); });
  });
  subs.sort((a, b) => new Date(b.time) - new Date(a.time));
  const actHtml = subs.length ? subs.slice(0, 8).map(s => `
    <div class="flex justify-between items-center" style="padding:14px 16px;background:var(--bg-dark);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:10px;">
      <span style="font-size:14px;">${s.msg}</span>
      <div style="display:flex;align-items:center;gap:16px;">
        <span style="font-size:12px;color:var(--text-muted);">${timeAgo(s.time)}</span>
        <button class="btn btn-ghost btn-sm" onclick="showAdminSection('${s.go}')">${t('btn.review')}</button>
      </div>
    </div>`).join('') : `<div class="empty-state"><span class="empty-icon">🎉</span><h3>${t('empty.no_activity')}</h3></div>`;
  document.getElementById('recent-activity').innerHTML = `<div class="card" style="margin-top:4px;"><h3 style="margin-bottom:20px;font-size:17px;">${t('msg.recent')}</h3>${actHtml}</div>`;
}


function renderProfessors(professors) {
  const el = document.getElementById('professors-list');
  if (!el) return;
  const groups = DB.getGroups();
  el.innerHTML = `
    <div style="margin-bottom:20px;">
      <button class="btn btn-primary" onclick="openCreateProfessorModal()">+ إضافة أستاذ جديد</button>
    </div>
    ${!professors.length ? `<div class="empty-state"><span class="empty-icon">🎓</span><h3>لا يوجد أساتذة بعد</h3></div>` :
    professors.map(p => {
      const pGroups = groups.filter(g => g.professorId === p.id);
      return `<div class="request-card" style="border-right:3px solid var(--primary);">
        <div class="flex justify-between items-center">
          <div><h3 style="font-size:17px;margin-bottom:4px;">${p.name}</h3>
            <span style="font-size:13px;color:var(--text-muted);" dir="ltr">${p.email}</span>
          </div>
          <span class="badge badge-info">${pGroups.length} مجموعة</span>
        </div>
        ${pGroups.length ? `<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">${pGroups.map(g => `<span class="badge badge-success">📁 ${g.name} — <span dir="ltr" style="letter-spacing:1px;">${g.code}</span></span>`).join('')}</div>` : ''}
      </div>`;
    }).join('')}`;
}

function renderMyGroups() {
  const el = document.getElementById('my-groups-list');
  if (!el) return;
  const groups = DB.getGroupsByProfessor(currentAdminUser.id);
  const allProjects = DB.getProjects();
  el.innerHTML = `
    <div style="margin-bottom:20px;">
      <button class="btn btn-primary" onclick="openCreateGroupModal()">+ إنشاء مجموعة جديدة</button>
    </div>
    ${!groups.length ? `<div class="empty-state"><span class="empty-icon">📂</span><h3>لم تنشئ أي مجموعة بعد</h3><p>أنشئ مجموعة وشارك كودها مع طلابك</p></div>` :
    groups.map(g => {
      const members = DB.getUsers().filter(u => u.groupId === g.id);
      const gProjects = allProjects.filter(p => p.groupId === g.id);
      return `<div class="request-card" style="border-right:3px solid var(--success);">
        <div class="flex justify-between items-center" style="margin-bottom:12px;">
          <h3 style="font-size:18px;">${g.name}</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="badge badge-success" style="font-family:monospace;letter-spacing:2px;font-size:14px;">🔑 ${g.code}</span>
          </div>
        </div>
        <div style="display:flex;gap:16px;font-size:13px;color:var(--text-secondary);">
          <span>👤 ${members.length} طالب</span>
          <span>📋 ${gProjects.length} مشروع</span>
          <span>📅 ${timeAgo(g.createdAt)}</span>
        </div>
      </div>`;
    }).join('')}`;
}

function renderAllGroups(groups, allUsers) {
  const el = document.getElementById('all-groups-list');
  if (!el) return;
  const professors = allUsers.filter(u => u.role === 'professor');
  const allProjects = DB.getProjects();

  const createBtn = `
    <div style="margin-bottom:20px;">
      <button class="btn btn-primary" onclick="openSuperAdminGroupModal()">+ إنشاء مجموعة جديدة</button>
    </div>`;

  if (!groups.length) {
    el.innerHTML = createBtn + `<div class="empty-state"><span class="empty-icon">📁</span><h3>لا توجد مجموعات بعد</h3></div>`;
    return;
  }

  const groupOpts = (excludeId) => [
    `<option value="general">📋 المجموعة العامة (غير معيّن)</option>`,
    ...groups.filter(g => g.id !== excludeId).map(g => {
      const prof = professors.find(p => p.id === g.professorId);
      return `<option value="${g.id}">📁 ${g.name} ${prof ? '— '+prof.name : ''} (${g.code})</option>`;
    })
  ].join('');

  el.innerHTML = createBtn + groups.map(g => {
    const prof = professors.find(p => p.id === g.professorId);
    const members = allUsers.filter(u => u.groupId === g.id && u.role === 'user');

    const membersHtml = members.length ? members.map(u => {
      const proj = allProjects.find(p => p.userId === u.id);
      const statusMap = { pending:'⏳ قيد المراجعة', accepted:'🚀 نشط', rejected:'❌ مرفوض', completed:'🏆 مكتمل' };
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-dark);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:8px;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:14px;font-weight:700;">${u.name}</div>
            <div style="font-size:12px;color:var(--text-muted);" dir="ltr">${u.email}</div>
            ${proj
              ? `<span style="font-size:12px;color:var(--text-secondary);">📋 ${proj.projectName} — ${statusMap[proj.status]||''}</span>`
              : `<span style="font-size:12px;color:var(--text-muted);">لا يوجد مشروع</span>`}
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <select id="transfer-${u.id}" class="form-select" style="min-width:200px;font-size:13px;">
              <option value="">نقل إلى مجموعة أخرى...</option>
              ${groupOpts(g.id)}
            </select>
            <button class="btn btn-sm" style="background:var(--warning);color:#000;white-space:nowrap;" onclick="doTransfer('${u.id}')">نقل ←</button>
          </div>
        </div>`;
    }).join('') : `<div style="font-size:13px;color:var(--text-muted);padding:10px 0;text-align:center;">لا يوجد طلاب في هذه المجموعة بعد</div>`;

    return `
      <div class="request-card" style="margin-bottom:16px;">
        <div class="flex justify-between items-center" style="margin-bottom:14px;">
          <div>
            <h3 style="font-size:18px;margin-bottom:4px;">📁 ${g.name}</h3>
            <span style="font-size:13px;color:var(--text-muted);">الأستاذ: <strong>${prof ? prof.name : '— غير محدد'}</strong></span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:13px;color:var(--text-muted);">👤 ${members.length} طالب</span>
            <span class="badge badge-success" style="font-family:monospace;letter-spacing:2px;font-size:14px;">🔑 ${g.code}</span>
          </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:12px;">
          ${membersHtml}
        </div>
      </div>`;
  }).join('');
}

function doTransfer(userId) {
  const sel = document.getElementById('transfer-' + userId);
  if (!sel || !sel.value) { showToast('اختر مجموعة للنقل إليها أولاً', 'danger'); return; }
  DB.assignStudentToGroup(userId, sel.value);
  showToast('✅ تم نقل الطالب بنجاح', 'success');
  loadAdmin();
}


function renderGeneralStudents(generals, professors) {
  const el = document.getElementById('general-list');
  if (!el) return;
  el.innerHTML = !generals.length ? `<div class="empty-state"><span class="empty-icon">✅</span><h3>جميع الطلاب معيّنون</h3></div>` :
    generals.map(u => {
      const proj = DB.getProjects().find(p => p.userId === u.id);
      const opts = professors.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      const grpOpts = DB.getGroups().map(g => `<option value="${g.id}">${g.name} (${g.professorId ? professors.find(p=>p.id===g.professorId)?.name : '?'})</option>`).join('');
      return `<div class="request-card">
        <div class="flex justify-between items-center" style="margin-bottom:12px;">
          <div><h3 style="font-size:16px;">${u.name}</h3>
            <span style="font-size:13px;color:var(--text-muted);">${u.email} ${proj ? '· مشروع: '+proj.projectName : '· لا يوجد مشروع'}</span>
          </div>
          <span class="badge badge-pending">غير معيّن</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <select class="form-select" id="assign-grp-${u.id}" style="flex:1;"><option value="">اختر مجموعة...</option>${grpOpts}</select>
          <button class="btn btn-success" onclick="doAssign('${u.id}')">تعيين ←</button>
        </div>
      </div>`;
    }).join('');
}

function doAssign(userId) {
  const sel = document.getElementById('assign-grp-' + userId);
  if (!sel || !sel.value) { showToast('اختر مجموعة أولاً', 'danger'); return; }
  DB.assignStudentToGroup(userId, sel.value);
  showToast('✅ تم تعيين الطالب بنجاح', 'success');
  loadAdmin();
}

function openSuperAdminGroupModal() {
  const professors = DB.getUsers().filter(u => u.role === 'professor');
  const profOptions = professors.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('admin-modal-title').textContent = '📂 إنشاء مجموعة جديدة';
  document.getElementById('admin-modal-desc').textContent  = 'أدخل اسم المجموعة واختر الأستاذ المسؤول (اختياري).';
  document.getElementById('admin-note').value = '';
  document.getElementById('admin-note').placeholder = 'اسم المجموعة (مثال: مجموعة أ)';
  const extraEl = document.getElementById('admin-modal-extra');
  extraEl.style.display = professors.length ? '' : 'none';
  extraEl.innerHTML = professors.length ? `
    <label class="form-label">🎓 الأستاذ المسؤول <span style="color:var(--text-muted);font-weight:400;">(اختياري)</span></label>
    <select id="modal-prof-select" class="form-select">
      <option value="">— بدون أستاذ محدد —</option>
      ${profOptions}
    </select>` : '';
  document.getElementById('admin-confirm-btn').textContent = 'إنشاء المجموعة';
  document.getElementById('admin-confirm-btn').className = 'btn btn-success btn-full';
  document.getElementById('admin-modal').classList.add('open');
  adminAction = { type: 'create-group-super' };
}

function renderPending(pending) {
  const el = document.getElementById('pending-list');
  if (!el || !pending) return;
  if (!pending.length) { el.innerHTML = `<div class="empty-state"><span class="empty-icon">✅</span><h3>${t('empty.no_pending')}</h3><p>${t('empty.no_pending_sub')}</p></div>`; return; }
  const groups = DB.getGroups();
  el.innerHTML = pending.map(p => {
    const grp = groups.find(g => g.id === p.groupId);
    return `<div class="request-card">
      <div class="flex justify-between items-center" style="margin-bottom:10px;">
        <div><h3 style="font-size:18px;margin-bottom:4px;">${p.projectName}</h3>
          <span style="font-size:13px;color:var(--text-muted);">${t('msg.owner')} <strong>${p.userName}</strong> • ${timeAgo(p.createdAt)} ${grp ? '• 📁 '+grp.name : ''}</span>
        </div>
        <span class="badge badge-pending"><span class="dot dot-pulse" style="background:var(--warning);"></span>${t('status.pending')}</span>
      </div>
      <p style="font-size:14px;margin-bottom:8px;max-width:700px;">${p.description}</p>
      <span class="badge badge-info" style="margin-bottom:16px;">${catLabel(p.category)}</span>
      <div class="request-actions">
        <button class="btn btn-success" onclick="openAdminModal('accept-idea','${p.id}')">${t('btn.accept_idea')}</button>
        <button class="btn btn-danger" onclick="openAdminModal('reject-idea','${p.id}')">${t('btn.reject_idea')}</button>
      </div>
    </div>`;
  }).join('');
}

function renderActive(active) {
  const el = document.getElementById('active-list');
  if (!el || !active) return;
  if (!active.length) { el.innerHTML = `<div class="empty-state"><span class="empty-icon">📂</span><h3>${t('empty.no_active')}</h3><p>${t('empty.no_active_sub')}</p></div>`; return; }
  const STAGE_NAMES = getStageNames();
  el.innerHTML = active.map(p => {
    const submitted = p.stages.find(s => s.status === 'submitted');
    const inProg    = p.stages.find(s => s.status === 'in_progress');
    const cur = submitted || inProg;
    const si = cur ? cur.stageNumber - 1 : 0;
    const stagesHtml = p.stages.map((s, i) => {
      const colors = { locked:'var(--text-muted)', in_progress:'var(--primary)', submitted:'var(--warning)', approved:'var(--success)', rejected:'var(--danger)' };
      const icons  = { locked:'🔒', in_progress:'⚡', submitted:'⏳', approved:'✅', rejected:'❌' };
      return `<span style="font-size:13px;font-weight:700;color:${colors[s.status]||'var(--text-muted)'};">${icons[s.status]} ${STAGE_NAMES[i]}</span>`;
    }).join('<span style="color:var(--text-muted);padding:0 8px;">→</span>');
    let actionHtml = '';
    if (submitted) {
      actionHtml = `
        <div class="alert alert-warning" style="margin-top:16px;"><span>⏳</span>
          <div><strong>${p.userName} يطلب إتمام المرحلة ${submitted.stageNumber}: ${STAGE_NAMES[si]}</strong><br>
            <span style="font-size:13px;">${timeAgo(submitted.submittedAt)}</span></div>
        </div>
        ${submitted.completionItems.length ? `<div style="margin:10px 0;">${submitted.completionItems.map(i=>`<span class="badge badge-info" style="margin:3px;">${i}</span>`).join('')}</div>` : ''}
        ${submitted.summary ? `<div style="background:var(--bg-dark);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:10px;font-size:14px;"><strong>ملخص:</strong> ${submitted.summary}</div>` : ''}
        ${submitted.proofLink ? `<div style="background:var(--bg-dark);padding:10px;border-radius:var(--radius-sm);border:1px solid var(--primary);margin-bottom:14px;font-size:14px;">🔗 <strong>رابط العمل:</strong> <a href="${submitted.proofLink}" target="_blank" style="color:var(--primary);">${submitted.proofLink}</a></div>` : `<div style="background:var(--bg-dark);padding:10px;border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:14px;font-size:13px;color:var(--text-muted);">🔗 لم يُرفق رابط إثبات عمل</div>`}
        <div class="request-actions">
          <button class="btn btn-success" onclick="openAdminModal('approve-stage','${p.id}',${submitted.stageNumber})">${t('btn.approve_stage')}</button>
          <button class="btn btn-danger"  onclick="openAdminModal('reject-stage','${p.id}',${submitted.stageNumber})">${t('btn.reject_stage')}</button>
        </div>`;
    }
    return `<div class="request-card" style="border-right:3px solid var(--primary);">
      <div class="flex justify-between items-center" style="margin-bottom:12px;">
        <div><h3 style="font-size:18px;margin-bottom:4px;">${p.projectName}</h3>
          <span style="font-size:13px;color:var(--text-muted);">${p.userName}</span>
        </div>
        <span class="badge badge-info">المرحلة ${p.currentStage} / 4</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:4px;">${stagesHtml}</div>
      ${actionHtml}
    </div>`;
  }).join('');
}

function renderCompleted(done) {
  const el = document.getElementById('completed-list');
  if (!el || !done) return;
  el.innerHTML = !done.length ? `<div class="empty-state"><span class="empty-icon">🏆</span><h3>${t('empty.no_completed')}</h3></div>` :
    done.map(p => `<div class="request-card" style="border-right:3px solid var(--purple);">
      <div class="flex justify-between items-center">
        <div><h3 style="font-size:18px;margin-bottom:4px;">${p.projectName}</h3>
          <span style="font-size:13px;color:var(--text-muted);">${p.userName}</span>
        </div>
        <span class="badge badge-purple">🏆 مكتمل</span>
      </div>
    </div>`).join('');
}

function renderUsers(users, projects) {
  const el = document.getElementById('users-list');
  if (!el || !users) return;
  if (!users.length) { el.innerHTML = `<div class="empty-state"><span class="empty-icon">👥</span><h3>${t('empty.no_users')}</h3></div>`; return; }
  const groups = DB.getGroups();
  el.innerHTML = `<div class="card" style="overflow:hidden;padding:0;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:var(--bg-dark);border-bottom:1px solid var(--border);">
        <th style="padding:14px 20px;text-align:right;font-size:13px;color:var(--text-muted);">المستخدم</th>
        <th style="padding:14px 20px;text-align:right;font-size:13px;color:var(--text-muted);">البريد</th>
        <th style="padding:14px 20px;text-align:right;font-size:13px;color:var(--text-muted);">المجموعة</th>
        <th style="padding:14px 20px;text-align:right;font-size:13px;color:var(--text-muted);">المشروع</th>
        <th style="padding:14px 20px;text-align:right;font-size:13px;color:var(--text-muted);">الحالة</th>
      </tr></thead>
      <tbody>${users.map(u => {
        const proj = projects.find(p => p.userId === u.id);
        const grp  = groups.find(g => g.id === u.groupId);
        const status = proj ? proj.status : 'none';
        const bm = { none:`<span class="badge">—</span>`, pending:`<span class="badge badge-pending">معلق</span>`, accepted:`<span class="badge badge-info">نشط</span>`, rejected:`<span class="badge badge-danger">مرفوض</span>`, completed:`<span class="badge badge-purple">مكتمل</span>` };
        return `<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:14px 20px;"><div style="display:flex;align-items:center;gap:10px;"><div class="avatar avatar-sm">${u.name.charAt(0)}</div><span style="font-size:14px;font-weight:700;">${u.name}</span></div></td>
          <td style="padding:14px 20px;font-size:13px;" dir="ltr">${u.email}</td>
          <td style="padding:14px 20px;font-size:13px;">${grp ? grp.name : (u.groupId === 'general' ? '<span style="color:var(--warning);">عامة</span>' : '—')}</td>
          <td style="padding:14px 20px;font-size:14px;">${proj ? proj.projectName : '—'}</td>
          <td style="padding:14px 20px;">${bm[status]||''}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

// ── MODALS ──────────────────────────────────────────────────────────────
function openAdminModal(type, projectId, stageNum = null) {
  adminAction = { type, projectId, stageNum };
  const titles = { 'accept-idea':'✅ قبول الفكرة','reject-idea':'❌ رفض الفكرة','approve-stage':'✅ قبول إتمام المرحلة','reject-stage':'❌ رفض إتمام المرحلة' };
  const descs  = { 'accept-idea':'ستتم الموافقة على الفكرة وستبدأ رحلة المستخدم.','reject-idea':'سيتم رفض الفكرة. يُنصح بذكر سبب الرفض.','approve-stage':'ستتم الموافقة وستُفتح المرحلة التالية.','reject-stage':'سيتم رفض الطلب. أذكر السبب.' };
  const btnClass = (type.startsWith('accept')||type.startsWith('approve')) ? 'btn-success' : 'btn-danger';
  document.getElementById('admin-modal-title').textContent = titles[type];
  document.getElementById('admin-modal-desc').textContent  = descs[type];
  document.getElementById('admin-note').value = '';
  const btn = document.getElementById('admin-confirm-btn');
  btn.textContent = titles[type]; btn.className = `btn ${btnClass} btn-full`;
  document.getElementById('admin-modal').classList.add('open');
}
function closeAdminModal() {
  document.getElementById('admin-modal').classList.remove('open');
  document.getElementById('admin-modal-extra').style.display = 'none';
  document.getElementById('admin-modal-extra').innerHTML = '';
  // Always restore the note field in case it was hidden by professor modal
  const noteParent = document.getElementById('admin-note')?.parentElement;
  if (noteParent) noteParent.style.display = '';
  adminAction = null;
}

function confirmAdminAction() {
  if (!adminAction) return;
  const note = document.getElementById('admin-note').value.trim();
  const { type, projectId, stageNum } = adminAction;
  if (type === 'accept-idea')   { DB.adminReviewIdea(projectId, true, note);  showToast(t('toast.accepted'), 'success'); }
  if (type === 'reject-idea')   { DB.adminReviewIdea(projectId, false, note); showToast(t('toast.rejected'), 'danger'); }
  if (type === 'approve-stage') { DB.adminReviewStage(projectId, stageNum, true, note);  showToast(t('toast.stage_ok'), 'success'); }
  if (type === 'reject-stage')  { DB.adminReviewStage(projectId, stageNum, false, note); showToast(t('toast.stage_no'), 'danger'); }
  closeAdminModal(); loadAdmin();
}

function openCreateProfessorModal() {
  document.getElementById('admin-modal-title').textContent = '🎓 إضافة أستاذ جديد';
  document.getElementById('admin-modal-desc').textContent  = 'أدخل بيانات الأستاذ وسيتمكن من تسجيل الدخول بها مباشرة.';
  // Hide the generic note field, use extra fields instead
  document.getElementById('admin-note').value = 'SKIP';
  document.getElementById('admin-note').parentElement.style.display = 'none';
  const extraEl = document.getElementById('admin-modal-extra');
  extraEl.style.display = '';
  extraEl.innerHTML = `
    <div class="form-group">
      <label class="form-label">اسم الأستاذ</label>
      <input type="text" id="prof-name" class="form-input" placeholder="د.أحمد العلي">
    </div>
    <div class="form-group">
      <label class="form-label">البريد الإلكتروني</label>
      <input type="email" id="prof-email" class="form-input" placeholder="ahmed@uni.edu" dir="ltr">
    </div>
    <div class="form-group">
      <label class="form-label">كلمة المرور <span style="color:var(--text-muted);font-size:12px;">(يشاركها الأستاذ لاحقاً)</span></label>
      <input type="text" id="prof-pass" class="form-input" placeholder="مثال: Pass@2025" dir="ltr">
    </div>`;
  document.getElementById('admin-confirm-btn').textContent = 'إنشاء الحساب';
  document.getElementById('admin-confirm-btn').className = 'btn btn-success btn-full';
  document.getElementById('admin-modal').classList.add('open');
  adminAction = { type: 'create-professor' };
}

function openCreateGroupModal() {
  document.getElementById('admin-modal-title').textContent = '📂 إنشاء مجموعة جديدة';
  document.getElementById('admin-modal-desc').textContent  = 'أدخل اسم المجموعة وسيتم توليد الكود تلقائياً.';
  document.getElementById('admin-note').value = '';
  document.getElementById('admin-note').placeholder = 'اسم المجموعة (مثال: مجموعة أ)';
  document.getElementById('admin-confirm-btn').textContent = 'إنشاء المجموعة';
  document.getElementById('admin-confirm-btn').className = 'btn btn-success btn-full';
  document.getElementById('admin-modal').classList.add('open');
  adminAction = { type: 'create-group' };
}

// Override confirmAdminAction to handle new types
const _origConfirm = confirmAdminAction;
window.confirmAdminAction = async function() {
  if (!adminAction) return;
  if (adminAction.type === 'create-professor') {
    const name  = (document.getElementById('prof-name')?.value  || '').trim();
    const email = (document.getElementById('prof-email')?.value || '').trim();
    const pass  = (document.getElementById('prof-pass')?.value  || '').trim();
    if (!name || !email || !pass) { showToast('يرجى تعبئة جميع حقول الأستاذ', 'danger'); return; }
    if (pass.length < 6) { showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'danger'); return; }
    document.getElementById('admin-confirm-btn').disabled = true;
    document.getElementById('admin-confirm-btn').textContent = '...جاري الإنشاء';
    try {
      const res = await DB.createProfessor(name, email, pass);
      if (res && res.error) { showToast(res.error, 'danger'); }
      else { showToast(`✅ تم إنشاء حساب أستاذ: ${name}`, 'success'); closeAdminModal(); loadAdmin(); }
    } catch(e) {
      showToast('خطأ: ' + e.message, 'danger');
    }
    document.getElementById('admin-confirm-btn').disabled = false;
    document.getElementById('admin-confirm-btn').textContent = 'إنشاء الحساب';
    return;
  }
  if (adminAction.type === 'create-group') {
    // Professor creating their own group
    const name = document.getElementById('admin-note').value.trim();
    if (!name) { showToast('أدخل اسم المجموعة', 'danger'); return; }
    const grp = DB.createGroup(name, currentAdminUser.id, currentAdminUser.name);
    showToast(`✅ تم إنشاء "${grp.name}" — الكود: ${grp.code}`, 'success');
    closeAdminModal(); loadAdmin(); return;
  }
  if (adminAction.type === 'create-group-super') {
    // Super admin creating a group with optional professor assignment
    const name = document.getElementById('admin-note').value.trim();
    if (!name) { showToast('أدخل اسم المجموعة', 'danger'); return; }
    const profSel = document.getElementById('modal-prof-select');
    const profId  = profSel ? profSel.value : '';
    const prof    = profId ? DB.getUsers().find(u => u.id === profId) : null;
    const grp = DB.createGroup(name, profId || currentAdminUser.id, prof ? prof.name : currentAdminUser.name);
    showToast(`✅ تم إنشاء "${grp.name}" — الكود: ${grp.code}`, 'success');
    closeAdminModal(); loadAdmin(); return;
  }
  _origConfirm();
};

function catLabel(cat) {
  const map = { tech:'تقني / تطبيق', ecommerce:'تجارة إلكترونية', service:'خدمات', food:'غذاء ومطاعم', education:'تعليم', other:'أخرى' };
  return map[cat] || cat;
}

