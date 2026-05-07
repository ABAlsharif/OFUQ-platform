/* =============================================
   أفق Platform — User Dashboard Logic
   ============================================= */

let currentUser = null;
let currentProject = null;
let currentModalStage = null;

window.addEventListener('DOMContentLoaded', async () => {
  initSettings();
  currentUser = await requireAuth('user');
  if (!currentUser) return;

  document.getElementById('user-name-display').textContent = currentUser.name;
  document.getElementById('user-avatar').textContent = currentUser.name.charAt(0);
  document.getElementById('welcome-msg').textContent = `أهلاً، ${currentUser.name} 👋`;

  loadDashboard();

  // Auto-refresh every 4 seconds — skips idea form to avoid wiping typed text
  setInterval(() => loadDashboard(true), 4000);

  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadDashboard(); });
});

function loadDashboard(isAutoRefresh = false) {
  currentProject = DB.getUserProject(currentUser.id);
  renderHome();
  // Don't re-render idea form during auto-refresh if user hasn't submitted yet
  // (avoids wiping text they're currently typing)
  if (!isAutoRefresh || currentProject) {
    renderIdeaSection();
  }
  renderTrackSection();
}

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  document.getElementById('link-' + name).classList.add('active');
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = type === 'success' ? 'var(--success)' : type === 'danger' ? 'var(--danger)' : 'var(--border-light)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── HOME ──────────────────────────────────────────────────────────────
function renderHome() {
  const p = currentProject;

  // Notification inbox
  const notifs = DB.getNotifications(currentUser.id);
  const unread = notifs.filter(n => !n.read);
  let notifHtml = '';
  if (notifs.length > 0) {
    notifHtml = `
      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h3 style="font-size:15px;color:var(--text-secondary);">🔔 الإشعارات ${unread.length > 0 ? `<span style="background:var(--danger);color:#fff;font-size:11px;padding:2px 7px;border-radius:99px;margin-right:6px;">${unread.length}</span>` : ''}</h3>
          ${unread.length > 0 ? `<button class="btn btn-ghost btn-sm" onclick="markNotifsRead()">تحديد كمقروءة</button>` : ''}
        </div>
        ${notifs.slice().reverse().slice(0, 5).map(n => `
          <div style="display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-radius:var(--radius-sm);border:1px solid ${n.type==='success'?'var(--success)':n.type==='danger'?'var(--danger)':'var(--border)'};background:var(--bg-dark);margin-bottom:8px;opacity:${n.read?'0.6':'1'};">
            <span style="font-size:18px;">${n.type==='success'?'✅':'❌'}</span>
            <div style="flex:1;font-size:13px;">${n.message}</div>
            <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${timeAgo(n.createdAt)}</span>
          </div>`).join('')}
      </div>`;
  }

  if (!p) {
    document.getElementById('stat-stage').textContent = '—';
    document.getElementById('stat-done').textContent = '0';
    document.getElementById('stat-status-val').textContent = 'لا يوجد';
    document.getElementById('home-project-area').innerHTML = notifHtml + `
      <div class="card" style="text-align:center;padding:56px;">
        <div style="font-size:52px;margin-bottom:16px;">💡</div>
        <h3 style="margin-bottom:10px;font-size:22px;">${t('empty.no_project')}</h3>
        <p style="margin-bottom:28px;">${t('empty.no_project_sub')}</p>
        <button class="btn btn-primary btn-lg" onclick="showSection('idea')">${t('btn.start_idea')}</button>
      </div>`;
    return;
  }

  const stagesDone = p.stages.filter(s => s.status === 'approved').length;
  const stageLabel = p.status === 'accepted' ? `المرحلة ${p.currentStage}` : (p.status === 'completed' ? 'مكتمل' : '—');
  document.getElementById('stat-stage').textContent = stageLabel;
  document.getElementById('stat-done').textContent = stagesDone;

  let statusText = '', statusClass = '';
  if (p.status === 'pending')   { statusText = t('status.pending');   statusClass = 'badge-pending'; }
  if (p.status === 'accepted')  { statusText = t('status.accepted');  statusClass = 'badge-success'; }
  if (p.status === 'rejected')  { statusText = t('status.rejected');  statusClass = 'badge-danger'; }
  if (p.status === 'completed') { statusText = t('status.completed'); statusClass = 'badge-purple'; }
  document.getElementById('stat-status-val').textContent = statusText;

  let adminMsgHtml = '';
  if (p.adminNote) {
    adminMsgHtml = `
      <div class="alert ${p.status === 'rejected' ? 'alert-danger' : 'alert-info'}" style="margin-top:16px;">
        <span>💬</span>
        <div><strong>${t('msg.manager_msg')}</strong> ${p.adminNote}</div>
      </div>`;
  }

  document.getElementById('home-project-area').innerHTML = notifHtml + `
    <div class="project-card status-${p.status}">
      <div class="flex justify-between items-center" style="margin-bottom:12px;">
        <h3 style="font-size:20px;">${p.projectName}</h3>
        <span class="badge ${statusClass}"><span class="dot dot-pulse" style="background:currentColor;"></span>${statusText}</span>
      </div>
      <p style="margin-bottom:16px;">${p.description}</p>
      ${adminMsgHtml}
      ${p.status === 'accepted' ? `<button class="btn btn-primary mt-16" onclick="showSection('track')">${t('btn.track')}</button>` : ''}
      ${p.status === 'completed' ? `<div class="alert alert-success mt-16"><span>🎉</span> ${t('msg.stage_done')}</div>` : ''}
    </div>`;
}

