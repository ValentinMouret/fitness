"""Prefer the Ubuntu archive in known GitHub-hosted runner mirror layouts."""
from pathlib import Path

CLOUDS = (
    'http://azure.archive.ubuntu.com/ubuntu/\tpriority:',
    'http://us-east-2.ec2.archive.ubuntu.com/ubuntu/\tpriority:',
)
ARCHIVE = 'https://archive.ubuntu.com/ubuntu/\tpriority:'


def prefer_archive(original):
    lines = original.splitlines(keepends=True)
    cloud = [(i, prefix) for i, line in enumerate(lines)
             for prefix in CLOUDS if line.startswith(prefix)]
    archive = [i for i, line in enumerate(lines) if line.startswith(ARCHIVE)]
    if len(cloud) != 1 or len(archive) != 1:
        raise ValueError('Unexpected runner APT mirror layout; left unchanged')
    (a, prefix), b = cloud[0], archive[0]
    current = (lines[a].rstrip('\n'), lines[b].rstrip('\n'))
    if current == (prefix + '2', ARCHIVE + '1'):
        return original
    if current != (prefix + '1', ARCHIVE + '2'):
        raise ValueError('Unexpected runner APT mirror priorities; left unchanged')
    lines[a] = lines[a].replace('priority:1', 'priority:2')
    lines[b] = lines[b].replace('priority:2', 'priority:1')
    return ''.join(lines)


if __name__ == '__main__':
    path = Path('/etc/apt/apt-mirrors.txt')
    original = path.read_text()
    try:
        updated = prefer_archive(original)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    if updated != original:
        path.write_text(updated)
