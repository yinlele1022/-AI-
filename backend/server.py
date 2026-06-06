"""
《反着来》后端服务
Flask + 通义千问/DeepSeek 降级
运行: python server.py
"""
import os
import json
import time
import random
import hashlib
import sqlite3
import logging
from datetime import datetime, timedelta
from functools import wraps

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ── 日志 ────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("opposite-game")

# ── 应用初始化 ──────────────────────────────────
app = Flask(__name__)
CORS(app, origins=["*"])  # 开发阶段允许所有跨域，上线前改具体域名

# ── 配置（从环境变量读，本地开发用 .env）────────────────────────────
TONGYI_API_KEY = os.getenv("TONGYI_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
TONGYI_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
FALLBACK_JSON = os.path.join(os.path.dirname(__file__), "data", "questions-fallback.json")
CHALLENGE_DIR = os.path.join(os.path.dirname(__file__), "data", "challenges")
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "game.db")
TIMEOUT_SECONDS = 10  # AI 调用超时时间

# 去重缓存：记录最近 N 条题目的 instruction_text，避免重复
_recent_questions = []
RECENT_MAX = 10

def _cache_question(q):
    """记录题目到去重缓存"""
    inst = q.get("instruction_text", "")
    if inst:
        _recent_questions.append(inst)
        if len(_recent_questions) > RECENT_MAX:
            _recent_questions[:] = _recent_questions[-RECENT_MAX:]

# 确保挑战目录存在
os.makedirs(CHALLENGE_DIR, exist_ok=True)

