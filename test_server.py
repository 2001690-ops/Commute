import http.client, json, tempfile, threading, unittest
from pathlib import Path
import server
class SecurityTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();server.DATA=Path(cls.temp.name);server.DB=server.DATA/'test.db';server.SECURE=False;server.PUBLIC_ORIGIN='https://attendance.example.test';server.init();server.init();server.create_admin('admin','admin-password-123')
  with server.db() as c:
   for name in ('alice','bob'):c.execute("INSERT INTO users(username,display_name,role,password_hash,created_at) VALUES(?,?,'employee',?,?)",(name,name,server.hash_password('employee-password-123'),server.now()))
  cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
 @classmethod
 def tearDownClass(cls):
  cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.temp.cleanup()
 def req(self,path,data=None,auth=None,csrf=True):
  conn=http.client.HTTPConnection('127.0.0.1',self.http.server_port);headers={}
  if auth:
   headers['Cookie']=auth[0]
   if csrf:headers['X-CSRF-Token']=auth[1]
  if data is not None:headers['Content-Type']='application/json'
  conn.request('POST' if data is not None else 'GET',path,None if data is None else json.dumps(data),headers);r=conn.getresponse();result=(r.status,r.read(),dict(r.getheaders()));conn.close();return result
 def login(self,name):
  status,raw,h=self.req('/api/login',{'username':name,'password':'admin-password-123' if name=='admin' else 'employee-password-123'});self.assertEqual(status,200);cookie=h['Set-Cookie'].split(';')[0];return cookie,json.loads(self.req('/api/me',auth=(cookie,''))[1])['user']['csrf']
 def test_shortcuts_and_security(self):
  admin=self.login('admin');alice=self.login('alice');bob=self.login('bob');path='/api/employees/2/shortcut'
  for auth,csrf,status in ((None,True,401),(alice,True,403),(admin,False,403)):self.assertEqual(self.req(path+'/issue',{},auth,csrf)[0],status)
  status,raw,_=self.req(path+'/issue',{},admin);self.assertEqual(status,200);url=json.loads(raw)['url'];locator=url.rsplit('/',1)[1];start='/s/'+locator
  self.assertNotIn('alice',url);self.assertEqual(self.req(start)[0],200);self.assertIsNone(json.loads(self.req('/api/me')[1])['user']);self.assertEqual(self.req('/api/attendance')[0],401)
  self.assertEqual(self.req(start,auth=bob)[0],403);self.assertEqual(self.req('/api/shortcut/'+locator,auth=bob)[0],403);self.assertEqual(self.req('/api/shortcut/'+locator,auth=alice)[0],200)
  for endpoint in (path,path+'/qr'):self.assertEqual(self.req(endpoint,auth=alice)[0],403)
  status,qr,h=self.req(path+'/qr',auth=admin);self.assertEqual(status,200);self.assertIn(b'<svg',qr);self.assertEqual(h['Cache-Control'],'no-store')
  status,raw,h=self.req('/manifest/'+locator);self.assertEqual(json.loads(raw)['start_url'],start);self.assertIn('application/manifest+json',h['Content-Type'])
  for size in (192,512):self.assertTrue(self.req(f'/icon-{size}.png')[1].startswith(b'\x89PNG'))
  self.assertNotIn(b'caches.',self.req('/sw.js')[1])
  work={'employee_id':3,'work_date':'2026-10-27','start_time':'16:00','end_time':'22:00','break_minutes':30,'confirmed':True}
  self.assertEqual(self.req('/api/attendance',work,alice)[0],200);self.assertEqual(json.loads(self.req('/api/attendance',auth=bob)[1])['items'],[]);self.assertEqual(json.loads(self.req('/api/attendance',auth=alice)[1])['items'][0]['employee_id'],2);self.assertEqual(self.req('/api/attendance',work,alice)[0],409)
  self.assertEqual(self.req(path+'/issue',{},admin)[0],200);self.assertEqual(self.req(start)[0],404);self.assertEqual(self.req('/manifest/'+locator)[0],404)
  current=json.loads(self.req(path,auth=admin)[1])['url'].replace(server.PUBLIC_ORIGIN,'');self.assertEqual(self.req(path+'/revoke',{},bob)[0],403);self.assertEqual(self.req(path+'/revoke',{},admin)[0],200);self.assertEqual(self.req(current)[0],404);self.assertEqual(self.req(path+'/qr',auth=admin)[0],404);self.assertEqual(self.req('/api/attendance',auth=alice)[0],200)
  self.req(path+'/issue',{},admin)
  with server.db() as c:c.execute('UPDATE users SET active=0 WHERE id=2')
  self.assertEqual(self.req('/api/attendance',auth=alice)[0],401);self.assertEqual(self.req(path,auth=admin)[0],404)
 def test_origin(self):
  saved=server.PUBLIC_ORIGIN
  try:
   for value in ('','http://evil.test','https://user:pass@host.test','https://host.test/path','https://host.test?x=1'):
    server.PUBLIC_ORIGIN=value
    with self.assertRaises(ValueError):server.shortcut_url('a'*32)
  finally:server.PUBLIC_ORIGIN=saved
if __name__=='__main__':unittest.main()