function markNotifsRead() {
  DB.markNotificationsRead(currentUser.id);
  renderHome();
}

// ── IDEA SECTION ──────────────────────────────────────────────────────
function renderIdeaSection() {
  const el = document.getElementById('idea-content');
  if (!currentProject) {
    const groups = DB.getGroups();
    const groupOptions = groups.map(g =>
      `<option value="${g.id}" ${currentUser.groupId === g.id ? 'selected' : ''}>${g.name} — ${g.code}</option>`
    ).join('');
    const groupSelector = groups.length ? `
      <div class="form-group">
        <label class="form-label">📁 ${SETTINGS.getLang()==='en'?'Your Group':'مجموعتك'}</label>
        <select id="proj-group" class="form-select">
          <option value="general" ${!currentUser.groupId || currentUser.groupId==='general' ? 'selected' : ''}>${SETTINGS.getLang()==='en'?'General Group (no group code)':'المجموعة العامة (لا يوجد كود)'}</option>
          ${groupOptions}
        </select>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">${SETTINGS.getLang()==='en'?'Choose the group your professor assigned you to.':'اختر المجموعة التي ينتمي إليها استاذك.'}</div>
      </div>` : '';
    el.innerHTML = `
      <div class="card" style="max-width:640px;">
        <div class="form-group">
          <label class="form-label">${t('idea.owner_name') || (SETTINGS.getLang()==='en'?'Your Name':'اسمك')}</label>
          <input type="text" id="proj-owner" class="form-input" value="${currentUser.name}" readonly style="opacity:0.7;cursor:default;">
        </div>
        <div class="form-group">
          <label class="form-label">${t('idea.name')}</label>
          <input type="text" id="proj-name" class="form-input" placeholder="${t('idea.name_ph')}">
        </div>
        <div class="form-group">
          <label class="form-label">${t('idea.desc')}</label>
          <textarea id="proj-desc" class="form-textarea" rows="5" placeholder="${t('idea.desc_ph')}"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">${t('idea.category')}</label>
          <select id="proj-cat" class="form-select">
            <option value="">${t('idea.cat0')}</option>
            <option value="tech">${t('idea.cat1')}</option>
            <option value="ecommerce">${t('idea.cat2')}</option>
            <option value="service">${t('idea.cat3')}</option>
            <option value="food">${t('idea.cat4')}</option>
            <option value="education">${t('idea.cat5')}</option>
            <option value="other">${t('idea.cat6')}</option>
          </select>
        </div>
        ${groupSelector}
        <div id="idea-error" class="form-error"></div>
        <button class="btn btn-primary btn-full btn-lg" onclick="submitIdea()">${t('idea.submit')}</button>
      </div>`;
  } else {
    let msg = '', cls = '';
    if (currentProject.status === 'pending')   { msg = t('msg.idea_pending');   cls = 'alert-warning'; }
    if (currentProject.status === 'accepted')  { msg = t('msg.idea_accepted');  cls = 'alert-success'; }
    if (currentProject.status === 'rejected')  { msg = t('msg.idea_rejected');  cls = 'alert-danger'; }
    if (currentProject.status === 'completed') { msg = t('msg.idea_completed'); cls = 'alert-success'; }

    el.innerHTML = `
      <div class="alert ${cls}">${msg}</div>
      <div class="card" style="max-width:640px;">
        <h3 style="margin-bottom:8px;">${currentProject.projectName}</h3>
        <p>${currentProject.description}</p>
        ${currentProject.adminNote ? `<div class="alert alert-info mt-16"><span>💬</span> <strong>${t('msg.admin_note')}</strong> ${currentProject.adminNote}</div>` : ''}
        ${currentProject.status === 'rejected' ? `<button class="btn btn-danger mt-16" onclick="resetProject()">${t('btn.resubmit')}</button>` : ''}
      </div>`;
  }
}

