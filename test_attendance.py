"""Regression checks: python -m unittest -v test_attendance.py"""
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
import server


class AttendanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        cls.old_data,cls.old_db,cls.old_secure=server.DATA,server.DB,server.SECURE
        server.DATA=Path(cls.tmp.name);server.DB=server.DATA/'test.sqlite3';server.SECURE=False
        server.init();server.create_admin('admin','test-password-admin')
        with server.db() as c:
            for name in ('employee','other'):
                c.execute("INSERT INTO users(username,display_name,role,password_hash,created_at) VALUES(?,?,'employee',?,?)",(name,name,server.hash_password('test-password-employee'),server.now()))
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown();cls.http.server_close();cls.thread.join()
        server.DATA,server.DB,server.SECURE=cls.old_data,cls.old_db,cls.old_secure
        cls.tmp.cleanup()

    def setUp(self):
        with server.db() as c:
            c.execute('DELETE FROM attendance');c.execute('DELETE FROM audit_logs')
        self.admin=self.login('admin','test-password-admin')
        self.employee=self.login('employee','test-password-employee')
        self.payload=dict(employee_id=2,work_date='2026-10-28',start_time='16:00',end_time='22:00',break_minutes=30,confirmed=True,next_day=False)

    def request(self,path,data=None,auth=None):
        c=http.client.HTTPConnection(*self.http.server_address,timeout=10)
        headers={'Content-Type':'application/json'}
        if auth:headers.update({'Cookie':auth[0],'X-CSRF-Token':auth[1]})
        c.request('GET' if data is None else 'POST',path,None if data is None else json.dumps(data),headers)
        r=c.getresponse();status=r.status;cookie=r.getheader('Set-Cookie');body=json.loads(r.read());c.close()
        return status,body,cookie

    def login(self,name,password):
        code,_,cookie=self.request('/api/login',dict(username=name,password=password))
        self.assertEqual(code,200)
        cookie=cookie.split(';')[0]
        _,body,_=self.request('/api/me',auth=(cookie,''))
        return cookie,body['user']['csrf']

    def save(self,auth=None,**changes):
        return self.request('/api/attendance',self.payload|changes,auth or self.admin)[:2]

    def rows(self):
        return self.request('/api/attendance',auth=self.admin)[1]['items']

    def test_regular_and_explicit_overnight(self):
        self.assertEqual(self.save()[1]['minutes'],330)
        code,body=self.save(work_date='2026-10-29',start_time='22:00',end_time='02:00',next_day=True)
        self.assertEqual((code,body['minutes']),(200,210))

    def test_reversed_times_rejected_without_next_day(self):
        for end in ('15:00','16:00'):
            self.assertEqual(self.save(end_time=end)[0],400)
        self.assertEqual(self.rows(),[])

    def test_long_shift_requires_explicit_confirmation(self):
        self.assertEqual(self.save(end_time='15:00',next_day=True)[0],400)
        self.assertEqual(self.rows(),[])
        code,body=self.save(end_time='15:00',next_day=True,long_shift_confirmed=True)
        self.assertEqual((code,body['minutes']),(200,1350))
        self.assertEqual(self.save(work_date='2026-10-29',start_time='06:00',end_time='19:00')[0],400)

    def test_invalid_or_24_hour_shifts_and_breaks(self):
        for values in (dict(next_day=True),dict(end_time='16:00',next_day=True),dict(end_time='25:00'),dict(next_day='true'),dict(break_minutes=360),dict(break_minutes=-1)):
            self.assertEqual(self.save(**values)[0],400)
        self.assertEqual(self.rows(),[])

    def test_admin_must_review_existing_record(self):
        self.assertEqual(self.save()[0],200)
        code,body=self.save(end_time='23:00')
        self.assertEqual(code,409);self.assertEqual(body['code'],'attendance_conflict')
        self.assertEqual(body['existing']['display_name'],'employee')
        self.assertEqual(body['existing']['end_time'],'22:00')
        self.assertEqual(self.rows()[0]['end_time'],'22:00')
        self.assertEqual(self.save(end_time='23:00',expected_revision=body['revision'])[0],200)
        self.assertEqual(self.rows()[0]['end_time'],'23:00')
        with server.db() as c:
            detail=json.loads(c.execute("SELECT detail FROM audit_logs WHERE action='update_attendance'").fetchone()[0])
        self.assertEqual(detail['before']['end_time'],'22:00');self.assertEqual(detail['after']['end_time'],'23:00')

    def test_stale_confirmation_does_not_overwrite_newer_edit(self):
        self.save();_,conflict=self.save(end_time='23:00')
        self.assertEqual(self.save(end_time='23:00',expected_revision=conflict['revision'])[0],200)
        self.assertEqual(self.save(end_time='21:00',expected_revision=conflict['revision'])[0],409)
        self.assertEqual(self.rows()[0]['end_time'],'23:00')

    def test_employee_cannot_overwrite_even_with_admin_revision(self):
        self.save();_,conflict=self.save(end_time='23:00')
        self.assertEqual(self.save(auth=self.employee,expected_revision=conflict['revision'],end_time='23:00')[0],409)
        self.assertEqual(self.rows()[0]['end_time'],'22:00')

    def test_employee_can_only_create_own_record(self):
        self.assertEqual(self.save(auth=self.employee,employee_id=3)[0],200)
        self.assertEqual(self.rows()[0]['employee_id'],2)

    def test_simultaneous_employee_submissions_do_not_overwrite(self):
        barrier=threading.Barrier(2);results=[]
        def submit(end):
            barrier.wait();results.append(self.save(auth=self.employee,end_time=end)[0])
        threads=[threading.Thread(target=submit,args=(end,)) for end in ('22:00','23:00')]
        for t in threads:t.start()
        for t in threads:t.join()
        self.assertEqual(sorted(results),[200,409]);self.assertEqual(len(self.rows()),1)


if __name__=='__main__':unittest.main()
