import unittest

from apt_mirrors import ARCHIVE, CLOUDS, prefer_archive


class AptMirrors(unittest.TestCase):
    def fixture(self, cloud, cloud_priority=1, archive_priority=2):
        return (f'# Runner mirrors\n{cloud}{cloud_priority}\n'
                f'{ARCHIVE}{archive_priority}\n'
                'https://security.ubuntu.com/ubuntu/\tpriority:3\n')

    def test_both_clouds_prefer_archive_and_preserve_other_lines(self):
        for cloud in CLOUDS:
            with self.subTest(cloud=cloud):
                self.assertEqual(prefer_archive(self.fixture(cloud)),
                                 self.fixture(cloud, 2, 1))

    def test_already_preferred_is_unchanged(self):
        for cloud in CLOUDS:
            original = self.fixture(cloud, 2, 1)
            self.assertEqual(prefer_archive(original), original)

    def test_duplicate_missing_unknown_and_mixed_clouds_refused(self):
        original = self.fixture(CLOUDS[0])
        for value in (
            original + CLOUDS[0] + '1\n',
            original + ARCHIVE + '2\n',
            original.replace(CLOUDS[0] + '1\n', ''),
            original.replace(ARCHIVE + '2\n', ''),
            original.replace('azure.archive', 'unknown.archive'),
            original + CLOUDS[1] + '1\n',
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                prefer_archive(value)

    def test_unexpected_priorities_refused(self):
        for cloud in CLOUDS:
            for priorities in ((1, 1), (2, 2), (3, 2), (1, 3)):
                with self.subTest(cloud=cloud, priorities=priorities), self.assertRaises(ValueError):
                    prefer_archive(self.fixture(cloud, *priorities))

    def test_final_newline_preserved(self):
        for cloud in CLOUDS:
            self.assertEqual(prefer_archive(self.fixture(cloud).rstrip('\n')),
                             self.fixture(cloud, 2, 1).rstrip('\n'))


if __name__ == '__main__':
    unittest.main()
