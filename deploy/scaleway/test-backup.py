#!/usr/bin/env python3
"""Synthetic receipts plus real Docker pg_dump/curl/TLS/pg_restore; no cloud access."""
import base64
import fcntl
import hashlib
import http.server
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import socketserver
import ssl
import subprocess
import tempfile
import threading
import time
import unittest
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('backup', HERE / 'backup.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class ReceiptTests(unittest.TestCase):
    def test_freshness_and_failure_boundaries(self):
        state = {'version': 1, 'status': 'uploaded', 'attempted_at': 900, 'last_success_at': 900}
        self.assertEqual(backup.assess(state, 1000, 100, 600), (0, 'fresh'))
        self.assertEqual(backup.assess(state, 1001, 100, 600), (2, 'stale'))
        self.assertEqual(backup.assess(dict(state, status='failed'), 1000, 100, 600), (1, 'attempt_failed'))
        self.assertEqual(backup.assess(dict(state, status='running'), 1000, 100, 600), (0, 'in_progress'))
        self.assertEqual(backup.assess(dict(state, status='running'), 1501, 900, 600), (1, 'attempt_unfinished'))
        self.assertEqual(backup.assess(dict(state, last_success_at=None), 1000, 100, 600), (2, 'no_verified_upload'))
        self.assertEqual(backup.assess(state, 899, 100, 600), (3, 'future_timestamp'))

    def test_read_only_check_exit_codes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copy2(HERE / 'backup.py', root / 'backup.py')
            def check():
                result = subprocess.run(['python3', str(root / 'backup.py'), 'check', '--max-age-seconds', '100'], capture_output=True)
                return result.returncode, json.loads(result.stdout)
            self.assertEqual(check()[0], 3)
            now = time.time()
            state = {'version': 1, 'status': 'uploaded', 'stage': 'complete',
                     'object': 'release/synthetic.dump', 'attempted_at': now - 2,
                     'last_success_at': now - 1, 'last_daily_success_at': None,
                     'last_success_object': 'release/synthetic.dump',
                     'last_success_sha256': 'a' * 64, 'last_success_bytes': 100}
            receipt = root / 'backup-status.json'
            receipt.write_text(json.dumps(state))
            self.assertEqual(check()[0], 0)
            self.assertIsNone(check()[1]['receipt']['last_daily_success_at'])
            state['last_success_at'] = now - 101
            receipt.write_text(json.dumps(state))
            self.assertEqual(check()[0], 2)
            state['last_success_at'] = now + 60
            receipt.write_text(json.dumps(state))
            self.assertEqual(check()[0], 3)
            state['last_success_at'] = now - 1
            for field in ('last_success_sha256', 'last_success_bytes', 'last_success_object'):
                invalid = dict(state)
                del invalid[field]
                receipt.write_text(json.dumps(invalid))
                self.assertEqual(check()[0], 3)
            receipt.write_text(json.dumps(dict(state, unexpected_secret='must-not-echo')))
            code, output = check()
            self.assertEqual(code, 3)
            self.assertNotIn('must-not-echo', json.dumps(output))

    def test_invalid_receipts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state'
            for value in ('{}', 'null', '{', '{"version":1,"status":"uploaded","attempted_at":true}',
                          '{"version":1,"status":"uploaded","attempted_at":NaN}',
                          '{"version":1,"status":"uploaded","attempted_at":100,"last_success_at":100}'):
                path.write_text(value)
                with self.assertRaises((ValueError, TypeError)):
                    backup.load_state(path)


class Upload(http.server.BaseHTTPRequestHandler):
    status = 200
    bodies = []

    def do_PUT(self):
        body = self.rfile.read(int(self.headers['Content-Length']))
        if self.headers.get('Content-MD5') != base64.b64encode(hashlib.md5(body).digest()).decode():
            self.send_error(400)
            return
        if self.headers.get('x-amz-content-sha256') != hashlib.sha256(body).hexdigest():
            self.send_error(400)
            return
        self.bodies.append(body)
        self.send_response(self.status)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def log_message(self, *args):
        pass


class Proxy(socketserver.StreamRequestHandler):
    target_port = None

    def handle(self):
        line = self.rfile.readline()
        if line != b'CONNECT synthetic-bucket.s3.pl-waw.scw.cloud:443 HTTP/1.1\r\n':
            return
        while self.rfile.readline() not in (b'\r\n', b''):
            pass
        with socket.create_connection(('127.0.0.1', self.target_port)) as upstream:
            self.wfile.write(b'HTTP/1.1 200 Connection established\r\n\r\n')
            self.wfile.flush()
            import select
            while True:
                readable, _, _ = select.select([self.connection, upstream], [], [], 10)
                if not readable:
                    return
                for source in readable:
                    block = source.recv(65536)
                    if not block:
                        return
                    (upstream if source is self.connection else self.connection).sendall(block)


class IntegrationTests(unittest.TestCase):
    def test_real_backup_success_upload_failures_and_restore(self):
        name = 'fitness-backup-test-' + uuid.uuid4().hex[:12]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for file in ('backup.py', 'backup.sh'):
                shutil.copy2(HERE / file, root / file)
            (root / '.env').write_text('BACKUP_BUCKET=synthetic-bucket\nBACKUP_ACCESS_KEY=synthetic\nBACKUP_SECRET_KEY=synthetic-not-real\n')
            cert, key = root / 'cert.pem', root / 'key.pem'
            subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
                            '-subj', '/CN=synthetic-bucket.s3.pl-waw.scw.cloud',
                            '-addext', 'subjectAltName=DNS:synthetic-bucket.s3.pl-waw.scw.cloud',
                            '-keyout', str(key), '-out', str(cert)], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Upload)
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(cert, key)
            server.socket = context.wrap_socket(server.socket, server_side=True)
            Proxy.target_port = server.server_port
            proxy = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Proxy)
            proxy.daemon_threads = True
            for service in (server, proxy):
                threading.Thread(target=service.serve_forever, daemon=True).start()
            env = dict(os.environ, BACKUP_POSTGRES_CONTAINER=name,
                       HTTPS_PROXY='http://127.0.0.1:' + str(proxy.server_address[1]),
                       https_proxy='http://127.0.0.1:' + str(proxy.server_address[1]),
                       NO_PROXY='', no_proxy='', CURL_CA_BUNDLE=str(cert))
            def docker(*args, **kwargs):
                return subprocess.run(['docker', *args], check=True, stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE, **kwargs)
            def invoke():
                return subprocess.run(['bash', str(root / 'backup.sh'), 'daily/2099-01-01'],
                                      env=env, capture_output=True, timeout=210)
            try:
                docker('run', '-d', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data:rw,size=256m',
                       '-e', 'POSTGRES_USER=fixture', '-e', 'POSTGRES_DB=fixture',
                       '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine')
                for _ in range(60):
                    ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'fixture'], capture_output=True)
                    if ready.returncode == 0:
                        break
                    time.sleep(0.5)
                else:
                    self.fail('PostgreSQL fixture did not become TCP-ready within 30 seconds')
                docker('exec', name, 'psql', '-U', 'fixture', '-c', 'CREATE TABLE synthetic(value int); INSERT INTO synthetic VALUES(42)')
                with (root / '.backup.lock').open('a') as lock:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    self.assertEqual(invoke().returncode, 1)
                    self.assertFalse((root / 'backup-status.json').exists())
                Upload.status = 200
                result = invoke()
                self.assertEqual(result.returncode, 0, result.stdout.decode() + result.stderr.decode())
                receipt = json.loads((root / 'backup-status.json').read_text())
                self.assertEqual(receipt['last_success_sha256'], hashlib.sha256(Upload.bodies[-1]).hexdigest())
                self.assertEqual((root / 'backup-status.json').stat().st_mode & 0o777, 0o600)
                docker('exec', name, 'createdb', '-U', 'fixture', 'restored')
                docker('exec', '-i', name, 'pg_restore', '-U', 'fixture', '-d', 'restored', input=Upload.bodies[-1])
                rows = docker('exec', name, 'psql', '-U', 'fixture', '-d', 'restored', '-Atc', 'SELECT value FROM synthetic')
                self.assertEqual(rows.stdout.strip(), b'42')
                for status in (503, 307):
                    Upload.status = status
                    self.assertNotEqual(invoke().returncode, 0)
                    failed = json.loads((root / 'backup-status.json').read_text())
                    self.assertEqual(failed['last_success_at'], receipt['last_success_at'])
                    self.assertEqual(failed['stage'], 'upload')
                    checked = subprocess.run(['python3', str(root / 'backup.py'), 'check', '--max-age-seconds', '108000'], capture_output=True)
                    self.assertEqual(checked.returncode, 1)
                docker('stop', name)
                pipeline = subprocess.run(['bash', '-c', 'bash "$1" daily/2099-01-01 | cat', '_', str(root / 'backup.sh')],
                                          env=env, capture_output=True, timeout=210)
                self.assertEqual(pipeline.returncode, 0)
                self.assertEqual(json.loads((root / 'backup-status.json').read_text())['stage'], 'dump')
                checked = subprocess.run(['python3', str(root / 'backup.py'), 'check', '--max-age-seconds', '108000'], capture_output=True)
                self.assertEqual(checked.returncode, 1)
                self.assertNotIn('| logger', (HERE / 'release.sh').read_text())
                self.assertNotIn('synthetic-not-real', result.stdout.decode() + result.stderr.decode())
            finally:
                subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                proxy.shutdown()
                proxy.server_close()
                server.shutdown()
                server.server_close()


if __name__ == '__main__':
    unittest.main()