# ── SQLite 数据库初始化 ─────────────────────────
def init_db():
    """创建排行榜表和每日记录表"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT DEFAULT '匿名玩家',
        score INTEGER NOT NULL,
        max_combo INTEGER DEFAULT 0,
        fastest_reaction_ms INTEGER DEFAULT 999999,
        answers_json TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_score ON leaderboard(score DESC)')
    conn.commit()
    conn.close()

def submit_score(player_name, score, max_combo, fastest_ms, answers_json):
    """提交分数到排行榜，返回排名"""
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        'INSERT INTO leaderboard (player_name, score, max_combo, fastest_reaction_ms, answers_json) VALUES (?,?,?,?,?)',
        (player_name or '匿名玩家', score, max_combo, fastest_ms, answers_json)
    )
    conn.commit()
    # 查询排名（分数大于当前分数的记录数 + 1）
    rank = conn.execute('SELECT COUNT(*) + 1 FROM leaderboard WHERE score > ?', (score,)).fetchone()[0]
    total = conn.execute('SELECT COUNT(*) FROM leaderboard').fetchone()[0]
    conn.close()
    return rank, total

def get_top_scores(limit=20):
    """获取排行榜 Top N"""
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        'SELECT player_name, score, max_combo, fastest_reaction_ms, created_at FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT ?',
        (limit,)
    ).fetchall()
    conn.close()
    return [{
        "player_name": r[0], "score": r[1], "max_combo": r[2],
        "fastest_reaction_ms": r[3], "created_at": r[4]
    } for r in rows]

def get_player_rank_str(score):
    """获取分数对应的排名信息"""
    conn = sqlite3.connect(DB_PATH)
    rank = conn.execute('SELECT COUNT(*) + 1 FROM leaderboard WHERE score > ?', (score,)).fetchone()[0]
    total = conn.execute('SELECT COUNT(*) FROM leaderboard').fetchone()[0]
    conn.close()
    pct = round((1 - rank / max(total, 1)) * 100)
    return {"rank": rank, "total": total, "percentile": pct}

init_db()

# ── 工具函数 ─────────────────────────────────────

def json_resp(data, status=200):
    """统一包装 JSON 响应，加 CORS header（不与 Flask make_response 冲突）"""
    resp = jsonify(data)
    resp.status_code = status
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


def load_fallback_questions():
    """加载本地降级题库"""
    try:
        with open(FALLBACK_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("questions", [])
    except Exception as e:
        log.error(f"加载降级题库失败: {e}")
        return []


FALLBACK_CACHE = []
def get_fallback_question(difficulty, exclude_types):
    """从本地题库随机取一道（排除最近题型）"""
    global FALLBACK_CACHE
    if not FALLBACK_CACHE:
        FALLBACK_CACHE = load_fallback_questions()
    pool = [q for q in FALLBACK_CACHE if q.get("type") not in (exclude_types or [])]
    if not pool:
        pool = FALLBACK_CACHE  # 兜底：全部返回
    q = random.choice(pool)
    q["source"] = "fallback"
    return q


def call_tongyi(prompt):
    """调用通义千问（OpenAI 兼容模式），返回生成文本或 None"""
    if not TONGYI_API_KEY:
        return None
    headers = {
        "Authorization": f"Bearer {TONGYI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "qwen-max",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.9,
        "max_tokens": 500
    }
    try:
        resp = requests.post(TONGYI_URL, headers=headers, json=payload, timeout=TIMEOUT_SECONDS)
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        log.warning(f"通义千问调用失败: {e}")
    return None


def call_deepseek(prompt):
    """调用 DeepSeek，返回生成文本或 None"""
    if not DEEPSEEK_API_KEY:
        return None
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 1.2,
        "max_tokens": 500
    }
    try:
        resp = requests.post(DEEPSEEK_URL, headers=headers, json=payload, timeout=TIMEOUT_SECONDS)
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        log.warning(f"DeepSeek 调用失败: {e}")
    return None


def parse_ai_question(raw_text):
    """
    解析 AI 生成的题目文本，尝试转成标准题目结构。
    AI 可能返回 JSON 或自由文本，这里做兼容解析。
    失败返回 None。
    """
    try:
        # 尝试直接解析为 JSON
        obj = json.loads(raw_text)
        # 校验必要字段
        if all(k in obj for k in ("type", "instruction_text", "correct_action", "options")):
            obj.setdefault("time_limit_ms", 1000)
            obj.setdefault("source", "ai")
            return obj
    except json.JSONDecodeError:
        pass

    # 尝试从自由文本中提取 JSON 块（AI 有时会包裹在 ```json ``` 里）
    import re
    m = re.search(r"```json\s*([\s\S]*?)\s*```", raw_text)
    if m:
        try:
            obj = json.loads(m.group(1))
            if all(k in obj for k in ("type", "instruction_text", "correct_action", "options")):
                obj.setdefault("time_limit_ms", 1000)
                obj.setdefault("source", "ai")
                return obj
        except Exception:
            pass
    return None


def generate_question_prompt(difficulty, exclude_types, force_type="any"):
    """构造让 AI 生成题目的 prompt"""
    type_hints = {
        "direction": "方向类：指令说「向左滑/向右滑」，正确答案操作方向相反",
        "color": "颜色类：指令说「点红色的/点蓝色的」，正确答案点另一个颜色",
        "action": "动作类：指令说「别动/立刻点」，正确答案是反着来",
        "double_neg": "双重否定类：指令说「不要不点/别不点」，双重否定=肯定，要立刻点",
        "combo": "组合类：指令说「不要点红色的/别向左滑」，先理解否定含义再反着来"
    }
    # 类型选择：force_type 指定则用指定类型，否则随机
    if force_type and force_type != "any" and force_type in type_hints:
        chosen_type = force_type
    else:
        available = [t for t in type_hints if t not in (exclude_types or [])]
        if not available:
            available = list(type_hints.keys())
        chosen_type = random.choice(available)
    hint = type_hints[chosen_type]

    # 最近出过的题，让 AI 避开
    recent_str = ""
    if _recent_questions:
        recent_str = "最近已经出过的题目（请生成不同的）：\n" + "\n".join(f"- {q}" for q in _recent_questions[-5:])

    return f"""你是一个反直觉反应力游戏的题目生成器，每次都要生成全新的、有创意的题目。

游戏名称：《反着来》
规则：屏幕上出现一条指令，玩家必须做「相反」的操作才算正确。
例如：指令说「向左滑」，玩家必须向右滑。

当前难度等级：{difficulty}/5（数字越大越难，双重否定和组合类只在难度>=3出现）
请生成一道「{chosen_type}」类型的题目。

{hint}

{recent_str}

请严格按以下 JSON 格式返回，不要有任何其他文字：
{{
  "type": "{chosen_type}",
  "instruction_text": "显示在屏幕上的指令文字",
  "correct_action": "正确答案的动作标识（如 swipe_right / tap_blue / tap_any）",
  "options": [
    {{"label": "按钮1文字", "action": "对应动作", "color": "#_hex（颜色类才需要）"}},
    {{"label": "按钮2文字", "action": "对应动作", "color": "#hex（颜色类才需要）"}}
  ],
  "time_limit_ms": 800
}}

