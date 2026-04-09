/** French */
export const bundle = {
  sidebar: { friends: "Liste d’amis" },
  settings: {
    title: "Paramètres",
    saved: "Enregistré.",
    error: {
      load_user: "Impossible de charger le profil utilisateur.",
      save: "Échec de l’enregistrement.",
      save_during: "Une erreur s’est produite pendant l’enregistrement.",
    },
    account: {
      title: "Compte",
      email: "E-mail",
      nickname: "Pseudo",
      default: "(par défaut)",
      nickname_placeholder: "Si vide, le nom sera affiché",
      nickname_hint: "Si vide, votre nom sera affiché.",
      honor: "Honneur",
      point: "pts",
      provider: "Fournisseur",
    },
    withdraw: {
      title: "Supprimer le compte",
      desc: "La suppression supprime compte et données sans retour possible.",
      button: "Supprimer le compte",
      confirm_desc:
        "Confirmer la suppression ? Saisissez Delete account ci-dessous pour continuer.",
      placeholder: "Delete account",
      submit: "Supprimer",
      error: "Échec de la suppression du compte.",
      error_during: "Erreur pendant la suppression du compte.",
    },
    profile: {
      title: "Profil voyage",
      subtitle: "Utilisé pour les recommandations IA personnalisées",
      save: "Enregistrer le profil voyage",
      saved: "Profil voyage enregistré.",
    },
  },
  chat: {
    friends: {
      title: "Liste d’amis",
      whisper_box: "Messages privés",
      error_list: "Impossible de charger la liste.",
      list_title: "Amis ({{count}})",
      empty:
        "Aucun ami pour l’instant. Dans le chat de groupe, touchez un message pour demander en ami.",
      pending_title: "Demandes d’ami reçues ({{count}})",
      pending_empty: "Aucune demande en attente.",
      whisper: "Chuchoter",
      remove_title: "Retirer l’ami",
      block_title: "Bloquer l’utilisateur",
      whisper_to_suffix: " — message privé",
      whisper_placeholder: "Saisissez votre message privé…",
      counter_send_hint: "{{len}} / 500 · Ctrl+Entrée pour envoyer",
      sending: "Envoi…",
      send: "Envoyer",
      honor: "Honneur {{value}}",
      user_fallback: "Utilisateur {{id}}",
      accept_ok: "Demande d’ami acceptée.",
      accept_fail: "Échec de l’acceptation.",
      accept_err: "Erreur lors de l’acceptation.",
      remove_confirm: "Retirer {{name}} de vos amis ?",
      remove_ok: "{{name}} a été retiré de vos amis.",
      remove_fail: "Échec de la suppression de l’ami.",
      remove_err: "Échec de la suppression de l’ami.",
      block_confirm:
        "Bloquer {{name}} ?\nLa personne sera retirée des amis et ne pourra plus chuchoter.",
      block_ok: "{{name}} a été bloqué(e).",
      block_fail: "Échec du blocage.",
      block_err: "Échec du blocage.",
      whisper_ok: "Message privé envoyé à {{name}}.",
      whisper_fail: "Échec de l’envoi du message privé.",
      whisper_err: "Échec de l’envoi du message privé.",
    },
    whisper: {
      user_fallback: "Utilisateur {{id}}",
      title: "Chuchotement",
      new_chat: "Nouvelle conversation",
      no_conversations: "Aucune conversation",
      start: "Envoyer un chuchotement",
      blocked_user: "Utilisateur bloqué",
      delete_conv: "Supprimer la conversation",
      unblock: "Débloquer",
      block: "Bloquer l’utilisateur",
      empty_thread: "Démarrez une conversation avec {{name}}",
      view_tourstar: "Voir la publication Tourstar",
      read: "Lu",
      cannot_send_blocked:
        "Impossible d’envoyer des messages à un utilisateur bloqué.",
      input_placeholder:
        "Saisir un message… (Entrée envoyer, Maj+Entrée nouvelle ligne)",
      pick_or_start: "Choisissez une conversation ou un nouveau chuchotement",
      new_whisper: "+ Nouveau chuchotement",
      new_whisper_title: "Nouveau chuchotement",
      no_friends: "Aucun ami.",
      add_friend: "Ajouter des amis",
      delete_confirm:
        "Supprimer toutes les conversations avec {{name}} ?\nAction irréversible.",
    },
  },
  customer: {
    inquiry: {
      title: "Nous contacter",
      tabs: { write: "Demande 1:1", list: "Mes demandes" },
      form: {
        subject: "Objet",
        subject_placeholder: "Saisir l’objet",
        content: "Message",
        content_placeholder: "Décrivez votre demande",
        attachments: "Pièces jointes",
        attachment_help: "Images (GIF, PNG, JPG) jusqu’à 10 Mo chacune, max 3",
        privacy_agree: "Consentement à la collecte et à l’utilisation des données personnelles",
        sending: "Envoi…",
        submit: "Envoyer",
      },
      list: {
        search_label: "Recherche",
        search_placeholder: "Rechercher par titre/contenu/statut",
        no_results: "Aucun résultat.",
      },
      status: { answered: "Répondu", pending: "En cours" },
      submit_done: "Votre demande a été envoyée.",
      seed: {
        10001: {
          title: "Impossible de téléverser la photo de profil",
          content: "Après sélection, le téléversement échoue à plusieurs reprises.",
        },
        10002: {
          title: "Comment modifier mon planning ?",
          content: "Je veux changer un seul jour de mon itinéraire enregistré.",
          answer:
            "Ouvrez Planning, choisissez une date, puis relancez ou modifiez avec l’IA.",
        },
      },
    },
    inquiries: {
      title: "Mes demandes",
      mobile_title: "Historique des demandes",
      subtitle: "Consultez vos demandes et les réponses.",
      my_list: "Liste des demandes",
      write: "Rédiger une demande",
      search_placeholder: "Rechercher par titre/contenu/statut",
      no_results: "Aucun résultat.",
      status: { answered: "Répondu", pending: "En cours" },
      seed: {
        10001: {
          title: "Impossible de téléverser la photo de profil",
          content: "Après sélection, le téléversement échoue à plusieurs reprises.",
        },
        10002: {
          title: "Comment modifier mon planning ?",
          content: "Je veux changer un seul jour de mon itinéraire enregistré.",
          answer:
            "Ouvrez Planning, choisissez une date, puis relancez ou modifiez avec l’IA.",
        },
      },
      detail: {
        title: "Détail de la demande",
        mobile_title: "Détail de la demande",
        back_to_list: "Retour à la liste",
        received_at: "Reçu le : {{date}}",
        content: "Contenu",
        attachments: "Pièces jointes",
        no_attachments: "Aucune pièce jointe.",
        answer: "Réponse",
        answer_pending: "Réponse en préparation, merci de patienter.",
        not_found: "Demande introuvable.",
      },
    },
    faq: {
      count: "{{count}} entrées",
      title: "Questions fréquentes",
      no_results: "Aucun résultat de recherche.",
      items: {
        login_help: {
          category: "Demande",
          question: "Je n’arrive pas à me connecter, que faire ?",
          answer:
            "Actualisez l’application et réessayez. Si ça persiste, contactez le support.",
        },
        first_steps: {
          category: "Guide",
          question: "Je débute : par quoi commencer ?",
          answer:
            "Essayez Planificateur et Découvrir depuis l’accueil, puis le planning.",
        },
        update_notes: {
          category: "Annonces",
          question: "Où voir les notes de mise à jour ?",
          answer: "Dans la catégorie Annonces du centre d’aide.",
        },
        refund_flow: {
          category: "Paiement & service",
          question: "Comment annuler un paiement (remboursement) ?",
          answer:
            "Envoyez une demande avec infos de paiement et numéro de commande.",
        },
        emergency_help: {
          category: "Urgence & conseils voyage",
          question: "Quelle aide en cas d’urgence pendant un voyage ?",
          answer:
            "Vérifiez les contacts d’urgence et le guide, puis contactez le support si besoin.",
        },
      },
    },
    center: {
      title: "Centre d’aide",
      subtitle: "Trouvez rapidement l’aide dont vous avez besoin.",
    },
    search: {
      label: "Comment pouvons-nous vous aider ?",
      placeholder: "Saisir un mot-clé",
    },
    categories: {
      title: "Catégories",
      items: {
        inquiry: {
          title: "Demande",
          desc: "Compte, fonctionnalités, erreurs — questions générales",
        },
        guide: {
          title: "Guide utilisateur",
          desc: "Utilisation du service et prise en main",
        },
        notices: {
          title: "Annonces",
          desc: "Maintenance, versions et changements",
        },
        payment: {
          title: "Paiement & utilisation",
          desc: "Paiement, remboursement et abonnement",
        },
        emergency: {
          title: "Urgence & conseils voyage",
          desc: "Situations d’urgence et sécurité",
        },
      },
    },
    guide: {
      title: "Guide utilisateur",
      subtitle: "Aperçu de 5 fonctions clés accessibles depuis l’accueil.",
      hero: {
        kicker: "Pour votre premier voyage",
        title: "Créer un trajet → organiser le planning → partager et chatter si besoin",
        steps: {
          planner: "Planificateur",
          schedule: "Planning",
          guide: "Découvrir",
          social: "Tourstar / Chat de groupe",
        },
        cta_planner: "Lancer le planificateur",
        cta_groupchat: "Voir le chat de groupe",
      },
      cards: {
        tourstar: {
          title: "Tourstar",
          subtitle: "Publiez et partagez vos souvenirs de voyage au même endroit.",
          cta: "Aller à Tourstar",
          items: {
            1: {
              title: "1) Préparer photos / notes",
              body: "Après envoi, l’IA aide pour titre et résumé.",
            },
            2: {
              title: "2) Choisir la visibilité",
              body: "Public ou privé selon vos besoins.",
            },
            3: {
              title: "3) Recevoir des réactions",
              body: "Conseils via likes/commentaires et lien avec des amis.",
            },
          },
          tip: {
            title: "Astuce",
            body: "Titres courts ; texte : quand / où / qu’avez-vous aimé.",
          },
        },
        planner: {
          title: "Planificateur",
          subtitle: "L’IA propose trajets et journées selon votre style.",
          cta: "Ouvrir le planificateur",
          items: {
            1: {
              label: "Standard / K-content / Contenu utilisateur",
              body: "Choisissez une option.",
            },
            2: {
              label: "Choisir destination (ou thème)",
              body: "Plus le contexte est clair, meilleures sont les suggestions.",
            },
            3: {
              body: "Les propositions sont enregistrées et affinables dans le planning.",
            },
          },
        },
        schedule: {
          title: "Planning",
          subtitle: "Voir les plans dans le calendrier ; relancer ou modifier avec l’IA.",
          cta: "Ouvrir le planning",
          items: {
            1: {
              title: "1) Choisir une date",
              body: "Cliquer sur un jour affiche le programme.",
            },
            2: {
              title: "2) Relancer pour une autre version",
              body: "Régénérer seulement ce qui ne convient pas.",
            },
            3: {
              title: "3) Demander une modification IA",
              body: "Décrivez le changement souhaité.",
            },
          },
          tip: {
            title: "Carte / Météo",
            body: "Carte et météo dans les cartes d’activité.",
          },
        },
        discover: {
          title: "Découvrir",
          subtitle: "Restaurants, événements et plus sur un seul écran.",
          cta: "Aller à Découvrir",
          items: {
            1: {
              title: "1) Choisir un guide",
              body: "Onglet restaurants ou événements.",
            },
            2: {
              title: "2) Parcourir cartes/liste",
              body: "Touchez un lieu pour les détails.",
            },
            3: {
              body: "Pour l’itinéraire : ajuster dans planificateur/planning.",
            },
          },
        },
        groupchat: {
          title: "Chat de groupe",
          subtitle: "Salons selon le niveau d’honneur — partagez vos histoires.",
          cta: "Aller au chat de groupe",
          items: {
            1: {
              title: "1) Entrer depuis la liste",
              body: "L’accès peut dépendre du niveau d’honneur.",
            },
            2: {
              title: "2) Envoyer des messages",
              body: "Saisie et envoi en temps réel.",
            },
            3: {
              title: "3) Ami / chuchotement / honneur",
              body: "Menu message : chuchoter, ajouter ami, honneur.",
            },
          },
        },
      },
    },
  },
};
