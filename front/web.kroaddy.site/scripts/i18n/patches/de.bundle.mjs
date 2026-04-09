/** German */
export const bundle = {
  sidebar: { friends: "Freundesliste" },
  settings: {
    title: "Einstellungen",
    saved: "Gespeichert.",
    error: {
      load_user: "Benutzerdaten konnten nicht geladen werden.",
      save: "Speichern fehlgeschlagen.",
      save_during: "Beim Speichern ist ein Fehler aufgetreten.",
    },
    account: {
      title: "Konto",
      email: "E-Mail",
      nickname: "Spitzname",
      default: "(Standard)",
      nickname_placeholder: "Leer lassen, um den Namen anzuzeigen",
      nickname_hint: "Ohne Eingabe wird Ihr Name angezeigt.",
      honor: "Ehre",
      point: "Pkt.",
      provider: "Anbieter",
    },
    withdraw: {
      title: "Konto löschen",
      desc: "Beim Löschen werden Konto und Daten entfernt; keine Wiederherstellung.",
      button: "Konto löschen",
      confirm_desc:
        "Wirklich löschen? Geben Sie unten Delete account ein, um fortzufahren.",
      placeholder: "Delete account",
      submit: "Löschen",
      error: "Konto konnte nicht gelöscht werden.",
      error_during: "Beim Löschen ist ein Fehler aufgetreten.",
    },
    profile: {
      title: "Reiseprofil",
      subtitle: "Wird für personalisierte KI-Empfehlungen genutzt",
      save: "Reiseprofil speichern",
      saved: "Reiseprofil gespeichert.",
    },
  },
  chat: {
    friends: {
      title: "Freundesliste",
      whisper_box: "Flüster-Posteingang",
      error_list: "Liste konnte nicht geladen werden.",
      list_title: "Freunde ({{count}})",
      empty:
        "Noch keine Freunde. Tippen Sie in der Gruppenchat-Nachricht auf „Freund hinzufügen“.",
      pending_title: "Freundschaftsanfragen ({{count}})",
      pending_empty: "Keine ausstehenden Anfragen.",
      whisper: "Flüstern",
      remove_title: "Freund entfernen",
      block_title: "Nutzer blockieren",
      whisper_to_suffix: " — Flüstern",
      whisper_placeholder: "Flüsternachricht eingeben…",
      counter_send_hint: "{{len}} / 500 · Strg+Enter zum Senden",
      sending: "Wird gesendet…",
      send: "Senden",
      honor: "Ehre {{value}}",
      user_fallback: "Nutzer {{id}}",
      accept_ok: "Freundschaftsanfrage angenommen.",
      accept_fail: "Annehmen fehlgeschlagen.",
      accept_err: "Fehler beim Annehmen.",
      remove_confirm: "{{name}} aus der Freundesliste entfernen?",
      remove_ok: "{{name}} wurde entfernt.",
      remove_fail: "Entfernen fehlgeschlagen.",
      remove_err: "Entfernen fehlgeschlagen.",
      block_confirm:
        "{{name}} blockieren?\nDann wird die Person aus Freunden entfernt und sendet keine Flüsternachrichten mehr.",
      block_ok: "{{name}} wurde blockiert.",
      block_fail: "Blockieren fehlgeschlagen.",
      block_err: "Blockieren fehlgeschlagen.",
      whisper_ok: "Flüsternachricht an {{name}} gesendet.",
      whisper_fail: "Senden der Flüsternachricht fehlgeschlagen.",
      whisper_err: "Senden der Flüsternachricht fehlgeschlagen.",
    },
    whisper: {
      user_fallback: "Nutzer {{id}}",
      title: "Flüstern",
      new_chat: "Neuer Chat",
      no_conversations: "Keine Unterhaltungen",
      start: "Flüsternachricht senden",
      blocked_user: "Blockierter Nutzer",
      delete_conv: "Unterhaltung löschen",
      unblock: "Entblocken",
      block: "Nutzer blockieren",
      empty_thread: "Starten Sie einen Chat mit {{name}}",
      view_tourstar: "Tourstar-Beitrag ansehen",
      read: "Gelesen",
      cannot_send_blocked:
        "Sie können blockierten Nutzern keine Nachrichten senden.",
      input_placeholder:
        "Nachricht… (Enter senden, Shift+Enter Zeilenumbruch)",
      pick_or_start: "Wählen Sie einen Chat oder starten Sie ein Flüstern",
      new_whisper: "+ Neues Flüstern",
      new_whisper_title: "Neues Flüstern",
      no_friends: "Keine Freunde.",
      add_friend: "Freunde hinzufügen",
      delete_confirm:
        "Alle Chats mit {{name}} löschen?\nDies kann nicht rückgängig gemacht werden.",
    },
  },
  customer: {
    inquiry: {
      title: "Kontakt",
      tabs: { write: "1:1 Anfrage", list: "Meine Anfragen" },
      form: {
        subject: "Betreff",
        subject_placeholder: "Betreff eingeben",
        content: "Nachricht",
        content_placeholder: "Bitte Details angeben",
        attachments: "Anhänge",
        attachment_help: "Bilder (GIF, PNG, JPG) je bis 10 MB, max. 3",
        privacy_agree: "Einwilligung zur Erhebung und Nutzung personenbezogener Daten",
        sending: "Wird gesendet…",
        submit: "Absenden",
      },
      list: {
        search_label: "Suche",
        search_placeholder: "Nach Titel/Inhalt/Status suchen",
        no_results: "Keine Ergebnisse.",
      },
      status: { answered: "Beantwortet", pending: "In Bearbeitung" },
      submit_done: "Ihre Anfrage wurde gesendet.",
      seed: {
        10001: {
          title: "Profilbild lässt sich nicht hochladen",
          content: "Nach Bildauswahl schlägt der Upload wiederholt fehl.",
        },
        10002: {
          title: "Wie ändere ich meinen Plan?",
          content: "Ich möchte nur einen Tag meiner gespeicherten Route ändern.",
          answer:
            "Öffnen Sie „Termine“, wählen Sie ein Datum und nutzen Sie Neurollen oder KI-Anpassung.",
        },
      },
    },
    inquiries: {
      title: "Meine Anfragen",
      mobile_title: "Anfragen-Verlauf",
      subtitle: "Übermittelte Anfragen und Antworten einsehen.",
      my_list: "Anfrageliste",
      write: "Anfrage schreiben",
      search_placeholder: "Nach Titel/Inhalt/Status suchen",
      no_results: "Keine Ergebnisse.",
      status: { answered: "Beantwortet", pending: "In Bearbeitung" },
      seed: {
        10001: {
          title: "Profilbild lässt sich nicht hochladen",
          content: "Nach Bildauswahl schlägt der Upload wiederholt fehl.",
        },
        10002: {
          title: "Wie ändere ich meinen Plan?",
          content: "Ich möchte nur einen Tag meiner gespeicherten Route ändern.",
          answer:
            "Öffnen Sie „Termine“, wählen Sie ein Datum und nutzen Sie Neurollen oder KI-Anpassung.",
        },
      },
      detail: {
        title: "Anfragedetails",
        mobile_title: "Anfragedetails",
        back_to_list: "Zur Liste",
        received_at: "Eingang: {{date}}",
        content: "Inhalt",
        attachments: "Anhänge",
        no_attachments: "Keine Anhänge.",
        answer: "Antwort",
        answer_pending: "Antwort wird vorbereitet. Bitte warten.",
        not_found: "Anfrage nicht gefunden.",
      },
    },
    faq: {
      count: "{{count}} Einträge",
      title: "Häufige Fragen",
      no_results: "Keine Suchergebnisse.",
      items: {
        login_help: {
          category: "Anfrage",
          question: "Was tun, wenn die Anmeldung nicht klappt?",
          answer:
            "App aktualisieren und erneut versuchen. Bei anhaltendem Fehler Support kontaktieren.",
        },
        first_steps: {
          category: "Guide",
          question: "Ich bin neu — womit starte ich?",
          answer:
            "Starten Sie mit Reiseplaner und Entdecken von der Startseite, dann Terminverwaltung.",
        },
        update_notes: {
          category: "Hinweise",
          question: "Wo stehen Update-Hinweise?",
          answer: "Unter „Hinweise“ im Kundencenter finden Sie die neuesten Änderungen.",
        },
        refund_flow: {
          category: "Zahlung & Service",
          question: "Wie läuft eine Stornierung (Erstattung)?",
          answer:
            "Senden Sie eine Anfrage mit Zahlungsdaten und Bestellnummer — wir helfen der Reihe nach.",
        },
        emergency_help: {
          category: "Notfall & Reisetipps",
          question: "Welche Hilfe gibt es in einem Reisenotfall?",
          answer:
            "Zuerst Notfallkontakte und Leitfaden prüfen, dann bei Bedarf sofort den Support kontaktieren.",
        },
      },
    },
    center: {
      title: "Kundencenter",
      subtitle: "Finden Sie schnell die passende Hilfe.",
    },
    search: {
      label: "Womit können wir helfen?",
      placeholder: "Suchbegriff eingeben",
    },
    categories: {
      title: "Kategorien",
      items: {
        inquiry: {
          title: "Anfrage",
          desc: "Konto, Funktionen, Fehler und allgemeine Fragen",
        },
        guide: {
          title: "Nutzungsanleitung",
          desc: "Bedienung und Einstieg",
        },
        notices: {
          title: "Hinweise",
          desc: "Wartung, Releases und Änderungen",
        },
        payment: {
          title: "Zahlung & Nutzung",
          desc: "Zahlung, Erstattung und Abo",
        },
        emergency: {
          title: "Notfallhilfe & Reisetipps",
          desc: "Notfallreaktion und Sicherheitstipps",
        },
      },
    },
    guide: {
      title: "Nutzungsanleitung",
      subtitle: "Fünf Kernfunktionen, die Sie direkt von der Startseite nutzen können.",
      hero: {
        kicker: "So starten Sie Ihre erste Reise",
        title: "Route erstellen → Plan ordnen → bei Bedarf teilen & chatten",
        steps: {
          planner: "Reiseplaner",
          schedule: "Termine",
          guide: "Entdecken",
          social: "Tourstar / Gruppenchat",
        },
        cta_planner: "Reiseplaner starten",
        cta_groupchat: "Gruppenchat ansehen",
      },
      cards: {
        tourstar: {
          title: "Tourstar",
          subtitle: "Reisebeiträge, Bewertungen und Teilen an einem Ort.",
          cta: "Zu Tourstar",
          items: {
            1: {
              title: "1) Fotos/Notizen vorbereiten",
              body: "Nach dem Hochladen hilft die KI bei Titel und Kurzfassung.",
            },
            2: {
              title: "2) Sichtbarkeit wählen",
              body: "Öffentlich oder privat — je nach Bedarf.",
            },
            3: {
              title: "3) Reaktionen sammeln",
              body: "Tipps per Likes/Kommentaren tauschen und Freunde verbinden.",
            },
          },
          tip: {
            title: "Tipp",
            body: "Kurze Titel; Text am besten: wann / wo / was war gut.",
          },
        },
        planner: {
          title: "Reiseplaner",
          subtitle: "Die KI schlägt Routen und Tagespläne nach Ihrem Stil vor.",
          cta: "Zum Reiseplaner",
          items: {
            1: {
              label: "Standard / K-Content / Nutzerinhalte",
              body: "Eine Option wählen.",
            },
            2: {
              label: "Reiseziel (oder Thema) wählen",
              body: "Je klarer der Kontext, desto besser die Vorschläge.",
            },
            3: {
              body: "Vorschläge werden gespeichert und in „Termine“ verfeinert.",
            },
          },
        },
        schedule: {
          title: "Terminverwaltung",
          subtitle: "Gespeicherte Pläne im Kalender; Neurollen oder KI-Anpassung.",
          cta: "Termine öffnen",
          items: {
            1: {
              title: "1) Datum im Kalender wählen",
              body: "Klick zeigt den Tagesplan.",
            },
            2: {
              title: "2) Neurollen für andere Version",
              body: "Nur ungeliebte Teile neu generieren.",
            },
            3: {
              title: "3) KI um Änderung bitten",
              body: "Per Kurzprompt den Plan anpassen.",
            },
          },
          tip: {
            title: "Karte / Wetter",
            body: "In Kartenansicht und Wetterkurzfassung in den Karten.",
          },
        },
        discover: {
          title: "Entdecken",
          subtitle: "Restaurants, Events und mehr auf einem Bildschirm.",
          cta: "Zu Entdecken",
          items: {
            1: {
              title: "1) Guide wählen",
              body: "Tab „Restaurant“ oder „Event“.",
            },
            2: {
              title: "2) Karten/Liste durchsuchen",
              body: "Ort antippen für Details.",
            },
            3: {
              body: "Für den Plan: in Planer/Terminen an die Route anpassen.",
            },
          },
        },
        groupchat: {
          title: "Gruppenchat",
          subtitle: "Räume nach Ehrenlevel — Reisegeschichten teilen.",
          cta: "Zum Gruppenchat",
          items: {
            1: {
              title: "1) Aus der Raumliste eintreten",
              body: "Zugang kann vom Ehrenlevel abhängen.",
            },
            2: {
              title: "2) Nachrichten senden",
              body: "Eingabe und Senden in Echtzeit.",
            },
            3: {
              title: "3) Freund / Flüstern / Ehre",
              body: "Im Nachrichtenmenü: Flüstern, Freund hinzufügen, Ehre.",
            },
          },
        },
      },
    },
  },
};
