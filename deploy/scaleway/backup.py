#!/usr/bin/env python3
"""Host-side backup receipt and read-only freshness check; no cloud read permission."""
import argparse
import base64
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parent
STATE = ROOT / 'backup-status.json'


def load_state(path):
    with path.open() as source:
        raw = source.read(8193)
    if len(raw) > 8192:
        raise ValueError('oversized receipt')
    value = json.loads(raw)
    fields = {'version', 'status', 'object', 'attempted_at', 'last_success_at',
              'last_daily_success_at', 'stage', 'finished_at', 'last_success_object',
              'last_success_sha256', 'last_success_bytes', 'error', 'exit_code'}
    if not isinstance(value, dict) or type(value.get('version')) is not int or value.get('version') != 1 or set(value) - fields:
        raise ValueError('invalid receipt')
    if value.get('status') not in ('running', 'failed', 'uploaded'):
        raise ValueError('invalid status')
    for field in ('attempted_at', 'last_success_at', 'last_daily_success_at', 'finished_at'):
        stamp = value.get(field)
        if field == 'attempted_at' or stamp is not None:
            if type(stamp) not in (int, float) or not math.isfinite(stamp) or stamp < 0:
                raise ValueError('invalid timestamp')
    if value.get('stage') not in ('configuration', 'dump', 'upload', 'complete'):
        raise ValueError('invalid stage')
    if value['status'] == 'failed' and value.get('finished_at') is None:
        raise ValueError('missing failure timestamp')
    if 'error' in value and value['error'] not in ('timeout', 'process_failed', 'invalid_input', 'io_error'):
        raise ValueError('invalid failure kind')
    if 'exit_code' in value and type(value['exit_code']) is not int:
        raise ValueError('invalid exit code')
    if not re.fullmatch(r'(daily|release)/[A-Za-z0-9_-]+\.dump', value.get('object', '')):
        raise ValueError('invalid object')
    if value.get('last_success_at') is not None:
        if not re.fullmatch(r'(daily|release)/[A-Za-z0-9_-]+\.dump', value.get('last_success_object', '')):
            raise ValueError('invalid success object')
        if not re.fullmatch(r'[0-9a-f]{64}', value.get('last_success_sha256', '')):
            raise ValueError('invalid success checksum')
        if type(value.get('last_success_bytes')) is not int or value['last_success_bytes'] <= 5:
            raise ValueError('invalid success size')
    if value['status'] == 'uploaded' and value.get('last_success_at') is None:
        raise ValueError('missing upload evidence')
    return value


def assess(state, now, max_age, max_attempt):
    stamps = [state.get(k) for k in ('attempted_at', 'last_success_at', 'last_daily_success_at', 'finished_at')]
    if any(stamp is not None and stamp > now for stamp in stamps):
        return 3, 'future_timestamp'
    if state['status'] == 'failed':
        return 1, 'attempt_failed'
    if state['status'] == 'running' and now - state['attempted_at'] > max_attempt:
        return 1, 'attempt_unfinished'
    success = state.get('last_success_at')
    if success is None:
        return 2, 'no_verified_upload'
    if now - success > max_age:
        return 2, 'stale'
    return 0, 'in_progress' if state['status'] == 'running' else 'fresh'


