# Nuxt 导航站与运营管理台架构设计

## 1. 目标与范围

以 NavHub 的导航站业务形态为参考，使用 Nuxt 独立实现前台导航站和运营管理台。借鉴内容类型、页面流程和运营能力，不依赖 WordPress，不复制受版权保护的源码、图片或主题资源。

### 首期必须满足

- 公开前台无需注册、登录或建立用户账户。
- 游客可以发表评论；评论经过反垃圾校验，并默认进入审核队列。
- 游客可以提交网址/资源收录申请；申请默认待审核，审核通过后才进入公开内容。
- 后台只有系统管理员角色。所有管理操作必须经过服务端鉴权。
- 管理员维护网站、APP/资源、书籍/影视、文章、公告、分类、标签和首页模块。
- 支持搜索、详情页、分类页、SEO、基础访问统计和内容审核。
- 移动端和桌面端均可使用。

### 首期明确不做

- 前台账户、用户中心、用户收藏同步、用户等级/VIP、积分和提现。
- 第三方登录、短信登录。
- 付费内容、支付、卡密和自动广告售卖。
- AI 内容生成。

这些功能不是实现核心导航站所必需的，未来若有明确运营需求，再作为独立模块评估。

## 2. OneNav 能力映射

| OneNav 现有概念 | Nuxt 版本设计 |
|---|---|
| `sites` 网址、分类和标签 | `sites` 内容实体、`categories`、`tags` |
| `app` 应用/资源 | `resources`，通过类型字段区分 APP、软件、资源 |
| `book` 书籍/影视 | `media_items`，类型区分书籍、影视等 |
| `post` 普通文章 | `articles` |
| `bulletin` 公告 | `announcements` |
| 首页模块和小工具 | 管理员可排序、启停的首页模块配置 |
| 搜索模板、Meilisearch 客户端 | 统一搜索 API；首期数据库搜索，数据量增长后接 Meilisearch |
| 评论 | 游客评论、限流、验证码/反垃圾、人工审核 |
| 用户投稿 | 游客提交收录申请、限流/反垃圾、管理员审核后发布 |
| WordPress 后台配置 | 独立 Nuxt 管理台和管理员配置 |
| 用户中心、支付、积分、VIP | 首期不实现 |

OneNav 当前是 WordPress 主题而非独立后端。新系统不迁移 WordPress 的 Hook、模板机制或用户体系，改由明确的 API、数据模型和管理端承接业务。

## 3. 技术架构

首期采用**模块化单体**：Nuxt 4/Nitro 提供 SSR 页面和服务端 API，便于快速交付与统一鉴权；数据层和业务模块保持边界，避免一开始拆成微服务。公开站和管理台在同一个 Nuxt 应用中分区开发、同源部署；界面分离不意味着必须拆成两个项目。

```text
浏览器
  ├── 公开站：Nuxt SSR 页面（无账户）
  └── 管理台：/admin 页面（独立布局，仅管理员）
          │
          ▼
Nuxt Nitro Server API
  ├── Public：内容读取、搜索、游客评论、游客投稿
  ├── Admin：内容、投稿/评论审核、分类、首页、设置、统计
  ├── Services：业务规则、审核、SEO、统计
  └── Repositories：数据访问
          │
          ├── PostgreSQL
          ├── Redis（可选：缓存、限流、队列）
          ├── Meilisearch（可选：全文检索）
          └── S3 兼容对象存储（可选：图片和附件）
```

### 建议选型

- Nuxt 4、Vue 3、TypeScript。
- Nuxt UI 或 Tailwind CSS：前台与管理台共享基础设计令牌，但使用独立布局和组件。
- PostgreSQL：主数据库；Drizzle ORM（或团队熟悉的 Prisma）。
- Zod：请求参数、表单及配置校验。
- Redis：达到实际缓存、限流或异步任务需求时再接入。
- Meilisearch：首期预留适配层，不把核心功能绑定到搜索服务。
- S3 兼容对象存储：生产环境存放图片；本地开发可使用本地存储或 MinIO。
- ECharts：管理台统计图表，首期只显示可验证的基础指标。

## 4. 应用目录建议

默认建议是**一个 Nuxt 4 应用、界面分区、服务端分层**，而不是把 `app/` 再拆成“前端”和“后端”两个目录：

- `app/` 是 Nuxt 的 Vue 应用层，放页面、布局、组件、middleware 和 composables。
- 根目录 `server/` 是 Nitro 服务端，放 API 路由、中间件和服务端业务代码。
- `shared/` 放可安全供前后端共同使用的类型、校验 schema 和常量；不得在其中放密钥或仅服务端可用逻辑。
- 管理台页面和公开页面在 `app/pages/` 下清晰分组，并使用不同布局、组件和路由中间件。
- 管理 API 与公开 API 使用不同路由前缀；服务端对每个管理 API 独立检查管理员会话。页面隐藏/路由中间件不能代替 API 鉴权。