注意：
- options 数组长度：所有题型必须为 2（包括动作类和双重否定类）
- 动作类 2 个选项：一个「点」类（action: tap_any），一个「不点/等待」类（action: wait）
- 双重否定类 2 个选项：一个「点」类（action: tap_any），一个「不点/等待」类（action: wait）
- correct_action 必须匹配 options 中某个 action
- time_limit_ms：方向类 700-800，其他 800-1200，难度越高时间越短
- 每次生成的 instruction_text 必须跟最近出过的题目完全不同
"""


def analyze_performance_prompt(answers):
    """构造让 AI 分析表现的 prompt"""
    summary = json.dumps(answers, ensure_ascii=False)
    return f"""你是一个认知科学分析器。以下是玩家在一场《反着来》游戏中的答题记录：
{summary}

请从以下4个维度给玩家打分（0-100），并给出弱点维度和一句话评语。
维度说明：
- reaction_speed: 反应速度（答对题目的平均反应时间，越快越高）
- color_discrimination: 颜色辨别力（颜色类题目的正确率）
- antisocial_thinking: 反直觉思维力（双重否定和组合类题目的正确率）
- pressure_resistance: 抗压能力（连击越长，后面题目的正确率是否下降）

请严格按以下 JSON 格式返回：
{{
  "radar": {{
    "reaction_speed": 85,
    "color_discrimination": 70,
    "antisocial_thinking": 60,
    "pressure_resistance": 90
  }},
  "weakness": "antisocial_thinking",
  "recommended_difficulty": 3,
  "comment": "一句话评语，风趣有梗，20字以内"
}}
"""


def generate_share_text_prompt(score, max_combo, fastest_ms, weakness):
    """构造让 AI 生成分享文案的 prompt"""
    return f"""你是一个社交媒体文案高手。《反着来》是一款反直觉反应力游戏。
玩家刚刚完成一局，成绩：答对 {score}/30 题，最长连击 {max_combo}，最快反应 {fastest_ms}ms。
弱点维度：{weakness}。

请生成一段适合发抖音/朋友圈的分享文案（50字以内），带emoji，末尾附带挑战邀请。
再生成3个hashtag。