function submitIdea() {
  const name = document.getElementById('proj-name').value.trim();
  const desc = document.getElementById('proj-desc').value.trim();
  const cat  = document.getElementById('proj-cat').value;
  if (!name || !desc || !cat) {
    const e = document.getElementById('idea-error');
    e.textContent = t('err.fill');
    e.classList.add('show');
    setTimeout(() => e.classList.remove('show'), 3000);
    return;
  }
  // Get selected group and update user profile if changed
  const groupSel = document.getElementById('proj-group');
  const selectedGroupId = groupSel ? groupSel.value : (currentUser.groupId || 'general');
  if (selectedGroupId !== currentUser.groupId) {
    _fs.collection('users').doc(currentUser.id).update({ groupId: selectedGroupId });
    currentUser.groupId = selectedGroupId;
    // Update local cache too
    const cached = CACHE.users.find(u => u.id === currentUser.id);
    if (cached) cached.groupId = selectedGroupId;
  }
  DB.createProject(currentUser.id, currentUser.name, name, desc, cat, selectedGroupId);
  showToast(t('toast.idea_sent'), 'success');
  loadDashboard();
}

function resetProject() {
  if (!currentProject) return;
  _fs.collection('projects').doc(currentProject.id).delete();
  currentProject = null;
  loadDashboard();
}