```text
app/
  app.vue
  pages/
    index.vue
    search.vue
    sites/[slug].vue
    categories/[slug].vue
    resources/[slug].vue
    media/[slug].vue
    articles/[slug].vue
    announcements/index.vue
    admin/
      login.vue
      index.vue
      sites/
      resources/
      media/
      articles/
      announcements/
      categories/
      tags/
      submissions/
      comments/
      homepage/
      settings/
      audit-logs/
  layouts/
    default.vue
    admin.vue
  middleware/
    admin.ts
  components/
    public/
    admin/
    shared/
  features/
    public/
    admin/
  composables/
  utils/
server/
  api/
    public/
      home.get.ts
      search.get.ts
      submissions.post.ts
      comments.post.ts
    admin/
      auth/
      sites/
      submissions/
      comments/
      settings/
  middleware/
  services/
    content/
    submissions/
    comments/
    search/
  repositories/
  validators/
  utils/
  tasks/
shared/
  schemas/
  types/
  constants/
  utils/
db/
  schema/
  migrations/
```

公开站使用 `default` 布局，`/admin/**` 使用独立管理台布局。`app/middleware/admin.ts` 可负责进入管理页面前的体验性跳转，并明确排除 `/admin/login`；Nitro 的 `/api/admin/**` 必须再次进行服务端鉴权。路由和文件命名可按项目实际习惯调整；公开内容 URL 应保持稳定，避免后台改标题时意外改变链接。

如果将来要求管理台独立域名、独立发布或单独扩容，再升级为 pnpm workspace 等 monorepo：`apps/site` 与 `apps/admin` 各自是 Nuxt 4 应用，共用独立 API 服务及 `packages/shared`。首期不建议这样拆，因其会增加构建、部署、跨域、会话 Cookie 和版本协调成本。

## 5. 功能模块

### 5.1 公开前台

- 首页：搜索框、分类导航、精选/最新/热门内容、公告和可配置模块。
- 网址分类页：分类树、标签、排序、分页。
- 网址详情：名称、简介、图标、目标地址、分类、标签、相关内容、评论。
- 资源页：软件/APP/下载资源的详情字段和外链。
- 书籍/影视页：封面、类型、简介、评分等可配置元信息。
- 文章与公告：列表、详情、相关推荐。
- 搜索页：按内容类型筛选，支持标题、简介和标签检索。
- 跳转统计：外链点击通过受控的跳转路由记录事件，再跳转至目标地址。
- 响应式布局、主题色/深色模式可作为 UI 层能力。

### 5.2 游客评论

- 提交字段：评论内容、显示名称；邮箱可选且不公开展示。
- 新评论默认 `pending`，管理员审核后才公开。
- 支持管理员批准、拒绝、标记垃圾和删除。
- 使用速率限制、内容长度限制、输入清理及人机验证；不要仅依赖前端校验。
- 采用软删除或状态变更，保留必要的审核记录。
- 反滥用数据遵循最少收集原则；IP 不作为公开信息，按隐私政策限定用途和保留期限。
- 评论 API 不创建用户账户、不签发长期登录凭证，也不提供游客修改他人评论的能力。

### 5.3 游客投稿与审核

- 游客无需注册即可提交收录申请；首期由管理员配置开放类型，建议覆盖网址、APP/资源、书籍/影视和文章，对应类型使用各自字段 schema；公告仍由管理员维护。不开放任意 HTML。
- 提交表单包含内容字段、可选提交者称呼和可选联系邮箱；联系方式只用于审核沟通，不在前台展示。
- 新申请写入独立的 `guest_submissions` 队列，状态为 `pending`；不能直接创建已发布内容。
- 管理员可以查看、编辑、批准、拒绝或标记垃圾；批准时在事务中创建/更新正式内容并记录来源申请，避免重复审核或重复发布。
- 对重复 URL、短时间批量提交和异常请求进行服务端限流及反垃圾处理；所有字段服务端校验、URL 规范化并限制协议。
- 拒绝/垃圾申请按保留策略处理；审核备注仅后台可见，审计日志不包含不必要的个人信息。

### 5.4 管理台