严格按 JSON 返回：
{{
  "text": "分享文案",
  "hashtags": ["tag1", "tag2", "tag3"]
}}
"""


# ── 路由 ─────────────────────────────────────────

@app.route("/health", methods=["GET", "OPTIONS"])
def health():
    return json_resp({"status": "ok", "version": "1.0.0"})


@app.route("/api/generate-question", methods=["POST", "OPTIONS"])
def generate_question():
    """生成题目：先试 AI，失败降级到本地题库"""
    if request.method == "OPTIONS":
        return json_resp({})
    try:
        body = request.get_json(silent=True) or {}
        difficulty_raw = body.get("difficulty", 1)
        # 支持字符串 ("easy"/"medium"/"hard") 和数字 (1-5)
        DIFFICULTY_MAP = {"easy": 1, "medium": 2, "hard": 3, "extreme": 4, "hell": 5}
        if isinstance(difficulty_raw, str):
            difficulty = DIFFICULTY_MAP.get(difficulty_raw.lower(), 1)
        else:
            difficulty = int(difficulty_raw)

        force_type = body.get("type", "any")   # 前端指定类型
        exclude_types = body.get("exclude_types", [])

        # 1. 先试通义千问
        prompt = generate_question_prompt(difficulty, exclude_types, force_type)
        raw = call_tongyi(prompt)

        # 2. 超时/失败 → DeepSeek 降级
        if raw is None:
            log.info("通义千问不可用，降级到 DeepSeek")
            raw = call_deepseek(prompt)

        # 3. 都失败 → 本地题库降级
        if raw is None:
            log.info("AI 全部不可用，降级到本地题库")
            q = get_fallback_question(difficulty, exclude_types)
            _cache_question(q)
            return json_resp(q)

        # 4. 解析 AI 返回
        question = parse_ai_question(raw)
        if question:
            _cache_question(question)
            return json_resp(question)

        # 5. 解析失败 → 本地降级
        log.warning("AI 返回格式异常，降级到本地题库")
        q = get_fallback_question(difficulty, exclude_types)
        _cache_question(q)
        return json_resp(q)

    except Exception as e:
        log.error(f"生成题目异常: {e}")
        q = get_fallback_question(1, [])
        return json_resp(q)


@app.route("/api/analyze-performance", methods=["POST", "OPTIONS"])
def analyze_performance():
    """分析玩家表现，返回雷达图数据"""
    if request.method == "OPTIONS":
        return json_resp({})
    try:
        body = request.get_json(silent=True) or {}
        answers = body.get("answers", [])
        if not answers:
            return json_resp({"error": "answers 为空"}, 400)

        # 用简单算法本地计算（不依赖 AI，速度快）
        total = len(answers)
        correct = sum(1 for a in answers if a.get("correct"))
        avg_reaction = sum(a.get("reaction_time_ms", 1000) for a in answers if a.get("correct")) / max(correct, 1)

        # 各维度正确率
        type_stats = {}
        for a in answers:
            t = a.get("question_type", "unknown")
            type_stats.setdefault(t, {"correct": 0, "total": 0})
            type_stats[t]["total"] += 1
            if a.get("correct"):
                type_stats[t]["correct"] += 1

        def calc_score(correct_list):
            if not correct_list:
                return 50
            rate = sum(correct_list) / len(correct_list)
            return int(rate * 100)

        reaction_speed = max(0, min(100, int(100 - avg_reaction / 10)))
        color_score = calc_score([a.get("correct") for a in answers if a.get("question_type") == "color"])
        anti_score = calc_score([a.get("correct") for a in answers if a.get("question_type") in ("double_neg", "combo")])
        pressure_score = 80  # 简化：默认 80

        weakness = min(
            ("reaction_speed", 100 - reaction_speed),
            ("color_discrimination", 100 - color_score),
            ("antisocial_thinking", 100 - anti_score),
            ("pressure_resistance", 100 - pressure_score),
            key=lambda x: x[1]
        )[0]

        comments = {
            "reaction_speed": "手速惊人，堪称人机合一！",
            "color_discrimination": "色弱实锤了，建议少玩射击游戏",
            "antisocial_thinking": "反直觉思维有待提升，多练练！",
            "pressure_resistance": "抗压能力满分，大心脏！"
        }

        return json_resp({
            "radar": {
                "reaction_speed": reaction_speed,
                "color_discrimination": color_score,
                "antisocial_thinking": anti_score,
                "pressure_resistance": pressure_score
            },
            "weakness": weakness,
            "recommended_difficulty": min(5, max(1, int(correct / total * 5) + 1)),
            "comment": comments.get(weakness, "继续加油！")
        })

    except Exception as e:
        log.error(f"分析表现异常: {e}")
        return json_resp({"error": str(e)}, 500)


@app.route("/api/generate-share-text", methods=["POST", "OPTIONS"])
def generate_share_text():
    """生成分享文案"""
    if request.method == "OPTIONS":
        return json_resp({})
    try:
        body = request.get_json(silent=True) or {}
        score = int(body.get("score", 0))
        max_combo = int(body.get("max_combo", 0))
        fastest_ms = int(body.get("fastest_reaction_ms", 9999))
        weakness = body.get("weakness", "")

        # 本地生成（不依赖 AI，避免延迟）
        rank_text = "菜鸟" if score < 10 else "普通" if score < 20 else "高手" if score < 28 else "反直觉战神"
        text = f"我在《反着来》答对了 {score}/30 题，最长连击 {max_combo}，最快 {fastest_ms}ms！{rank_text}，来挑战我 👉 输入代码 "
        hashtags = ["反着来", "反直觉挑战", "反应力测试"]

        return json_resp({
            "text": text,
            "hashtags": hashtags,
            "share_image_prompt": f"生成一张游戏分享卡片，分数 {score}，连击 {max_combo}"
        })

    except Exception as e:
        log.error(f"生成分享文案异常: {e}")
        return json_resp({"error": str(e)}, 500)


@app.route("/api/create-challenge", methods=["POST", "OPTIONS"])
def create_challenge():
    """创建挑战：保存题目和成绩，返回 6 位挑战码"""
    if request.method == "OPTIONS":
        return json_resp({})
    try:
        body = request.get_json(silent=True) or {}
        player_name = body.get("player_name", "匿名玩家")
        score = int(body.get("score", 0))
        questions = body.get("questions", [])

        # 生成 6 位挑战码（字母+数字）
        import string
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

        challenge = {
            "code": code,
            "player_name": player_name,
            "score": score,
            "questions": questions,
            "created_at": datetime.utcnow().isoformat() + "Z"
        }
        filepath = os.path.join(CHALLENGE_DIR, f"{code}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(challenge, f, ensure_ascii=False, indent=2)

        log.info(f"挑战创建成功: {code} by {player_name}")
        return json_resp({
            "challenge_code": code,
            "share_url": f"https://douyin.com/share/{code}"
        })

    except Exception as e:
        log.error(f"创建挑战异常: {e}")
        return json_resp({"error": str(e)}, 500)


@app.route("/api/challenge/<code>", methods=["GET", "OPTIONS"])
def get_challenge(code):
    """获取挑战信息"""
    if request.method == "OPTIONS":
        return json_resp({})
    try:
        filepath = os.path.join(CHALLENGE_DIR, f"{code}.json")
        if not os.path.exists(filepath):
            return json_resp({"error": "挑战码不存在或已过期"}, 404)
        with open(filepath, "r", encoding="utf-8") as f:
            challenge = json.load(f)
        return json_resp(challenge)

    except Exception as e:
        log.error(f"获取挑战异常: {e}")
        return json_resp({"error": str(e)}, 500)


# ── 排行榜 API ──────────────────────────────────

@app.route("/api/leaderboard/submit", methods=["POST", "OPTIONS"])
def leaderboard_submit():
    """提交分数到排行榜"""
    if request.method == "OPTIONS":
        return json_resp({})
    try:
        body = request.get_json(silent=True) or {}
        player_name = body.get("player_name", "匿名玩家")
        score = int(body.get("score", 0))
        max_combo = int(body.get("max_combo", 0))
        fastest_ms = int(body.get("fastest_reaction_ms", 999999))
        answers_json = json.dumps(body.get("answers", []), ensure_ascii=False)

        rank, total = submit_score(player_name, score, max_combo, fastest_ms, answers_json)
        log.info(f"排行榜提交: {player_name} 得分 {score}，排名 {rank}/{total}")
        return json_resp({"rank": rank, "total": total, "score": score})

    except Exception as e:
        log.error(f"提交排行榜失败: {e}")
        return json_resp({"error": str(e)}, 500)


@app.route("/api/leaderboard/top", methods=["GET", "OPTIONS"])
def leaderboard_top():
    """获取排行榜 Top 20"""
    if request.method == "OPTIONS":
        return json_resp({})
    try:
        top = get_top_scores(20)
        return json_resp({"leaderboard": top})
    except Exception as e:
        log.error(f"获取排行榜失败: {e}")
        return json_resp({"error": str(e)}, 500)


# ── 每日挑战 API ────────────────────────────────

@app.route("/api/daily-challenge", methods=["GET", "OPTIONS"])
def daily_challenge():
    """获取每日挑战种子（基于日期哈希，同一天所有玩家题目相同）"""
    if request.method == "OPTIONS":
        return json_resp({})
    date_str = datetime.now().strftime("%Y-%m-%d")
    seed = int(hashlib.md5(date_str.encode()).hexdigest()[:8], 16)
    tomorrow = (datetime.now() + timedelta(days=1)).replace(hour=0, minute=0, second=0)
    seconds_remaining = int((tomorrow - datetime.now()).total_seconds())
    return json_resp({
        "seed": seed,
        "date": date_str,
        "seconds_remaining": seconds_remaining,
        "label": f"{date_str} 每日挑战"
    })


# ── AI 画像分析 API（增强版）────────────────────

@app.route("/api/ai-profile", methods=["POST", "OPTIONS"])
def ai_profile():
    """
    AI 画像分析：调用通义千问生成个性化评语。
    已有本地计算结果，但加上 AI 文案会更生动。
    超时 5 秒自动降级。
    """
    if request.method == "OPTIONS":
        return json_resp({})
    try:
        body = request.get_json(silent=True) or {}
        score = int(body.get("score", 0))
        max_combo = int(body.get("max_combo", 0))
        fastest_ms = int(body.get("fastest_reaction_ms", 999999))
        total_questions = int(body.get("total_questions", 20))
        weakness = body.get("weakness", "无")
        answers = body.get("answers", [])

        # 构建类型正确率统计
        type_stats = {}
        for a in answers:
            t = a.get("question_type", "unknown")
            type_stats.setdefault(t, {"correct": 0, "total": 0})
            type_stats[t]["total"] += 1
            if a.get("correct"):
                type_stats[t]["correct"] += 1
        stats_text = "；".join(
            f"{t}: {s['correct']}/{s['total']}"
            for t, s in type_stats.items()
        )

        prompt = f"""你叫「反骨AI」，是《反着来》游戏的角色分析师。请分析以下玩家数据，用风趣有梗的语调给一段评价：

