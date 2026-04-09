/** Indonesian */
export const bundle = {
  sidebar: { friends: "Daftar teman" },
  settings: {
    title: "Pengaturan",
    saved: "Tersimpan.",
    error: {
      load_user: "Tidak dapat memuat data pengguna.",
      save: "Gagal menyimpan.",
      save_during: "Terjadi kesalahan saat menyimpan.",
    },
    account: {
      title: "Informasi akun",
      email: "Email",
      nickname: "Nama panggilan",
      default: "(default)",
      nickname_placeholder: "Kosongkan untuk menampilkan nama",
      nickname_hint: "Jika kosong, nama Anda akan ditampilkan.",
      honor: "Kehormatan",
      point: "poin",
      provider: "Penyedia",
    },
    withdraw: {
      title: "Hapus akun",
      desc: "Menghapus akun akan menghapus data dan tidak dapat dipulihkan.",
      button: "Hapus akun",
      confirm_desc:
        "Yakin ingin menghapus? Ketik Delete account di bawah untuk melanjutkan.",
      placeholder: "Delete account",
      submit: "Hapus",
      error: "Gagal menghapus akun.",
      error_during: "Terjadi kesalahan saat menghapus akun.",
    },
    profile: {
      title: "Profil perjalanan",
      subtitle: "Digunakan untuk rekomendasi AI yang dipersonalisasi",
      save: "Simpan profil perjalanan",
      saved: "Profil perjalanan disimpan.",
    },
  },
  chat: {
    friends: {
      title: "Daftar teman",
      whisper_box: "Kotak bisikan",
      error_list: "Tidak dapat memuat daftar.",
      list_title: "Teman ({{count}})",
      empty:
        "Belum ada teman. Di obrolan grup, ketuk pesan untuk mengirim permintaan pertemanan.",
      pending_title: "Permintaan pertemanan ({{count}})",
      pending_empty: "Tidak ada permintaan tertunda.",
      whisper: "Bisikan",
      remove_title: "Hapus teman",
      block_title: "Blokir pengguna",
      whisper_to_suffix: " — kirim bisikan",
      whisper_placeholder: "Ketik pesan bisikan…",
      counter_send_hint: "{{len}} / 500 · Ctrl+Enter untuk kirim",
      sending: "Mengirim…",
      send: "Kirim",
      honor: "Kehormatan {{value}}",
      user_fallback: "Pengguna {{id}}",
      accept_ok: "Permintaan pertemanan diterima.",
      accept_fail: "Gagal menerima.",
      accept_err: "Gagal memproses penerimaan.",
      remove_confirm: "Hapus {{name}} dari daftar teman?",
      remove_ok: "{{name}} dihapus dari daftar teman.",
      remove_fail: "Gagal menghapus teman.",
      remove_err: "Gagal menghapus teman.",
      block_confirm:
        "Blokir {{name}}?\nAkan dihapus dari teman dan tidak menerima bisikan.",
      block_ok: "{{name}} diblokir.",
      block_fail: "Gagal memblokir.",
      block_err: "Gagal memblokir.",
      whisper_ok: "Bisikan terkirim ke {{name}}.",
      whisper_fail: "Gagal mengirim bisikan.",
      whisper_err: "Gagal mengirim bisikan.",
    },
    whisper: {
      user_fallback: "Pengguna {{id}}",
      title: "Bisikan",
      new_chat: "Percakapan baru",
      no_conversations: "Belum ada percakapan",
      start: "Kirim bisikan",
      blocked_user: "Pengguna diblokir",
      delete_conv: "Hapus percakapan",
      unblock: "Buka blokir",
      block: "Blokir pengguna",
      empty_thread: "Mulai percakapan dengan {{name}}",
      view_tourstar: "Lihat posting Tourstar",
      read: "Dibaca",
      cannot_send_blocked: "Tidak dapat mengirim pesan ke pengguna yang diblokir.",
      input_placeholder:
        "Ketik pesan… (Enter kirim, Shift+Enter baris baru)",
      pick_or_start: "Pilih percakapan atau kirim bisikan baru",
      new_whisper: "+ Bisikan baru",
      new_whisper_title: "Bisikan baru",
      no_friends: "Belum ada teman.",
      add_friend: "Tambah teman",
      delete_confirm:
        "Hapus semua percakapan dengan {{name}}?\nTindakan ini tidak dapat dibatalkan.",
    },
  },
  customer: {
    inquiry: {
      title: "Hubungi kami",
      tabs: { write: "Pertanyaan 1:1", list: "Pertanyaan saya" },
      form: {
        subject: "Subjek",
        subject_placeholder: "Masukkan subjek",
        content: "Pesan",
        content_placeholder: "Jelaskan detailnya",
        attachments: "Lampiran",
        attachment_help: "Gambar (GIF, PNG, JPG) maks. 10MB per file, maks. 3",
        privacy_agree: "Setuju pengumpulan dan penggunaan data pribadi",
        sending: "Mengirim…",
        submit: "Kirim",
      },
      list: {
        search_label: "Cari",
        search_placeholder: "Cari berdasarkan judul/konten/status",
        no_results: "Tidak ada hasil.",
      },
      status: { answered: "Dijawab", pending: "Diproses" },
      submit_done: "Pertanyaan Anda telah dikirim.",
      seed: {
        10001: {
          title: "Tidak bisa mengunggah foto profil",
          content: "Setelah memilih gambar, unggahan berulang kali gagal.",
        },
        10002: {
          title: "Bagaimana mengubah jadwal?",
          content: "Ingin mengubah hanya satu hari dalam rencana tersimpan.",
          answer:
            "Buka Jadwal, pilih tanggal, lalu gunakan gulir ulang atau modifikasi AI.",
        },
      },
    },
    inquiries: {
      title: "Pertanyaan saya",
      mobile_title: "Riwayat pertanyaan",
      subtitle: "Lihat pertanyaan yang dikirim dan jawabannya.",
      my_list: "Daftar pertanyaan",
      write: "Tulis pertanyaan",
      search_placeholder: "Cari berdasarkan judul/konten/status",
      no_results: "Tidak ada hasil.",
      status: { answered: "Dijawab", pending: "Diproses" },
      seed: {
        10001: {
          title: "Tidak bisa mengunggah foto profil",
          content: "Setelah memilih gambar, unggahan berulang kali gagal.",
        },
        10002: {
          title: "Bagaimana mengubah jadwal?",
          content: "Ingin mengubah hanya satu hari dalam rencana tersimpan.",
          answer:
            "Buka Jadwal, pilih tanggal, lalu gunakan gulir ulang atau modifikasi AI.",
        },
      },
      detail: {
        title: "Detail pertanyaan",
        mobile_title: "Detail pertanyaan",
        back_to_list: "Kembali ke daftar",
        received_at: "Diterima: {{date}}",
        content: "Isi",
        attachments: "Lampiran",
        no_attachments: "Tidak ada lampiran.",
        answer: "Jawaban",
        answer_pending: "Jawaban sedang disiapkan, mohon tunggu.",
        not_found: "Pertanyaan tidak ditemukan.",
      },
    },
    faq: {
      count: "{{count}} item",
      title: "Pertanyaan umum",
      no_results: "Tidak ada hasil pencarian.",
      items: {
        login_help: {
          category: "Pertanyaan",
          question: "Tidak bisa masuk, apa yang harus dilakukan?",
          answer:
            "Segarkan aplikasi dan coba lagi. Jika masih gagal, hubungi dukungan.",
        },
        first_steps: {
          category: "Panduan",
          question: "Pengguna baru harus mulai dari mana?",
          answer:
            "Gunakan Perencana Perjalanan dan Jelajahi dari beranda, lalu Kelola Jadwal.",
        },
        update_notes: {
          category: "Pengumuman",
          question: "Di mana melihat catatan pembaruan?",
          answer: "Di kategori Pengumuman Pusat Bantuan.",
        },
        refund_flow: {
          category: "Pembayaran & layanan",
          question: "Bagaimana pembatalan pembayaran (refund)?",
          answer:
            "Kirim pertanyaan dengan detail pembayaran dan nomor pesanan.",
        },
        emergency_help: {
          category: "Darurat & tips perjalanan",
          question: "Bantuan apa saat darurat dalam perjalanan?",
          answer:
            "Periksa kontak darurat dan panduan dasar, lalu hubungi dukungan jika perlu.",
        },
      },
    },
    center: {
      title: "Pusat bantuan",
      subtitle: "Temukan bantuan yang Anda butuhkan dengan cepat.",
    },
    search: {
      label: "Apa yang bisa kami bantu?",
      placeholder: "Masukkan kata kunci",
    },
    categories: {
      title: "Kategori",
      items: {
        inquiry: {
          title: "Pertanyaan",
          desc: "Akun, fitur, error — pertanyaan umum",
        },
        guide: {
          title: "Panduan pengguna",
          desc: "Cara menggunakan layanan dan memulai",
        },
        notices: {
          title: "Pengumuman",
          desc: "Pemeliharaan, rilis, dan perubahan",
        },
        payment: {
          title: "Pembayaran & penggunaan",
          desc: "Pembayaran, refund, dan langganan",
        },
        emergency: {
          title: "Bantuan darurat & tips perjalanan",
          desc: "Tanggap darurat dan keselamatan",
        },
      },
    },
    guide: {
      title: "Panduan pengguna",
      subtitle: "Lima fitur inti yang bisa dimulai dari beranda.",
      hero: {
        kicker: "Perjalanan pertama Anda bisa seperti ini",
        title: "Buat rute → atur jadwal → bagikan dan obrol jika perlu",
        steps: {
          planner: "Perencana perjalanan",
          schedule: "Jadwal",
          guide: "Rekomendasi tempat",
          social: "Tourstar / Obrolan grup",
        },
        cta_planner: "Mulai perencana perjalanan",
        cta_groupchat: "Lihat obrolan grup",
      },
      cards: {
        tourstar: {
          title: "Tourstar",
          subtitle: "Catat, ulas, dan bagikan perjalanan di satu tempat.",
          cta: "Ke Tourstar",
          items: {
            1: {
              title: "1) Siapkan foto/catatan",
              body: "Unggah foto, AI membantu judul dan ringkasan.",
            },
            2: {
              title: "2) Pilih visibilitas",
              body: "Publik atau privat sesuai kebutuhan.",
            },
            3: {
              title: "3) Dapatkan respons",
              body: "Tukar tips lewat suka/komentar, hubungkan teman.",
            },
          },
          tip: {
            title: "Tips",
            body: "Judul pendek; isi urut: kapan/di mana/apa yang disukai.",
          },
        },
        planner: {
          title: "Perencana perjalanan",
          subtitle: "AI merekomendasikan rute dan jadwal sesuai gaya Anda.",
          cta: "Ke perencana perjalanan",
          items: {
            1: {
              label: "Standar / K-content / Konten pengguna",
              body: "Pilih salah satu untuk mulai.",
            },
            2: {
              label: "Pilih tujuan (atau tema)",
              body: "Semakin jelas konteks, semakin akurat saran.",
            },
            3: {
              body: "Jadwal yang disarankan tersimpan otomatis, disempurnakan di Jadwal.",
            },
          },
        },
        schedule: {
          title: "Kelola jadwal",
          subtitle: "Lihat rencana di kalender; gulir ulang atau ubah dengan AI.",
          cta: "Buka jadwal",
          items: {
            1: {
              title: "1) Pilih tanggal di kalender",
              body: "Ketuk tanggal untuk melihat rencana hari itu.",
            },
            2: {
              title: "2) Gulir ulang untuk versi lain",
              body: "Hanya buat ulang bagian yang tidak disukai.",
            },
            3: {
              title: "3) Minta AI mengubah",
              body: "Jelaskan permintaan untuk menyesuaikan jadwal.",
            },
          },
          tip: {
            title: "Peta / Cuaca",
            body: "Lihat peta dan ringkasan cuaca di kartu jadwal.",
          },
        },
        discover: {
          title: "Rekomendasi tempat",
          subtitle: "Restoran, acara, dan lainnya dalam satu layar.",
          cta: "Ke rekomendasi tempat",
          items: {
            1: {
              title: "1) Pilih panduan",
              body: "Tab restoran atau acara.",
            },
            2: {
              title: "2) Jelajahi kartu/daftar",
              body: "Ketuk tempat untuk detail.",
            },
            3: {
              body: "Untuk rencana: sesuaikan di perencana/jadwal.",
            },
          },
        },
        groupchat: {
          title: "Obrolan grup",
          subtitle: "Ruang sesuai tingkat kehormatan — bagikan cerita perjalanan.",
          cta: "Ke obrolan grup",
          items: {
            1: {
              title: "1) Masuk dari daftar ruang",
              body: "Akses dapat bergantung pada kehormatan.",
            },
            2: {
              title: "2) Kirim pesan",
              body: "Ketik dan kirim secara real-time.",
            },
            3: {
              title: "3) Teman / bisikan / kehormatan",
              body: "Menu pesan: bisikan, tambah teman, kehormatan.",
            },
          },
        },
      },
    },
  },
};