- 管理员登录、退出、会话失效和密码重置。
- 仪表盘：内容数量、待审核投稿/评论、近期访问/外链点击等基础指标。
- 内容管理：搜索、筛选、草稿、发布、下线、批量操作。
- 分类与标签：层级、排序、关联内容。
- 投稿审核：队列筛选、申请详情、编辑、批准、拒绝和垃圾标记。
- 评论审核：队列、详情、状态筛选和审核记录。
- 首页编排：模块启停、排序、关联分类/内容、模块标题与展示数量。
- 外观与站点配置：站点名称、Logo、基础色彩、页脚、SEO 默认项。
- 媒体管理：上传、替换、删除；限制文件类型和大小。
- 失效链接检查：手动或定时检查，支持忽略/重试；外部 URL 检查需防止访问内网和本机地址。
- 操作审计：记录管理员、操作对象、动作和时间，不记录密码、密钥等敏感值。

后台不设置普通编辑员、作者或会员角色。若未来确实需要多人协作，再增加细粒度 RBAC，而不是提前引入复杂权限。

## 6. 数据模型草案

所有主表使用 UUID 或自增主键，统一记录 `created_at`、`updated_at`；时间按 UTC 存储，页面按站点时区显示。

| 表 | 核心字段/用途 |
|---|---|
| `admins` | 登录名、密码哈希、状态、最近登录时间；仅系统管理员 |
| `admin_sessions` | 管理员会话哈希、过期时间、撤销时间 |
| `sites` | 标题、slug、简介、目标 URL、图标、状态、排序、SEO 字段 |
| `resources` | 标题、slug、资源类型、简介、封面、平台/下载链接等 JSON 元信息 |
| `media_items` | 书籍/影视类型、标题、slug、封面、简介、评分和类型化元信息 |
| `articles` | 标题、slug、正文、摘要、封面、状态、发布时间、SEO 字段 |
| `announcements` | 标题、正文、状态、有效期、可选外链 |
| `categories` | 内容类型、名称、slug、父级、排序、描述 |
| `tags` | 名称、slug、描述 |
| `content_categories` | 内容与分类多对多关系 |
| `content_tags` | 内容与标签多对多关系 |
| `comments` | 内容引用、游客显示名、可选邮箱、正文、审核状态、反滥用元数据 |
| `guest_submissions` | 游客提交的类型、字段 payload、可选联系方式、审核状态、审核备注、发布内容引用和反滥用元数据 |
| `media_assets` | 存储键、MIME、大小、尺寸、替代文本 |
| `homepage_modules` | 模块类型、配置、排序、启用状态 |
| `site_settings` | 站点级配置，按键分组；敏感配置不通过公开 API 返回 |
| `content_events` | 页面访问、搜索、外链点击等聚合/分析事件 |
| `link_check_results` | 目标 URL 检查时间、状态、错误摘要 |
| `admin_audit_logs` | 管理员、动作、资源、资源 ID、时间和脱敏变更摘要 |

内容实体可以分别建表，或在明确需要统一编辑/搜索后抽象统一内容表。首期优先使用类型安全、易理解的实体，避免过度通用化。评论通过 `content_type + content_id` 关联内容时，服务层必须验证目标内容存在且允许评论。投稿原始 payload 与正式内容分开保存；审核通过时记录正式内容类型和 ID，便于去重和追溯。

## 7. API 设计

公共 API 只提供必要的公开数据；管理 API 按资源拆分，并在服务端统一校验管理员会话。

### 公共端点示例

```text
GET  /api/public/home
GET  /api/public/categories
GET  /api/public/sites
GET  /api/public/sites/:slug
GET  /api/public/resources
GET  /api/public/media
GET  /api/public/articles
GET  /api/public/announcements
GET  /api/public/search?q=...&type=...
GET  /api/public/content/:type/:id/comments
POST /api/public/content/:type/:id/comments
POST /api/public/submissions
POST /api/public/out/:id
```

### 管理端点示例

```text
POST   /api/admin/auth/login
POST   /api/admin/auth/logout
GET    /api/admin/dashboard
GET    /api/admin/:resource
POST   /api/admin/:resource
GET    /api/admin/:resource/:id
PATCH  /api/admin/:resource/:id
DELETE /api/admin/:resource/:id
PATCH  /api/admin/comments/:id/status
GET    /api/admin/submissions
GET    /api/admin/submissions/:id
PATCH  /api/admin/submissions/:id
POST   /api/admin/submissions/:id/approve
POST   /api/admin/submissions/:id/reject
PUT    /api/admin/homepage/modules
GET    /api/admin/audit-logs
```

列表接口统一支持白名单筛选项、排序、分页和总数；分页默认有上限。错误返回统一包含机器可读错误码和用户可理解消息，不返回堆栈、SQL 或敏感配置。

## 8. 身份验证与安全边界

