/* =============================================
   أفق Platform — Firebase Core Layer
   ============================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBUcJ_mkNqb7_eKHF5TPE4CrcggsuowfUs",
  authDomain: "ofuq-platform.firebaseapp.com",
  projectId: "ofuq-platform",
  storageBucket: "ofuq-platform.firebasestorage.app",
  messagingSenderId: "262896120884",
  appId: "1:262896120884:web:6b8c63623ab4908d098661",
  measurementId: "G-YV5D84Z2KP"
};

firebase.initializeApp(firebaseConfig);
const _auth = firebase.auth();
const _fs   = firebase.firestore();

// ── LOCAL CACHE (Firestore → cache, reads are synchronous) ────────────
const CACHE = { users:[], projects:[], groups:[], notifs:[], _loaded:0 };
let _cacheResolve;
const CACHE_READY = new Promise(r => _cacheResolve = r);
let _listenersStarted = false;

function startCacheListeners(uid) {
  if (_listenersStarted) return; _listenersStarted = true;
  const check = () => { if (++CACHE._loaded >= 3) _cacheResolve(); };
  _fs.collection('users').onSnapshot(s    => { CACHE.users    = s.docs.map(d => d.data()); check(); }, () => check());
  _fs.collection('projects').onSnapshot(s => { CACHE.projects = s.docs.map(d => d.data()); }, () => {});
  _fs.collection('groups').onSnapshot(s   => { CACHE.groups   = s.docs.map(d => d.data()); check(); }, () => check());
  _fs.collection('notifications').where('userId','==',uid).onSnapshot(s => {
    CACHE.notifs = s.docs.map(d => d.data()); check();
  }, () => check());
}

// ── DB OBJECT ──────────────────────────────────────────────────────────
const DB = {
  init() {}, // no-op — Firebase handles init

  getUsers()    { return CACHE.users; },
  getProjects() { return CACHE.projects; },
  getGroups()   { return CACHE.groups; },
  saveUsers()   {}, saveProjects() {}, saveGroups() {},

  getCurrentUser() {
    const u = _auth.currentUser;
    if (!u) return null;
    return CACHE.users.find(p => p.id === u.uid) || null;
  },

  logout() { _auth.signOut().then(() => { window.location.href = 'index.html'; }); },

  // ── NOTIFICATIONS ────────────────────────────────────────────────────
  getNotifications(uid) { return CACHE.notifs.filter(n => n.userId === uid); },
  addNotification(userId, type, message) {
    const n = { id:'n-'+Date.now(), userId, type, message, read:false, createdAt:new Date().toISOString() };
    _fs.collection('notifications').doc(n.id).set(n);
  },
  markNotificationsRead(uid) {
    const batch = _fs.batch();
    CACHE.notifs.filter(n => n.userId===uid && !n.read).forEach(n => {
      batch.update(_fs.collection('notifications').doc(n.id), { read:true });
    });
    batch.commit();
  },

  // ── GROUPS ───────────────────────────────────────────────────────────
  getGroupsByProfessor(pid) { return CACHE.groups.filter(g => g.professorId === pid); },
  getGroupByCode(code) { return CACHE.groups.find(g => g.code === code.toUpperCase().trim()) || null; },
  generateGroupCode() {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let code;
    do { code='GRP-'; for(let i=0;i<4;i++) code+=c[Math.floor(Math.random()*c.length)]; }
    while (CACHE.groups.find(g => g.code === code));
    return code;
  },
  createGroup(name, professorId, professorName) {
    const g = { id:'grp-'+Date.now(), name, code:this.generateGroupCode(), professorId, professorName, createdAt:new Date().toISOString() };
    _fs.collection('groups').doc(g.id).set(g);
    return g;
  },
  assignStudentToGroup(userId, groupId) {
    _fs.collection('users').doc(userId).update({ groupId });
    const proj = CACHE.projects.find(p => p.userId === userId);
    if (proj) _fs.collection('projects').doc(proj.id).update({ groupId });
  },
  async createProfessor(name, email, password) {
    const existing = CACHE.users.find(u => u.email === email);
    if (existing) {
      await _fs.collection('users').doc(existing.id).update({ role:'professor' });
      return { user: existing };
    }
    const inv = { id:'inv-'+Date.now(), email, name, role:'professor', createdAt:new Date().toISOString() };
    await _fs.collection('invitations').doc(inv.id).set(inv);
    return { invitation: inv };
  },

  // ── PROJECTS ──────────────────────────────────────────────────────────
  getUserProject(uid) { return CACHE.projects.find(p => p.userId === uid) || null; },
  createProject(userId, userName, projectName, description, category, groupId) {
    const ms = n => ({ stageNumber:n, status:'locked', completionItems:[], summary:'', proofLink:'', adminNote:'', submittedAt:null, reviewedAt:null });
    const u = CACHE.users.find(u => u.id === userId);
    const resolvedGroupId = groupId || (u ? (u.groupId || 'general') : 'general');
    const proj = { id:'proj-'+Date.now(), userId, userName, projectName, description, category, status:'pending', adminNote:'', currentStage:0, groupId: resolvedGroupId, createdAt:new Date().toISOString(), stages:[1,2,3,4].map(ms) };
    _fs.collection('projects').doc(proj.id).set(proj);
    return proj;
  },
  updateProject(id, updates) { _fs.collection('projects').doc(id).update(updates); },

  adminReviewIdea(projectId, accepted, adminNote) {
    const proj = CACHE.projects.find(p => p.id === projectId); if (!proj) return;
    const updates = { status: accepted?'accepted':'rejected', adminNote: adminNote||'' };
    if (accepted) { const st=[...proj.stages]; st[0]={...st[0],status:'in_progress'}; updates.stages=st; updates.currentStage=1; }
    _fs.collection('projects').doc(projectId).update(updates);
    const msg = accepted ? `✅ تم قبول فكرة مشروعك "${proj.projectName}"! ابدأ رحلتك الآن.${adminNote?' — '+adminNote:''}` : `❌ تم رفض فكرة مشروعك "${proj.projectName}".${adminNote?' السبب: '+adminNote:''}`;
    this.addNotification(proj.userId, accepted?'success':'danger', msg);
  },

  submitStageCompletion(projectId, stageNum, items, summary, proofLink) {
    const proj = CACHE.projects.find(p => p.id === projectId); if (!proj) return;
    const st=[...proj.stages];
    st[stageNum-1]={...st[stageNum-1], status:'submitted', completionItems:items, summary, proofLink:proofLink||'', submittedAt:new Date().toISOString()};
    _fs.collection('projects').doc(projectId).update({ stages:st });
  },

  adminReviewStage(projectId, stageNum, approved, adminNote) {
    const proj = CACHE.projects.find(p => p.id === projectId); if (!proj) return;
    const st=[...proj.stages];
    st[stageNum-1]={...st[stageNum-1], status:approved?'approved':'rejected', adminNote:adminNote||'', reviewedAt:new Date().toISOString()};
    const updates={stages:st};
    if (approved) { if(stageNum<4){st[stageNum]={...st[stageNum],status:'in_progress'};updates.currentStage=stageNum+1;}else{updates.status='completed';} }
    _fs.collection('projects').doc(projectId).update(updates);
    const sn=['الهيكل والتخطيط','قاعدة البيانات','تصميم الواجهات','الإطلاق'];
    const msg = approved ? `✅ تمت الموافقة على المرحلة ${stageNum}: ${sn[stageNum-1]}.${stageNum<4?' يمكنك الانتقال للتالية.':' 🎉 أكملت جميع المراحل!'} ${adminNote?'— '+adminNote:''}` : `❌ تم رفض المرحلة ${stageNum}: ${sn[stageNum-1]}.${adminNote?' — '+adminNote:''}`;
    this.addNotification(proj.userId, approved?'success':'danger', msg);
  },

  // Creates a professor account WITHOUT signing out the current admin
  // Uses a secondary Firebase App instance so auth state is isolated
  async createProfessor(name, email, password) {
    const secondaryApp = firebase.initializeApp(firebaseConfig, 'prof-create-' + Date.now());
    const secondaryAuth = secondaryApp.auth();
    try {
      const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
      const uid  = cred.user.uid;
      await _fs.collection('users').doc(uid).set({
        id: uid, name, email, role: 'professor', groupId: 'professor',
        createdAt: new Date().toISOString()
      });
      await secondaryAuth.signOut();
      await secondaryApp.delete();
      return { uid };
    } catch (err) {
      try { await secondaryApp.delete(); } catch(e) {}
      return { error: err.code === 'auth/email-already-in-use'
        ? 'هذا البريد مستخدم بالفعل'
        : err.message };
    }
  }
};

// ── AUTH ──────────────────────────────────────────────────────────────
async function requireAuth(role) {
  return new Promise(resolve => {
    _auth.onAuthStateChanged(async user => {
      if (!user) { window.location.href = 'auth.html'; resolve(null); return; }
      startCacheListeners(user.uid);
      await CACHE_READY;
      const profile = CACHE.users.find(u => u.id === user.uid);
      if (!profile) { window.location.href = 'auth.html'; resolve(null); return; }
      if (role==='admin' && profile.role!=='admin' && profile.role!=='professor') { window.location.href='dashboard.html'; resolve(null); return; }
      if (role==='user' && profile.role!=='user') { window.location.href='admin.html'; resolve(null); return; }
      resolve(profile);
    });
  });
}

// ── THEME & LANGUAGE ──────────────────────────────────────────────────
const SETTINGS = {
  getTheme() { return localStorage.getItem('afq_theme') || 'dark'; },
  setTheme(th) { localStorage.setItem('afq_theme', th); applyTheme(th); },
  getLang()  { return localStorage.getItem('afq_lang') || 'ar'; },
  setLang(l) { localStorage.setItem('afq_lang', l); location.reload(); }
};
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('[data-theme-icon]').forEach(el => { el.textContent = theme==='dark' ? '☀️' : '🌙'; });
}
(function() {
  const t=localStorage.getItem('afq_theme')||'dark', l=localStorage.getItem('afq_lang')||'ar';
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.setAttribute('lang', l);
  document.documentElement.setAttribute('dir', l==='ar'?'rtl':'ltr');
})();
function applyLang(lang) {
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang==='ar'?'rtl':'ltr');
  document.querySelectorAll('[data-lang-btn]').forEach(el => { el.textContent = lang==='ar'?'EN':'عر'; });
  document.querySelectorAll('[data-i18n]').forEach(el => { const k=el.getAttribute('data-i18n'); if(TR[lang]&&TR[lang][k]) el.textContent=TR[lang][k]; });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { const k=el.getAttribute('data-i18n-ph'); if(TR[lang]&&TR[lang][k]) el.placeholder=TR[lang][k]; });
}
function initSettings() { applyTheme(SETTINGS.getTheme()); applyLang(SETTINGS.getLang()); }
function toggleTheme() { SETTINGS.setTheme(SETTINGS.getTheme()==='dark'?'light':'dark'); }
function toggleLang()  { SETTINGS.setLang(SETTINGS.getLang()==='ar'?'en':'ar'); }

// ── TRANSLATIONS ──────────────────────────────────────────────────────
const TR = {
  ar: {
    // Nav
    'nav.login': 'تسجيل الدخول', 'nav.start': 'ابدأ رحلتك ✨',
    // Auth
    'auth.login_tab': 'تسجيل الدخول', 'auth.register_tab': 'إنشاء حساب',
    'auth.email': 'البريد الإلكتروني', 'auth.password': 'كلمة المرور',
    'auth.confirm': 'تأكيد كلمة المرور', 'auth.name': 'الاسم الكامل',
    'auth.name_ph': 'محمد العلي',
    'auth.login_btn': 'دخول ←', 'auth.register_btn': 'إنشاء الحساب 🚀',
    // Dashboard sidebar
    'dash.home': 'الرئيسية', 'dash.idea': 'تقديم الفكرة',
    'dash.track': 'متابعة المشروع', 'dash.role': 'رائد أعمال',
    // Home stats
    'home.subtitle': 'إليك نظرة سريعة على حالة مشروعك',
    'home.stat1': 'مرحلتك الحالية', 'home.stat2': 'مراحل مكتملة', 'home.stat3': 'حالة الطلب',
    // Idea section
    'idea.title': 'تقديم فكرة مشروع 💡', 'idea.subtitle': 'أخبرنا عن فكرتك وسيراجعها المشرف في أقرب وقت',
    'idea.owner_name': 'اسمك', 'idea.name': 'اسم المشروع', 'idea.name_ph': 'متجري الإلكتروني...',
    'idea.desc': 'وصف الفكرة', 'idea.desc_ph': 'اشرح فكرتك بشكل مختصر...',
    'idea.category': 'التصنيف', 'idea.submit': 'تقديم الفكرة 🚀',
    'idea.cat0': 'اختر تصنيفاً', 'idea.cat1': 'تقني / تطبيق', 'idea.cat2': 'تجارة إلكترونية',
    'idea.cat3': 'خدمات', 'idea.cat4': 'غذاء ومطاعم', 'idea.cat5': 'تعليم', 'idea.cat6': 'أخرى',
    // Track section
    'track.title': 'متابعة مشروعك 📈',
    // Statuses
    'status.pending': 'قيد المراجعة', 'status.accepted': 'مقبول', 'status.rejected': 'مرفوض',
    'status.completed': 'مكتمل', 'status.locked': 'مقفلة', 'status.in_progress': 'جارية',
    'status.submitted': 'بانتظار الموافقة', 'status.approved': 'مكتملة',
    // Buttons
    'btn.start_idea': 'قدّم فكرتك الآن 💡', 'btn.track': 'تابع مشروعك →',
    'btn.complete': 'إتمام المرحلة ✅', 'btn.resubmit': 'أعد التقديم',
    'btn.send': 'إرسال للمشرف ✅', 'btn.confirm': 'تأكيد', 'btn.cancel': 'إلغاء',
    'btn.review': 'مراجعة', 'btn.accept_idea': '✅ قبول', 'btn.reject_idea': '❌ رفض',
    'btn.approve_stage': '✅ قبول المرحلة', 'btn.reject_stage': '❌ رفض المرحلة',
    // Messages
    'msg.manager_msg': 'رسالة المشرف:', 'msg.stage_done': 'أكملت جميع المراحل! 🎉',
    'msg.idea_pending': '⏳ فكرتك قيد المراجعة من قِبَل المشرف.', 'msg.idea_accepted': '✅ تمت الموافقة على فكرتك! ابدأ متابعة مشروعك.',
    'msg.idea_rejected': '❌ تم رفض الفكرة. يمكنك تعديلها وإعادة تقديمها.', 'msg.idea_completed': '🏆 أكملت مشروعك بنجاح!',
    'msg.admin_note': 'ملاحظة المشرف:', 'msg.rejection': 'سبب الرفض:',
    'msg.under_review': 'طلبك قيد المراجعة', 'msg.under_review_sub': 'سيتم الرد في أقرب وقت ممكن.',
    'msg.what_done': 'ما أنجزته:', 'msg.wait': '⏳ في انتظار موافقة المشرف على فكرتك.',
    'msg.rejected_track': '❌ تم رفض فكرتك. يرجى تعديلها في قسم الفكرة.', 'msg.all_done': '🎉 مبروك! أكملت جميع المراحل الأربع بنجاح.',
    'msg.recent': 'آخر النشاطات', 'msg.owner': 'مقدّم:',
    // Modal
    'modal.title': 'إتمام المرحلة', 'modal.desc': 'اختر ما أنجزته في هذه المرحلة:',
    'modal.summary': 'ملخص قصير عما أنجزته', 'modal.summary_ph': 'اكتب هنا ملخصاً سريعاً...',
    'modal.note': 'رسالتك للمستخدم', 'modal.note_opt': '(اختياري)', 'modal.note_ph': 'اكتب ملاحظاتك أو سبب القرار...',
    // Errors
    'err.fill': 'يرجى تعبئة جميع الحقول', 'err.pass_match': 'كلمتا المرور غير متطابقتين',
    'err.pass_short': 'كلمة المرور قصيرة جداً (6 أحرف على الأقل)',
    'err.check_one': 'يرجى تحديد عنصر واحد على الأقل', 'err.summary': 'يرجى كتابة ملخص قصير',
    'err.email_used': 'هذا البريد الإلكتروني مستخدم بالفعل', 'err.invalid_login': 'البريد أو كلمة المرور غير صحيحة',
    'err.no_user': 'المستخدم غير موجود', 'err.group_not_found': 'كود المجموعة غير صحيح',
    // Toasts
    'toast.welcome': '👋 أهلاً بعودتك!', 'toast.created': '✅ تم إنشاء حسابك بنجاح!',
    'toast.idea_sent': '✅ تم إرسال فكرتك بنجاح!', 'toast.stage_sent': '✅ تم إرسال طلب إتمام المرحلة!',
    'toast.accepted': '✅ تمت الموافقة', 'toast.rejected': '❌ تم الرفض',
    'toast.stage_ok': '✅ تمت الموافقة على المرحلة', 'toast.stage_no': '❌ تم رفض المرحلة',
    // Empty states
    'empty.no_project': 'لا يوجد مشروع بعد', 'empty.no_project_sub': 'ابدأ بتقديم فكرة مشروعك الآن!',
    'empty.no_idea_yet': 'لم تبدأ بعد', 'empty.no_idea_sub': 'قدّم فكرتك لتبدأ متابعة مشروعك',
    'empty.no_pending': 'لا توجد أفكار معلقة', 'empty.no_pending_sub': 'كل شيء مُراجَع ✅',
    'empty.no_active': 'لا توجد مشاريع نشطة', 'empty.no_active_sub': 'ستظهر المشاريع المقبولة هنا',
    'empty.no_completed': 'لا توجد مشاريع مكتملة بعد', 'empty.no_users': 'لا يوجد مستخدمون بعد',
    'empty.no_activity': 'لا توجد نشاطات حديثة',
    // Admin sections
    'admin.overview.title': 'نظرة عامة على المنصة 📊', 'admin.overview.sub': 'إحصائيات وآخر نشاطات المستخدمين',
    'admin.pending.title': 'الأفكار المعلقة 🟡', 'admin.pending.sub': 'راجع الأفكار المقدمة واتخذ قرارك',
    'admin.active.title': 'المشاريع النشطة 🚀', 'admin.active.sub': 'تابع تقدم المشاريع وراجع طلبات إتمام المراحل',
    'admin.completed.title': 'المشاريع المكتملة 🏆', 'admin.completed.sub': 'المشاريع التي أنجز أصحابها جميع المراحل',
    'admin.users.title': 'المستخدمون 👥', 'admin.users.sub': 'قائمة بجميع رواد الأعمال المسجلين',
    // Stats
    'stat.users': 'مستخدم', 'stat.pending': 'فكرة معلقة', 'stat.active': 'مشروع نشط', 'stat.completed_count': 'مشروع مكتمل',
  },
  en: {
    'nav.login': 'Sign In', 'nav.start': 'Start Your Journey ✨',
    'auth.login_tab': 'Sign In', 'auth.register_tab': 'Create Account',
    'auth.email': 'Email', 'auth.password': 'Password',
    'auth.confirm': 'Confirm Password', 'auth.name': 'Full Name', 'auth.name_ph': 'John Doe',
    'auth.login_btn': 'Sign In →', 'auth.register_btn': 'Create Account 🚀',
    'dash.home': 'Home', 'dash.idea': 'Submit Idea', 'dash.track': 'Track Project', 'dash.role': 'Entrepreneur',
    'home.subtitle': 'A quick overview of your project status',
    'home.stat1': 'Current Stage', 'home.stat2': 'Completed Stages', 'home.stat3': 'Request Status',
    'idea.title': 'Submit Project Idea 💡', 'idea.subtitle': 'Tell us about your idea and our mentors will review it shortly',
    'idea.owner_name': 'Your Name', 'idea.name': 'Project Name', 'idea.name_ph': 'My Online Store...',
    'idea.desc': 'Idea Description', 'idea.desc_ph': 'Briefly describe your idea...',
    'idea.category': 'Category', 'idea.submit': 'Submit Idea 🚀',
    'idea.cat0': 'Select a category', 'idea.cat1': 'Tech / App', 'idea.cat2': 'E-Commerce',
    'idea.cat3': 'Services', 'idea.cat4': 'Food & Restaurants', 'idea.cat5': 'Education', 'idea.cat6': 'Other',
    'track.title': 'Track Your Project 📈',
    'status.pending': 'Under Review', 'status.accepted': 'Accepted', 'status.rejected': 'Rejected',
    'status.completed': 'Completed', 'status.locked': 'Locked', 'status.in_progress': 'In Progress',
    'status.submitted': 'Awaiting Approval', 'status.approved': 'Approved',
    'btn.start_idea': 'Submit Your Idea 💡', 'btn.track': 'Track Project →',
    'btn.complete': 'Complete Stage ✅', 'btn.resubmit': 'Resubmit',
    'btn.send': 'Send to Mentor ✅', 'btn.confirm': 'Confirm', 'btn.cancel': 'Cancel',
    'btn.review': 'Review', 'btn.accept_idea': '✅ Accept', 'btn.reject_idea': '❌ Reject',
    'btn.approve_stage': '✅ Approve Stage', 'btn.reject_stage': '❌ Reject Stage',
    'msg.manager_msg': 'Mentor Note:', 'msg.stage_done': 'All stages completed! 🎉',
    'msg.idea_pending': '⏳ Your idea is under review by the mentor.',
    'msg.idea_accepted': '✅ Your idea has been accepted! Start tracking your project.',
    'msg.idea_rejected': '❌ Your idea was rejected. You may revise and resubmit.',
    'msg.idea_completed': '🏆 Your project is complete!',
    'msg.admin_note': 'Mentor Note:', 'msg.rejection': 'Rejection Reason:',
    'msg.under_review': 'Your submission is under review', 'msg.under_review_sub': 'You will receive a response soon.',
    'msg.what_done': 'What you completed:', 'msg.wait': '⏳ Waiting for mentor approval on your idea.',
    'msg.rejected_track': '❌ Your idea was rejected. Please update it in the Idea section.',
    'msg.all_done': '🎉 Congratulations! You completed all four stages successfully.',
    'msg.recent': 'Recent Activity', 'msg.owner': 'By:',
    'modal.title': 'Complete Stage', 'modal.desc': 'Select what you completed in this stage:',
    'modal.summary': 'Brief summary of your progress', 'modal.summary_ph': 'Write a quick summary...',
    'modal.note': 'Message to user', 'modal.note_opt': '(optional)', 'modal.note_ph': 'Write your notes or reason...',
    'err.fill': 'Please fill in all fields', 'err.pass_match': 'Passwords do not match',
    'err.pass_short': 'Password is too short (min 6 characters)',
    'err.check_one': 'Please check at least one item', 'err.summary': 'Please write a brief summary',
    'err.email_used': 'This email is already in use', 'err.invalid_login': 'Incorrect email or password',
    'err.no_user': 'User not found', 'err.group_not_found': 'Invalid group code',
    'toast.welcome': '👋 Welcome back!', 'toast.created': '✅ Account created successfully!',
    'toast.idea_sent': '✅ Your idea was submitted!', 'toast.stage_sent': '✅ Stage completion request sent!',
    'toast.accepted': '✅ Accepted', 'toast.rejected': '❌ Rejected',
    'toast.stage_ok': '✅ Stage approved', 'toast.stage_no': '❌ Stage rejected',
    'empty.no_project': 'No project yet', 'empty.no_project_sub': 'Start by submitting your idea!',
    'empty.no_idea_yet': 'Not started yet', 'empty.no_idea_sub': 'Submit your idea to start tracking',
    'empty.no_pending': 'No pending ideas', 'empty.no_pending_sub': 'Everything is reviewed ✅',
    'empty.no_active': 'No active projects', 'empty.no_active_sub': 'Accepted projects will appear here',
    'empty.no_completed': 'No completed projects yet', 'empty.no_users': 'No users yet',
    'empty.no_activity': 'No recent activity',
    'admin.overview.title': 'Platform Overview 📊', 'admin.overview.sub': 'Stats and recent user activity',
    'admin.pending.title': 'Pending Ideas 🟡', 'admin.pending.sub': 'Review submitted ideas and make a decision',
    'admin.active.title': 'Active Projects 🚀', 'admin.active.sub': 'Track progress and review stage completion requests',
    'admin.completed.title': 'Completed Projects 🏆', 'admin.completed.sub': 'Projects where all stages are done',
    'admin.users.title': 'Users 👥', 'admin.users.sub': 'List of all registered entrepreneurs',
    'stat.users': 'Users', 'stat.pending': 'Pending Idea', 'stat.active': 'Active Project', 'stat.completed_count': 'Completed',
  }
};

function t(key) {
  const lang = SETTINGS.getLang();
  return (TR[lang] && TR[lang][key]) ? TR[lang][key] : (TR['ar'][key] || key);
}

// ── SHARED HELPERS ─────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff/60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff/3600)} س`;
  return `منذ ${Math.floor(diff/86400)} يوم`;
}

const STAGE_ICONS = ['💡', '🏗️', '🎨', '🚀'];

function getStageNames() {
  const lang = SETTINGS.getLang();
  return lang === 'en'
    ? ['Idea & Planning', 'Foundation', 'Design & Dev', 'Launch']
    : ['الفكرة والتخطيط', 'البنية والتأسيس', 'التصميم والتطوير', 'الإطلاق'];
}

function getStageChecklists() {
  const lang = SETTINGS.getLang();
  if (lang === 'en') return [
    ['Market Research', 'Business Model Canvas', 'SWOT Analysis', 'Target Audience Definition'],
    ['Database Design', 'Team Formation', 'Financial Plan', 'Legal Structure'],
    ['UI/UX Wireframes', 'Prototype Build', 'User Testing', 'Feedback Integration'],
    ['Marketing Plan', 'Official Launch', 'Social Media Setup', 'GitHub Repository'],
  ];
  return [
    ['البحث السوقي', 'نموذج العمل التجاري', 'تحليل SWOT', 'تحديد الفئة المستهدفة'],
    ['تصميم قاعدة البيانات', 'تكوين الفريق', 'الخطة المالية', 'الهيكل القانوني'],
    ['تصميم الواجهات (Wireframes)', 'بناء النموذج الأولي', 'اختبار المستخدم', 'دمج التغذية الراجعة'],
    ['خطة التسويق', 'الإطلاق الرسمي', 'إعداد وسائل التواصل', 'رابط GitHub للمشروع'],
  ];
}