// ── TRACK SECTION ──────────────────────────────────────────────────────
function renderTrackSection() {
  const el = document.getElementById('track-content');
  const p = currentProject;

  const STAGE_NAMES = getStageNames();
  const STAGE_CHECKLISTS = getStageChecklists();
  if (!p) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span><h3>${t('empty.no_idea_yet')}</h3><p>${t('empty.no_idea_sub')}</p></div>`;
    return;
  }
  if (p.status === 'pending') {
    el.innerHTML = `<div class="alert alert-warning">${t('msg.wait')}</div>`;
    return;
  }
  if (p.status === 'rejected') {
    el.innerHTML = `<div class="alert alert-danger">${t('msg.rejected_track')}</div>`;
    return;
  }

  document.getElementById('track-project-name').textContent = `مشروع: ${p.projectName}`;

  // Build stepper
  const stepperHtml = p.stages.map((stage, idx) => {
    const sNum = idx + 1;
    const statusMap = { locked:'🔒', in_progress:'⚡', submitted:'⏳', approved:'✅', rejected:'❌' };
    const labelMap = { locked:t('status.locked'), in_progress:t('status.in_progress'), submitted:t('status.submitted'), approved:t('status.approved'), rejected:t('status.rejected') };
    const isActive = stage.status === 'in_progress' || stage.status === 'submitted' || stage.status === 'rejected';
    return `
      <div class="stage-step">
        <div class="stage-circle ${stage.status}">${statusMap[stage.status] || sNum}</div>
        <div class="stage-label ${isActive ? 'active-label' : ''}">${STAGE_ICONS[idx]} ${STAGE_NAMES[idx]}</div>
        <div class="stage-status" style="color:${stage.status==='approved'?'var(--success)':stage.status==='rejected'?'var(--danger)':stage.status==='submitted'?'var(--warning)':'var(--text-muted)'}">${labelMap[stage.status]||''}</div>
      </div>`;
  }).join('');

  // Current active stage detail
  const activeStage = p.stages.find(s => ['in_progress','submitted','rejected'].includes(s.status));
  let stageDetailHtml = '';

  if (activeStage) {
    const si = activeStage.stageNumber - 1;
    const isSubmitted = activeStage.status === 'submitted';
    const isRejected = activeStage.status === 'rejected';

    stageDetailHtml = `
      <div class="card" style="margin-top:28px;">
        <div class="flex justify-between items-center" style="margin-bottom:20px;">
          <h3 style="font-size:20px;">${STAGE_ICONS[si]} المرحلة ${activeStage.stageNumber}: ${STAGE_NAMES[si]}</h3>
          <span class="badge ${isSubmitted?'badge-pending':isRejected?'badge-danger':'badge-info'}">
            ${isSubmitted?'⏳ '+t('status.submitted'):isRejected?'❌ '+t('status.rejected'):'⚡ '+t('status.in_progress')}
          </span>
        </div>

        ${isRejected && activeStage.adminNote ? `
          <div class="alert alert-danger">
            <span>💬</span>
            <div><strong>${t('msg.rejection')}</strong> ${activeStage.adminNote}</div>
          </div>` : ''}

        ${isSubmitted ? `
          <div class="alert alert-warning">
            <span>⏳</span>
            <div>
              <strong>${t('msg.under_review')}</strong><br>
              <span style="font-size:13px;font-weight:400;">${t('msg.under_review_sub')}</span>
            </div>
          </div>
          <div style="margin-top:16px;">
            <p class="text-sm text-muted" style="margin-bottom:8px;">${t('msg.what_done')}</p>
            ${activeStage.completionItems.map(i => `<span class="badge badge-info" style="margin:3px;">${i}</span>`).join('')}
          </div>
          ${activeStage.summary ? `<p class="text-sm mt-12" style="background:var(--bg-dark);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--border);">${activeStage.summary}</p>` : ''}
          ${activeStage.proofLink ? `<div style="margin-top:12px;padding:10px 14px;background:var(--bg-dark);border-radius:var(--radius-sm);border:1px solid var(--border);font-size:13px;">🔗 <strong>رابط العمل:</strong> <a href="${activeStage.proofLink}" target="_blank" style="color:var(--primary);word-break:break-all;">${activeStage.proofLink}</a></div>` : ''}
        ` : `
          <button class="btn btn-primary" onclick="openCompletionModal(${activeStage.stageNumber})">${t('btn.complete')}</button>
        `}
      </div>`;
  }

  // Completed stages
  const completedStages = p.stages.filter(s => s.status === 'approved');
  let completedHtml = '';
  if (completedStages.length > 0) {
    completedHtml = `
      <div style="margin-top:20px;">
        <h3 style="margin-bottom:16px;font-size:17px;color:var(--text-secondary);">المراحل المكتملة</h3>
        ${completedStages.map(s => `
          <div class="card card-hover" style="margin-bottom:12px;border-right:3px solid var(--success);">
            <div class="flex justify-between items-center">
              <div><strong>${STAGE_ICONS[s.stageNumber-1]} المرحلة ${s.stageNumber}: ${STAGE_NAMES[s.stageNumber-1]}</strong></div>
              <span class="badge badge-success">✅ مكتملة</span>
            </div>
            ${s.adminNote ? `<p class="text-sm mt-8" style="color:var(--success);">💬 ${s.adminNote}</p>` : ''}
          </div>`).join('')}
      </div>`;
  }

  if (p.status === 'completed') {
    stageDetailHtml = `<div class="alert alert-success" style="margin-top:20px;">${t('msg.all_done')}</div>`;
  }

  el.innerHTML = `
    <div class="card">
      <div class="stage-stepper">${stepperHtml}</div>
      ${stageDetailHtml}
    </div>
    ${completedHtml}`;
}

// ── MODAL ──────────────────────────────────────────────────────────────
function openCompletionModal(stageNum) {
  currentModalStage = stageNum;
  const STAGE_NAMES_L = getStageNames();
  const STAGE_CHECKLISTS_L = getStageChecklists();
  const items = STAGE_CHECKLISTS_L[stageNum - 1];
  document.getElementById('modal-stage-title').textContent = `${t('modal.title')} ${stageNum}: ${STAGE_NAMES_L[stageNum-1]}`;
  document.getElementById('modal-checklist').innerHTML = items.map((item, i) => `
    <div class="checklist-item" onclick="toggleCheck(this)">
      <input type="checkbox" id="chk-${i}">
      <label for="chk-${i}">${item}</label>
    </div>`).join('');
  document.getElementById('modal-summary').value = '';
  document.getElementById('modal-proof-link').value = '';
  // Stage 4 label: emphasise GitHub link is mandatory
  const proofRow = document.getElementById('proof-link-row');
  if (stageNum === 4) {
    proofRow.querySelector('label').textContent = '🔗 رابط GitHub الخاص بمشروعك (إلزامي)';
    document.getElementById('modal-proof-link').placeholder = 'https://github.com/username/project';
  } else {
    proofRow.querySelector('label').textContent = '🔗 رابط إثبات عملك (GitHub / Figma / Drive...)';
    document.getElementById('modal-proof-link').placeholder = 'https://';
  }
  document.getElementById('modal-error').classList.remove('show');
  document.getElementById('completion-modal').classList.add('open');
}

function toggleCheck(el) {
  const chk = el.querySelector('input[type=checkbox]');
  chk.checked = !chk.checked;
  el.classList.toggle('checked', chk.checked);
}

function closeModal() {
  document.getElementById('completion-modal').classList.remove('open');
  currentModalStage = null;
}

function submitCompletion() {
  const checked = Array.from(document.querySelectorAll('#modal-checklist input:checked'))
    .map(c => c.nextElementSibling.textContent);
  const summary = document.getElementById('modal-summary').value.trim();
  const proofLink = document.getElementById('modal-proof-link').value.trim();
  const errEl = document.getElementById('modal-error');

  if (checked.length === 0) {
    errEl.textContent = t('err.check_one'); errEl.classList.add('show'); return;
  }
  if (!summary) {
    errEl.textContent = t('err.summary'); errEl.classList.add('show'); return;
  }
  if (currentModalStage === 4 && !proofLink) {
    errEl.textContent = 'رابط GitHub إلزامي في المرحلة الأخيرة'; errEl.classList.add('show'); return;
  }

  DB.submitStageCompletion(currentProject.id, currentModalStage, checked, summary, proofLink);
  closeModal();
  showToast(t('toast.stage_sent'), 'success');
  loadDashboard();
  showSection('track');
}
