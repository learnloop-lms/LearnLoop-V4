export const THEME_CONFIG = {
  Visionaries: {
    name: "Visionaries",
    tagline: "Futuristic Explorers & High-Tech Creators",
    worldName: "Cosmic Cyber Citadel",
    bgImage: "/assets/visionaries/visionary_bg.png",
    cardBg: "rgba(13, 20, 36, 0.88)",
    primaryColor: "#00f0ff",
    secondaryColor: "#7928ca",
    accentGlow: "rgba(0, 240, 255, 0.35)",
    textColor: "#e0f2fe",
    badgeColors: {
      associate: "#38bdf8",
      professional: "#818cf8",
      master: "#c084fc"
    },
    icons: {
      coins: "/assets/visionaries/visionary_coins.png",
      hearts: "/assets/visionaries/visionary_hearts.png",
      keys: "/assets/visionaries/visionary_keys.png",
      hints: "/assets/visionaries/visionary_hints.png",
      extra_time: "/assets/visionaries/visionary_extra_time.png",
      ask_expert: "/assets/visionaries/visionary_ask_expert.png",
      peer_mentoring: "/assets/visionaries/visionary_peer_mentoring.png",
      swap: "/assets/visionaries/visionary_swap.png",
      double_dip: "/assets/visionaries/visionary_double_dip.png",
      fifty_fifty: "/assets/visionaries/visionary_50_50.png"
    },
    visibleElements: ["Feedback", "Leaderboard", "Badges"]
  },
  Mentors: {
    name: "Mentors",
    tagline: "Scholars of the Grand Academy & Community Guild",
    worldName: "The Grand Library of Alexandria",
    bgImage: "/assets/mentors/mentor_bg.png",
    cardBg: "rgba(28, 22, 16, 0.88)",
    primaryColor: "#f59e0b",
    secondaryColor: "#10b981",
    accentGlow: "rgba(245, 158, 11, 0.35)",
    textColor: "#fef3c7",
    badgeColors: {
      associate: "#34d399",
      professional: "#fbbf24",
      master: "#f97316"
    },
    icons: {
      coins: "/assets/mentors/mentor_coins.png",
      hearts: "/assets/mentors/mentor_hearts.png",
      keys: "/assets/mentors/mentor_keys.png",
      hints: "/assets/mentors/mentor_hints.png",
      extra_time: "/assets/mentors/mentor_extra_time.png",
      ask_expert: "/assets/mentors/mentor_ask_expert.png",
      peer_mentoring: "/assets/mentors/mentor_peer_mentoring.png",
      swap: "/assets/mentors/mentor_swap.png",
      double_dip: "/assets/mentors/mentor_double_dip.png",
      fifty_fifty: "/assets/mentors/mentor_50_50.png",
      mystery: "/assets/mentors/mentor_mystery.png"
    },
    visibleElements: ["Badges", "ProgressBar", "Mystery"]
  },
  Conquerors: {
    name: "Conquerors",
    tagline: "Valiant Warriors & Master Tacticians",
    worldName: "Crimson Dragon Keep",
    bgImage: "/assets/conquerors/conqueror_bg.png",
    cardBg: "rgba(35, 12, 16, 0.88)",
    primaryColor: "#ef4444",
    secondaryColor: "#f59e0b",
    accentGlow: "rgba(239, 68, 68, 0.4)",
    textColor: "#fee2e2",
    badgeColors: {
      associate: "#fb7185",
      professional: "#f87171",
      master: "#dc2626"
    },
    icons: {
      coins: "/assets/conquerors/conqueror_coins.png",
      hearts: "/assets/conquerors/conqueror_hearts.png",
      keys: "/assets/conquerors/conqueror_keys.png",
      hints: "/assets/conquerors/conqueror_hints.png",
      extra_time: "/assets/conquerors/conqueror_extra_time.png",
      ask_expert: "/assets/conquerors/conqueror_ask_expert.png",
      peer_mentoring: "/assets/conquerors/conqueror_peer_mentoring.png",
      swap: "/assets/conquerors/conqueror_swap.png",
      double_dip: "/assets/conquerors/conqueror_double_dip.png",
      fifty_fifty: "/assets/conquerors/conqueror_50_50.png"
    },
    visibleElements: ["Badges", "ProgressBar", "Leaderboard"]
  },
  Pioneers: {
    name: "Pioneers",
    tagline: "Wilderness Explorers & Relic Seekers",
    worldName: "The Uncharted Jungle Archipelago",
    bgImage: "/assets/pioneers/pioneer_bg.png",
    cardBg: "rgba(10, 28, 20, 0.88)",
    primaryColor: "#10b981",
    secondaryColor: "#06b6d4",
    accentGlow: "rgba(16, 185, 129, 0.35)",
    textColor: "#d1fae5",
    badgeColors: {
      associate: "#2dd4bf",
      professional: "#34d399",
      master: "#059669"
    },
    icons: {
      coins: "/assets/pioneers/pioneer_coins.png",
      hearts: "/assets/pioneers/pioneer_hearts.png",
      keys: "/assets/pioneers/pioneer_keys.png",
      hints: "/assets/pioneers/pioneer_hints.png",
      extra_time: "/assets/pioneers/pioneer_extra_time.png",
      ask_expert: "/assets/pioneers/pioneer_ask_expert.png",
      peer_mentoring: "/assets/pioneers/pioneer_peer_mentoring.png",
      swap: "/assets/pioneers/pioneer_swap.png",
      double_dip: "/assets/pioneers/pioneer_double_dip.png",
      fifty_fifty: "/assets/pioneers/pioneer_50_50.png",
      mystery: "/assets/pioneers/pioneer_mystery.png"
    },
    visibleElements: ["Leaderboard", "Mystery", "Rewards"]
  }
};

export const getTheme = (archetype) => {
  return THEME_CONFIG[archetype] || THEME_CONFIG.Visionaries;
};