得分：{score}/{total_questions}
最长连击：{max_combo}
最快反应：{fastest_ms}ms
弱点题型：{weakness}
各题型：{stats_text}

请严格按 JSON 返回（不要加任何其他文字）：
{{
  "title": "给玩家的称号（4-8字，有创意）",
  "comment": "一段风趣评语（50字以内，像吐槽又像鼓励）",
  "tip": "一条针对弱点的改进建议（20字以内）",
  "tags": ["标签1", "标签2", "标签3"]
}}"""

        # 先试通义千问
        raw = call_tongyi(prompt)

        # 降级 DeepSeek
        if raw is None:
            raw = call_deepseek(prompt)

        # 解析 AI 返回
        if raw:
            try:
                obj = json.loads(raw)
                if all(k in obj for k in ("title", "comment", "tip", "tags")):
                    return json_resp(dict(obj, source="ai"))
            except json.JSONDecodeError:
                import re
                m = re.search(r"```json\s*([\s\S]*?)\s*```", raw)
                if m:
                    try:
                        obj = json.loads(m.group(1))
                        if all(k in obj for k in ("title", "comment", "tip", "tags")):
                            return json_resp(dict(obj, source="ai"))
                    except Exception:
                        pass

        # AI 不可用，用本地算法兜底
        log.info("AI 画像不可用，使用本地兜底")
        rate = score / max(total_questions, 1)
        if rate >= 0.9:
            title, comment, tip = "反骨战神", "天生反骨，大脑和手从来没达成过一致，完美！", f"多练练{weakness}题型保持手感"
        elif rate >= 0.7:
            title, comment, tip = "反向达人", "手偶尔背叛大脑，但大部分时候站对了边。", f"重点攻克{weakness}，你能更稳"
        elif rate >= 0.5:
            title, comment, tip = "渐入佳境", "一半时间在反骨，一半时间被本能支配。", f"做{weakness}题时多停顿0.5秒"
        elif rate >= 0.3:
            title, comment, tip = "方向感缺失", "你的手和大脑达成了危险的默契——都做错了。", f"先从简单{weakness}开始练"
        else:
            title, comment, tip = "反向小白", "彻底被本能统治，但每个高手都从这里开始。", "别急，反骨是练出来的"
        return json_resp({
            "title": title, "comment": comment, "tip": tip,
            "tags": ["反着来", weakness, "继续加油"],
            "source": "local"
        })

    except Exception as e:
        log.error(f"AI 画像分析异常: {e}")
        return json_resp({"error": str(e)}, 500)


# ── 验证页托管 ──────────────────────────────────

@app.route("/test")
def serve_test():
    """托管 test.html，避免 file:// 跨域问题"""
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return send_from_directory(parent_dir, "test.html")


