/** Vietnamese */
export const bundle = {
  sidebar: { friends: "Danh sách bạn bè" },
  settings: {
    title: "Cài đặt",
    saved: "Đã lưu.",
    error: {
      load_user: "Không tải được thông tin người dùng.",
      save: "Lưu thất bại.",
      save_during: "Đã xảy ra lỗi khi lưu.",
    },
    account: {
      title: "Thông tin tài khoản",
      email: "Email",
      nickname: "Biệt danh",
      default: "(mặc định)",
      nickname_placeholder: "Để trống sẽ hiển thị tên",
      nickname_hint: "Nếu để trống sẽ hiển thị tên của bạn.",
      honor: "Danh dự",
      point: "điểm",
      provider: "Liên kết",
    },
    withdraw: {
      title: "Xóa tài khoản",
      desc: "Xóa tài khoản sẽ xóa dữ liệu và không thể khôi phục.",
      button: "Xóa tài khoản",
      confirm_desc:
        "Bạn chắc chắn chứ? Nhập Delete account bên dưới để tiếp tục.",
      placeholder: "Delete account",
      submit: "Xóa",
      error: "Xóa tài khoản thất bại.",
      error_during: "Lỗi khi xóa tài khoản.",
    },
    profile: {
      title: "Hồ sơ du lịch",
      subtitle: "Dùng để gợi ý AI phù hợp hơn",
      save: "Lưu hồ sơ du lịch",
      saved: "Đã lưu hồ sơ du lịch.",
    },
  },
  chat: {
    friends: {
      title: "Danh sách bạn bè",
      whisper_box: "Hộp tin riêng",
      error_list: "Không tải được danh sách.",
      list_title: "Bạn bè ({{count}})",
      empty:
        "Chưa có bạn. Trong chat nhóm, chạm tin nhắn để gửi lời mời kết bạn.",
      pending_title: "Lời mời đã nhận ({{count}})",
      pending_empty: "Không có yêu cầu đang chờ.",
      whisper: "Tin riêng",
      remove_title: "Xóa bạn",
      block_title: "Chặn người dùng",
      whisper_to_suffix: " — gửi tin riêng",
      whisper_placeholder: "Nhập nội dung tin riêng…",
      counter_send_hint: "{{len}} / 500 · Ctrl+Enter để gửi",
      sending: "Đang gửi…",
      send: "Gửi",
      honor: "Danh dự {{value}}",
      user_fallback: "Người dùng {{id}}",
      accept_ok: "Đã chấp nhận lời mời kết bạn.",
      accept_fail: "Chấp nhận thất bại.",
      accept_err: "Xử lý chấp nhận thất bại.",
      remove_confirm: "Xóa {{name}} khỏi danh sách bạn?",
      remove_ok: "Đã xóa {{name}} khỏi danh sách bạn.",
      remove_fail: "Xóa bạn thất bại.",
      remove_err: "Xóa bạn thất bại.",
      block_confirm:
        "Chặn {{name}}?\nNgười này sẽ bị xóa khỏi bạn bè và không gửi tin riêng được.",
      block_ok: "Đã chặn {{name}}.",
      block_fail: "Chặn thất bại.",
      block_err: "Chặn thất bại.",
      whisper_ok: "Đã gửi tin riêng cho {{name}}.",
      whisper_fail: "Gửi tin riêng thất bại.",
      whisper_err: "Gửi tin riêng thất bại.",
    },
    whisper: {
      user_fallback: "Người dùng {{id}}",
      title: "Tin riêng",
      new_chat: "Cuộc trò chuyện mới",
      no_conversations: "Chưa có cuộc trò chuyện",
      start: "Gửi tin riêng",
      blocked_user: "Người dùng bị chặn",
      delete_conv: "Xóa cuộc trò chuyện",
      unblock: "Bỏ chặn",
      block: "Chặn người dùng",
      empty_thread: "Bắt đầu trò chuyện với {{name}}",
      view_tourstar: "Xem bài Tourstar",
      read: "Đã đọc",
      cannot_send_blocked: "Không thể gửi tin cho người đã chặn.",
      input_placeholder:
        "Nhập tin nhắn… (Enter gửi, Shift+Enter xuống dòng)",
      pick_or_start: "Chọn cuộc trò chuyện hoặc gửi tin riêng mới",
      new_whisper: "+ Tin riêng mới",
      new_whisper_title: "Tin riêng mới",
      no_friends: "Chưa có bạn bè.",
      add_friend: "Thêm bạn",
      delete_confirm:
        "Xóa toàn bộ cuộc trò chuyện với {{name}}?\nKhông thể hoàn tác.",
    },
  },
  customer: {
    inquiry: {
      title: "Liên hệ",
      tabs: { write: "Hỗ trợ 1:1", list: "Yêu cầu của tôi" },
      form: {
        subject: "Tiêu đề",
        subject_placeholder: "Nhập tiêu đề",
        content: "Nội dung",
        content_placeholder: "Mô tả chi tiết",
        attachments: "Đính kèm",
        attachment_help: "Ảnh (GIF, PNG, JPG) tối đa 10MB mỗi file, tối đa 3",
        privacy_agree: "Đồng ý thu thập và sử dụng thông tin cá nhân",
        sending: "Đang gửi…",
        submit: "Gửi",
      },
      list: {
        search_label: "Tìm",
        search_placeholder: "Tìm theo tiêu đề/nội dung/trạng thái",
        no_results: "Không có kết quả.",
      },
      status: { answered: "Đã trả lời", pending: "Đang xử lý" },
      submit_done: "Yêu cầu của bạn đã được gửi.",
      seed: {
        10001: {
          title: "Không tải được ảnh đại diện",
          content: "Chọn ảnh xong nhưng tải lên thất bại nhiều lần.",
        },
        10002: {
          title: "Làm sao sửa lịch trình?",
          content: "Tôi muốn đổi chỉ một ngày trong hành trình đã lưu.",
          answer:
            "Mở Lịch trình, chọn ngày, dùng tạo lại hoặc chỉnh bằng AI.",
        },
      },
    },
    inquiries: {
      title: "Yêu cầu của tôi",
      mobile_title: "Lịch sử yêu cầu",
      subtitle: "Xem yêu cầu đã gửi và câu trả lời.",
      my_list: "Danh sách yêu cầu",
      write: "Viết yêu cầu",
      search_placeholder: "Tìm theo tiêu đề/nội dung/trạng thái",
      no_results: "Không có kết quả.",
      status: { answered: "Đã trả lời", pending: "Đang xử lý" },
      seed: {
        10001: {
          title: "Không tải được ảnh đại diện",
          content: "Chọn ảnh xong nhưng tải lên thất bại nhiều lần.",
        },
        10002: {
          title: "Làm sao sửa lịch trình?",
          content: "Tôi muốn đổi chỉ một ngày trong hành trình đã lưu.",
          answer:
            "Mở Lịch trình, chọn ngày, dùng tạo lại hoặc chỉnh bằng AI.",
        },
      },
      detail: {
        title: "Chi tiết yêu cầu",
        mobile_title: "Chi tiết yêu cầu",
        back_to_list: "Về danh sách",
        received_at: "Ngày tiếp nhận: {{date}}",
        content: "Nội dung",
        attachments: "Tệp đính kèm",
        no_attachments: "Không có tệp đính kèm.",
        answer: "Trả lời",
        answer_pending: "Đang chuẩn bị trả lời, vui lòng đợi.",
        not_found: "Không tìm thấy yêu cầu.",
      },
    },
    faq: {
      count: "{{count}} mục",
      title: "Câu hỏi thường gặp",
      no_results: "Không có kết quả tìm kiếm.",
      items: {
        login_help: {
          category: "Hỗ trợ",
          question: "Không đăng nhập được thì sao?",
          answer:
            "Làm mới ứng dụng và thử lại. Nếu vẫn lỗi, liên hệ hỗ trợ.",
        },
        first_steps: {
          category: "Hướng dẫn",
          question: "Tôi mới dùng, nên bắt đầu từ đâu?",
          answer:
            "Dùng Bộ lập kế hoạch và Khám phá từ trang chủ, sau đó Quản lý lịch.",
        },
        update_notes: {
          category: "Thông báo",
          question: "Xem ghi chú cập nhật ở đâu?",
          answer: "Trong mục Thông báo của Trung tâm hỗ trợ.",
        },
        refund_flow: {
          category: "Thanh toán & dịch vụ",
          question: "Hủy thanh toán (hoàn tiền) thế nào?",
          answer:
            "Gửi yêu cầu kèm thông tin thanh toán và mã đơn, chúng tôi sẽ hướng dẫn.",
        },
        emergency_help: {
          category: "Khẩn cấp & mẹo du lịch",
          question: "Khi khẩn cấp trên đường có hỗ trợ gì?",
          answer:
            "Xem số liên hệ khẩn cấp và hướng dẫn cơ bản, cần thì liên hệ hỗ trợ ngay.",
        },
      },
    },
    center: {
      title: "Trung tâm hỗ trợ",
      subtitle: "Tìm trợ giúp nhanh chóng.",
    },
    search: {
      label: "Chúng tôi có thể giúp gì cho bạn?",
      placeholder: "Nhập từ khóa",
    },
    categories: {
      title: "Danh mục",
      items: {
        inquiry: {
          title: "Hỗ trợ",
          desc: "Tài khoản, tính năng, lỗi — câu hỏi chung",
        },
        guide: {
          title: "Hướng dẫn sử dụng",
          desc: "Cách dùng dịch vụ và bắt đầu",
        },
        notices: {
          title: "Thông báo",
          desc: "Bảo trì, phát hành và thay đổi",
        },
        payment: {
          title: "Thanh toán & sử dụng",
          desc: "Thanh toán, hoàn tiền và gói đăng ký",
        },
        emergency: {
          title: "Trợ giúp khẩn cấp & mẹo du lịch",
          desc: "Ứng phó khẩn cấp và an toàn",
        },
      },
    },
    guide: {
      title: "Hướng dẫn sử dụng",
      subtitle: "Năm tính năng chính bạn có thể bắt đầu từ trang chủ.",
      hero: {
        kicker: "Chuyến đi đầu tiên có thể làm như sau",
        title: "Tạo lộ trình → sắp lịch → chia sẻ và chat khi cần",
        steps: {
          planner: "Bộ lập kế hoạch",
          schedule: "Lịch trình",
          guide: "Địa điểm",
          social: "Tourstar / Chat nhóm",
        },
        cta_planner: "Bắt đầu lập kế hoạch",
        cta_groupchat: "Xem chat nhóm",
      },
      cards: {
        tourstar: {
          title: "Tourstar",
          subtitle: "Ghi chép, đánh giá và chia sẻ chuyến đi một chỗ.",
          cta: "Đi tới Tourstar",
          items: {
            1: {
              title: "1) Chuẩn bị ảnh/ghi chép",
              body: "Tải ảnh lên, AI gợi ý tiêu đề và tóm tắt.",
            },
            2: {
              title: "2) Chọn phạm vi hiển thị",
              body: "Công khai hoặc riêng tư tùy nhu cầu.",
            },
            3: {
              title: "3) Tương tác",
              body: "Trao đổi mẹo qua thích/bình luận, kết nối bạn bè.",
            },
          },
          tip: {
            title: "Mẹo",
            body: "Tiêu đề ngắn; nội dung theo thứ tự: khi nào / ở đâu / thích gì.",
          },
        },
        planner: {
          title: "Bộ lập kế hoạch",
          subtitle: "AI gợi ý lộ trình và lịch theo phong cách bạn.",
          cta: "Đi tới bộ lập kế hoạch",
          items: {
            1: {
              label: "Chuẩn / K-content / Nội dung người dùng",
              body: "Chọn một mục để bắt đầu.",
            },
            2: {
              label: "Chọn điểm đến (hoặc chủ đề)",
              body: "Càng rõ ngữ cảnh, gợi ý càng chính xác.",
            },
            3: {
              body: "Lịch gợi ý tự lưu, chỉnh thêm trong Quản lý lịch.",
            },
          },
        },
        schedule: {
          title: "Quản lý lịch",
          subtitle: "Xem kế hoạch trên lịch; tạo lại hoặc sửa bằng AI.",
          cta: "Mở lịch",
          items: {
            1: {
              title: "1) Chọn ngày trên lịch",
              body: "Chạm ngày để xem lịch trong ngày.",
            },
            2: {
              title: "2) Tạo lại để có phiên bản khác",
              body: "Chỉ tạo lại phần bạn không thích.",
            },
            3: {
              title: "3) Nhờ AI chỉnh",
              body: "Mô tả yêu cầu để điều chỉnh lịch.",
            },
          },
          tip: {
            title: "Bản đồ / Thời tiết",
            body: "Xem bản đồ và tóm tắt thời tiết trong thẻ lịch.",
          },
        },
        discover: {
          title: "Địa điểm",
          subtitle: "Nhà hàng, sự kiện… trên một màn hình.",
          cta: "Đi tới địa điểm",
          items: {
            1: {
              title: "1) Chọn hướng dẫn",
              body: "Tab nhà hàng hoặc sự kiện.",
            },
            2: {
              title: "2) Duyệt thẻ/danh sách",
              body: "Chạm địa điểm để xem chi tiết.",
            },
            3: {
              body: "Muốn thêm vào lịch: chỉnh trong lập kế hoạch/lịch.",
            },
          },
        },
        groupchat: {
          title: "Chat nhóm",
          subtitle: "Phòng theo cấp danh dự — chia sẻ câu chuyện du lịch.",
          cta: "Đi tới chat nhóm",
          items: {
            1: {
              title: "1) Vào từ danh sách phòng",
              body: "Quyền vào có thể phụ thuộc danh dự.",
            },
            2: {
              title: "2) Gửi tin nhắn",
              body: "Nhập và gửi theo thời gian thực.",
            },
            3: {
              title: "3) Bạn / tin riêng / danh dự",
              body: "Menu tin: tin riêng, thêm bạn, danh dự.",
            },
          },
        },
      },
    },
  },
};
