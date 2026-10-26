#!/usr/bin/env python3
"""Yeondeok attendance multi-device server. Python standard library only."""
import os, json, sqlite3, secrets, hashlib, hmac, time, threading, re, shutil, argparse
from pathlib import Path
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from http.cookies import SimpleCookie
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

BASE=Path(__file__).resolve().parent
DATA=Path(os.getenv('YD_DATA_DIR',str(BASE/'data')))
DB=DATA/'attendance.sqlite3'
TZ=ZoneInfo('Asia/Seoul')
LOCK=threading.RLock()
SECURE=os.getenv('YD_SECURE_COOKIE','1')=='1'
MAX_BODY=65536

def now():return datetime.now(timezone.utc).isoformat()
def db():
    c=sqlite3.connect(DB,timeout=20);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON');c.execute('PRAGMA busy_timeout=20000');return c

def init():
    DATA.mkdir(parents=True,exist_ok=True)
    with db() as c:
        c.execute('PRAGMA journal_mode=WAL')
        c.executescript('''
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','employee')), password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, hourly_rate INTEGER NOT NULL DEFAULT 12500, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES users(id), work_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, break_minutes INTEGER NOT NULL, minutes INTEGER NOT NULL, confirmed INTEGER NOT NULL DEFAULT 1, created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(employee_id,work_date));
        CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES users(id), action TEXT NOT NULL, target TEXT, detail TEXT, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS login_attempts(id INTEGER PRIMARY KEY, username TEXT NOT NULL, ip TEXT NOT NULL, success INTEGER NOT NULL, at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS ix_attendance_date ON attendance(work_date);
        CREATE INDEX IF NOT EXISTS ix_sessions_expiry ON sessions(expires_at);
        ''')

def hash_password(p):
    salt=secrets.token_bytes(16);k=hashlib.pbkdf2_hmac('sha256',p.encode(),salt,310000)
    return f'pbkdf2_sha256$310000${salt.hex()}${k.hex()}'
def check_password(p,stored):
    try:
        _,iters,salt,key=stored.split('$');a=hashlib.pbkdf2_hmac('sha256',p.encode(),bytes.fromhex(salt),int(iters));return hmac.compare_digest(a,bytes.fromhex(key))
    except Exception:return False

def audit(c,actor,action,target='',detail=''):
    c.execute('INSERT INTO audit_logs(actor_id,action,target,detail,created_at) VALUES(?,?,?,?,?)',(actor,action,str(target),detail,now()))

def create_admin(username,password):
    if len(password)<12:raise ValueError('관리자 비밀번호는 12자 이상이어야 합니다.')
    with db() as c:
        if c.execute("SELECT 1 FROM users WHERE role='admin'").fetchone():raise ValueError('관리자가 이미 존재합니다.')
        c.execute("INSERT INTO users(username,display_name,role,password_hash,created_at) VALUES(?,?,?,?,?)",(username,'관리자','admin',hash_password(password),now()))

def duration(s,e,b):
    if not re.fullmatch(r'\d{2}:\d{2}',s or '') or not re.fullmatch(r'\d{2}:\d{2}',e or ''):raise ValueError('시간 형식은 HH:MM입니다.')
    a,am=map(int,s.split(':'));z,zm=map(int,e.split(':'))
    if a>23 or z>23 or am>59 or zm>59:raise ValueError('올바르지 않은 시간입니다.')
    if not isinstance(b,int) or b<0 or b>720:raise ValueError('휴게시간 범위 오류')
    d=(z*60+zm-a*60-am)%1440
    if d==0 or b>=d:raise ValueError('퇴근시간 또는 휴게시간을 확인하세요.')
    return d-b

def backup():
    dest=DATA/'backups';dest.mkdir(exist_ok=True)
    filename=dest/('attendance_'+datetime.now(TZ).strftime('%Y%m%d_%H%M%S')+'.sqlite3')
    with LOCK, db() as src,sqlite3.connect(filename) as dst:src.backup(dst)
    os.chmod(filename,0o600)
    backups=sorted(dest.glob('attendance_*.sqlite3'),reverse=True)
    for f in backups[30:]:f.unlink()
    return str(filename)