# ── 启动 ────────────────────────────────────────


# ── 前端托管（SPA 模式）──────────────────────

@app.route("/", defaults={"path": ""}, methods=["GET"])
@app.route("/<path:path>", methods=["GET"])
def serve_frontend(path):
    """托管前端静态文件，SPA 回退到 index.html"""
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    full_path = os.path.join(static_dir, path) if path else ""

    # 空路径 → index.html
    if not path:
        return send_from_directory(static_dir, "index.html")

    # 防止目录遍历攻击
    abs_path = os.path.abspath(full_path)
    abs_dir = os.path.abspath(static_dir)
    if not abs_path.startswith(abs_dir):
        return json_resp({"error": "Forbidden"}, 403)

    # 文件存在 → 直接返回
    if os.path.exists(abs_path) and os.path.isfile(abs_path):
        return send_from_directory(static_dir, path)

    # SPA 回退：前端路由交给 index.html
    return send_from_directory(static_dir, "index.html")


if __name__ == "__main__":
    log.info("《反着来》后端启动，端口 5000")
    log.info(f"通义千问 API Key: {'已配置' if TONGYI_API_KEY else '未配置（将使用本地降级）'}")
    log.info(f"DeepSeek API Key: {'已配置' if DEEPSEEK_API_KEY else '未配置（将使用本地降级）'}")
    app.run(host="0.0.0.0", port=5000, debug=True)
