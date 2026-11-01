import { computed } from 'vue'
import type { Player, PlayerColor } from '@/engine'
import { useSettingsStore, type Lang } from '@/stores/settings'

const en = {
  passPlay: 'Pass & Play',
  lan: 'LAN',
  players: 'Players',
  resume: 'Resume last game',
  start: 'Start game',
  blockingRule: 'Blocking rule',
  endAtFirstWinner: 'End at first winner',
  debugTools: 'Debug tools',
  bot: 'Bot',
  human: 'Human',
  home: 'home',
  out: 'out',
  turnOf: "{name}'s turn",
  tapDice: 'Tap the dice to roll',
  chooseToken: 'Choose a token to move',
  botThinking: '{name} is thinking…',
  noMove: '{name} has no move',
  captured: '{a} captured {b}!',
  reachedHome: '{name} token reached home',
  finishedRank: '{name} finished #{rank}',
  extraTurn: 'EXTRA TURN!',
  homeRun: 'HOME RUN!',
  sixAgain: 'SIX! ROLL AGAIN',
  threeSixes: 'OOPS! THREE 6s',
  winsBanner: '{name} WINS!',
  winsTitle: '{name} wins!',
  playAgain: 'Play again',
  mainMenu: 'Main menu',
  toggleSound: 'Toggle sound',
  toggleHaptics: 'Toggle vibration',
  language: 'Language',
  lobbyTitle: 'LAN lobby',
  lobbyScan: 'Scan to join from any phone on the same Wi-Fi',
  roomCode: 'Room code',
  lobbyPreview: 'Preview — LAN play arrives with the Rust server (M7).',
  close: 'Close',
  forceRoll: 'Force roll',
  endgamePreset: 'Endgame preset',
  restart2p: '2P',
  restart4p: '4P',
  bots: 'Bots',
  red: 'Red',
  green: 'Green',
  yellow: 'Yellow',
  blue: 'Blue',
  lanSection: 'Play on Wi-Fi',
  yourName: 'Your name',
  hostWifi: 'Host a room',
  joinRoom: 'Join',
  roomCodePlaceholder: 'Room code',
  rejoin: 'Rejoin room {code}',
  waitingHost: 'Waiting for the host to start…',
  startGame: 'Start game',
  leave: 'Leave',
  addBot: 'Add bot',
  removeBot: 'Remove bot',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  hostBadge: 'Host',
  youBadge: 'You',
  room: 'Room',
  needTwo: 'Need at least 2 players',
  hostOnly: 'Only the host can start',
  lanError: 'Could not join: {message}',
  ipUnknown: 'Could not detect this phone\'s Wi-Fi address. Find it under Wi-Fi / hotspot settings and share http://<ip>:7878 with the room code.',
}

export type I18nKey = keyof typeof en

const hi: Record<I18nKey, string> = {
  passPlay: 'पास एंड प्ले',
  lan: 'लैन',
  players: 'खिलाड़ी',
  resume: 'पिछला गेम जारी रखें',
  start: 'गेम शुरू करें',
  blockingRule: 'ब्लॉकिंग नियम',
  endAtFirstWinner: 'पहले विजेता पर खत्म',
  debugTools: 'डीबग टूल',
  bot: 'बॉट',
  human: 'इंसान',
  home: 'घर',
  out: 'बाहर',
  turnOf: '{name} की बारी',
  tapDice: 'पासा फेंकने के लिए टैप करें',
  chooseToken: 'चलने के लिए गोटी चुनें',
  botThinking: '{name} सोच रहा है…',
  noMove: '{name} के पास कोई चाल नहीं',
  captured: '{a} ने {b} को काटा!',
  reachedHome: '{name} की गोटी घर पहुँची',
  finishedRank: '{name} #{rank} पर रहे',
  extraTurn: 'एक्स्ट्रा टर्न!',
  homeRun: 'घर पहुँचे!',
  sixAgain: 'छक्का! फिर फेंको',
  threeSixes: 'अरे! तीन छक्के',
  winsBanner: '{name} जीते!',
  winsTitle: '{name} जीत गए!',
  playAgain: 'फिर से खेलें',
  mainMenu: 'मुख्य मेनू',
  toggleSound: 'आवाज़',
  toggleHaptics: 'वाइब्रेशन',
  language: 'भाषा',
  lobbyTitle: 'लैन लॉबी',
  lobbyScan: 'उसी वाई-फाई पर किसी भी फोन से जुड़ने के लिए स्कैन करें',
  roomCode: 'रूम कोड',
  lobbyPreview: 'प्रीव्यू — लैन प्ले Rust सर्वर (M7) के साथ आएगा।',
  close: 'बंद करें',
  forceRoll: 'पासा तय करें',
  endgamePreset: 'एंडगेम प्रीसेट',
  restart2p: '2 खिलाड़ी',
  restart4p: '4 खिलाड़ी',
  bots: 'बॉट',
  red: 'लाल',
  green: 'हरा',
  yellow: 'पीला',
  blue: 'नीला',
  lanSection: 'वाई-फाई पर खेलें',
  yourName: 'आपका नाम',
  hostWifi: 'रूम बनाएँ',
  joinRoom: 'जुड़ें',
  roomCodePlaceholder: 'रूम कोड',
  rejoin: 'रूम {code} में वापस जाएँ',
  waitingHost: 'होस्ट के शुरू करने का इंतज़ार…',
  startGame: 'गेम शुरू करें',
  leave: 'बाहर निकलें',
  addBot: 'बॉट जोड़ें',
  removeBot: 'बॉट हटाएँ',
  connected: 'जुड़ा हुआ',
  reconnecting: 'दोबारा जुड़ रहा है…',
  hostBadge: 'होस्ट',
  youBadge: 'आप',
  room: 'रूम',
  needTwo: 'कम से कम 2 खिलाड़ी चाहिए',
  hostOnly: 'सिर्फ होस्ट शुरू कर सकता है',
  lanError: 'जुड़ नहीं पाए: {message}',
  ipUnknown: 'इस फोन का वाई-फाई पता नहीं मिला। वाई-फाई / हॉटस्पॉट सेटिंग में IP देखें और http://<ip>:7878 रूम कोड के साथ शेयर करें।',
}

const DICT: Record<Lang, Record<I18nKey, string>> = { en, hi }

export type Params = Record<string, string | number>

export function format(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`))
}

const DEFAULT_NAMES = new Set(['Red', 'Green', 'Yellow', 'Blue'])

export function useI18n() {
  const settings = useSettingsStore()
  const lang = computed(() => settings.lang)
  const t = (key: I18nKey, params?: Params): string => format(DICT[settings.lang][key] ?? en[key] ?? key, params)
  /** Player name, with untouched default colour names translated. */
  const displayName = (p: Pick<Player, 'name' | 'color'> | null | undefined): string => {
    if (!p) return ''
    return DEFAULT_NAMES.has(p.name) && p.name.toLowerCase() === p.color ? t(p.color as PlayerColor) : p.name
  }
  const colorName = (c: PlayerColor) => t(c)
  function toggleLang() {
    settings.lang = settings.lang === 'en' ? 'hi' : 'en'
  }
  return { t, lang, displayName, colorName, toggleLang }
}