class Handler(BaseHTTPRequestHandler):
    def log_message(self,fmt,*args):print('%s %s'%(self.address_string(),fmt%args))
    def headers_common(self,typ='application/json; charset=utf-8'):
        self.send_header('Content-Type',typ);self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('X-Frame-Options','DENY');self.send_header('Referrer-Policy','no-referrer');self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'self'")
    def send_json(self,code,obj,cookie=None):
        raw=json.dumps(obj,ensure_ascii=False).encode();self.send_response(code);self.headers_common();self.send_header('Content-Length',str(len(raw)))
        if cookie:self.send_header('Set-Cookie',cookie)
        self.end_headers();self.wfile.write(raw)
    def fail(self,code,msg):self.send_json(code,{'error':msg})
    def body(self):
        n=int(self.headers.get('Content-Length','0'))
        if n<1 or n>MAX_BODY:raise ValueError('요청 크기 오류')
        v=json.loads(self.rfile.read(n))
        if not isinstance(v,dict):raise ValueError('객체 데이터가 필요합니다.')
        return v
    def session(self):
        ck=SimpleCookie()
        try:ck.load(self.headers.get('Cookie',''))
        except Exception:return None
        t=ck.get('yd_session')
        if not t:return None
        token_hash=hashlib.sha256(t.value.encode()).hexdigest()
        with db() as c:
            return c.execute('SELECT users.id,users.username,users.display_name,users.role,users.hourly_rate,sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>? AND users.active=1',(token_hash,int(time.time()))).fetchone()
    def guard(self,write=False):
        u=self.session()
        if not u:self.fail(401,'로그인이 필요합니다.');return None
        if write and not hmac.compare_digest(self.headers.get('X-CSRF-Token',''),u['csrf']):self.fail(403,'CSRF 검증 실패');return None
        return u
    def do_GET(self):
        p=urlsplit(self.path).path
        if p=='/':
            raw=(BASE/'index.html').read_bytes();self.send_response(200);self.headers_common('text/html; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw);return
        if p=='/app.css':
            raw=(BASE/'app.css').read_bytes();self.send_response(200);self.headers_common('text/css; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw);return
        if p=='/app.js':
            raw=(BASE/'app.js').read_bytes();self.send_response(200);self.headers_common('text/javascript; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw);return
        if p=='/api/me':
            u=self.session();return self.send_json(200,{'user':dict(u) if u else None})
        u=self.guard()
        if not u:return
        if p=='/api/employees':
            if u['role']!='admin':return self.fail(403,'관리자 전용')
            with db() as c:rows=c.execute("SELECT id,username,display_name,hourly_rate,active FROM users WHERE role='employee' ORDER BY id").fetchall()
            return self.send_json(200,{'items':[dict(x) for x in rows]})
        if p=='/api/attendance':
            with db() as c:
                if u['role']=='admin':rows=c.execute('SELECT a.*,u.display_name,u.hourly_rate FROM attendance a JOIN users u ON a.employee_id=u.id ORDER BY work_date DESC,id DESC LIMIT 1000').fetchall()
                else:rows=c.execute('SELECT a.*,u.display_name,u.hourly_rate FROM attendance a JOIN users u ON a.employee_id=u.id WHERE employee_id=? ORDER BY work_date DESC LIMIT 366',(u['id'],)).fetchall()
            return self.send_json(200,{'items':[dict(x) for x in rows]})
        self.fail(404,'경로 없음')
    def do_POST(self):
        p=urlsplit(self.path).path
        try:data=self.body()
        except (ValueError,json.JSONDecodeError):return self.fail(400,'올바른 JSON을 입력하세요.')
        if p=='/api/login':
            name=str(data.get('username','')).strip();pw=str(data.get('password',''));ip=self.client_address[0];ts=int(time.time())
            with db() as c:
                c.execute('DELETE FROM login_attempts WHERE at<?',(ts-3600,))
                n=c.execute('SELECT COUNT(*) FROM login_attempts WHERE username=? AND ip=? AND success=0 AND at>?',(name,ip,ts-900)).fetchone()[0]
                if n>=8:return self.fail(429,'로그인 시도 제한. 15분 후 다시 시도하세요.')
                u=c.execute('SELECT * FROM users WHERE username=? AND active=1',(name,)).fetchone()
                valid=bool(u and check_password(pw,u['password_hash']))
                c.execute('INSERT INTO login_attempts(username,ip,success,at) VALUES(?,?,?,?)',(name,ip,int(valid),ts))
                if not valid:return self.fail(401,'계정 또는 비밀번호 오류')
                token=secrets.token_urlsafe(48);csrf=secrets.token_urlsafe(32)
                c.execute('INSERT INTO sessions(token_hash,user_id,csrf,expires_at,created_at) VALUES(?,?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),u['id'],csrf,ts+28800,now()))
                audit(c,u['id'],'login')
            cookie=f'yd_session={token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800'+('; Secure' if SECURE else '')
            return self.send_json(200,{'ok':True},cookie)
        u=self.guard(write=True)
        if not u:return
        if p=='/api/logout':
            ck=SimpleCookie();ck.load(self.headers.get('Cookie',''));t=ck.get('yd_session')
            with db() as c:
                if t:c.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(t.value.encode()).hexdigest(),))
                audit(c,u['id'],'logout')
            return self.send_json(200,{'ok':True},'yd_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'+('; Secure' if SECURE else ''))
        if p=='/api/employees':
            if u['role']!='admin':return self.fail(403,'관리자 전용')
            name=str(data.get('username','')).strip();display=str(data.get('display_name','')).strip();pw=str(data.get('password',''));rate=data.get('hourly_rate',12500)
            if not re.fullmatch('[A-Za-z0-9_.-]{3,40}',name) or not display or len(display)>80 or len(pw)<12 or not isinstance(rate,int) or not 0<=rate<=1000000:return self.fail(400,'아이디 3~40자, 이름, 12자 이상 비밀번호, 시급을 확인하세요.')
            try:
                with db() as c:
                    cur=c.execute("INSERT INTO users(username,display_name,role,password_hash,hourly_rate,created_at) VALUES(?,?,'employee',?,?,?)",(name,display,hash_password(pw),rate,now()))
                    audit(c,u['id'],'create_employee',cur.lastrowid)
            except sqlite3.IntegrityError:return self.fail(409,'이미 사용 중인 아이디입니다.')
            return self.send_json(201,{'ok':True})
        if p=='/api/attendance':
            employee=u['id'] if u['role']=='employee' else data.get('employee_id')
            if not isinstance(employee,int):return self.fail(400,'직원을 선택하세요.')
            day=str(data.get('work_date',''));start=str(data.get('start_time',''));end=str(data.get('end_time',''));br=data.get('break_minutes')
            if not data.get('confirmed') or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',day):return self.fail(400,'날짜와 근무 확인이 필요합니다.')
            try:datetime.strptime(day,'%Y-%m-%d');minutes=duration(start,end,br)
            except ValueError as e:return self.fail(400,str(e))
            with db() as c:
                target=c.execute("SELECT id FROM users WHERE id=? AND role='employee' AND active=1",(employee,)).fetchone()
                if not target:return self.fail(404,'직원 없음')
                existing=c.execute('SELECT id FROM attendance WHERE employee_id=? AND work_date=?',(employee,day)).fetchone()
                if existing and u['role']!='admin':return self.fail(409,'기존 기록은 관리자만 수정할 수 있습니다.')
                ts=now()
                c.execute('''INSERT INTO attendance(employee_id,work_date,start_time,end_time,break_minutes,minutes,confirmed,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?,?) ON CONFLICT(employee_id,work_date) DO UPDATE SET start_time=excluded.start_time,end_time=excluded.end_time,break_minutes=excluded.break_minutes,minutes=excluded.minutes,updated_at=excluded.updated_at''',(employee,day,start,end,br,minutes,u['id'],ts,ts))
                audit(c,u['id'],'update_attendance' if existing else 'create_attendance',f'{employee}:{day}',f'{start}-{end}, break={br}, minutes={minutes}')
            return self.send_json(200,{'ok':True,'minutes':minutes})
        if p=='/api/backup':
            if u['role']!='admin':return self.fail(403,'관리자 전용')
            dest=backup()
            with db() as c:audit(c,u['id'],'backup',Path(dest).name)
            return self.send_json(200,{'ok':True,'filename':Path(dest).name})
        self.fail(404,'경로 없음')

def backup_loop():
    last=''
    while True:
        d=datetime.now(TZ).strftime('%Y-%m-%d')
        if d!=last:
            try:backup();last=d
            except Exception as e:print('Backup failed:',e)
        time.sleep(3600)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('command',nargs='?',default='serve',choices=['serve','init-admin','backup']);parser.add_argument('--host',default=os.getenv('YD_HOST','127.0.0.1'));parser.add_argument('--port',type=int,default=int(os.getenv('YD_PORT','8080')));args=parser.parse_args()
    init()
    if args.command=='init-admin':
        import getpass
        name=input('관리자 아이디: ').strip();pw=getpass.getpass('관리자 비밀번호 (12자 이상): ');create_admin(name,pw);print('관리자 생성 완료')
    elif args.command=='backup':print(backup())
    else:
        threading.Thread(target=backup_loop,daemon=True).start()
        print(f'연덕갈비 서버 시작 http://{args.host}:{args.port} (외부 접속은 HTTPS 역방향 프록시 필수)')
        ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
