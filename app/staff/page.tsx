'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { loadSession, saveSession, clearSession } from '@/lib/session';
import type { StaffSession, StockRequest, CourseReg, VenueBooking, Item, Course, Venue, StaffInfo, ActivityNotice, AllRecord, CourseLink } from '@/lib/types';

type Tab = 'venue' | 'stock' | 'course' | 'items' | 'courses' | 'venues' | 'activity' | 'records' | 'staff' | 'password' | 'courseLinks';

const STATUS_PILL: Record<string, string> = {
  pending: 'pending', approved: 'approved', confirmed: 'confirmed', rejected: 'rejected',
  returned: 'returned', done: 'done', waitlist: 'waitlist', filed: 'done',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '待批', approved: '已批', confirmed: '已確認', rejected: '已拒',
  returned: '已歸還', done: '完成', waitlist: '候補', filed: '已存檔',
};

export default function StaffPage() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('venue');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const s = loadSession();
    if (s) {
      setSession(s);
      api.staffVerify(s.token).then((r) => {
        if (r.ok && r.data) { setSession(r.data); saveSession(r.data); }
        else { clearSession(); setSession(null); }
      });
    }
  }, []);

  // 依權限決定可見 tab
  const tabs = useMemo(() => {
    if (!session) return [] as Tab[];
    const t: Tab[] = [];
    if (session.canVenue) t.push('venue', 'venues');
    if (session.canStock) t.push('stock', 'items');
    if (session.canCourse) t.push('course', 'courses');
    if (session.canCourse) t.push('courseLinks'); // 訓練班 Script 管理
    t.push('activity', 'records'); // 活動知會 + 統一紀錄：所有職員可睇
    if (session.canStaff) t.push('staff');
    t.push('password');
    return t;
  }, [session]);

  useEffect(() => {
    if (session && tabs.length > 0 && !tabs.includes(tab)) setTab(tabs[0]);
  }, [session, tabs]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr('');
    setBusy(true);
    const r = await api.staffLogin(email.trim(), password);
    setBusy(false);
    if (r.ok && r.data) { saveSession(r.data); setSession(r.data); }
    else setLoginErr(r.error || '帳號或密碼不正確');
  }
  function logout() { clearSession(); setSession(null); setPassword(''); }

  if (!session) {
    return (
      <div className="center-bg">
        <div className="panel">
          <div style={{ fontSize: 38, textAlign: 'center' }}>🔐</div>
          <h1 style={{ textAlign: 'center', color: '#003366', margin: '8px 0 2px' }}>職員登入</h1>
          <p style={{ textAlign: 'center', color: '#666', fontSize: 12.5, marginBottom: 20 }}>成員服務門戶 — 批核後台</p>
          <form onSubmit={login}>
            {loginErr && <div className="err">{loginErr}</div>}
            <div className="field"><label>帳戶／電郵</label>
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
            <div className="field"><label>密碼</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
            <button className="btn" disabled={busy}>{busy ? '登入中…' : '登入'}</button>
          </form>
        </div>
      </div>
    );
  }

  const TAB_LABELS: Record<Tab, string> = {
    venue: '🏛 借場待批', stock: '📦 借物資待批', course: '🎓 報班待批',
    items: '📦 物資管理', courses: '🎓 班管理', venues: '🏛 場地管理',
    activity: '📋 活動知會', records: '🗂 查核紀錄', staff: '👥 帳戶管理', password: '🔑 改密碼',
    courseLinks: '🎓 訓練班管理',
  };

  return (
    <>
      <header className="shell-head">
        <div className="top">
          <div>
            <div className="brand" style={{ color: '#fff' }}>🧭 職員後台</div>
            <div className="sub" style={{ color: '#bbdefb' }}>{session.displayName}</div>
          </div>
          <button className="btn-ghost" onClick={logout} style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}>登出</button>
        </div>
      </header>
      <main className="shell-main">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => { setTab(t); setMsg(''); }}>{TAB_LABELS[t]}</button>
          ))}
        </div>
        {msg && <div className="ok-msg">{msg}</div>}

        {tab === 'venue' && <VenueApprovals token={session.token} onDone={setMsg} />}
        {tab === 'stock' && <StockApprovals token={session.token} onDone={setMsg} />}
        {tab === 'course' && <CourseApprovals token={session.token} onDone={setMsg} />}
        {tab === 'items' && <ItemsAdmin token={session.token} onDone={setMsg} />}
        {tab === 'courses' && <CoursesAdmin token={session.token} onDone={setMsg} />}
        {tab === 'courseLinks' && <CourseLinksAdmin token={session.token} onDone={setMsg} />}
        {tab === 'venues' && <VenuesAdmin token={session.token} onDone={setMsg} />}
        {tab === 'activity' && <ActivityNotices token={session.token} />}
        {tab === 'records' && <RecordsAdmin session={session} onDone={setMsg} />}
        {tab === 'staff' && <StaffAdmin token={session.token} self={session.email} onDone={setMsg} />}
        {tab === 'password' && <ChangePassword token={session.token} onDone={setMsg} />}
      </main>
    </>
  );
}

