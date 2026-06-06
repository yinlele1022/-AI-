# 反着来（Opposite Game）

> 抖音 AI 创变者计划参赛作品 — 一款考验逆向思维的互动小游戏

## 🎮 玩法介绍

题目给出一个题意描述，你需要选择**与题意描述相反**的选项。

例如：题目说「向右移动」，你就要向左滑；题目说「选择红色」，你就要点蓝色。

**支持三种模式：**
- 🟢 **单人对战**：自由练习，逐层递进难度
- 🟡 **Shadow PK**：对战 AI 影子，看谁更懂「反着来」
- 🔵 **好友 PK**：生成挑战码，发给好友比拼分数

## ✨ 特性

- 📅 **每日挑战**：每天固定题目，全服玩家同台竞技
- 🏆 **排行榜**：查看每日挑战的高分选手
- 🤖 **AI 画像**：赛后 AI 生成你的思维模式画像
- 🎆 **里程碑特效**：5/10/15/20 分触发粒子炸裂特效
- 📱 **纯 Canvas 渲染**：375×812 移动端适配，无需任何框架

## 🚀 本地运行

### 后端版（完整功能：排行榜 + AI 画像 + 挑战码）

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\pip install -r requirements.txt
venv\Scripts\python server.py
# 访问 http://127.0.0.1:5000
```

> 需要配置 `.env` 文件（参见 `.env.example`）

### 离线版（双击即玩，无需后端）

直接用浏览器打开 `反着来_分享版/index.html`，核心玩法完整运行。

## 📁 项目结构

```
抖音创变者计划/
├── backend/
│   ├── static/          # 前端文件（Flask 托管）
│   │   ├── index.html
│   │   ├── game.js      # 游戏主逻辑
│   │   ├── questions.js # 90 题题库
│   │   └── api-client.js
│   ├── server.py        # Flask 后端
│   ├── data/game.db    # SQLite 排行榜数据库
│   └── .env            # API Key（勿提交）
├── 反着来_分享版/       # 离线版（可分享）
└── README.md
```

## 🤝 参与贡献

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📝 题库扩展

编辑 `backend/static/questions.js`，按以下格式添加题目：

```javascript
{
  id: 91,
  text: "题目文字",
  options: ["选项A", "选项B", "选项C", "选项D"],
  answer: 0,          // 正确答案的 index
  direction: "right",   // 题目类型标签
  difficulty: 1        // 1=易 2=中 3=难
}
```

## 📄 License

MIT License — 详见 [LICENSE](LICENSE)

## 🙏 致谢

- 题目灵感来源于生活观察与逆向思维训练
- AI 画像由通义千问 API 驱动

---

**比赛：** 抖音 AI 创变者计划  
**作者：** 殷文才
