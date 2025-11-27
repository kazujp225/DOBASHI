"""
言及集計ユーティリティ
期間・対象社長ごとに、動画一覧 / 人別集計 / 年間サマリーを作成
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Any, Tuple
from datetime import datetime, timezone

from analyzers.comment_analyzer import CommentAnalyzer
from typing import Optional
import re

try:
    from models import get_db, Tiger as TigerDB, VideoTiger as VideoTigerDB
    _DB_AVAILABLE = True
except Exception:
    _DB_AVAILABLE = False


def _parse_dt(dt_str: str) -> datetime:
    """ISO8601文字列をdatetime(UTCに正規化)へ"""
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        dt = datetime.min.replace(tzinfo=timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _load_json(path: Path) -> Any:
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _ensure_analyzed(data_dir: Path, video_id: str, tiger_ids: List[str]) -> List[Dict[str, Any]]:
    """解析済みコメントファイルがなければ作成して返す"""
    analyzed_path = data_dir / f"analyzed_comments_{video_id}.json"
    if analyzed_path.exists():
        return _load_json(analyzed_path) or []

    comments_path = data_dir / f"comments_{video_id}.json"
    comments = _load_json(comments_path) or []
    # コメント未取得なら空
    if not comments:
        return []

    tigers_file = data_dir / "tigers.json"
    aliases_file = data_dir / "aliases.json"
    analyzer = CommentAnalyzer(str(tigers_file), str(aliases_file))
    analyzed: List[Dict[str, Any]] = []
    for c in comments:
        r = analyzer.find_tiger_mentions(c.get("text", ""), target_tigers=tiger_ids)
        analyzed.append({
            **c,
            "normalized_text": r.get("normalized_text"),
            "tiger_mentions": r.get("mentions", []),
        })

    with analyzed_path.open("w", encoding="utf-8") as f:
        json.dump(analyzed, f, ensure_ascii=False, indent=2)

    return analyzed


def _build_alias_patterns(aliases_map: Dict[str, List[Dict[str, Any]]]) -> Dict[str, List[re.Pattern]]:
    patterns: Dict[str, List[re.Pattern]] = {}
    for tid, alias_list in aliases_map.items():
        compiled = []
        for a in alias_list:
            alias = a.get("alias", "")
            if not alias:
                continue
            if a.get("type") == "short" and len(alias) <= 2:
                pat = re.compile(re.escape(alias) + r"(社長|さん|氏)")
            else:
                pat = re.compile(re.escape(alias))
            compiled.append(pat)
        patterns[tid] = compiled
    return patterns


def _resolve_target_ids(requested_ids: List[str], aliases_data: Dict[str, List[Dict[str, Any]]], tigers_data: List[Dict[str, Any]]):
    """tigers.jsonのID配列を、aliases.jsonのキーへ解決。
    Returns: (alias_ids(list), alias_to_requested(dict), requested_to_alias(dict))
    """
    alias_ids: List[str] = []
    alias_to_requested: Dict[str, str] = {}
    requested_to_alias: Dict[str, str] = {}
    disp_map = {t['tiger_id']: (t.get('display_name',''), t.get('full_name','')) for t in tigers_data}
    for req in requested_ids:
        if req in aliases_data:
            alias_ids.append(req)
            alias_to_requested[req] = req
            requested_to_alias[req] = req
            continue
        dname, fname = disp_map.get(req, ('',''))
        matched = None
        if dname:
            for k, alias_list in aliases_data.items():
                if any(a.get('alias') == dname for a in alias_list):
                    matched = k
                    break
        if not matched and fname:
            for k, alias_list in aliases_data.items():
                if any(a.get('alias') == fname for a in alias_list):
                    matched = k
                    break
        alias_key = matched or req
        alias_ids.append(alias_key)
        alias_to_requested[alias_key] = req
        requested_to_alias[req] = alias_key
    # unique preserving order
    seen = set(); alias_ids_u = []
    for a in alias_ids:
        if a not in seen:
            seen.add(a); alias_ids_u.append(a)
    return alias_ids_u, alias_to_requested, requested_to_alias


def aggregate_mentions(
    base_dir: Path,
    start_date: datetime,
    end_date: datetime,
    tiger_ids: List[str],
    count_mode: str = "comment",
    performers_source: str = "comments"
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    言及集計を実行

    Returns:
        videos_sheet, people_sheet, summary_sheet
    """
    data_dir = base_dir / "data"
    # 期間境界をUTCに正規化
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    if end_date.tzinfo is None:
        end_date = end_date.replace(tzinfo=timezone.utc)
    videos_data = _load_json(data_dir / "videos.json") or []
    tigers_data = _load_json(data_dir / "tigers.json") or []
    aliases_data = _load_json(data_dir / "aliases.json") or {}
    tiger_map = {t["tiger_id"]: t for t in tigers_data}

    # 期間内の動画を抽出
    videos = []
    for v in videos_data:
        dt = _parse_dt(v.get("published_at", ""))
        if start_date <= dt <= end_date:
            videos.append(v)

    # 動画単位の集計
    videos_sheet: List[Dict[str, Any]] = []

    # 人別集計: 出演動画本数 / コメント出現数
    person_video_count = {tid: 0 for tid in tiger_ids}
    person_comment_mentions = {tid: 0 for tid in tiger_ids}

    # 入力IDをaliases側IDに解決
    alias_ids, alias_to_req, req_to_alias = _resolve_target_ids(tiger_ids, aliases_data, tigers_data)
    # エイリアスパターン（occurrence用）: alias_idベース
    alias_patterns = _build_alias_patterns({aid: aliases_data.get(aid, []) for aid in alias_ids})

    for v in videos:
        vid = v["video_id"]
        title = v.get("title", "")
        published_at = v.get("published_at", "")
        url = f"https://www.youtube.com/watch?v={vid}"

        # コメント総数
        comments = _load_json(data_dir / f"comments_{vid}.json") or []
        total_comments = len(comments)

        # 解析済みコメント（なければ作成）
        # 解析（不足時）: analyzerにはaliases側IDを渡す
        analyzed = _ensure_analyzed(data_dir, vid, alias_ids)

        # 動画内で言及があった対象社長（コメント上の言及）
        mentioned_tigers_in_video = set()
        # 各対象社長のこの動画でのコメント出現数
        per_video_comment_mentions = {tid: 0 for tid in tiger_ids}
        # 各対象社長のこの動画での文字列登場回数
        per_video_occurrence_mentions = {tid: 0 for tid in tiger_ids}

        for ac in analyzed:
            mentions = ac.get("tiger_mentions", [])
            text = ac.get("normalized_text") or ac.get("text", "")

            # comment_analyzer形式(エイリアスID) or UI整形(リクエストID)の両対応
            m_ids: List[str] = []
            for m in mentions:
                mid = m.get("tiger_id") or m.get("tigerId")
                if not mid:
                    continue
                if mid in tiger_ids:
                    m_ids.append(mid)
                elif mid in alias_ids:
                    # エイリアスID→リクエストIDへ
                    rid = alias_to_req.get(mid)
                    if rid and rid in tiger_ids:
                        m_ids.append(rid)
            if m_ids:
                for tid in set(m_ids):
                    per_video_comment_mentions[tid] += 1
                    mentioned_tigers_in_video.add(tid)

            # 文字列登場回数
            if text:
                for rid in tiger_ids:
                    aid = req_to_alias.get(rid, rid)
                    pats = alias_patterns.get(aid, [])
                    occ = 0
                    for pat in pats:
                        occ += len(pat.findall(text))
                    if occ > 0:
                        per_video_occurrence_mentions[rid] += occ

        # 人別集計に反映
        for tid in tiger_ids:
            if per_video_comment_mentions[tid] > 0:
                person_video_count[tid] += 1
                person_comment_mentions[tid] += per_video_comment_mentions[tid]

        # 動画一覧レコード
        # 出演者算定（DB優先オプション）
        performer_names = None
        if performers_source == "db" and _DB_AVAILABLE:
            try:
                db = next(get_db())
                vtigers = db.query(VideoTigerDB).filter(VideoTigerDB.video_id == vid).all()
                tids = [vt.tiger_id for vt in vtigers]
                if tids:
                    trows = db.query(TigerDB).filter(TigerDB.tiger_id.in_(tids)).all()
                    performer_names = [tr.display_name for tr in trows]
                db.close()
            except Exception:
                performer_names = None

        videos_sheet.append({
            "動画ID": vid,
            "URL": url,
            "タイトル": title,
            "配信日": published_at,
            "出演者数": (len(performer_names) if performer_names is not None else len(mentioned_tigers_in_video)),
            "出演者一覧": ", ".join(
                performer_names if performer_names is not None else [tiger_map.get(tid, {}).get("display_name", tid) for tid in sorted(mentioned_tigers_in_video)]
            ),
            "コメント総数": total_comments,
            **{
                f"{tiger_map.get(tid, {}).get('display_name', tid)}_コメント出現数": per_video_comment_mentions[tid]
                for tid in tiger_ids
            },
            **{
                f"{tiger_map.get(tid, {}).get('display_name', tid)}_言及回数": per_video_occurrence_mentions[tid]
                for tid in tiger_ids
            },
        })

    # 人別集計シート
    people_sheet: List[Dict[str, Any]] = []
    # 人別集計シート：言及回数（occurrence）も算出
    # videos_sheetから集計（対象期間内のみ）
    # per_video_occurrence_mentions の総和
    person_occurrences = {tid: 0 for tid in tiger_ids}
    for row in videos_sheet:
        for tid in tiger_ids:
            key = f"{tiger_map.get(tid, {}).get('display_name', tid)}_言及回数"
            person_occurrences[tid] += int(row.get(key, 0) or 0)

    for tid in tiger_ids:
        people_sheet.append({
            "社長ID": tid,
            "社長名": tiger_map.get(tid, {}).get("display_name", tid),
            "出演動画本数": person_video_count[tid],
            "コメント出現数": person_comment_mentions[tid],
            "言及回数": person_occurrences[tid],
        })

    # 年間サマリー（期間全体のまとめ）
    total_videos = len(videos)
    total_comments = 0
    for v in videos:
        comments = _load_json(data_dir / f"comments_{v['video_id']}.json") or []
        total_comments += len(comments)

    # 人別ランキング（count_modeに応じて基準変更）
    ranking_key = "言及回数" if count_mode == "occurrence" else "コメント出現数"
    ranking = sorted(
        [
            {
                "社長ID": tid,
                "社長名": tiger_map.get(tid, {}).get("display_name", tid),
                "コメント出現数": person_comment_mentions[tid],
                "言及回数": person_occurrences[tid],
                "出演動画本数": person_video_count[tid],
            }
            for tid in tiger_ids
        ],
        key=lambda x: x[ranking_key],
        reverse=True,
    )

    summary_sheet: List[Dict[str, Any]] = []
    summary_sheet.append({
        "対象期間開始": start_date.strftime("%Y-%m-%d"),
        "対象期間終了": end_date.strftime("%Y-%m-%d"),
        "動画本数": total_videos,
        "総コメント数": total_comments,
    })
    # ランキングは別行で
    summary_sheet.extend(ranking)

    return videos_sheet, people_sheet, summary_sheet