/* ============ 借場批核 ============ */
function VenueApprovals({ token, onDone }: { token: string; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<VenueBooking[]>([]);
  const [busyId, setBusyId] = useState('');
  async function reload() { const r = await api.getVenueBookings(token); if (r.ok && r.data) setRows(r.data); }
  useEffect(() => { reload(); }, []);
  async function approve(id: string) {
    setBusyId(id);
    const r = await api.approveVenueBooking(token, id);
    setBusyId('');
    if (r.ok && r.data) onDone(`已批核。電子鎖密碼：${r.data.password}${r.data.warn ? '　' + r.data.warn : ''}`);
    else onDone(r.error || '批核失敗');
    reload();
  }
  async function reject(id: string) { setBusyId(id); await api.rejectVenueBooking(token, id); setBusyId(''); onDone('已拒絕申請'); reload(); }
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>場地</th><th>時段</th><th>申請人</th><th>電話</th><th>旅團</th><th>狀態</th><th className="actions">動作</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} className="empty">冇申請。</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.venueName}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{r.startDate}<br />→ {r.endDate}</td>
              <td>{r.name}</td>
              <td>{r.phone}</td>
              <td>{r.troop}</td>
              <td><span className={`pill ${STATUS_PILL[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
              <td className="actions">
                {r.status === 'pending' && (
                  <>
                    <button className="btn-sm" disabled={busyId === r.id} onClick={() => approve(r.id)}>批核＋開密碼</button>{' '}
                    <button className="btn-ghost danger" disabled={busyId === r.id} onClick={() => reject(r.id)}>拒絕</button>
                  </>
                )}
                {r.status === 'approved' && r.pwdRef && <span style={{ fontSize: 12 }}>密碼已生成</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============ 借物資批核 ============ */
function StockApprovals({ token, onDone }: { token: string; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<StockRequest[]>([]);
  async function reload() { const r = await api.getStockRequests(token); if (r.ok && r.data) setRows(r.data); }
  useEffect(() => { reload(); }, []);
  async function act(id: string, status: string) {
    const r = await api.setStockRequestStatus(token, id, status);
    if (r.ok) onDone('已更新狀態'); else onDone(r.error || '更新失敗');
    reload();
  }
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>物資</th><th>數量</th><th>借用期</th><th>申請人</th><th>旅團</th><th>用途</th><th>狀態</th><th className="actions">動作</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={8} className="empty">冇申請。</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.itemName}</td>
              <td>{r.qty}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{r.borrowDate}<br />→ {r.returnDate}</td>
              <td>{r.name}<br /><span style={{ fontSize: 11, color: '#64748b' }}>{r.phone}</span></td>
              <td>{r.troop}</td>
              <td>{r.purpose}</td>
              <td><span className={`pill ${STATUS_PILL[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
              <td className="actions">
                {r.status === 'pending' && (
                  <>
                    <button className="btn-sm" onClick={() => act(r.id, 'approved')}>批核</button>{' '}
                    <button className="btn-ghost danger" onClick={() => act(r.id, 'rejected')}>拒絕</button>
                  </>
                )}
                {r.status === 'approved' && <button className="btn-ghost" onClick={() => act(r.id, 'returned')}>標記歸還</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============ 報班批核 ============ */
function CourseApprovals({ token, onDone }: { token: string; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<CourseReg[]>([]);
  async function reload() { const r = await api.getCourseRegs(token); if (r.ok && r.data) setRows(r.data); }
  useEffect(() => { reload(); }, []);
  async function act(id: string, status: string) {
    const r = await api.setCourseRegStatus(token, id, status);
    if (r.ok) onDone('已更新狀態'); else onDone(r.error || '更新失敗');
    reload();
  }
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>班</th><th>姓名</th><th>電話</th><th>旅團</th><th>付款</th><th>入數紙</th><th>狀態</th><th className="actions">動作</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={8} className="empty">冇報名。</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.courseTitle}</td>
              <td>{r.nameZh}</td>
              <td>{r.phone}</td>
              <td>{r.troop}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{r.payMethod}<br /><span style={{ fontSize: 11, color: '#64748b' }}>{r.payAccount}</span></td>
              <td>{r.receiptUrl ? <a href={r.receiptUrl} target="_blank" rel="noopener" style={{ color: '#1565c0' }}>檢視</a> : <span style={{ color: '#c62828' }}>未交</span>}</td>
              <td><span className={`pill ${STATUS_PILL[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
              <td className="actions">
                {r.status === 'pending' && (
                  <>
                    <button className="btn-sm" onClick={() => act(r.id, 'confirmed')}>確認</button>{' '}
                    <button className="btn-ghost" onClick={() => act(r.id, 'waitlist')}>候補</button>{' '}
                    <button className="btn-ghost danger" onClick={() => act(r.id, 'rejected')}>拒絕</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============ 物資管理 ============ */
function ItemsAdmin({ token, onDone }: { token: string; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<Item[]>([]);
  const [f, setF] = useState<Partial<Item>>({ category: '', name: '', totalQty: 0, availableQty: 0, unit: '件', note: '', location: '' });
  async function reload() { const r = await api.getItems(token); if (r.ok && r.data) setRows(r.data); }
  useEffect(() => { reload(); }, []);
  async function save() {
    if (!f.name || !f.category) { onDone('請填名稱同分類'); return; }
    const r = await api.saveItem(token, f);
    if (r.ok) { onDone('已儲存'); setF({ category: '', name: '', totalQty: 0, availableQty: 0, unit: '件', note: '', location: '' }); reload(); }
    else onDone(r.error || '儲存失敗');
  }
  async function del(id: string) { await api.deleteItem(token, id); onDone('已刪除'); reload(); }
  return (
    <>
      <div className="panel">
        <h2>新增 / 編輯物資</h2>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>💡 亦可以直接喺後台 Google Sheet 嘅「Items」分頁新增／修改物資。</p>
        <div className="frow">
          <div className="field"><label>分類</label>
            <input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="A. 交通管理與物流工具" /></div>
          <div className="field"><label>名稱</label>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label>單位</label>
            <input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>
        </div>
        <div className="frow">
          <div className="field"><label>總數量</label>
            <input type="number" value={f.totalQty || 0} onChange={(e) => setF({ ...f, totalQty: Number(e.target.value), availableQty: Number(e.target.value) })} /></div>
          <div className="field"><label>存放位置</label>
            <input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
          <div className="field"><label>備註</label>
            <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        </div>
        <button className="btn-sm" onClick={save}>儲存物資</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>分類</th><th>名稱</th><th>總數</th><th>可借</th><th>位置</th><th>備註</th><th className="actions">動作</th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.itemId}>
                <td>{i.category}</td><td>{i.name}</td><td>{i.totalQty}</td><td>{i.availableQty}</td><td>{i.location}</td><td>{i.note}</td>
                <td className="actions"><button className="btn-ghost danger" onClick={() => del(i.itemId)}>刪除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============ 班管理 ============ */
function CoursesAdmin({ token, onDone }: { token: string; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<Course[]>([]);
  const [f, setF] = useState<Partial<Course>>({ title: '', sessionsText: '', eligibility: '', fee: 0, originalFee: 0, deadline: '', quota: 0, venue: '', noticeUrl: '' });
  async function reload() { const r = await api.getCourses(token); if (r.ok && r.data) setRows(r.data); }
  useEffect(() => { reload(); }, []);
  async function save() {
    if (!f.title) { onDone('請填班名'); return; }
    const r = await api.saveCourse(token, f);
    if (r.ok) { onDone('已儲存'); setF({ title: '', sessionsText: '', eligibility: '', fee: 0, originalFee: 0, deadline: '', quota: 0, venue: '', noticeUrl: '' }); reload(); }
    else onDone(r.error || '儲存失敗');
  }
  async function del(id: string) { await api.deleteCourse(token, id); onDone('已刪除'); reload(); }
  return (
    <>
      <div className="panel">
        <h2>新增 / 編輯訓練班</h2>
        <div className="field"><label>班名</label>
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="field"><label>節次（每行一節：日期 時間 地點）</label>
          <textarea value={f.sessionsText} onChange={(e) => setF({ ...f, sessionsText: e.target.value })} placeholder={'2026-01-21 19:00-22:00 筲箕灣區總部\n2026-02-07 10:00-16:00 大潭童軍中心'} /></div>
        <div className="field"><label>參加資格</label>
          <input value={f.eligibility} onChange={(e) => setF({ ...f, eligibility: e.target.value })} /></div>
        <div className="frow3">
          <div className="field"><label>費用（實收）</label>
            <input type="number" value={f.fee || 0} onChange={(e) => setF({ ...f, fee: Number(e.target.value) })} /></div>
          <div className="field"><label>原價（如有資助）</label>
            <input type="number" value={f.originalFee || 0} onChange={(e) => setF({ ...f, originalFee: Number(e.target.value) })} /></div>
          <div className="field"><label>名額</label>
            <input type="number" value={f.quota || 0} onChange={(e) => setF({ ...f, quota: Number(e.target.value) })} /></div>
        </div>
        <div className="frow">
          <div className="field"><label>截止日期</label>
            <input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></div>
          <div className="field"><label>通告連結</label>
            <input value={f.noticeUrl} onChange={(e) => setF({ ...f, noticeUrl: e.target.value })} /></div>
        </div>
        <button className="btn-sm" onClick={save}>儲存班別</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>班名</th><th>費用</th><th>名額</th><th>截止</th><th>已報</th><th className="actions">動作</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.courseId}>
                <td>{c.title}</td><td>${c.fee}</td><td>{c.quota}</td><td>{c.deadline}</td><td>{c.filled}</td>
                <td className="actions"><button className="btn-ghost danger" onClick={() => del(c.courseId)}>刪除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============ 訓練班 Script 管理（每班各自嘅收表 Script） ============ */
function CourseLinksAdmin({ token, onDone }: { token: string; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<CourseLink[]>([]);
  const [f, setF] = useState<Record<string, any>>({
    courseId: '', title: '', badgeName: '', section: '', courseNo: '', sessionsText: '',
    eligibility: '', fee: 0, originalFee: 0, subsidyNote: '', deadline: '', quota: 0,
    venue: '', noticeUrl: '', contact: '', apiBase: '', apiKey: '', active: true,
  });
  const [editing, setEditing] = useState(false);
  const [busyId, setBusyId] = useState('');

  async function reload() {
    const r = await api.getCourseLinks(token);
    if (r.ok && r.data) setRows(r.data);
    else onDone(r.error || '載入失敗');
  }
  useEffect(() => { reload(); }, []);

  function resetForm() {
    setF({ courseId: '', title: '', badgeName: '', section: '', courseNo: '', sessionsText: '', eligibility: '', fee: 0, originalFee: 0, subsidyNote: '', deadline: '', quota: 0, venue: '', noticeUrl: '', contact: '', apiBase: '', apiKey: '', active: true });
    setEditing(false);
  }
  async function save() {
    if (!f.title || !f.apiBase) { onDone('請填課程名同 Script 網址'); return; }
    const r = await api.saveCourseLink(token, f);
    if (r.ok) { onDone(editing ? '已更新' : '已新增'); resetForm(); reload(); }
    else onDone(r.error || '儲存失敗');
  }
  function edit(s: CourseLink) {
    setEditing(true);
    setF({ ...s });
    window.scrollTo(0, 0);
  }
  async function del(id: string) {
    if (!window.confirm('確定刪除呢個訓練班？')) return;
    const r = await api.deleteCourseLink(token, id);
    if (r.ok) { onDone('已刪除'); reload(); } else onDone(r.error || '刪除失敗');
  }
  async function toggleActive(s: CourseLink) {
    setBusyId(s.courseId);
    const r = await api.saveCourseLink(token, { ...s, active: !s.active });
    setBusyId('');
    if (r.ok) { onDone(s.active ? '已隱藏（不再顯示喺報名頁）' : '已顯示（重新開放報名）'); reload(); }
    else onDone(r.error || '更新失敗');
  }

  return (
    <>
      <div className="panel">
        <h2>{editing ? `編輯：${f.title}` : '新增訓練班（收表 Script）'}</h2>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
          💡 每個訓練班各自有 1 張 Google Sheet + 1 份收表 Script。負責人喺「⬇️ 下載」攞 <code>Code.gs.course</code> 模板建立後，
          喺呢度加入佢嘅 /exec 網址 + API Key，個班就會顯示喺 <code>/training</code> 俾人報名。
        </p>
        <div className="frow">
          <div className="field"><label>課程名 <span className="req">*</span></label>
            <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="field"><label>徽章名（可選）</label>
            <input value={f.badgeName} onChange={(e) => setF({ ...f, badgeName: e.target.value })} placeholder="例：原野烹飪" /></div>
        </div>
        <div className="frow">
          <div className="field"><label>支部（可選）</label>
            <input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} placeholder="例：深資童軍" /></div>
          <div className="field"><label>訓練班編號（可選）</label>
            <input value={f.courseNo} onChange={(e) => setF({ ...f, courseNo: e.target.value })} placeholder="例：SAL" /></div>
        </div>
        <div className="field"><label>節次（每行一節：日期 時間 地點）</label>
          <textarea value={f.sessionsText} onChange={(e) => setF({ ...f, sessionsText: e.target.value })} placeholder={'2026-01-21 19:00-22:00 筲箕灣區總部\n2026-02-07 10:00-16:00 大潭童軍中心'} /></div>
        <div className="field"><label>參加資格</label>
          <textarea value={f.eligibility} onChange={(e) => setF({ ...f, eligibility: e.target.value })} placeholder="例：已宣誓及持有有效紀錄冊之深資童軍支部成員" /></div>
        <div className="frow3">
          <div className="field"><label>費用（實收）</label>
            <input type="number" value={f.fee || 0} onChange={(e) => setF({ ...f, fee: Number(e.target.value) })} /></div>
          <div className="field"><label>原價（如有資助）</label>
            <input type="number" value={f.originalFee || 0} onChange={(e) => setF({ ...f, originalFee: Number(e.target.value) })} /></div>
          <div className="field"><label>名額（0 = 不限）</label>
            <input type="number" value={f.quota || 0} onChange={(e) => setF({ ...f, quota: Number(e.target.value) })} /></div>
        </div>
        <div className="frow">
          <div className="field"><label>資助說明（可選）</label>
            <input value={f.subsidyNote} onChange={(e) => setF({ ...f, subsidyNote: e.target.value })} placeholder="例：獲訓練資助計劃資助，費用減半" /></div>
          <div className="field"><label>截止日期</label>
            <input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></div>
        </div>
        <div className="frow">
          <div className="field"><label>地點（可選）</label>
            <input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></div>
          <div className="field"><label>通告連結（可選）</label>
            <input value={f.noticeUrl} onChange={(e) => setF({ ...f, noticeUrl: e.target.value })} placeholder="https://…" /></div>
        </div>
        <div className="field"><label>查詢聯絡（可選）</label>
          <input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="例：區會職員 1234 5678" /></div>
        <div className="frow">
          <div className="field"><label>收表 Script 網址（/exec） <span className="req">*</span></label>
            <input value={f.apiBase} onChange={(e) => setF({ ...f, apiBase: e.target.value })} placeholder="https://script.google.com/macros/s/…/exec" /></div>
          <div className="field"><label>該班 API Key <span className="req">*</span></label>
            <input value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value })} placeholder="ck_…" /></div>
        </div>
        <div className="field">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            開放報名（顯示喺 /training）
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-sm" onClick={save}>{editing ? '儲存變更' : '新增訓練班'}</button>
          {editing && <button className="btn-ghost" onClick={resetForm}>取消</button>}
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>課程</th><th>徽章/支部</th><th>名額</th><th>截止</th><th>Script 網址</th><th>狀態</th><th className="actions">動作</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="empty">未有訓練班。</td></tr>}
            {rows.map((s) => (
              <tr key={s.courseId}>
                <td><b>{s.title}</b>{s.courseNo ? <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.courseNo}</div> : null}</td>
                <td>{s.badgeName}{s.section ? <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.section}</div> : null}</td>
                <td>{s.quota > 0 ? `${s.filled}/${s.quota}` : `${s.filled}（不限）`}</td>
                <td>{s.deadline || '—'}</td>
                <td style={{ fontSize: 11, wordBreak: 'break-all', maxWidth: 220 }}>{s.apiBase}</td>
                <td><span className={`pill ${s.active ? 'approved' : 'rejected'}`}>{s.active ? '開放' : '隱藏'}</span></td>
                <td className="actions">
                  <button className="btn-ghost" disabled={busyId === s.courseId} onClick={() => toggleActive(s)}>{s.active ? '隱藏' : '開放'}</button>{' '}
                  <button className="btn-ghost" onClick={() => edit(s)}>編輯</button>{' '}
                  <button className="btn-ghost danger" onClick={() => del(s.courseId)}>刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============ 場地管理 ============ */
function VenuesAdmin({ token, onDone }: { token: string; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<Venue[]>([]);
  const [f, setF] = useState<Partial<Venue>>({ name: '', scienerLockId: '', note: '' });
  async function reload() { const r = await api.getVenues(token); if (r.ok && r.data) setRows(r.data); }
  useEffect(() => { reload(); }, []);
  async function save() {
    if (!f.name || !f.scienerLockId) { onDone('請填場地名同 Sciener lockId'); return; }
    const r = await api.saveVenue(token, f);
    if (r.ok) { onDone('已儲存'); setF({ name: '', scienerLockId: '', note: '' }); reload(); }
    else onDone(r.error || '儲存失敗');
  }
  async function del(id: string) { await api.deleteVenue(token, id); onDone('已刪除'); reload(); }
  return (
    <>
      <div className="panel">
        <h2>新增 / 編輯場地</h2>
        <div className="frow">
          <div className="field"><label>場地名</label>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label>Sciener 鎖 ID（lockId）</label>
            <input value={f.scienerLockId} onChange={(e) => setF({ ...f, scienerLockId: e.target.value })} placeholder="例：12345678" /></div>
        </div>
        <div className="field"><label>備註</label>
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <button className="btn-sm" onClick={save}>儲存場地</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>場地名</th><th>Sciener lockId</th><th>備註</th><th className="actions">動作</th></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.venueId}>
                <td>{v.name}</td><td>{v.scienerLockId}</td><td>{v.note}</td>
                <td className="actions"><button className="btn-ghost danger" onClick={() => del(v.venueId)}>刪除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============ 活動知會（存檔檢視） ============ */
function ActivityNotices({ token }: { token: string }) {
  const [rows, setRows] = useState<ActivityNotice[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getActivityNotices(token).then((r) => {
      if (r.ok && r.data) setRows(r.data);
      setLoading(false);
    });
  }, []);
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>旅號</th><th>活動</th><th>支部</th><th>性質</th><th>日期時間</th><th>地點</th><th>人數</th><th>負責領袖</th><th>備註</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={9} className="empty">載入中…</td></tr>}
          {!loading && rows.length === 0 && <tr><td colSpan={9} className="empty">未有活動知會。</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.troop}</td>
              <td>{r.activityName}</td>
              <td>{r.sections}</td>
              <td>{r.nature}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{r.startDateTime}<br />→ {r.endDateTime}</td>
              <td>{r.location}</td>
              <td>成員 {r.membersCount}<br />領袖 {r.leadersCount}</td>
              <td>{r.leaderName}<br /><span style={{ fontSize: 11, color: '#64748b' }}>{r.leaderPhone}</span></td>
              <td>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============ 統一紀錄（查核舊紀錄） ============ */
function RecordsAdmin({ session, onDone }: { session: StaffSession; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<AllRecord[]>([]);
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);

  async function reload() {
    const r = await api.getAllRecords(session.token);
    if (r.ok && r.data) setRows(r.data);
    setLoading(false);
  }
  useEffect(() => { reload(); }, []);

  const filtered = rows.filter((r) => {
    if (typeF && r.type !== typeF) return false;
    if (statusF === 'pending' && r.status !== 'pending') return false;
    if (statusF === 'processed' && ['pending'].includes(r.status)) return false;
    if (q) {
      const hay = (r.title + ' ' + r.requester + ' ' + r.phone + ' ' + r.troop + ' ' + r.refCode + ' ' + r.detail).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  async function act(type: string, id: string, status: string) {
    setBusyId(id);
    let res: { ok: boolean; error?: string; data?: { password?: string; saved?: boolean } } | undefined;
    if (type === 'stock') res = await api.setStockRequestStatus(session.token, id, status);
    else if (type === 'course') res = await api.setCourseRegStatus(session.token, id, status);
    else if (type === 'venue' && status === 'approved') res = await api.approveVenueBooking(session.token, id);
    else if (type === 'venue' && status === 'rejected') res = await api.rejectVenueBooking(session.token, id);
    setBusyId('');
    if (res && res.ok) {
      if (type === 'venue' && status === 'approved' && res.data?.password) onDone('✅ 已批核，電子鎖密碼：' + res.data.password);
      else onDone('✅ 已更新');
    } else if (res) onDone(res.error || '更新失敗');
    reload();
  }

  const can = (t: string) =>
    t === 'venue' ? session.canVenue : t === 'stock' ? session.canStock : t === 'course' ? session.canCourse : false;

  return (
    <>
      <div className="panel">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="search-input" style={{ flex: 2, minWidth: 200 }} placeholder="🔍 搜尋：姓名／電話／旅團／編號／物資…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="search-input" style={{ flex: 1, minWidth: 130 }} value={typeF} onChange={(e) => setTypeF(e.target.value)}>
            <option value="">全部類型</option>
            <option value="venue">🏛 借場</option>
            <option value="stock">📦 借物資</option>
            <option value="course">🎓 報班</option>
            <option value="activity">📋 活動知會</option>
          </select>
          <select className="search-input" style={{ flex: 1, minWidth: 130 }} value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            <option value="">全部狀態</option>
            <option value="pending">待批</option>
            <option value="processed">已處理</option>
          </select>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
          共 {filtered.length} 筆紀錄。全部申請（借場／借物資／報班／活動知會）都會自動寫入後台 Sheet 嘅「AllRecords」分頁，喺呢度一覽無遺。
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>內容</th><th>詳情</th><th>申請人</th><th>旅團</th><th>狀態</th><th>日期</th><th className="actions">動作</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="empty">載入中…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="empty">冇相符紀錄。</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td><span style={{ fontSize: 12, color: '#64748b' }}>{r.detail}</span><br /><span style={{ fontSize: 11, color: '#94a3b8' }}>{r.refCode}</span></td>
                <td>{r.requester}<br /><span style={{ fontSize: 11, color: '#64748b' }}>{r.phone}</span></td>
                <td>{r.troop}</td>
                <td><span className={`pill ${STATUS_PILL[r.status] || 'done'}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{(r.createdAt || '').slice(0, 10)}</td>
                <td className="actions">
                  {r.status === 'pending' && can(r.type) && (
                    <>
                      {r.type !== 'activity' && r.type !== 'course' && <button className="btn-sm" disabled={busyId === r.id} onClick={() => act(r.type, r.id, 'approved')}>批核</button>}{' '}
                      {r.type === 'course' && <button className="btn-sm" disabled={busyId === r.id} onClick={() => act(r.type, r.id, 'confirmed')}>確認</button>}{' '}
                      {r.type === 'course' && <button className="btn-ghost" disabled={busyId === r.id} onClick={() => act(r.type, r.id, 'waitlist')}>候補</button>}{' '}
                      <button className="btn-ghost danger" disabled={busyId === r.id} onClick={() => act(r.type, r.id, 'rejected')}>拒絕</button>
                    </>
                  )}
                  {r.type === 'stock' && r.status === 'approved' && can(r.type) && (
                    <button className="btn-ghost" disabled={busyId === r.id} onClick={() => act(r.type, r.id, 'returned')}>標記歸還</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============ 帳戶管理 ============ */
function StaffAdmin({ token, self, onDone }: { token: string; self: string; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<StaffInfo[]>([]);
  const [f, setF] = useState({ email: '', name: '', password: '', role: 'staff', canVenue: true, canStock: true, canCourse: true, canStaff: false });
  const [editing, setEditing] = useState(false);
  async function reload() { const r = await api.getStaffList(token); if (r.ok && r.data) setRows(r.data); else onDone(r.error || '載入失敗'); }
  useEffect(() => { reload(); }, []);

  function resetForm() { setF({ email: '', name: '', password: '', role: 'staff', canVenue: true, canStock: true, canCourse: true, canStaff: false }); setEditing(false); }

  async function save() {
    if (!f.email) { onDone('請填帳戶（電郵）'); return; }
    if (!editing && !f.password) { onDone('新帳戶必須設定密碼'); return; }
    const r = await api.saveStaff(token, { ...f, password: f.password || undefined });
    if (r.ok) { onDone(editing ? '已更新' : '已新增'); resetForm(); reload(); }
    else onDone(r.error || '儲存失敗');
  }
  function edit(s: StaffInfo) {
    setEditing(true);
    setF({ email: s.email, name: s.name, password: '', role: s.role, canVenue: s.canVenue, canStock: s.canStock, canCourse: s.canCourse, canStaff: s.canStaff });
    window.scrollTo(0, 0);
  }
  async function resetPw(s: StaffInfo) {
    const p = window.prompt(`重設 ${s.email} 嘅密碼：`);
    if (!p) return;
    const r = await api.saveStaff(token, { email: s.email, password: p });
    if (r.ok) onDone('密碼已重設'); else onDone(r.error || '失敗');
  }
  async function del(s: StaffInfo) {
    if (!window.confirm(`確定刪除 ${s.email}？`)) return;
    const r = await api.deleteStaff(token, s.email);
    if (r.ok) { onDone('已刪除'); reload(); } else onDone(r.error || '刪除失敗');
  }

  const permRow = (label: string, key: 'canVenue' | 'canStock' | 'canCourse' | 'canStaff') => (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 16, fontSize: 13 }}>
      <input type="checkbox" checked={!!f[key]} onChange={(e) => setF({ ...f, [key]: e.target.checked })} />{label}
    </label>
  );

  return (
    <>
      <div className="panel">
        <h2>{editing ? `編輯 ${f.email}` : '新增管理員 / 職員'}</h2>
        <div className="frow">
          <div className="field"><label>帳戶（電郵）</label>
            <input value={f.email} disabled={editing} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@example.com" /></div>
          <div className="field"><label>姓名</label>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        </div>
        <div className="frow">
          <div className="field"><label>{editing ? '新密碼（留空 = 不變）' : '密碼'}</label>
            <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <div className="field"><label>角色</label>
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="staff">職員（批核員）</option>
              <option value="admin">管理員</option>
            </select></div>
        </div>
        <div className="field">
          <label>權限（可批核邊啲嘢）</label>
          <div style={{ marginTop: 6 }}>
            {permRow('🏛 借場', 'canVenue')}
            {permRow('📦 借物資', 'canStock')}
            {permRow('🎓 報班', 'canCourse')}
            {permRow('👥 帳戶管理', 'canStaff')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-sm" onClick={save}>{editing ? '儲存變更' : '新增帳戶'}</button>
          {editing && <button className="btn-ghost" onClick={resetForm}>取消</button>}
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>姓名</th><th>帳戶</th><th>角色</th><th>借場</th><th>借物資</th><th>報班</th><th>帳戶管理</th><th className="actions">動作</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.email}>
                <td>{s.name}{s.email === self && <span style={{ fontSize: 10, color: '#1565c0' }}>（我）</span>}</td>
                <td>{s.email}</td>
                <td>{s.role === 'admin' ? '管理員' : '職員'}</td>
                <td>{s.canVenue ? '✓' : '—'}</td>
                <td>{s.canStock ? '✓' : '—'}</td>
                <td>{s.canCourse ? '✓' : '—'}</td>
                <td>{s.canStaff ? '✓' : '—'}</td>
                <td className="actions">
                  <button className="btn-ghost" onClick={() => edit(s)}>編輯</button>{' '}
                  <button className="btn-ghost" onClick={() => resetPw(s)}>重設密碼</button>{' '}
                  <button className="btn-ghost danger" onClick={() => del(s)}>刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============ 改密碼 ============ */
function ChangePassword({ token, onDone }: { token: string; onDone: (m: string) => void }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 4) { onDone('新密碼至少 4 位'); return; }
    if (newPw !== newPw2) { onDone('兩次輸入嘅新密碼不一致'); return; }
    setBusy(true);
    const r = await api.changeStaffPassword(token, oldPw, newPw);
    setBusy(false);
    if (r.ok) { onDone('✅ 密碼已更改'); setOldPw(''); setNewPw(''); setNewPw2(''); }
    else onDone(r.error || '更改失敗');
  }

  return (
    <form className="panel" onSubmit={submit} style={{ maxWidth: 420 }}>
      <h2>更改密碼</h2>
      <div className="field"><label>現時密碼</label>
        <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" /></div>
      <div className="field"><label>新密碼</label>
        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></div>
      <div className="field"><label>確認新密碼</label>
        <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} autoComplete="new-password" /></div>
      <button className="btn" disabled={busy}>{busy ? '更改中…' : '更改密碼'}</button>
    </form>
  );
}