def save_state(state):
    descriptor, name = tempfile.mkstemp(prefix='.backup-status-', dir=ROOT)
    try:
        with os.fdopen(descriptor, 'w') as target:
            json.dump(state, target, sort_keys=True, allow_nan=False)
            target.write('\n')
            target.flush()
            os.fsync(target.fileno())
        os.replace(name, STATE)
        directory = os.open(ROOT, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def report(state):
    message = json.dumps(state, sort_keys=True, allow_nan=False)
    print(message, flush=True)
    try:
        subprocess.run(['logger', '-t', 'fitness-backup', '--', message],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5, check=False)
    except (OSError, subprocess.TimeoutExpired):
        pass  # The durable receipt and process exit remain authoritative.


def settings():
    result = {}
    for line in (ROOT / '.env').read_text().splitlines():
        key, separator, value = line.partition('=')
        if separator and key in ('BACKUP_BUCKET', 'BACKUP_ACCESS_KEY', 'BACKUP_SECRET_KEY'):
            result[key] = value
    if set(result) != {'BACKUP_BUCKET', 'BACKUP_ACCESS_KEY', 'BACKUP_SECRET_KEY'} or not all(result.values()):
        raise ValueError('missing backup configuration')
    if not re.fullmatch(r'[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]', result['BACKUP_BUCKET']):
        raise ValueError('invalid bucket')
    return result


def curl_quote(value):
    if any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise ValueError('invalid credential characters')
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


def backup(name):
    if not re.fullmatch(r'(daily|release)/[A-Za-z0-9_-]+', name):
        raise ValueError('expected daily/<date> or release/<sha>')
    os.umask(0o077)
    with (ROOT / '.backup.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            report({'status': 'busy', 'version': 1})
            return 1
        try:
            previous = load_state(STATE)
        except (OSError, ValueError, TypeError):
            previous = {}
        state = {'version': 1, 'status': 'running', 'object': name + '.dump',
                 'attempted_at': time.time(), 'last_success_at': previous.get('last_success_at'),
                 'last_daily_success_at': previous.get('last_daily_success_at'), 'stage': 'configuration'}
        for field in ('last_success_object', 'last_success_sha256', 'last_success_bytes'):
            if field in previous:
                state[field] = previous[field]
        save_state(state)
        try:
            config = settings()
            container = os.environ.get('BACKUP_POSTGRES_CONTAINER', 'fitness-postgres-1')
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', container):
                raise ValueError('invalid container')
            with tempfile.TemporaryDirectory(prefix='fitness-backup-') as directory:
                dump = Path(directory) / 'database.dump'
                state['stage'] = 'dump'
                with dump.open('wb') as output:
                    subprocess.run(['docker', 'exec', container, 'sh', '-c',
                                    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'],
                                   stdout=output, stderr=subprocess.DEVNULL, timeout=180, check=True)
                sha, md5 = hashlib.sha256(), hashlib.md5()
                with dump.open('rb') as source:
                    if source.read(5) != b'PGDMP':
                        raise ValueError('invalid dump')
                    source.seek(0)
                    for block in iter(lambda: source.read(1024 * 1024), b''):
                        sha.update(block)
                        md5.update(block)
                credentials = Path(directory) / 'curl.config'
                credentials.write_text('user = ' + curl_quote(config['BACKUP_ACCESS_KEY'] + ':' + config['BACKUP_SECRET_KEY']) + '\n')
                state['stage'] = 'upload'
                response = subprocess.run([
                    'curl', '--disable', '--config', str(credentials), '--silent', '--show-error',
                    '--fail', '--connect-timeout', '10', '--max-time', '180',
                    '--aws-sigv4', 'aws:amz:pl-waw:s3',
                    '--header', 'Content-MD5: ' + base64.b64encode(md5.digest()).decode(),
                    '--header', 'x-amz-content-sha256: ' + sha.hexdigest(),
                    '--upload-file', str(dump), '--output', os.devnull, '--write-out', '%{http_code}',
                    'https://' + config['BACKUP_BUCKET'] + '.s3.pl-waw.scw.cloud/' + name + '.dump',
                ], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=190, check=True)
                if not re.fullmatch(rb'2[0-9]{2}', response.stdout):
                    raise ValueError('upload not acknowledged')
                state.update(status='uploaded', stage='complete', last_success_at=time.time(),
                             last_success_object=name + '.dump', last_success_sha256=sha.hexdigest(),
                             last_success_bytes=dump.stat().st_size)
                if name.startswith('daily/'):
                    state['last_daily_success_at'] = state['last_success_at']
        except (OSError, ValueError, subprocess.SubprocessError) as error:
            state['error'] = ('timeout' if isinstance(error, subprocess.TimeoutExpired) else
                              'process_failed' if isinstance(error, subprocess.CalledProcessError) else
                              'invalid_input' if isinstance(error, ValueError) else 'io_error')
            if isinstance(error, subprocess.CalledProcessError):
                state['exit_code'] = error.returncode
            state['status'] = 'failed'
            state['finished_at'] = time.time()
            save_state(state)
            report(state)
            return 1
        save_state(state)
        report(state)
        return 0


def positive(value):
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError('must be positive seconds')
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('backup').add_argument('name')
    check = commands.add_parser('check')
    check.add_argument('--max-age-seconds', required=True, type=positive)
    check.add_argument('--max-attempt-seconds', default=600, type=positive)
    args = parser.parse_args()
    if args.command == 'backup':
        return backup(args.name)
    try:
        state = load_state(STATE)
        code, reason = assess(state, time.time(), args.max_age_seconds, args.max_attempt_seconds)
        print(json.dumps({'code': code, 'reason': reason, 'receipt': state}, sort_keys=True))
        return code
    except (OSError, ValueError, TypeError):
        print(json.dumps({'code': 3, 'reason': 'missing_or_invalid_receipt'}))
        return 3


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError):
        print('{"code":3,"reason":"backup_receipt_or_configuration_error"}', file=sys.stderr)
        sys.exit(3)