- 公开站无用户认证；评论和投稿提交仅获得一次性的人机验证/CSRF 等必要状态，不等于登录。
- 管理员使用服务端 Session，浏览器通过 `HttpOnly`、`Secure`（HTTPS）、`SameSite` Cookie 保存会话标识。
- 密码使用成熟密码哈希算法，禁止明文存储；登录接口限流，并记录异常登录事件。
- 所有管理端写请求在服务端验证会话、CSRF 防护和请求体 schema；隐藏管理页面不等于权限保护。
- 公开评论和投稿进行长度、格式、URL 协议和输出编码校验；富文本采用严格白名单清理。
- 管理员密钥、邮件配置等仅保存在服务端环境变量或受控配置中，不下发到浏览器。
- 图片上传校验 MIME、扩展名、文件大小和内容；生产环境建议使用对象存储。
- 外链跳转使用内容 ID 查目标地址，禁止接受任意 `url` 参数作为开放重定向。
- 备份数据库和媒体文件，并为管理员配置变更、内容删除等操作留审计记录。

## 9. 搜索、缓存与异步任务

首期可用 PostgreSQL 的索引和全文检索，统一由 `SearchService` 封装。记录查询性能和搜索质量指标；当数据量或相关性需求达到阈值后，增加 Meilisearch 适配器及索引同步任务。

适合缓存的内容包括首页配置、分类树和公开内容列表。管理员发布/修改内容后，按标签或内容 ID 精确失效缓存。链接检测、站点地图生成和统计汇总可使用定时任务；首期无队列基础设施时可先通过受控 cron 触发。

## 10. SEO 与可访问性

- 公开详情页使用 SSR 输出标题、描述、canonical、Open Graph 和结构化数据。
- 为分类、文章、资源和网站详情生成稳定 canonical URL。
- 生成 sitemap、robots.txt 和自定义 404 页面。
- 草稿、待审核内容及管理台禁止被搜索引擎索引。
- 图片提供替代文本；键盘可操作交互、语义化标题和足够对比度。
- 对分页、筛选 URL 和重复内容制定 canonical/noindex 规则。

## 11. 部署与环境

本地开发建议使用 Docker Compose 启动 PostgreSQL；Redis、Meilisearch 和 MinIO 按需启用。生产部署建议 Nuxt Node Server + PostgreSQL，前置 Nginx/Caddy 或云负载均衡，并启用 HTTPS。

```text
DATABASE_URL=
SESSION_SECRET=           # 仅使用签名/加密会话方案时需要；当前随机令牌哈希存库方案不使用
SITE_URL=
STORAGE_DRIVER=local|s3
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
REDIS_URL=                 # 可选
MEILISEARCH_URL=           # 可选
MEILISEARCH_API_KEY=       # 可选，仅服务端
```

配置通过环境变量或部署平台密钥管理注入，不提交真实密钥。首次部署通过一次性受控命令创建管理员，不开放公开管理员注册页面。

## 12. 实施阶段与验收标准

### 阶段一：基础骨架

- Nuxt SSR、数据库迁移、管理员初始化和登录会话。
- 管理台主布局、错误处理、日志和基础设计系统。
- 验收：未登录无法读取或调用任何管理 API；会话可退出和撤销。

### 阶段二：内容管理

- 网站、分类、标签、资源、书籍/影视、文章和公告 CRUD。
- 图片管理、草稿/发布/下线状态。
- 验收：管理员在后台创建/编辑/发布后，公开页面正确展示；草稿不会公开。

### 阶段三：前台导航和搜索

- 首页、分类、详情、文章、公告、搜索、响应式布局、SEO。
- 验收：关键页面 SSR 正常，移动端可操作，分页/筛选结果正确，核心 URL 可被索引。

### 阶段四：游客投稿、评论与运营能力

- 游客投稿和评论、审核队列、反垃圾限制、仪表盘、首页模块、审计日志、基础链接检测。
- 验收：游客无需账户即可提交投稿和评论；待审核内容不可公开；管理员批准投稿后才生成公开内容、审核评论后才可见；重复或频繁提交受到限制。

### 阶段五：生产化

- 缓存、对象存储、备份、监控、错误告警、Sitemap 和部署流水线。
- 按实际需求接入 Meilisearch、邮件通知或定时任务。

## 13. 数据迁移策略

若后续从 OneNav/WordPress 迁移，单独编写一次性导入工具，不让 Nuxt 运行时直接依赖 WordPress。迁移前映射文章类型、分类、标签、元字段、媒体 URL 和固定链接；导入使用可重复执行的外部 ID 映射，并生成失败报告。先迁移内容和媒体，再验证 URL、数量、链接和图片，最后切换 DNS。旧站保留只读备份以便回滚。

## 14. 首期交付定义

首期完成后，系统应当是一个可独立部署的导航站：游客能浏览、搜索、评论和提交收录申请；系统管理员能管理所有公开内容并审核投稿/评论；没有前台注册/登录入口，也没有支付、积分、VIP或用户中心。后续商业化模块作为独立需求讨论，不影响首期核心数据和权限边界。
