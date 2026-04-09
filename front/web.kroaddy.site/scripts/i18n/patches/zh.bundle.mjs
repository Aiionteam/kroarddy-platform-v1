/** Simplified Chinese */
export const bundle = {
  sidebar: { friends: "好友列表" },
  settings: {
    title: "设置",
    saved: "已保存。",
    error: {
      load_user: "无法加载用户信息。",
      save: "保存失败。",
      save_during: "保存时发生错误。",
    },
    account: {
      title: "账户信息",
      email: "邮箱",
      nickname: "昵称",
      default: "（默认）",
      nickname_placeholder: "不填则显示姓名",
      nickname_hint: "不填时将显示您的姓名。",
      honor: "荣誉值",
      point: "分",
      provider: "绑定",
    },
    withdraw: {
      title: "注销账户",
      desc: "注销后账户与数据将被删除，无法恢复。",
      button: "注销账户",
      confirm_desc: "确定要注销吗？在下方输入 Delete account 以继续。",
      placeholder: "Delete account",
      submit: "注销",
      error: "注销失败。",
      error_during: "注销过程中发生错误。",
    },
    profile: {
      title: "旅行档案",
      subtitle: "用于 AI 个性化推荐",
      save: "保存旅行档案",
      saved: "旅行档案已保存。",
    },
  },
  chat: {
    friends: {
      title: "好友列表",
      whisper_box: "私信箱",
      error_list: "无法加载列表。",
      list_title: "好友（{{count}}）",
      empty: "暂无好友。在群聊中点击消息可发送好友请求。",
      pending_title: "收到的好友请求（{{count}}）",
      pending_empty: "没有待处理的请求。",
      whisper: "私信",
      remove_title: "删除好友",
      block_title: "屏蔽用户",
      whisper_to_suffix: "的私信",
      whisper_placeholder: "输入私信内容…",
      counter_send_hint: "{{len}} / 500 · Ctrl+Enter 发送",
      sending: "发送中…",
      send: "发送",
      honor: "荣誉 {{value}}",
      user_fallback: "用户{{id}}",
      accept_ok: "已接受好友请求。",
      accept_fail: "接受失败。",
      accept_err: "处理接受时失败。",
      remove_confirm: "要将 {{name}} 从好友列表中删除吗？",
      remove_ok: "已将 {{name}} 从好友列表中删除。",
      remove_fail: "删除好友失败。",
      remove_err: "删除好友失败。",
      block_confirm:
        "要屏蔽 {{name}} 吗？\n屏蔽后将从好友列表移除且无法收到私信。",
      block_ok: "已屏蔽 {{name}}。",
      block_fail: "屏蔽失败。",
      block_err: "屏蔽失败。",
      whisper_ok: "已向 {{name}} 发送私信。",
      whisper_fail: "发送私信失败。",
      whisper_err: "发送私信失败。",
    },
    whisper: {
      user_fallback: "用户{{id}}",
      title: "私信",
      new_chat: "新对话",
      no_conversations: "暂无对话",
      start: "发送私信",
      blocked_user: "已屏蔽用户",
      delete_conv: "删除对话",
      unblock: "解除屏蔽",
      block: "屏蔽用户",
      empty_thread: "开始与 {{name}} 的对话",
      view_tourstar: "查看 Tourstar 帖子",
      read: "已读",
      cannot_send_blocked: "无法向已屏蔽用户发送消息。",
      input_placeholder: "输入消息…（Enter 发送，Shift+Enter 换行）",
      pick_or_start: "选择对话或发送新私信",
      new_whisper: "+ 新私信",
      new_whisper_title: "新私信",
      no_friends: "暂无好友。",
      add_friend: "添加好友",
      delete_confirm:
        "要删除与 {{name}} 的全部对话吗？\n此操作无法撤销。",
    },
  },
  customer: {
    inquiry: {
      title: "联系我们",
      tabs: { write: "1:1 咨询", list: "我的咨询" },
      form: {
        subject: "主题",
        subject_placeholder: "请输入主题",
        content: "内容",
        content_placeholder: "请填写详情",
        attachments: "附件",
        attachment_help: "图片（GIF、PNG、JPG）每个最大 10MB，最多 3 个",
        privacy_agree: "同意收集和使用个人信息",
        sending: "发送中…",
        submit: "提交",
      },
      list: {
        search_label: "搜索",
        search_placeholder: "按标题/内容/状态搜索",
        no_results: "没有结果。",
      },
      status: { answered: "已回复", pending: "处理中" },
      submit_done: "您的咨询已提交。",
      seed: {
        10001: {
          title: "无法上传头像",
          content: "选择图片后多次尝试仍上传失败。",
        },
        10002: {
          title: "如何修改行程？",
          content: "想只更改已保存行程中的某一天。",
          answer: "打开日程管理，选择日期，使用重抽或 AI 修改调整具体项目。",
        },
      },
    },
    inquiries: {
      title: "我的咨询",
      mobile_title: "咨询记录",
      subtitle: "查看已提交的咨询与回复。",
      my_list: "咨询列表",
      write: "写咨询",
      search_placeholder: "按标题/内容/状态搜索",
      no_results: "没有结果。",
      status: { answered: "已回复", pending: "处理中" },
      seed: {
        10001: {
          title: "无法上传头像",
          content: "选择图片后多次尝试仍上传失败。",
        },
        10002: {
          title: "如何修改行程？",
          content: "想只更改已保存行程中的某一天。",
          answer: "打开日程管理，选择日期，使用重抽或 AI 修改调整具体项目。",
        },
      },
      detail: {
        title: "咨询详情",
        mobile_title: "咨询详情",
        back_to_list: "返回列表",
        received_at: "受理日期：{{date}}",
        content: "咨询内容",
        attachments: "附件",
        no_attachments: "无附件。",
        answer: "回复",
        answer_pending: "正在准备回复，请稍候。",
        not_found: "未找到该咨询。",
      },
    },
    faq: {
      count: "{{count}} 条",
      title: "常见问题",
      no_results: "没有搜索结果。",
      items: {
        login_help: {
          category: "咨询",
          question: "无法登录怎么办？",
          answer: "请刷新应用后重试。若仍失败请联系客服。",
        },
        first_steps: {
          category: "指南",
          question: "我是新用户，应先使用哪些功能？",
          answer: "从首页进入旅行规划与发现地点，再使用日程管理。",
        },
        update_notes: {
          category: "公告",
          question: "在哪里查看更新说明？",
          answer: "可在客户中心的「公告」分类查看最新变更。",
        },
        refund_flow: {
          category: "支付与服务",
          question: "取消付款（退款）如何办理？",
          answer: "请提交咨询并附上支付信息与订单号，我们将依次协助。",
        },
        emergency_help: {
          category: "紧急与旅行提示",
          question: "旅行中遇到紧急情况可获得哪些帮助？",
          answer: "请先查看紧急联系方式与基本应对指南，必要时立即联系客服。",
        },
      },
    },
    center: {
      title: "客户中心",
      subtitle: "快速找到您需要的帮助。",
    },
    search: {
      label: "需要什么帮助？",
      placeholder: "输入搜索关键词",
    },
    categories: {
      title: "分类",
      items: {
        inquiry: {
          title: "咨询",
          desc: "账户、功能、错误等一般问题",
        },
        guide: { title: "使用指南", desc: "服务使用方法与入门" },
        notices: { title: "公告", desc: "维护、发布与变更通知" },
        payment: {
          title: "支付与服务使用",
          desc: "付款、退款与订阅说明",
        },
        emergency: {
          title: "紧急帮助与旅行提示",
          desc: "紧急情况应对与安全提示",
        },
      },
    },
    guide: {
      title: "使用指南",
      subtitle: "一览从首页即可开始的五项核心功能。",
      hero: {
        kicker: "第一次旅行可以这样做",
        title: "创建路线 → 整理日程 → 需要时分享与聊天",
        steps: {
          planner: "旅行规划",
          schedule: "日程管理",
          guide: "地点推荐",
          social: "Tourstar / 群聊",
        },
        cta_planner: "开始旅行规划",
        cta_groupchat: "浏览群聊",
      },
      cards: {
        tourstar: {
          title: "Tourstar",
          subtitle: "在一处创建旅行记录、点评与分享。",
          cta: "前往 Tourstar",
          items: {
            1: {
              title: "1) 准备照片/游记",
              body: "上传照片后 AI 可协助标题与摘要，加快写作。",
            },
            2: {
              title: "2) 选择可见范围",
              body: "可按需选择公开或仅自己可见。",
            },
            3: {
              title: "3) 获得互动",
              body: "通过点赞与评论交流贴士，也可连接好友。",
            },
          },
          tip: {
            title: "提示",
            body: "标题宜短，正文按「何时/何地/喜欢什么」顺序写更易读。",
          },
        },
        planner: {
          title: "旅行规划",
          subtitle: "AI 按您的风格推荐路线与日程。",
          cta: "前往旅行规划",
          items: {
            1: {
              label: "标准 / K 内容 / 用户内容",
              body: "任选其一开始。",
            },
            2: {
              label: "选择目的地（或主题）",
              body: "明确路线背景后推荐更准确。",
            },
            3: {
              body: "推荐日程会自动保存，可在日程管理中继续调整。",
            },
          },
        },
        schedule: {
          title: "日程管理",
          subtitle: "在日历查看已保存计划，并用 AI 重抽或修改。",
          cta: "打开日程管理",
          items: {
            1: {
              title: "1) 在日历选日期",
              body: "点击日期即可查看当天安排。",
            },
            2: {
              title: "2) 用「重抽」生成新版本",
              body: "可只重做不满意的部分。",
            },
            3: {
              title: "3) 请求 AI 修改",
              body: "用提示语说明即可调整日程。",
            },
          },
          tip: {
            title: "地图 / 天气",
            body: "在日程卡片内可查看地图与天气摘要。",
          },
        },
        discover: {
          title: "地点推荐",
          subtitle: "在同一屏浏览餐厅、活动等本地推荐。",
          cta: "前往地点推荐",
          items: {
            1: {
              title: "1) 选择指南",
              body: "选择「餐厅推荐」或「活动推荐」标签。",
            },
            2: {
              title: "2) 浏览卡片/列表",
              body: "点击感兴趣的地点查看详情。",
            },
            3: {
              body: "若要加入行程，请在规划/日程中按当前路线调整。",
            },
          },
        },
        groupchat: {
          title: "群聊",
          subtitle: "按荣誉等级加入房间，分享旅行故事。",
          cta: "前往群聊",
          items: {
            1: {
              title: "1) 从房间列表进入",
              body: "是否可进房可能因荣誉等级而异。",
            },
            2: {
              title: "2) 发送消息",
              body: "在输入框输入并发送即可实时共享。",
            },
            3: {
              title: "3) 好友/私信/荣誉",
              body: "在消息菜单可使用私信、加好友与荣誉操作。",
            },
          },
        },
      },
    },
  },
};
