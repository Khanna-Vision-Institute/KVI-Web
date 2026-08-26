#!/usr/bin/env python3
"""
Convert guru_faqs.json + guru_logs.json → guru_faqs.csv + guru_logs.csv.

Uses only Python 3 standard library (no pandas).

Usage:
  python3 guru_json_to_csv.py
  python3 guru_json_to_csv.py /path/to/guru_faqs.json /path/to/guru_logs.json
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path
from typing import Any

email_re = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')


def redact(val: Any) -> Any:
    if isinstance(val, str):
        return email_re.sub('[REDACTED]', val)
    return val


def flatten_record(record: dict[str, Any], prefix: str = '') -> dict[str, Any]:
    """Flatten nested dicts for CSV; lists/dicts embedded as JSON text."""
    out: dict[str, Any] = {}
    for key, raw in record.items():
        flat_key = f'{prefix}.{key}' if prefix else key
        if isinstance(raw, dict):
            out.update(flatten_record(raw, flat_key))
        elif isinstance(raw, list) and raw and isinstance(raw[0], dict):
            out[flat_key] = json.dumps(raw, ensure_ascii=False)
        elif isinstance(raw, list):
            if all(not isinstance(item, dict) for item in raw):
                out[flat_key] = '|'.join(str(item) for item in raw)
            else:
                out[flat_key] = json.dumps(raw, ensure_ascii=False)
        elif raw is None:
            out[flat_key] = ''
        else:
            out[flat_key] = raw
    return out


def normalize_root(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def write_csv(path_out: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        path_out.write_text('', encoding='utf-8')
        return
    flat_rows = [flatten_record(r) for r in rows]
    fieldnames: list[str] = sorted({k for fr in flat_rows for k in fr.keys()})
    with path_out.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        w.writeheader()
        for fr in flat_rows:
            safe = {}
            for k, v in fr.items():
                if v is None:
                    safe[k] = ''
                elif isinstance(v, (dict, list)):
                    safe[k] = json.dumps(v, ensure_ascii=False)
                else:
                    safe[k] = v
            w.writerow(safe)


def faqs_derived(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for r in rows:
        rr = dict(r)
        kw = rr.get('keywords')
        if isinstance(kw, list):
            rr['keywords_count'] = len(kw)
            rr['keywords'] = '|'.join(str(x) for x in kw)
        else:
            rr.setdefault('keywords_count', 1 if kw not in (None, '') else 0)
        out.append(rr)
    return out


def logs_derived(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for r in rows:
        rr = dict(r)
        for col in ('query', 'response'):
            if col in rr:
                rr[col] = redact(rr[col])
        mu = rr.get('model_used')
        if isinstance(mu, str):
            m = re.search(r'faq_match_(?P<score>[\d.]+)', mu)
            rr['faq_match_score'] = float(m.group('score')) if m else ''
            rr['event_type'] = re.sub(r'faq_match_[\d.]+', 'faq_match', mu)
        else:
            rr['faq_match_score'] = ''
            rr['event_type'] = ''
        q = rr.get('query', '')
        res = rr.get('response', '')
        rr['query_length'] = len(str(q)) if q is not None else 0
        rr['response_length'] = len(str(res)) if res is not None else 0
        out.append(rr)
    return out


def main() -> None:
    if len(sys.argv) >= 3:
        faqs_path = Path(sys.argv[1]).expanduser()
        logs_path = Path(sys.argv[2]).expanduser()
    else:
        faqs_path = Path('guru_faqs.json')
        logs_path = Path('guru_logs.json')

    if not faqs_path.is_file():
        sys.exit(f'Missing: {faqs_path.resolve()}')
    if not logs_path.is_file():
        sys.exit(f'Missing: {logs_path.resolve()}')

    faqs_data = json.loads(faqs_path.read_text(encoding='utf-8'))
    logs_data = json.loads(logs_path.read_text(encoding='utf-8'))

    faqs_rows = faqs_derived(normalize_root(faqs_data))
    logs_rows = logs_derived(normalize_root(logs_data))

    out_faqs = Path('guru_faqs.csv')
    out_logs = Path('guru_logs.csv')
    write_csv(out_faqs, faqs_rows)
    write_csv(out_logs, logs_rows)
    print(f'Wrote {out_faqs.resolve()} ({len(faqs_rows)} rows)')
    print(f'Wrote {out_logs.resolve()} ({len(logs_rows)} rows)')


if __name__ == '__main__':
    main()
