"""Offline contract tests for the review-only Wiki importer."""
import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = pathlib.Path(__file__).with_name("import_wiki_locations.py")
spec = importlib.util.spec_from_file_location("wiki_importer", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class WikiImporterTests(unittest.TestCase):
    def test_list_payload(self):
        self.assertEqual(module.records([{"uuid": "a"}]), [{"uuid": "a"}])

    def test_wrapped_payload(self):
        self.assertEqual(module.records({"data": [{"id": 1}], "meta": {"last_page": 1}}), [{"id": 1}])

    def test_reject_unknown_payload(self):
        with self.assertRaises(ValueError):
            module.records({"items": [{"id": 1}]})

    def test_version_pagination_and_provenance(self):
        import json
        import sys
        responses = [
            {"data": [{"uuid": "one", "name": "Alpha"}], "meta": {"last_page": 2}},
            {"data": [{"uuid": "two", "name": "Beta"}], "meta": {"last_page": 2}},
        ]
        seen = []
        def fake_fetch(url):
            seen.append(url)
            return responses.pop(0)
        with tempfile.TemporaryDirectory() as directory:
            out = pathlib.Path(directory) / "review.json"
            with patch.object(module, "fetch", side_effect=fake_fetch), patch.object(
                sys, "argv", ["import_wiki_locations.py", "--version", "4.10.3-LIVE.test", "--limit", "2", "--output", str(out)]
            ):
                module.main()
            data = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(data["count"], 2)
            self.assertTrue(data["reviewOnly"])
            self.assertEqual([r["sourceId"] for r in data["records"]], ["one", "two"])
            self.assertTrue(all(r["verification"] == "api-catalog-not-live-confirmed" for r in data["records"]))
            self.assertIn("page=2", seen[1])
            self.assertTrue(all("version=4.10.3-LIVE.test" in url for url in seen))


if __name__ == "__main__":
    unittest.main()
