/** Japanese — friends, whisper, settings, customer hub + inquiry + guide */
export const bundle = {
  sidebar: { friends: "友だち一覧" },
  settings: {
    title: "設定",
    saved: "保存しました。",
    error: {
      load_user: "ユーザー情報を読み込めませんでした。",
      save: "保存に失敗しました。",
      save_during: "保存中にエラーが発生しました。",
    },
    account: {
      title: "アカウント情報",
      email: "メール",
      nickname: "ニックネーム",
      default: "（初期値）",
      nickname_placeholder: "未入力の場合は名前が表示されます",
      nickname_hint: "未入力の場合は名前として表示されます。",
      honor: "名誉",
      point: "pt",
      provider: "連携",
    },
    withdraw: {
      title: "アカウント削除",
      desc: "退会するとアカウントとデータが削除され、元に戻せません。",
      button: "アカウント削除",
      confirm_desc:
        "本当に退会しますか？下の欄に Delete account と入力すると退会が進みます。",
      placeholder: "Delete account",
      submit: "退会する",
      error: "アカウントの削除に失敗しました。",
      error_during: "アカウント削除中にエラーが発生しました。",
    },
    profile: {
      title: "旅行プロフィール",
      subtitle: "AIによるおすすめ旅行の参考になります",
      save: "旅行プロフィールを保存",
      saved: "旅行プロフィールを保存しました。",
    },
  },
  chat: {
    friends: {
      title: "友だち一覧",
      whisper_box: "ささやき受信箱",
      error_list: "一覧を読み込めませんでした。",
      list_title: "友だち（{{count}}）",
      empty:
        "まだ友だちがいません。グループチャットでメッセージをタップして友だちリクエストを送ってみましょう。",
      pending_title: "届いた友だちリクエスト（{{count}}）",
      pending_empty: "承認待ちのリクエストはありません。",
      whisper: "ささやき",
      remove_title: "友だちを削除",
      block_title: "ユーザーをブロック",
      whisper_to_suffix: "さんにささやき",
      whisper_placeholder: "ささやきの内容を入力…",
      counter_send_hint: "{{len}} / 500 · Ctrl+Enterで送信",
      sending: "送信中…",
      send: "送信",
      honor: "名誉 {{value}}",
      user_fallback: "ユーザー{{id}}",
      accept_ok: "友だちリクエストを承認しました。",
      accept_fail: "承認に失敗しました。",
      accept_err: "承認処理に失敗しました。",
      remove_confirm: "{{name}}さんを友だち一覧から削除しますか？",
      remove_ok: "{{name}}さんを友だち一覧から削除しました。",
      remove_fail: "友だちの削除に失敗しました。",
      remove_err: "友だちの削除に失敗しました。",
      block_confirm:
        "{{name}}さんをブロックしますか？\nブロックすると友だち一覧からも外れ、ささやきも受け取れません。",
      block_ok: "{{name}}さんをブロックしました。",
      block_fail: "ブロックに失敗しました。",
      block_err: "ブロックに失敗しました。",
      whisper_ok: "{{name}}さんにささやきを送りました。",
      whisper_fail: "ささやきの送信に失敗しました。",
      whisper_err: "ささやきの送信に失敗しました。",
    },
    whisper: {
      user_fallback: "ユーザー{{id}}",
      title: "ささやき",
      new_chat: "新しい会話",
      no_conversations: "会話がありません",
      start: "ささやきを送る",
      blocked_user: "ブロック中のユーザー",
      delete_conv: "会話を削除",
      unblock: "ブロック解除",
      block: "ユーザーをブロック",
      empty_thread: "{{name}}さんとの会話を始めましょう",
      view_tourstar: "Tourstarの投稿を見る",
      read: "既読",
      cannot_send_blocked: "ブロック中のユーザーにはメッセージを送れません。",
      input_placeholder:
        "メッセージを入力…（Enterで送信、Shift+Enterで改行）",
      pick_or_start: "会話を選ぶか、新しいささやきを送ってください",
      new_whisper: "＋ 新しいささやき",
      new_whisper_title: "新しいささやき",
      no_friends: "友だちがいません。",
      add_friend: "友だちを追加",
      delete_confirm:
        "{{name}}さんとの会話をすべて削除しますか？\nこの操作は取り消せません。",
    },
  },
  customer: {
    inquiry: {
      title: "お問い合わせ",
      tabs: { write: "1:1 お問い合わせ", list: "自分のお問い合わせ" },
      form: {
        subject: "件名",
        subject_placeholder: "件名を入力",
        content: "内容",
        content_placeholder: "詳細をご記入ください",
        attachments: "添付ファイル",
        attachment_help: "画像（GIF, PNG, JPG）各10MBまで、最大3件",
        privacy_agree: "個人情報の収集・利用に同意します",
        sending: "送信中…",
        submit: "送信",
      },
      list: {
        search_label: "検索",
        search_placeholder: "件名・内容・ステータスで検索",
        no_results: "該当するお問い合わせがありません。",
      },
      status: { answered: "回答済み", pending: "対応中" },
      submit_done: "お問い合わせを送信しました。",
      seed: {
        10001: {
          title: "プロフィール画像がアップロードできない",
          content:
            "何度試しても画像を選んだあとアップロードに失敗します。",
        },
        10002: {
          title: "スケジュールの変更方法は？",
          content: "保存した行程のうち、1日分だけ変えたいです。",
          answer:
            "スケジュールで日付を選び、リロールやAI修正で該当項目を調整できます。",
        },
      },
    },
    inquiries: {
      title: "自分のお問い合わせ",
      mobile_title: "お問い合わせ履歴",
      subtitle: "送信したお問い合わせと回答を確認できます。",
      my_list: "お問い合わせ一覧",
      write: "お問い合わせを書く",
      search_placeholder: "件名・内容・ステータスで検索",
      no_results: "該当するお問い合わせがありません。",
      status: { answered: "回答済み", pending: "対応中" },
      seed: {
        10001: {
          title: "プロフィール画像がアップロードできない",
          content:
            "何度試しても画像を選んだあとアップロードに失敗します。",
        },
        10002: {
          title: "スケジュールの変更方法は？",
          content: "保存した行程のうち、1日分だけ変えたいです。",
          answer:
            "スケジュールで日付を選び、リロールやAI修正で該当項目を調整できます。",
        },
      },
      detail: {
        title: "お問い合わせ詳細",
        mobile_title: "お問い合わせ詳細",
        back_to_list: "一覧へ",
        received_at: "受付日: {{date}}",
        content: "お問い合わせ内容",
        attachments: "添付ファイル",
        no_attachments: "添付ファイルはありません。",
        answer: "回答",
        answer_pending: "現在回答を準備中です。しばらくお待ちください。",
        not_found: "お問い合わせが見つかりません。",
      },
    },
    faq: {
      count: "{{count}}件",
      title: "よくある質問",
      no_results: "検索結果がありません。",
      items: {
        login_help: {
          category: "お問い合わせ",
          question: "ログインできないときは？",
          answer:
            "アプリを更新して再度お試しください。解消しない場合はサポートへご連絡ください。",
        },
        first_steps: {
          category: "ガイド",
          question: "はじめてです。まず何を見ればいいですか？",
          answer:
            "ホームから旅行プランナーとスポットを試し、続けてスケジュール管理をご利用ください。",
        },
        update_notes: {
          category: "お知らせ",
          question: "アップデート内容はどこで見られますか？",
          answer:
            "カスタマーセンターの「お知らせ」から最新の変更を確認できます。",
        },
        refund_flow: {
          category: "決済・サービス",
          question: "支払いのキャンセル（返金）はどうなりますか？",
          answer:
            "決済情報と注文番号を記載のうえお問い合わせいただければ、順次ご案内します。",
        },
        emergency_help: {
          category: "緊急・旅行のヒント",
          question: "旅行中の緊急時、どんな支援がありますか？",
          answer:
            "まず緊急連絡先と基本対応ガイドを確認し、必要ならすぐサポートへご連絡ください。",
        },
      },
    },
    center: {
      title: "カスタマーセンター",
      subtitle: "必要なヘルプをすばやく見つけられます。",
    },
    search: {
      label: "何をお手伝いしましょうか？",
      placeholder: "キーワードを入力",
    },
    categories: {
      title: "カテゴリ",
      items: {
        inquiry: {
          title: "お問い合わせ",
          desc: "アカウント・機能・エラーなどの一般的なご質問",
        },
        guide: {
          title: "利用ガイド",
          desc: "サービスの使い方とはじめの一歩",
        },
        notices: {
          title: "お知らせ",
          desc: "メンテナンス・リリース・変更のお知らせ",
        },
        payment: {
          title: "決済・サービス利用",
          desc: "お支払い・返金・サブスクリプション",
        },
        emergency: {
          title: "緊急サポート・旅行のヒント",
          desc: "緊急時の対応と安全のヒント",
        },
      },
    },
    guide: {
      title: "利用ガイド",
      subtitle: "ホームからすぐ始められる5つの機能を一覧でご紹介します。",
      hero: {
        kicker: "はじめての旅はこんな流れで",
        title: "ルート作成 → 日程整理 → 必要なら共有・チャット",
        steps: {
          planner: "旅行プランナー",
          schedule: "スケジュール",
          guide: "スポット",
          social: "ツアースター / グループチャット",
        },
        cta_planner: "旅行プランナーを始める",
        cta_groupchat: "グループチャットを見る",
      },
      cards: {
        tourstar: {
          title: "ツアースター",
          subtitle: "旅の記録（投稿）やレビュー・共有をひとつで。",
          cta: "ツアースターへ",
          items: {
            1: {
              title: "1) 写真・旅行記を用意",
              body: "写真をアップするとAIがタイトルや要約を手伝い、執筆が速くなります。",
            },
            2: {
              title: "2) 公開範囲を選ぶ",
              body: "必要に応じて公開／非公開で分けて投稿できます。",
            },
            3: {
              title: "3) 反応をもらう",
              body: "いいね・コメントでヒントを交換し、友だちともつながれます。",
            },
          },
          tip: {
            title: "ヒント",
            body: "タイトルは短く、本文は「いつ・どこで・何が良かったか」の順で書くと読みやすいです。",
          },
        },
        planner: {
          title: "旅行プランナー",
          subtitle: "好みに合わせてAIがルートと日程を提案します。",
          cta: "旅行プランナーへ",
          items: {
            1: {
              label: "スタンダード / Kコンテンツ / ユーザーコンテンツ",
              body: "のいずれかを選びます。",
            },
            2: {
              label: "行き先（またはテーマ）を選択",
              body: "ルートの文脈がはっきりするとAIの提案がより正確になります。",
            },
            3: {
              body: "おすすめの日程は自動保存され、スケジュールでさらに調整できます。",
            },
          },
        },
        schedule: {
          title: "スケジュール管理",
          subtitle: "保存したプランをカレンダーで確認し、AIでリロール・修正できます。",
          cta: "スケジュールを開く",
          items: {
            1: {
              title: "1) カレンダーで日付を選ぶ",
              body: "日付をクリックするとその日の予定が表示されます。",
            },
            2: {
              title: "2) 「リロール」で別バージョンを生成",
              body: "気に入らない部分だけ作り直せます。",
            },
            3: {
              title: "3) AIに修正を依頼",
              body: "プロンプトで「変えて」などと伝えると日程が調整されます。",
            },
          },
          tip: {
            title: "地図・天気",
            body: "予定カード内で地図表示や天気の概要も確認できます。",
          },
        },
        discover: {
          title: "スポット",
          subtitle: "グルメ・イベントなど地域おすすめをひと画面で。",
          cta: "スポットへ",
          items: {
            1: {
              title: "1) ガイドを選ぶ",
              body: "「グルメ推薦」または「イベント推薦」タブを選びます。",
            },
            2: {
              title: "2) カード・リストを見る",
              body: "気になる場所をタップして詳細を確認します。",
            },
            3: {
              body: "行程に入れたい場合は、プランナー／スケジュールでルートに合わせて調整してください。",
            },
          },
        },
        groupchat: {
          title: "グループチャット",
          subtitle: "名誉レベルに応じたルームで旅の話を共有します。",
          cta: "グループチャットへ",
          items: {
            1: {
              title: "1) ルーム一覧から入室",
              body: "入室可否は名誉レベルによって異なる場合があります。",
            },
            2: {
              title: "2) メッセージを送る",
              body: "入力欄に入力して送るとリアルタイムで共有されます。",
            },
            3: {
              title: "3) 友だち・ささやき・名誉",
              body: "メッセージメニューからささやき・友だち追加・名誉の操作ができます。",
            },
          },
        },
      },
    },
  },
};
