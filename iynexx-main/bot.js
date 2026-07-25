const {
  Client, GatewayIntentBits,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  EmbedBuilder, PermissionFlagsBits,
  AttachmentBuilder, SlashCommandBuilder, ChannelType
} = require('discord.js');

const money = require('./Money');
const { randomUUID } = require('crypto');
const path = require('path');
const Jimp = require('jimp');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
  ]
});

require('dotenv').config();
const TOKEN            = process.env.TOKEN;
const VOICE_CHANNEL_ID = '1516181488020750406';
const IMAGE_URL        = 'https://media.discordapp.net/attachments/1466549247779537118/1518663767225794883/file_00000000264471f4b2808307e37574a9.png?ex=6a3abd59&is=6a396bd9&hm=a4b0aaf0e6d2d5c911ff1210fc388dee5f1eaf1511854ce7b18a4f9ba7d23ebe&=&format=webp&quality=lossless&width=1867&height=747';

const MONEY_PER_MESSAGE    = 0.01;
const MONEY_PER_VOICE_HOUR = 0.02;
const MONEY_PER_INVITE     = 1.00;
const MSG_MONEY_CD_MS      = 60_000;

const LEVEL_CHANNEL_ID = '1518729801613971608';
const LEVEL_UP_IMAGE   = 'https://scontent.ftun10-1.fna.fbcdn.net/v/t1.15752-9/728152174_3363735797129093_3349106481751440168_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=fc17b8&_nc_ohc=CvvfrrjF4HsQ7kNvwFE9yp2&_nc_oc=AdrKjEU8-8dgxku9wlQcASbjpcmw7O-pv2v1z8uvDTS0kND9fr_6dkt6baG-Wg5BbSA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.ftun10-1.fna&_nc_ss=7a22e&oh=03_Q7cD5gHndULZyOQGMJoBenq7BB4aj2aO6fqE4d4ciMlPg2eCdg&oe=6A636377';
const XP_PER_MESSAGE   = 15;
const XP_PER_VOICE_MIN = 2;
const XP_MSG_CD_MS     = 60_000;

// =================== Slot إعدادات ===================
const SLOT_BET         = 1;
const SLOT_PRIZE       = 7;
const SLOT_WIN_PCT     = 0.20;
const SLOT_MAX_PER_HR  = 3;       // 3 محاولات كل ساعة

// =================== GG إعدادات ===================
const GG_PRIZE        = 4;
const GG_MIN_INTERVAL = 4 * 60 * 60 * 1000;
const GG_MAX_INTERVAL = 6 * 60 * 60 * 1000;
const GG_CHANNEL_ID   = '1460259472575299624';

// =================== Anti-Spam إعدادات ===================
const SPAM_MSG_COUNT  = 5;
const SPAM_WINDOW_MS  = 5_000;
const SPAM_MUTE_MS    = 60 * 60 * 1000;

const xpMsgCooldowns = new Map();
let voiceXpInterval  = null;

const msgCooldowns = new Map();
const inviteCache  = new Map();

const spamTracker  = new Map(); // userId → { count, firstMsg }
const mutedUsers   = new Map(); // userId → unmuteTime

// Slot hourly attempts: `${userId}-${guildId}` → { count, resetAt }
const slotHourlyAttempts = new Map();

const ggWinners     = new Set();
let   ggActiveUntil = 0;

// =================== قائمة المنتخبات ===================
const teams = [
  { label: 'السعودية',       emoji: '🇸🇦', role: 'السعودية 🇸🇦' },
  { label: 'المغرب',         emoji: '🇲🇦', role: 'المغرب 🇲🇦' },
  { label: 'تونس',           emoji: '🇹🇳', role: 'تونس 🇹🇳' },
  { label: 'الجزائر',        emoji: '🇩🇿', role: 'الجزائر 🇩🇿' },
  { label: 'مصر',            emoji: '🇪🇬', role: 'مصر 🇪🇬' },
  { label: 'الأردن',         emoji: '🇯🇴', role: 'الأردن 🇯🇴' },
  { label: 'قطر',            emoji: '🇶🇦', role: 'قطر 🇶🇦' },
  { label: 'العراق',         emoji: '🇮🇶', role: 'العراق 🇮🇶' },
  { label: 'إيران',          emoji: '🇮🇷', role: 'إيران 🇮🇷' },
  { label: 'أوزبكستان',      emoji: '🇺🇿', role: 'أوزبكستان 🇺🇿' },
  { label: 'الأرجنتين',      emoji: '🇦🇷', role: 'الأرجنتين 🇦🇷' },
  { label: 'البرازيل',       emoji: '🇧🇷', role: 'البرازيل 🇧🇷' },
  { label: 'أوروغواي',       emoji: '🇺🇾', role: 'أوروغواي 🇺🇾' },
  { label: 'كولومبيا',       emoji: '🇨🇴', role: 'كولومبيا 🇨🇴' },
  { label: 'الإكوادور',      emoji: '🇪🇨', role: 'الإكوادور 🇪🇨' },
  { label: 'باراغواي',       emoji: '🇵🇾', role: 'باراغواي 🇵🇾' },
  { label: 'فرنسا',          emoji: '🇫🇷', role: 'فرنسا 🇫🇷' },
  { label: 'إسبانيا',        emoji: '🇪🇸', role: 'إسبانيا 🇪🇸' },
  { label: 'البرتغال',       emoji: '🇵🇹', role: 'البرتغال 🇵🇹' },
  { label: 'إنجلترا',        emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', role: 'إنجلترا 🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { label: 'ألمانيا',        emoji: '🇩🇪', role: 'ألمانيا 🇩🇪' },
  { label: 'هولندا',         emoji: '🇳🇱', role: 'هولندا 🇳🇱' },
  { label: 'بلجيكا',         emoji: '🇧🇪', role: 'بلجيكا 🇧🇪' },
  { label: 'كرواتيا',        emoji: '🇭🇷', role: 'كرواتيا 🇭🇷' },
  { label: 'سويسرا',         emoji: '🇨🇭', role: 'سويسرا 🇨🇭' },
  { label: 'النمسا',         emoji: '🇦🇹', role: 'النمسا 🇦🇹' },
  { label: 'اسكتلندا',       emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', role: 'اسكتلندا 🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { label: 'النرويج',        emoji: '🇳🇴', role: 'النرويج 🇳🇴' },
  { label: 'البوسنة',        emoji: '🇧🇦', role: 'البوسنة 🇧🇦' },
  { label: 'السويد',         emoji: '🇸🇪', role: 'السويد 🇸🇪' },
  { label: 'تركيا',          emoji: '🇹🇷', role: 'تركيا 🇹🇷' },
  { label: 'التشيك',         emoji: '🇨🇿', role: 'التشيك 🇨🇿' },
  { label: 'اليابان',        emoji: '🇯🇵', role: 'اليابان 🇯🇵' },
  { label: 'كوريا الجنوبية', emoji: '🇰🇷', role: 'كوريا الجنوبية 🇰🇷' },
  { label: 'أستراليا',       emoji: '🇦🇺', role: 'أستراليا 🇦🇺' },
  { label: 'السنغال',        emoji: '🇸🇳', role: 'السنغال 🇸🇳' },
  { label: 'جنوب أفريقيا',   emoji: '🇿🇦', role: 'جنوب أفريقيا 🇿🇦' },
  { label: 'كوت ديفوار',     emoji: '🇨🇮', role: 'كوت ديفوار 🇨🇮' },
  { label: 'غانا',           emoji: '🇬🇭', role: 'غانا 🇬🇭' },
  { label: 'الرأس الأخضر',   emoji: '🇨🇻', role: 'الرأس الأخضر 🇨🇻' },
  { label: 'الكونغو',        emoji: '🇨🇩', role: 'الكونغو 🇨🇩' },
  { label: 'أمريكا',         emoji: '🇺🇸', role: 'أمريكا 🇺🇸' },
  { label: 'المكسيك',        emoji: '🇲🇽', role: 'المكسيك 🇲🇽' },
  { label: 'كندا',           emoji: '🇨🇦', role: 'كندا 🇨🇦' },
  { label: 'بنما',           emoji: '🇵🇦', role: 'بنما 🇵🇦' },
  { label: 'هايتي',          emoji: '🇭🇹', role: 'هايتي 🇭🇹' },
  { label: 'كوراساو',        emoji: '🇨🇼', role: 'كوراساو 🇨🇼' },
  { label: 'نيوزيلندا',      emoji: '🇳🇿', role: 'نيوزيلندا 🇳🇿' },
];

// =================== مساعدات ===================
const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size));

function fmt(amount) {
  return `${Number(amount).toFixed(2)} IND`;
}

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator) ||
         member.id === member.guild.ownerId;
}

function parseAccounts(str) {
  if (!str || !str.trim()) return [];
  return str.split(',')
    .map(s => s.trim()).filter(Boolean)
    .map(s => {
      const nameMatch = s.match(/name:([^/\s,]+)/);
      const pswMatch  = s.match(/psw:([^,\s]+)/);
      return { name: nameMatch?.[1]?.trim() ?? null, psw: pswMatch?.[1]?.trim() ?? null };
    })
    .filter(a => a.name && a.psw);
}

function buildShopEmbed(product, soldOut) {
  const remaining = product.accounts.filter(a => !a.sold).length;
  return new EmbedBuilder()
    .setColor(soldOut ? 0x808080 : 0xf1c40f)
    .setTitle(`🛒 ${product.title}`)
    .setDescription(product.description)
    .setImage(product.imageUrl || null)
    .addFields(
      { name: '💰 السعر',   value: fmt(product.price), inline: true },
      { name: '📦 المتوفر', value: soldOut ? '❌ نفد المخزون' : `${remaining} حساب`, inline: true },
    )
    .setFooter({ text: 'IYNexx DOLLAR Store' });
}

function fmtTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}س ${m}د ${s}ث`;
}

// =================== Slot: محاولات كل ساعة ===================
function getSlotData(userId, guildId) {
  const key  = `${userId}-${guildId}`;
  const now  = Date.now();
  const data = slotHourlyAttempts.get(key);
  // إذا انتهت الساعة — صفّر
  if (!data || now >= data.resetAt) {
    const fresh = { count: 0, resetAt: now + 60 * 60 * 1000 };
    slotHourlyAttempts.set(key, fresh);
    return fresh;
  }
  return data;
}

function incrementSlotAttempts(userId, guildId) {
  const data = getSlotData(userId, guildId);
  data.count++;
}

// =================== GG نافذة ===================
function scheduleNextGG() {
  const delay = GG_MIN_INTERVAL + Math.random() * (GG_MAX_INTERVAL - GG_MIN_INTERVAL);
  setTimeout(async () => {
    ggActiveUntil = Date.now() + 5 * 60 * 1000;
    ggWinners.clear();
    try {
      const channel = await client.channels.fetch(GG_CHANNEL_ID);
      if (channel) {
        await channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle('🏆 تحدي GG!')
            .setDescription(
              `> أول شخص يكتب **GG** يربح **${fmt(GG_PRIZE)}** 💰\n` +
              `> عندك **5 دقائق** — يلا!`
            )
            .setFooter({ text: 'IYNexx • GG Challenge' })
            .setTimestamp()]
        });
      }
    } catch {}
    scheduleNextGG();
  }, delay);
}

// =====================================================================
// =================== لعبة الشكوبة التونسية (Chkobba) ===================
// =====================================================================
// كل شيء متعلق باللعبة موجود هنا في قسم واحد مستقل، ولا يلمس أي متغيّر
// أو دالة من الكود أعلاه. صور الأوراق يجب أن تكون في نفس مجلد bot.js
// (الجذر)، بأسماء: denari_1.jpg ... denari_10.jpg، coppe_1.jpg ...
// coppe_10.jpg، spade_1.jpg ... spade_10.jpg، bastoni_1.jpg ... bastoni_10.jpg
// + صورة "ضهر البطاقة" بنفس المجلد باسم: chkobba_card_back.jpg
//
// تحديثات في هذه النسخة:
//  1) تصحيح تسمية القيمتين 8 و 9 (كانتا مقلوبتين).
//  2) كل لاعب يوصلو تلقائياً "ثريد خاص" (Private Thread) جوه نفس
//     القناة، يفتحو البوت لوحدو مع اللاعب بلا ما يحتاج يضغط أي زر ولا
//     رسالة خاصة (DM). فيه بطاقاته الحقيقية وأزرار يختار منها مباشرة،
//     ويبقى مفتوح ومتحدّث تلقائياً طول اللعبة (كل ما يلعب هو أو خصمو
//     تتبدّل الصورة/الأزرار وحدها). خصومو ما ينضموش لهذا الثريد، فما
//     يقدروش يشوفو بطاقاتو أبداً — يشوفو غير ضهرها في اللوحة العامة.
//     زر "عرض يدي" الاحتياطي (ephemeral) ما يظهرش إلا إذا تعذّر فتح
//     الثريد الخاص لسبب تقني (صلاحيات/مستوى بوست السيرفر مثلاً).
//  3) كل صورة (يد/طاولة) تتولد باسم ملف فريد في كل مرة، باش نتفادى أي
//     تضارب/كاش في الصور بين اللاعبين.
//  4) دعم حقيقي للعب بـ 1 (ضد بوت 🤖) أو 2 أو 3 أو 4 لاعبين — وفي وضع
//     الـ 4 لاعبين اللعب يكون فرق (2 ضد 2، كل لاعب مع الي في مقابلو).
//  5) اللوحة العامة (يشوفها الجميع) توري يد كل لاعب مقلوبة (ضهر
//     البطاقة فقط) باش يشوف الجميع كم ورقة عند كل واحد، بلا ما تنكشف
//     قيمها لحتى حد.
//  6) لما تنتهي اللعبة، اللوحة العامة تتبدّل بالكامل لتوري النتيجة
//     النهائية فقط (بلا أزرار ولا صور قديمة)، وثريدات اللاعبين تتقفل.

// ---------- تعريف الورقة والرزمة ----------
const CHKOBBA_SUITS = ['denari', 'coppe', 'spade', 'bastoni'];


const CHKOBBA_SUIT_LABELS_AR = {
  denari: '',
  coppe: '',
  spade: '',
  bastoni: '',
};

const CHKOBBA_SUIT_EMOJI = {
  denari: '🟡',
  coppe: '🔴',
  spade: '⚔️',
  bastoni: '🟢',
};

// ✅ تم تصحيح 8 و 9 (كانا مقلوبين)
const CHKOBBA_VALUE_LABELS_AR = {
  1: 'الآس', 2: '2', 3: '3', 4: '4', 5: '5',
  6: '6', 7: '7', 8: 'الحصان', 9: 'الفارس', 10: 'الملك',
};

// نقاط البريمييرا الرسمية لكل قيمة (لحساب "البريم")
const CHKOBBA_PRIMIERA_POINTS = {
  1: 16, 2: 12, 3: 13, 4: 14, 5: 15, 6: 18, 7: 21, 8: 10, 9: 10, 10: 10,
};

// معرّف وهمي للبوت (وضع اللاعب الواحد ضد الذكاء الاصطناعي)
const CHKOBBA_AI_ID = 'chkobba_ai_bot';

function chkobbaMention(pid) {
  return pid === CHKOBBA_AI_ID ? '🤖 **البوت**' : `<@${pid}>`;
}

function chkobbaUniqueFileName(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
}

class ChkobbaCard {
  constructor(suit, value) {
    this.suit = suit;
    this.value = value;
    this.id = `${suit}_${value}`;
  }
  get label() { return `${CHKOBBA_VALUE_LABELS_AR[this.value]} ${CHKOBBA_SUIT_LABELS_AR[this.suit]}`; }
  get shortLabel() { return `${this.value} ${CHKOBBA_SUIT_LABELS_AR[this.suit]}`; }
  get imageName() { return `${this.id}.jpg`; } // ملف مباشرة في جذر المشروع
  get isSetteBello() { return this.suit === 'denari' && this.value === 7; }
  equals(other) { return other && this.suit === other.suit && this.value === other.value; }
}

function chkobbaCreateFullDeck() {
  const cards = [];
  for (const suit of CHKOBBA_SUITS) for (let v = 1; v <= 10; v++) cards.push(new ChkobbaCard(suit, v));
  return cards;
}

function chkobbaShuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- محرك القوانين ----------
const CHKOBBA_HAND_SIZE = 3;
const CHKOBBA_TABLE_INITIAL_SIZE = 4;
const CHKOBBA_TURN_TIMEOUT_MS = 2 * 60 * 1000;

function chkobbaFindCombinations(tableCards, target) {
  const results = [];
  const n = tableCards.length;
  function backtrack(start, current, sum) {
    if (sum === target && current.length > 0) results.push(current.slice());
    if (sum >= target) return;
    for (let i = start; i < n; i++) {
      current.push(tableCards[i]);
      backtrack(i + 1, current, sum + tableCards[i].value);
      current.pop();
    }
  }
  backtrack(0, [], 0);
  return results;
}

function chkobbaGetCaptureOptions(playedCard, tableCards) {
  const directMatches = tableCards.filter(c => c.value === playedCard.value);
  if (directMatches.length > 0) {
    return { forced: true, options: directMatches.map(c => [c]) };
  }
  const combos = chkobbaFindCombinations(tableCards, playedCard.value);
  return { forced: false, options: combos };
}

class ChkobbaPlayer {
  constructor(userId) {
    this.userId = userId;
    this.hand = [];
    this.captured = [];
    this.scope = 0;
  }
}

// اللعبة تدعم الآن 2 أو 3 أو 4 لاعبين (والوضع الفردي 1 يُلعب فعلياً كـ 2:
// اللاعب + البوت). في حالة 4 لاعبين تُلعب فرق: order[0]+order[2] ضد order[1]+order[3].
class ChkobbaGame {
  constructor(playerIds) {
    this.order = playerIds.slice();
    this.players = {};
    for (const pid of this.order) this.players[pid] = new ChkobbaPlayer(pid);

    this.teams = this.order.length === 4
      ? { A: [this.order[0], this.order[2]], B: [this.order[1], this.order[3]] }
      : null;

    this.turnIndex = 0;
    this.table = [];
    this.deck = [];
    this.lastCapturerId = null;
    this.log = [];
    this.finished = false;
    this.result = null;
    this.turnDeadline = Date.now() + CHKOBBA_TURN_TIMEOUT_MS;
    this._start();
  }

  _start() {
    this.deck = chkobbaShuffle(chkobbaCreateFullDeck());
    this.table = this.deck.splice(0, CHKOBBA_TABLE_INITIAL_SIZE);
    this._dealHands();
    this.log.push('🎴 تم توزيع الأوراق، بداية اللعبة!');
  }

  _dealHands() {
    for (const pid of this.order) {
      const p = this.players[pid];
      const drawn = this.deck.splice(0, CHKOBBA_HAND_SIZE);
      p.hand.push(...drawn);
    }
  }

  get currentPlayerId() { return this.order[this.turnIndex]; }
  isParticipant(userId) { return Object.prototype.hasOwnProperty.call(this.players, userId); }

  _cardsRemainingTotal() {
    const handsLeft = this.order.reduce((s, pid) => s + this.players[pid].hand.length, 0);
    return handsLeft + this.deck.length;
  }

  previewCaptureOptions(cardId) {
    const player = this.players[this.currentPlayerId];
    const card = player.hand.find(c => c.id === cardId);
    if (!card) return null;
    return { card, ...chkobbaGetCaptureOptions(card, this.table) };
  }

  playCard(userId, cardId, chosenComboIndex = 0) {
    if (this.finished) throw new Error('GAME_FINISHED');
    if (userId !== this.currentPlayerId) throw new Error('NOT_YOUR_TURN');

    const player = this.players[userId];
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) throw new Error('CARD_NOT_IN_HAND');
    const playedCard = player.hand[cardIdx];

    const { options } = chkobbaGetCaptureOptions(playedCard, this.table);
    let captured = [];
    let isScopa = false;

    if (options.length > 0) {
      const combo = options[Math.min(chosenComboIndex, options.length - 1)];
      captured = combo;
      this.table = this.table.filter(tc => !captured.some(cc => cc.equals(tc)));
      player.captured.push(playedCard, ...captured);
      this.lastCapturerId = userId;

      const isLastCardOfGame = this._cardsRemainingTotal() === 1;
      if (this.table.length === 0 && !isLastCardOfGame) {
        isScopa = true;
        player.scope += 1;
      }
    } else {
      this.table.push(playedCard);
    }

    player.hand.splice(cardIdx, 1);

    const eventLog = { playerId: userId, playedCard, captured, isScopa };
    this._logEvent(eventLog);
    this._advanceAfterPlay();
    return eventLog;
  }

  _logEvent({ playerId, playedCard, captured, isScopa }) {
    let text;
    if (captured.length > 0) {
      text = `${chkobbaMention(playerId)} لعب **${playedCard.shortLabel}** وأخذ: ${captured.map(c => c.shortLabel).join('، ')}`;
      if (isScopa) text += ' — 🏆 **شكوبة!**';
    } else {
      text = `${chkobbaMention(playerId)} لعب **${playedCard.shortLabel}** ووضعها على الطاولة`;
    }
    this.log.push(text);
    if (this.log.length > 6) this.log.shift();
  }

  _advanceAfterPlay() {
    const allHandsEmpty = this.order.every(pid => this.players[pid].hand.length === 0);
    if (allHandsEmpty) {
      if (this.deck.length > 0) {
        this._dealHands();
      } else {
        if (this.table.length > 0 && this.lastCapturerId) {
          this.players[this.lastCapturerId].captured.push(...this.table);
          this.log.push(`📥 أوراق الطاولة المتبقية ذهبت لـ ${chkobbaMention(this.lastCapturerId)} (قاعدة آخر أخذة)`);
        }
        this.table = [];
        this._finish();
        return;
      }
    }
    this.turnIndex = (this.turnIndex + 1) % this.order.length;
    this.turnDeadline = Date.now() + CHKOBBA_TURN_TIMEOUT_MS;
  }

  _finish() {
    this.finished = true;
    this.result = chkobbaComputeFinalScore(this);
  }

  abort(reason, byUserId = null) {
    this.finished = true;
    this.result = { aborted: true, reason, byUserId };
  }

  isTimedOut() { return !this.finished && Date.now() > this.turnDeadline; }
}

function chkobbaComputePrimiera(capturedCards) {
  const bestPerSuit = {};
  for (const c of capturedCards) {
    const pts = CHKOBBA_PRIMIERA_POINTS[c.value];
    if (!bestPerSuit[c.suit] || pts > bestPerSuit[c.suit].pts) bestPerSuit[c.suit] = { pts, card: c };
  }
  const breakdown = Object.values(bestPerSuit);
  const total = breakdown.reduce((s, x) => s + x.pts, 0);
  return { total, breakdown };
}

// يرجّع "مجموعات" التسجيل: كل لاعب لحاله (2/3 لاعبين) أو فريقين (4 لاعبين)
function chkobbaGroupsFromGame(game) {
  if (game.teams) {
    return [
      { id: 'A', memberIds: game.teams.A },
      { id: 'B', memberIds: game.teams.B },
    ];
  }
  return game.order.map(pid => ({ id: pid, memberIds: [pid] }));
}

function chkobbaAddPointForMax(groups, summary, field, flag) {
  const max = Math.max(...groups.map(g => summary[g.id][field]));
  const withMax = groups.filter(g => summary[g.id][field] === max);
  if (withMax.length === 1) {
    summary[withMax[0].id].points += 1;
    summary[withMax[0].id][flag] = true;
  }
}

function chkobbaComputeFinalScore(game) {
  const groups = chkobbaGroupsFromGame(game);
  const summary = {};

  for (const g of groups) {
    const capturedAll = g.memberIds.flatMap(pid => game.players[pid].captured);
    const scopeSum = g.memberIds.reduce((s, pid) => s + game.players[pid].scope, 0);
    const denariCount = capturedAll.filter(c => c.suit === 'denari').length;
    const setteBello = capturedAll.some(c => c.isSetteBello);
    const primiera = chkobbaComputePrimiera(capturedAll);
    summary[g.id] = {
      memberIds: g.memberIds,
      scope: scopeSum,
      cardsCount: capturedAll.length,
      denariCount,
      setteBello,
      primieraTotal: primiera.total,
      points: scopeSum,
    };
  }

  chkobbaAddPointForMax(groups, summary, 'cardsCount', 'wonCarte');
  chkobbaAddPointForMax(groups, summary, 'denariCount', 'wonDenari');
  for (const g of groups) if (summary[g.id].setteBello) summary[g.id].points += 1;
  chkobbaAddPointForMax(groups, summary, 'primieraTotal', 'wonPrimiera');

  const maxPoints = Math.max(...groups.map(g => summary[g.id].points));
  const winners = groups.filter(g => summary[g.id].points === maxPoints);
  const winnerGroupId = winners.length === 1 ? winners[0].id : null;

  return { aborted: false, summary, winnerGroupId, groups };
}

// ---------- ذكاء اصطناعي بسيط لوضع اللاعب الواحد ----------
function chkobbaAiChooseMove(game) {
  const ai = game.players[CHKOBBA_AI_ID];
  let best = null; // { cardId, comboIndex, comboLen }

  for (const card of ai.hand) {
    const { options } = chkobbaGetCaptureOptions(card, game.table);
    if (options.length === 0) continue;
    let bestComboIdx = 0;
    let bestComboLen = options[0].length;
    for (let i = 1; i < options.length; i++) {
      if (options[i].length > bestComboLen) { bestComboLen = options[i].length; bestComboIdx = i; }
    }
    if (!best || bestComboLen > best.comboLen) {
      best = { cardId: card.id, comboIndex: bestComboIdx, comboLen: bestComboLen };
    }
  }
  if (best) return best;

  // ما فماش أخذ ممكن — يرمي أعلى ورقة عندو باش يتخلص منها
  const sorted = ai.hand.slice().sort((a, b) => b.value - a.value);
  return { cardId: sorted[0].id, comboIndex: 0, comboLen: 0 };
}

// ---------- إدارة الجلسات (اختيار العدد + غرف انتظار + لعبات جارية) ----------
class ChkobbaGameManager {
  constructor() {
    this.pendingLobbies = new Map(); // messageId -> { hostId, channelId, targetCount, joined:[ids] }
    this.activeGames = new Map();    // messageId -> ChkobbaGame
    this.userToGame = new Map();     // userId -> messageId
  }
  registerLobby(messageId, hostId, channelId, targetCount) {
    const lobby = { hostId, channelId, targetCount, joined: [hostId], createdAt: Date.now() };
    this.pendingLobbies.set(messageId, lobby);
    return lobby;
  }
  getLobby(messageId) { return this.pendingLobbies.get(messageId); }
  removeLobby(messageId) { this.pendingLobbies.delete(messageId); }
  isUserBusy(userId) {
    if (this.userToGame.has(userId)) return true;
    for (const lobby of this.pendingLobbies.values()) if (lobby.joined.includes(userId)) return true;
    return false;
  }
  startGame(messageId, playerIds) {
    const game = new ChkobbaGame(playerIds);
    this.activeGames.set(messageId, game);
    for (const pid of playerIds) if (pid !== CHKOBBA_AI_ID) this.userToGame.set(pid, messageId);
    return game;
  }
  getGame(messageId) { return this.activeGames.get(messageId); }
  endGame(messageId) {
    const game = this.activeGames.get(messageId);
    if (game) for (const pid of game.order) if (pid !== CHKOBBA_AI_ID) this.userToGame.delete(pid);
    this.activeGames.delete(messageId);
  }
}

const chkobbaManager = new ChkobbaGameManager();
const chkobbaGameChannels = new Map();  // messageId -> channelId
const chkobbaTurnTimers   = new Map();  // messageId -> Timeout
const chkobbaPendingCombos = new Map(); // `${messageId}:${userId}` -> {cardId, options}
const CHKOBBA_COMMAND_NAME = 'chkobba';

// ---------- بناء الواجهات (Embeds/Buttons/Select Menus) ----------
function chkobbaCardAttachment(card) {
  const filePath = path.join(__dirname, card.imageName); // الصورة في جذر المشروع مباشرة
  return new AttachmentBuilder(filePath, { name: card.imageName });
}

// ---------- دمج صور عدة بطاقات في صورة واحدة مع اسم كل بطاقة تحتها ----------
const CHKOBBA_IMG_CARD_WIDTH   = 140; // عرض كل بطاقة داخل الصورة المدمجة
const CHKOBBA_IMG_GAP          = 14;  // مسافة بين البطاقات
const CHKOBBA_IMG_LABEL_HEIGHT = 34;  // ارتفاع مكان كتابة الاسم تحت كل بطاقة
const CHKOBBA_IMG_PADDING      = 16;  // حواف الصورة
const CHKOBBA_IMG_BG_COLOR     = 0x2c3e50ff;

async function chkobbaComposeCardsImage(cards) {
  if (!cards || cards.length === 0) return null;

  const loaded = [];
  for (const card of cards) {
    const filePath = path.join(__dirname, card.imageName);
    const img = await Jimp.read(filePath);
    img.resize(CHKOBBA_IMG_CARD_WIDTH, Jimp.AUTO);
    loaded.push({ card, img });
  }

  const cardHeight   = Math.max(...loaded.map(l => l.img.bitmap.height));
  const cellWidth    = CHKOBBA_IMG_CARD_WIDTH + CHKOBBA_IMG_GAP;
  const canvasWidth  = cellWidth * loaded.length + CHKOBBA_IMG_GAP;
  const canvasHeight = CHKOBBA_IMG_PADDING * 2 + cardHeight + CHKOBBA_IMG_LABEL_HEIGHT;

  const canvas = await new Jimp(canvasWidth, canvasHeight, CHKOBBA_IMG_BG_COLOR);
  const font   = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

  for (let i = 0; i < loaded.length; i++) {
    const { card, img } = loaded[i];
    const x = CHKOBBA_IMG_GAP + i * cellWidth;
    const y = CHKOBBA_IMG_PADDING;
    canvas.composite(img, x, y);
    canvas.print(
      font,
      x - 10,
      y + cardHeight + 4,
      {
        text: card.shortLabel,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
      },
      CHKOBBA_IMG_CARD_WIDTH + 20,
      CHKOBBA_IMG_LABEL_HEIGHT
    );
  }

  return canvas.getBufferAsync(Jimp.MIME_PNG);
}

// ---------- اختيار عدد اللاعبين ----------
function chkobbaBuildCountSelectEmbed(hostId) {
  return new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle('🃏 شكوبة تونسية — اختر عدد اللاعبين')
    .setDescription(
      `${chkobbaMention(hostId)} اختر عدد اللاعبين للعبة:\n\n` +
      `> **1** — تلعب لوحدك ضد البوت 🤖\n` +
      `> **2** — لاعب ضد لاعب\n` +
      `> **3** — كل واحد لحاله (بدون فرق)\n` +
      `> **4** — فرق (2 ضد 2 — اللي يقابلك هو شريكك)`
    )
    .setFooter({ text: 'IYNexx • Chkobba Tunisienne' });
}

function chkobbaBuildCountSelectRow(hostId) {
  const row = new ActionRowBuilder();
  for (let n = 1; n <= 4; n++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`chkobba_count_${n}_${hostId}`)
        .setLabel(n === 1 ? '1 🤖' : `${n} لاعبين`)
        .setStyle(ButtonStyle.Secondary)
    );
  }
  return row;
}

// ---------- غرفة الانتظار ----------
function chkobbaBuildLobbyEmbed(lobby) {
  const joinedList = lobby.joined.map(id => chkobbaMention(id)).join('\n') || '—';
  return new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle('🃏 بانتظار اللاعبين')
    .setDescription(
      `**${lobby.joined.length}/${lobby.targetCount}** انضموا حتى الآن:\n${joinedList}\n\n` +
      `> اضغط الزر أدناه للانضمام.`
    )
    .setFooter({ text: 'IYNexx • Chkobba Tunisienne' })
    .setTimestamp();
}

function chkobbaBuildJoinRow(messageId) {
  const btn = new ButtonBuilder()
    .setCustomId(`chkobba_lobbyjoin_${messageId}`)
    .setLabel('⚔️ انضمام')
    .setStyle(ButtonStyle.Success);
  return new ActionRowBuilder().addComponents(btn);
}

async function chkobbaBuildPublicGameView(game, messageId) {
  const files = [];

  const scoreLines = game.order.map(pid => {
    const s = game.players[pid];
    let teamTag = '';
    if (game.teams) teamTag = game.teams.A.includes(pid) ? ' [فريق A]' : ' [فريق B]';
    return `${chkobbaMention(pid)}${teamTag} — 🧹 شكوبة: **${s.scope}** | 🎴 أوراق: **${s.captured.length}**`;
  });

  const main = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🃏 الشكوبة التونسية — اللعبة جارية')
    .addFields(
      { name: '👤 اللاعبون', value: game.order.map(pid => chkobbaMention(pid)).join(' ⚔️ '), inline: false },
      { name: '📊 النقاط الحالية', value: scoreLines.join('\n'), inline: false },
      { name: '🀄 الدور الحالي', value: chkobbaMention(game.currentPlayerId), inline: true },
      { name: '📦 الرزمة المتبقية', value: `${game.deck.length} ورقة`, inline: true },
    )
    .setDescription(
      game.table.length > 0
        ? `**🪑 أوراق الطاولة (${game.table.length}):**\n` + game.table.map(c => `\`${c.shortLabel}\``).join('  ')
        : '**🪑 الطاولة فارغة حالياً**'
    )
    .setFooter({ text: 'IYNexx • Chkobba Tunisienne' })
    .setTimestamp();

  if (game.log.length > 0) main.addFields({ name: '📜 آخر الأحداث', value: game.log.slice(-4).join('\n') });

  // صورة واحدة تجمع كل بطاقات الطاولة — باسم فريد في كل مرة (يمنع كاش الصور القديمة)
  if (game.table.length > 0) {
    const buffer = await chkobbaComposeCardsImage(game.table);
    if (buffer) {
      const fileName = chkobbaUniqueFileName('chkobba_table');
      files.push(new AttachmentBuilder(buffer, { name: fileName }));
      main.setImage(`attachment://${fileName}`);
    }
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`chkobba_hand_${messageId}`).setLabel('🃏 عرض يدي واللعب').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`chkobba_quit_${messageId}`).setLabel('🚪 الانسحاب من اللعبة').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [main], files, components: [row] };
}

async function chkobbaBuildHandView(game, playerId, messageId) {
  const player = game.players[playerId];
  const files = [];

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🃏 يدك الحالية')
    .setDescription('اضغط على الزر المطابق للورقة التي تريد لعبها 👇')
    .setFooter({ text: 'هذه الرسالة تظهر لك فقط' });

  // صورة واحدة تجمع كل بطاقات يدك — باسم فريد في كل مرة (يمنع عرض صورة قديمة/غالطة)
  if (player.hand.length > 0) {
    const buffer = await chkobbaComposeCardsImage(player.hand);
    if (buffer) {
      const fileName = chkobbaUniqueFileName(`chkobba_hand_${playerId}`);
      files.push(new AttachmentBuilder(buffer, { name: fileName }));
      embed.setImage(`attachment://${fileName}`);
    }
  }

  // زر لكل بطاقة — الضغط عليه يختارها مباشرة (بدل قائمة منسدلة)
  const buttons = player.hand.map(card =>
    new ButtonBuilder()
      .setCustomId(`chkobba_play_${messageId}_${card.id}`)
      .setLabel(card.shortLabel)
      .setEmoji(CHKOBBA_SUIT_EMOJI[card.suit])
      .setStyle(ButtonStyle.Primary)
  );

  const rows = chunk(buttons, 5).map(group => new ActionRowBuilder().addComponents(group));

  return { embeds: [embed], files, components: rows };
}

function chkobbaBuildComboSelect(messageId, cardId, options) {
  const menuOptions = options.map((combo, idx) => {
    const label = combo.map(c => c.shortLabel).join(' + ');
    const sum = combo.reduce((s, c) => s + c.value, 0);
    return new StringSelectMenuOptionBuilder().setLabel(`أخذ: ${label} (=${sum})`).setValue(String(idx));
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`chkobba_combo_${messageId}_${cardId}`)
    .setPlaceholder('🧩 اختر التوليفة التي تريد أخذها')
    .addOptions(menuOptions);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🧩 أكثر من طريقة للأخذ!')
    .setDescription('اختر التوليفة التي تريد أخذها من الطاولة:');

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] };
}

function chkobbaBuildFinalResultEmbed(game) {
  const { summary, winnerGroupId, groups } = game.result;
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('🏁 انتهت لعبة الشكوبة!')
    .setTimestamp()
    .setFooter({ text: 'IYNexx • Chkobba Tunisienne' });

  for (const g of groups) {
    const s = summary[g.id];
    const nameLabel = g.memberIds.map(pid => chkobbaMention(pid)).join(' + ');
    const lines = [
      `🧹 شكوبة: **${s.scope}** نقطة`,
      `🎴 أكثر أوراق: ${s.wonCarte ? '✅ +1' : '—'}`,
      `🟡 أكثر ديناري: ${s.wonDenari ? '✅ +1' : '—'}`,
      `💎 سبعة ديناري: ${s.setteBello ? '✅ +1' : '—'}`,
      `🃏 البريم: ${s.wonPrimiera ? `✅ +1 (${s.primieraTotal})` : `— (${s.primieraTotal})`}`,
      `**المجموع: ${s.points} نقطة**`,
    ];
    embed.addFields({ name: `👤 ${nameLabel}`, value: lines.join('\n'), inline: true });
  }
  embed.setDescription(winnerGroupId
    ? `🏆 الفائز: ${groups.find(g => g.id === winnerGroupId).memberIds.map(pid => chkobbaMention(pid)).join(' + ')}`
    : '🤝 تعادل!');
  return embed;
}

function chkobbaBuildAbortEmbed(reason, byUserId) {
  const reasons = {
    timeout: '⏳ انتهت اللعبة بسبب انتهاء وقت أحد اللاعبين.',
    left: `🚪 انسحب ${chkobbaMention(byUserId)} من اللعبة، تم إلغاء المباراة.`,
    error: '⚠️ حدث خطأ غير متوقع، تم إلغاء المباراة.',
  };
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('❌ تم إلغاء اللعبة')
    .setDescription(reasons[reason] || 'تم إلغاء اللعبة.')
    .setFooter({ text: 'IYNexx • Chkobba Tunisienne' });
}

// ---------- تسجيل أمر الـ Slash ----------
async function chkobbaRegisterCommands(discordClient) {
  const command = new SlashCommandBuilder()
    .setName(CHKOBBA_COMMAND_NAME)
    .setDescription('ابدأ لعبة شكوبة تونسية (1 ضد بوت أو 2/3/4 لاعبين) في هذه القناة');
  try {
    const guildId = process.env.CHKOBBA_GUILD_ID;
    if (guildId) {
      const guild = await discordClient.guilds.fetch(guildId);
      await guild.commands.create(command);
      console.log(`✅ تم تسجيل أمر /${CHKOBBA_COMMAND_NAME} على السيرفر ${guildId}`);
    } else {
      await discordClient.application.commands.create(command);
      console.log(`✅ تم تسجيل أمر /${CHKOBBA_COMMAND_NAME} عالمياً (قد يستغرق ظهوره حتى ساعة)`);
    }
  } catch (err) {
    console.error('❌ فشل تسجيل أمر الشكوبة:', err.message);
  }
}

// ---------- أدوات مساعدة داخلية ----------
function chkobbaParseAfterPrefix(customId, prefix) { return customId.slice(prefix.length); }

async function chkobbaFetchPublicMessage(discordClient, messageId) {
  const channelId = chkobbaGameChannels.get(messageId);
  if (!channelId) return null;
  try {
    const channel = await discordClient.channels.fetch(channelId);
    return await channel.messages.fetch(messageId);
  } catch { return null; }
}

async function chkobbaUpdatePublicView(discordClient, messageId, game) {
  const message = await chkobbaFetchPublicMessage(discordClient, messageId);
  if (!message) return;
  try {
    if (game.finished) {
      if (game.result?.aborted) {
        await message.edit({ embeds: [chkobbaBuildAbortEmbed(game.result.reason, game.result.byUserId)], components: [], files: [] });
      } else {
        await message.edit({ embeds: [chkobbaBuildFinalResultEmbed(game)], components: [], files: [] });
      }
    } else {
      const view = await chkobbaBuildPublicGameView(game, messageId);
      await message.edit(view);
    }
  } catch (err) {
    console.error('❌ فشل تحديث لوحة الشكوبة العامة:', err.message);
  }
}

function chkobbaClearTimer(messageId) {
  const t = chkobbaTurnTimers.get(messageId);
  if (t) clearTimeout(t);
  chkobbaTurnTimers.delete(messageId);
}

function chkobbaScheduleTimeout(discordClient, messageId) {
  chkobbaClearTimer(messageId);
  const timer = setTimeout(async () => {
    const game = chkobbaManager.getGame(messageId);
    if (!game || game.finished) return;
    if (!game.isTimedOut()) return;
    game.abort('timeout');
    await chkobbaUpdatePublicView(discordClient, messageId, game);
    chkobbaCleanupGame(messageId);
  }, CHKOBBA_TURN_TIMEOUT_MS + 500);
  chkobbaTurnTimers.set(messageId, timer);
}

function chkobbaCleanupGame(messageId) {
  chkobbaClearTimer(messageId);
  chkobbaGameChannels.delete(messageId);
  chkobbaManager.endGame(messageId);
  for (const key of [...chkobbaPendingCombos.keys()]) {
    if (key.startsWith(`${messageId}:`)) chkobbaPendingCombos.delete(key);
  }
}

async function chkobbaSafeReplyEphemeral(interaction, content) {
  const payload = { content, ephemeral: true };
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch (err) {
    console.error('❌ فشل رد سرّي في الشكوبة:', err.message);
  }
}

// يشغّل دور البوت تلقائياً إذا كان الدور الحالي لو (وضع اللاعب الواحد)
async function chkobbaMaybePlayAiTurn(discordClient, messageId) {
  const game = chkobbaManager.getGame(messageId);
  if (!game || game.finished || game.currentPlayerId !== CHKOBBA_AI_ID) return;

  await new Promise(res => setTimeout(res, 1200));

  const freshGame = chkobbaManager.getGame(messageId);
  if (!freshGame || freshGame.finished || freshGame.currentPlayerId !== CHKOBBA_AI_ID) return;

  const move = chkobbaAiChooseMove(freshGame);
  freshGame.playCard(CHKOBBA_AI_ID, move.cardId, move.comboIndex);

  await chkobbaAfterStateChange(discordClient, messageId, freshGame);
}

// نقطة مركزية تُستدعى بعد أي حركة: تحدّث اللوحة العامة، وتشغّل دور البوت
// تلقائياً إذا لزم.
async function chkobbaAfterStateChange(discordClient, messageId, game) {
  await chkobbaUpdatePublicView(discordClient, messageId, game);

  if (game.finished) {
    chkobbaCleanupGame(messageId);
    return;
  }

  chkobbaScheduleTimeout(discordClient, messageId);

  if (game.currentPlayerId === CHKOBBA_AI_ID) {
    chkobbaMaybePlayAiTurn(discordClient, messageId);
  }
}

// ---------- المعالج الرئيسي لتفاعلات الشكوبة ----------
async function chkobbaHandleInteraction(interaction) {
  try {
    // ── أمر /chkobba: أول خطوة اختيار عدد اللاعبين ──
    if (interaction.isChatInputCommand() && interaction.commandName === CHKOBBA_COMMAND_NAME) {
      if (chkobbaManager.isUserBusy(interaction.user.id)) {
        await interaction.reply({ content: '⚠️ أنت بالفعل في لعبة أو غرفة انتظار شكوبة جارية!', ephemeral: true });
        return true;
      }

      const support = chkobbaCheckThreadSupport(interaction.channel, interaction.guild.members.me);
      if (!support.ok) {
        await interaction.reply({ content: chkobbaThreadSupportErrorMessage(support.reason), ephemeral: true });
        return true;
      }

      const hostId = interaction.user.id;
      await interaction.reply({ embeds: [chkobbaBuildCountSelectEmbed(hostId)], components: [chkobbaBuildCountSelectRow(hostId)] });
      return true;
    }

    const customId = interaction.customId;
    if (!customId || !customId.startsWith('chkobba_')) return false;

    // ── اختيار عدد اللاعبين ──
    if (interaction.isButton() && customId.startsWith('chkobba_count_')) {
      const rest = chkobbaParseAfterPrefix(customId, 'chkobba_count_');
      const sepIdx = rest.indexOf('_');
      const n = parseInt(rest.slice(0, sepIdx), 10);
      const hostId = rest.slice(sepIdx + 1);

      if (interaction.user.id !== hostId) {
        await interaction.reply({ content: '❌ هذا الاختيار لصاحب الطلب فقط.', ephemeral: true });
        return true;
      }
      if (chkobbaManager.isUserBusy(hostId)) {
        await interaction.reply({ content: '⚠️ أنت بالفعل في لعبة أو غرفة انتظار.', ephemeral: true });
        return true;
      }

      if (n === 1) {
        await interaction.update({ content: '⏳ جاري تجهيز اللعبة ضد البوت...', embeds: [], components: [] });
        const msg = await interaction.fetchReply();
        chkobbaGameChannels.set(msg.id, interaction.channelId);
        const game = chkobbaManager.startGame(msg.id, [hostId, CHKOBBA_AI_ID]);
        chkobbaScheduleTimeout(interaction.client, msg.id);
        const failedIds = await chkobbaSyncAllPlayerThreads(interaction.client, msg.id, game);
        const view = await chkobbaBuildPublicGameView(game, msg.id, failedIds);
        await interaction.editReply({ content: null, ...view });
        return true;
      }

      await interaction.update({ content: '⏳ جاري إنشاء غرفة الانتظار...', embeds: [], components: [] });
      const msg = await interaction.fetchReply();
      chkobbaGameChannels.set(msg.id, interaction.channelId);
      const lobby = chkobbaManager.registerLobby(msg.id, hostId, interaction.channelId, n);
      await interaction.editReply({ content: null, embeds: [chkobbaBuildLobbyEmbed(lobby)], components: [chkobbaBuildJoinRow(msg.id)] });
      return true;
    }

    // ── زر "انضمام" لغرفة الانتظار ──
    if (interaction.isButton() && customId.startsWith('chkobba_lobbyjoin_')) {
      const messageId = chkobbaParseAfterPrefix(customId, 'chkobba_lobbyjoin_');
      const lobby = chkobbaManager.getLobby(messageId);

      if (!lobby) {
        await interaction.reply({ content: '❌ غرفة الانتظار هذه لم تعد متاحة.', ephemeral: true });
        return true;
      }
      const uid = interaction.user.id;
      if (lobby.joined.includes(uid)) {
        await interaction.reply({ content: '✅ أنت منضم بالفعل، استنى بقية اللاعبين.', ephemeral: true });
        return true;
      }
      if (chkobbaManager.isUserBusy(uid)) {
        await interaction.reply({ content: '⚠️ أنت بالفعل في لعبة أو غرفة انتظار أخرى.', ephemeral: true });
        return true;
      }

      lobby.joined.push(uid);

      if (lobby.joined.length < lobby.targetCount) {
        await interaction.update({ embeds: [chkobbaBuildLobbyEmbed(lobby)], components: [chkobbaBuildJoinRow(messageId)] });
        return true;
      }

      // اكتمل عدد اللاعبين — ابدأ اللعبة
      chkobbaManager.removeLobby(messageId);
      const game = chkobbaManager.startGame(messageId, lobby.joined);
      chkobbaScheduleTimeout(interaction.client, messageId);
      const failedIds = await chkobbaSyncAllPlayerThreads(interaction.client, messageId, game);
      const view = await chkobbaBuildPublicGameView(game, messageId, failedIds);
      await interaction.update(view);
      return true;
    }

    // ── زر "عرض يدي واللعب" ──
    if (interaction.isButton() && customId.startsWith('chkobba_hand_')) {
      const messageId = chkobbaParseAfterPrefix(customId, 'chkobba_hand_');
      const game = chkobbaManager.getGame(messageId);

      if (!game || game.finished) {
        await interaction.reply({ content: '❌ لا توجد لعبة نشطة هنا.', ephemeral: true });
        return true;
      }
      if (!game.isParticipant(interaction.user.id)) {
        await interaction.reply({ content: '⛔ هذه ليست لعبتك، لا يمكنك المشاركة فيها!', ephemeral: true });
        return true;
      }
      if (interaction.user.id !== game.currentPlayerId) {
        await interaction.reply({ content: '⏳ ليس دورك الآن، انتظر خصمك.', ephemeral: true });
        return true;
      }

      const view = await chkobbaBuildHandView(game, interaction.user.id, messageId);
      await interaction.reply({ ...view, ephemeral: true });
      return true;
    }

    // ── زر "الانسحاب" ──
    if (interaction.isButton() && customId.startsWith('chkobba_quit_')) {
      const messageId = chkobbaParseAfterPrefix(customId, 'chkobba_quit_');
      const game = chkobbaManager.getGame(messageId);

      if (!game || game.finished) {
        await interaction.reply({ content: '❌ لا توجد لعبة نشطة هنا.', ephemeral: true });
        return true;
      }
      if (!game.isParticipant(interaction.user.id)) {
        await interaction.reply({ content: '⛔ هذه ليست لعبتك!', ephemeral: true });
        return true;
      }

      game.abort('left', interaction.user.id);
      await interaction.deferUpdate();
      await chkobbaUpdatePublicView(interaction.client, messageId, game);
      await chkobbaCloseAllPlayerThreads(interaction.client, messageId, game);
      chkobbaCleanupGame(messageId);
      return true;
    }

    // ── أزرار اختيار البطاقة للعب (كل بطاقة زر منفصل) ──
    if (interaction.isButton() && customId.startsWith('chkobba_play_')) {
      const rest = chkobbaParseAfterPrefix(customId, 'chkobba_play_');
      const sepIdx = rest.indexOf('_');
      const messageId = rest.slice(0, sepIdx);
      const cardId = rest.slice(sepIdx + 1);

      const game = chkobbaManager.getGame(messageId);

      if (!game || game.finished) {
        await interaction.update({ content: '❌ لا توجد لعبة نشطة.', embeds: [], components: [], files: [] });
        return true;
      }
      if (!game.isParticipant(interaction.user.id) || interaction.user.id !== game.currentPlayerId) {
        await chkobbaSafeReplyEphemeral(interaction, '⛔ لا يمكنك التصرف في هذه اللعبة الآن.');
        return true;
      }

      const preview = game.previewCaptureOptions(cardId);
      if (!preview) {
        await interaction.update({ content: '❌ ورقة غير صالحة.', embeds: [], components: [], files: [] });
        return true;
      }

      if (preview.options.length > 1) {
        chkobbaPendingCombos.set(`${messageId}:${interaction.user.id}`, { cardId, options: preview.options });
        const combo = chkobbaBuildComboSelect(messageId, cardId, preview.options);
        await interaction.update({ ...combo, files: [] });
        return true;
      }

      game.playCard(interaction.user.id, cardId, 0);
      await interaction.deferUpdate();

      await chkobbaAfterStateChange(interaction.client, messageId, game);
      return true;
    }

    // ── قائمة اختيار التوليفة عند تعدد خيارات الأخذ ──
    if (interaction.isStringSelectMenu() && customId.startsWith('chkobba_combo_')) {
      const rest = chkobbaParseAfterPrefix(customId, 'chkobba_combo_');
      const sepIdx = rest.indexOf('_');
      const messageId = rest.slice(0, sepIdx);
      const cardId = rest.slice(sepIdx + 1);

      const game = chkobbaManager.getGame(messageId);
      if (!game || game.finished) {
        await interaction.update({ content: '❌ لا توجد لعبة نشطة.', embeds: [], components: [] });
        return true;
      }
      if (!game.isParticipant(interaction.user.id) || interaction.user.id !== game.currentPlayerId) {
        await chkobbaSafeReplyEphemeral(interaction, '⛔ لا يمكنك التصرف في هذه اللعبة الآن.');
        return true;
      }

      const key = `${messageId}:${interaction.user.id}`;
      chkobbaPendingCombos.delete(key);
      const comboIndex = parseInt(interaction.values[0], 10) || 0;

      game.playCard(interaction.user.id, cardId, comboIndex);
      await interaction.deferUpdate();

      await chkobbaAfterStateChange(interaction.client, messageId, game);
      return true;
    }

    return false;
  } catch (err) {
    console.error('❌ خطأ في وحدة الشكوبة:', err);
    await chkobbaSafeReplyEphemeral(interaction, '⚠️ حدث خطأ غير متوقع في اللعبة.');
    return true;
  }
}
// =====================================================================
// ================ نهاية قسم لعبة الشكوبة التونسية ================
// =====================================================================

// =================== أخطاء ===================
client.on('error', err => console.error('❌ كلاينت:', err.message));
process.on('unhandledRejection', err => console.error('❌ غير معالج:', err?.message ?? err));

// =================== جاهز ===================
client.once('ready', async () => {
  console.log(`✅ البوت شغال: ${client.user.tag}`);
  startVoiceXpInterval();
  scheduleNextGG();
  for (const guild of client.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();
      const map = new Map();
      invites.forEach(inv => map.set(inv.code, inv.uses));
      inviteCache.set(guild.id, map);
    } catch {}
  }

  // تسجيل أمر /chkobba
  await chkobbaRegisterCommands(client);
});

// =================== إشعار اللفل أب ===================
async function sendLevelUp(guild, userId, newLevel) {
  try {
    const channel = await guild.channels.fetch(LEVEL_CHANNEL_ID);
    if (!channel) return;
    await channel.send({
      content: `🎉 مبروك <@${userId}>! وصلت للفل **${newLevel}** 🚀`,
      files: [{ attachment: LEVEL_UP_IMAGE, name: 'levelup.jpg' }]
    });
  } catch {}
}

// =================== XP الصوت ===================
function startVoiceXpInterval() {
  if (voiceXpInterval) return;
  voiceXpInterval = setInterval(async () => {
    for (const [guildId, guild] of client.guilds.cache) {
      for (const [, member] of guild.members.cache) {
        if (!member.voice.channelId) continue;
        const result = money.addXp(member.id, guildId, XP_PER_VOICE_MIN);
        if (result?.leveledUp) await sendLevelUp(guild, member.id, result.newLevel);
      }
    }
  }, 60_000);
}

// =================== دعوة جديدة ===================
client.on('inviteCreate', inv => {
  const map = inviteCache.get(inv.guild.id) || new Map();
  map.set(inv.code, inv.uses);
  inviteCache.set(inv.guild.id, map);
});

// =================== عضو جديد ===================
client.on('guildMemberAdd', async member => {
  try {
    const newInvites = await member.guild.invites.fetch();
    const oldMap     = inviteCache.get(member.guild.id) || new Map();
    let usedInvite   = null;
    for (const [code, inv] of newInvites) {
      if ((inv.uses ?? 0) > (oldMap.get(code) ?? 0)) { usedInvite = inv; break; }
    }
    const newMap = new Map();
    newInvites.forEach(inv => newMap.set(inv.code, inv.uses));
    inviteCache.set(member.guild.id, newMap);
    if (usedInvite?.inviter) {
      money.addBalance(usedInvite.inviter.id, member.guild.id, MONEY_PER_INVITE);
      usedInvite.inviter.send(
        `🎉 دعوت **${member.user.username}** للسيرفر! حصلت على **${fmt(MONEY_PER_INVITE)}** 💰`
      ).catch(() => {});
    }
  } catch {}
});

// =================== مكافأة البوست ===================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const wasBoosting = !!oldMember.premiumSince;
    const isBoosting  = !!newMember.premiumSince;
    if (!wasBoosting && isBoosting) {
      money.addBalance(newMember.id, newMember.guild.id, 3);
      const channel = newMember.guild.channels.cache.find(
        c => c.isTextBased() && c.permissionsFor(newMember.guild.members.me)?.has('SendMessages')
      );
      if (channel) {
        await channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff73fa)
            .setTitle('💎 شكراً على البوست!')
            .setDescription(
              `<@${newMember.id}> 🚀 ضاف Boost للسيرفر!\n` +
              `حصل على **3.00 IND** كمكافأة 💰\n\n` +
              `شكراً لدعمك للسيرفر! ❤️`
            )
            .setThumbnail(newMember.user.displayAvatarURL({ extension: 'png' }))
            .setFooter({ text: 'IYNexx DOLLAR • Boost Reward' })
            .setTimestamp()]
        }).catch(() => {});
      }
      newMember.send(`🚀 شكراً على البوست! حصلت على **3.00 IND** 💰`).catch(() => {});
    }
  } catch {}
});

// =================== صوت ===================
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId  = newState.id || oldState.id;
  const guildId = (newState.guild || oldState.guild)?.id;
  if (!userId || !guildId) return;
  if (!oldState.channelId && newState.channelId) {
    money.startVoiceSession(userId, guildId);
  } else if (oldState.channelId && !newState.channelId) {
    const hours = money.endVoiceSession(userId, guildId);
    if (hours > 0) money.addBalance(userId, guildId, hours * MONEY_PER_VOICE_HOUR);
  }
});

// =================== رسائل ===================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const userId  = message.author.id;
  const guildId = message.guild.id;
  const now     = Date.now();
  const content = message.content.trim();

  // ── Anti-Spam ──
  const muteUntil = mutedUsers.get(userId);
  if (muteUntil) {
    if (now < muteUntil) {
      await message.delete().catch(() => {});
      return;
    }
    mutedUsers.delete(userId);
  }

  const spam = spamTracker.get(userId) || { count: 0, firstMsg: now };
  if (now - spam.firstMsg > SPAM_WINDOW_MS) {
    spam.count = 1; spam.firstMsg = now;
  } else {
    spam.count++;
  }
  spamTracker.set(userId, spam);

  if (spam.count >= SPAM_MSG_COUNT) {
    spamTracker.delete(userId);
    mutedUsers.set(userId, now + SPAM_MUTE_MS);
    await message.delete().catch(() => {});
    try {
      await message.channel.send({
        content: `<@${userId}>`,
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🔇 تم كتمك لساعة!')
          .setDescription(
            `> ⚠️ <@${userId}> تم اكتشاف **سبام**!\n` +
            `> 🔇 لن تستطيع إرسال رسائل لمدة **ساعة كاملة**.\n\n` +
            `*تجنب إرسال رسائل كثيرة بشكل متتالي.*`
          )
          .setFooter({ text: 'IYNexx Anti-Spam System' })
          .setTimestamp()]
      });
    } catch {}
    return;
  }

  // مال تلقائي
  const cdKey = `${guildId}-${userId}`;
  const last  = msgCooldowns.get(cdKey) || 0;
  if (now - last >= MSG_MONEY_CD_MS) {
    msgCooldowns.set(cdKey, now);
    money.addBalance(userId, guildId, MONEY_PER_MESSAGE);
  }

  // XP
  const xpKey  = `xp-${guildId}-${userId}`;
  const lastXp = xpMsgCooldowns.get(xpKey) || 0;
  if (now - lastXp >= XP_MSG_CD_MS) {
    xpMsgCooldowns.set(xpKey, now);
    const xpResult = money.addXp(userId, guildId, XP_PER_MESSAGE);
    if (xpResult?.leveledUp) await sendLevelUp(message.guild, userId, xpResult.newLevel);
  }

  // ── GG ──
  if (content.toUpperCase() === 'GG') {
    if (now < ggActiveUntil && !ggWinners.has(userId)) {
      ggWinners.add(userId);
      money.addBalance(userId, guildId, GG_PRIZE);
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🏆 GG! فزت!')
          .setDescription(`<@${userId}> كان الأسرع! ربح **${fmt(GG_PRIZE)}** 💰 🎉`)
          .setFooter({ text: 'IYNexx • GG Challenge' })
          .setTimestamp()]
      });
    }
  }

  // ── /MT: رفع الكتم (أدمن) ──
  if (content.startsWith('/MT:')) {
    if (!isAdmin(message.member))
      return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });

    const mentioned = message.mentions.users.first();
    if (!mentioned)
      return message.reply({ content: '⚠️ مثال: `/MT: @اسم`' });

    if (!mutedUsers.has(mentioned.id)) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xe67e22)
          .setDescription(`⚠️ <@${mentioned.id}> غير مكتوم أصلاً!`)]
      });
    }

    mutedUsers.delete(mentioned.id);
    spamTracker.delete(mentioned.id);
    await message.delete().catch(() => {});
    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🔊 تم رفع الكتم')
        .setDescription(`✅ تم رفع الكتم عن <@${mentioned.id}> بواسطة الأدمن.`)
        .setFooter({ text: 'IYNexx Anti-Spam System' })
        .setTimestamp()]
    });
  }

  // ── /level ──
  if (content.startsWith('/level')) {
    const target = message.mentions.users.first() || message.author;
    const data   = money.getLevelData(target.id, guildId);
    const filled = Math.floor((data.xp / data.xpNeeded) * 10);
    const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`⭐ لفل ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ extension: 'png' }))
        .addFields(
          { name: '🏆 اللفل الحالي', value: `**${data.level}**`, inline: true },
          { name: '✨ XP', value: `**${Math.floor(data.xp)} / ${data.xpNeeded}**`, inline: true },
          { name: '📊 التقدم', value: `\`${bar}\``, inline: false },
        )
        .setFooter({ text: 'IYNexx Level System' })]
    });
  }

  // ── /$ ──
  if (content === '/$') {
    const bal = money.getBalance(userId, guildId);
    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('💰 رصيدك')
        .setDescription(`**${fmt(bal)}**`)
        .setThumbnail(message.author.displayAvatarURL({ extension: 'png' }))
        .setFooter({ text: 'IYNexx DOLLAR' })]
    });
  }

  // ── /daily ──
  if (content === '/daily') {
    const result = money.claimDaily(userId, guildId);
    if (!result.ok) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('⏳ المكافأة اليومية')
          .setDescription(`خذت مكافأتك اليوم! تنجم ترجع بعد:\n**${fmtTime(result.nextIn)}**`)
          .setFooter({ text: 'IYNexx Daily Reward • تلقائية كل 24 ساعة' })]
      });
    }
    const streakMsg = result.streak >= 7
      ? `🔥 سلسلة ${result.streak} يوم — استمر!`
      : result.streak > 1 ? `⚡ ${result.streak} أيام متتالية` : '📅 أول يوم — ارجع باكر!';
    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🎁 مكافأة يومية!')
        .setDescription(`حصلت على **${fmt(result.amount)}** 💰\n${streakMsg}`)
        .addFields(
          { name: '💼 رصيدك الآن', value: `**${fmt(money.getBalance(userId, guildId))}**`, inline: true },
          { name: '🔥 السلسلة', value: `**${result.streak} يوم**`, inline: true },
        )
        .setFooter({ text: 'IYNexx Daily Reward • تتجدد كل 24 ساعة تلقائياً' })
        .setTimestamp()]
    });
  }

  // ── /transfer ──
  if (content.startsWith('/transfer')) {
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply({ content: '⚠️ مثال: `/transfer @iyed 5`' });
    if (mentioned.id === userId) return message.reply({ content: '❌ ما تقدر تحول لنفسك!' });
    const parts  = content.split(/\s+/);
    const amount = parseFloat(parts[parts.length - 1]);
    if (isNaN(amount) || amount < 0.01)
      return message.reply({ content: '⚠️ أدخل مبلغاً صحيحاً (الحد الأدنى 0.01)!' });
    const result = money.transferBalance(userId, mentioned.id, guildId, amount);
    if (!result.ok) {
      const reasons = {
        self: '❌ ما تقدر تحول لنفسك!',
        invalid_amount: '⚠️ المبلغ غير صحيح!',
        insufficient: `❌ رصيدك ما يكفي! رصيدك: **${fmt(money.getBalance(userId, guildId))}**`,
        error: '❌ صار خطأ، حاول مرة ثانية.',
      };
      return message.reply({ content: reasons[result.reason] || '❌ فشل التحويل.' });
    }
    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('💸 تم التحويل بنجاح!')
        .addFields(
          { name: '📤 أرسلت إلى', value: `<@${mentioned.id}>`, inline: true },
          { name: '💰 المبلغ', value: `**${fmt(amount)}**`, inline: true },
          { name: '👤 رصيدك الآن', value: `**${fmt(result.newFromBal)}**`, inline: true },
        )
        .setFooter({ text: 'IYNexx DOLLAR Transfer' })
        .setTimestamp()]
    });
  }

  // ── /$:@mention ──
  if (content.startsWith('/$:')) {
    if (!isAdmin(message.member)) return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply({ content: '⚠️ مثال: `/$:@اسم 5`' });
    const parts  = content.split(/\s+/);
    const amount = parseFloat(parts[parts.length - 1]);
    if (isNaN(amount) || amount <= 0) return message.reply({ content: '⚠️ أدخل مبلغاً صحيحاً!' });
    money.addBalance(mentioned.id, guildId, amount);
    const newBal = money.getBalance(mentioned.id, guildId);
    await message.delete().catch(() => {});
    return message.channel.send({
      embeds: [new EmbedBuilder().setColor(0x2ecc71)
        .setDescription(`✅ تمت إضافة **${fmt(amount)}** لـ <@${mentioned.id}>\nرصيده الآن: **${fmt(newBal)}**`)]
    });
  }

  // ── /-$:@mention ──
  if (content.startsWith('/-$:')) {
    if (!isAdmin(message.member)) return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply({ content: '⚠️ مثال: `/-$:@اسم 5`' });
    const parts  = content.split(/\s+/);
    const amount = parseFloat(parts[parts.length - 1]);
    if (isNaN(amount) || amount <= 0) return message.reply({ content: '⚠️ أدخل مبلغاً صحيحاً!' });
    const ok = money.deductBalance(mentioned.id, guildId, amount);
    if (!ok) return message.reply({ content: `❌ رصيد <@${mentioned.id}> لا يكفي!` });
    const newBal = money.getBalance(mentioned.id, guildId);
    await message.delete().catch(() => {});
    return message.channel.send({
      embeds: [new EmbedBuilder().setColor(0xe74c3c)
        .setDescription(`✅ تم سحب **${fmt(amount)}** من <@${mentioned.id}>\nرصيده الآن: **${fmt(newBal)}**`)]
    });
  }

  // ── /TR: ──
  if (content.startsWith('/TR:')) {
    if (!isAdmin(message.member)) return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });
    const accMatch   = content.match(/\(([^)]*)\)\s*$/);
    const accStr     = accMatch ? accMatch[1] : '';
    const mainPart   = accMatch ? content.slice(0, accMatch.index).trim() : content;
    const titleMatch = mainPart.match(/\/TR:"([^"]+)"/);
    const dsMatch    = mainPart.match(/DS:"([^"]+)"/);
    const imgMatch   = mainPart.match(/IMG:"([^"]+)"/);
    const smMatch    = mainPart.match(/SM:"([^"]+)"/);
    if (!titleMatch || !dsMatch || !smMatch)
      return message.reply({ content: '⚠️ `/TR:"العنوان"-DS:"الوصف"-SM:"السعر"(name:01/psw:123)`' });
    const title    = titleMatch[1];
    const desc     = dsMatch[1];
    const imageUrl = imgMatch ? imgMatch[1] : '';
    const price    = parseFloat(smMatch[1]);
    const accounts = parseAccounts(accStr);
    if (isNaN(price) || price <= 0) return message.reply({ content: '⚠️ السعر يجب أن يكون رقماً موجباً!' });
    if (accounts.length === 0) return message.reply({ content: '⚠️ أضف حسابات بالصيغة الصحيحة!' });
    const productId = randomUUID();
    money.createProduct(productId, guildId, { title, description: desc, imageUrl, price, accounts });
    const product = money.getProduct(productId);
    const buyBtn  = new ButtonBuilder().setCustomId(`buy_${productId}`).setLabel(`🛒 شراء — ${fmt(price)}`).setStyle(ButtonStyle.Success);
    const sent    = await message.channel.send({ embeds: [buildShopEmbed(product, false)], components: [new ActionRowBuilder().addComponents(buyBtn)] });
    money.updateProductMessage(productId, sent.id, sent.channelId);
    await message.delete().catch(() => {});
    return;
  }

  // ── /$$top ──
  if (content === '/$$top') {
    const top = money.getAllBalances(guildId);
    if (top.length === 0) return message.reply({ content: '❌ لا يوجد بيانات بعد!' });
    const medals = ['🥇', '🥈', '🥉'];
    const lines  = top.map((row, i) => `${medals[i] || `**${i + 1}.**`} <@${row.userId}> — **${fmt(row.balance)}**`);
    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('💰 أغنى 10 أعضاء في السيرفر')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'IYNexx DOLLAR Leaderboard' })
        .setTimestamp()]
    });
  }

  // ── slot — زر ابدأ ──
  if (content === 'slot') {
    const slotData  = getSlotData(userId, guildId);
    const remaining = SLOT_MAX_PER_HR - slotData.count;

    if (remaining <= 0) {
      const msLeft = slotData.resetAt - Date.now();
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🎰 Slot Machine — انتهت المحاولات')
          .setDescription(
            `> ⛔ استنفذت **${SLOT_MAX_PER_HR} محاولات** هذه الساعة.\n` +
            `> ⏳ تنجم تلعب مرة ثانية بعد: **${fmtTime(msLeft)}**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `> 🕌 **تذكير ديني:**\n` +
            `> هذه اللعبة **ترفيه فقط** داخل السيرفر ولا مال حقيقي فيها.\n` +
            `> أما **القمار الحقيقي** فهو **حرام** بنص القرآن الكريم:\n` +
            `> *﴿ إِنَّمَا الْخَمْرُ وَالْمَيْسِرُ وَالْأَنصَابُ وَالْأَزْلَامُ رِجْسٌ مِّنْ عَمَلِ الشَّيْطَانِ فَاجْتَنِبُوهُ ﴾*\n` +
            `> احرص على دينك ودنياك، ولا تقرب القمار الحقيقي أبداً. 🙏`
          )
          .setFooter({ text: 'IYNexx Slot Machine' })]
      });
    }

    const bal = money.getBalance(userId, guildId);
    const startBtn = new ButtonBuilder()
      .setCustomId(`slot_start_${userId}`)
      .setLabel(`🎰 ابدأ اللعب — ${fmt(SLOT_BET)}`)
      .setStyle(ButtonStyle.Primary);

    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🎰 Slot Machine')
        .setDescription(
          `\n  🍒  ❓  ❓  ❓  🍒  \n\n` +
          `> 💰 **التكلفة:** ${fmt(SLOT_BET)} لكل لعبة\n` +
          `> 🏆 **الجائزة:** ${fmt(SLOT_PRIZE)} عند التطابق\n` +
          `> 🎯 **فرصة الفوز:** 20%\n` +
          `> 🎮 **محاولاتك المتبقية:** ${remaining}/${SLOT_MAX_PER_HR} هذه الساعة\n` +
          `> 💼 **رصيدك:** ${fmt(bal)}`
        )
        .setFooter({ text: 'IYNexx Slot Machine • اضغط ابدأ للعب' })],
      components: [new ActionRowBuilder().addComponents(startBtn)]
    });
  }

  // ── /BN ──
  if (content === '/BN') {
    const btn = new ButtonBuilder().setCustomId('join_voice').setLabel('⚽ • بث المباراة هنا • ⚽').setStyle(ButtonStyle.Success);
    await message.channel.send({ content: '||@everyone||', components: [new ActionRowBuilder().addComponents(btn)] });
    await message.delete().catch(() => {});
  }

  // ── /your.country ──
  if (content === '/your.country') {
    const embed = new EmbedBuilder()
      .setColor(0x1a56db).setImage(IMAGE_URL)
      .setTitle('🏆 كأس العالم 2026')
      .setDescription('**اضغط على الزر أدناه واختر منتخبك**\n\n*اختر نفس المنتخب مرة ثانية لإزالة الرتبة*');
    const btn = new ButtonBuilder().setCustomId('open_country_select').setLabel('🌍 اختر دولتك').setStyle(ButtonStyle.Primary);
    await message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
    await message.delete().catch(() => {});
  }

  // ── /Tn: ──
  if (content.startsWith('/Tn:')) {
    if (!message.member.permissions.has('Administrator')) return message.reply({ content: '❌ هذا الأمر للأدمن فقط!' });
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply({ content: '⚠️ مثال: `/Tn: @iyed`' });
    await message.delete().catch(() => {});
    await message.channel.send({
      content: `||@everyone|| | <@${mentioned.id}>\n\n⚠️ **تحذير رسمي** ⚠️\n\n> 🚨 <@${mentioned.id}> **أنت تخالف قوانين السيرفر**\n> ⚡ هذا تحذير رسمي، الاستمرار يعرضك للطرد!`
    });
  }

  // ── /BOT: ──
  if (content.startsWith('/BOT:')) {
    if (!isAdmin(message.member)) return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });
    const text = content.slice(5).trim();
    if (!text) return message.reply({ content: '⚠️ اكتب رسالة بعد `/BOT:`' });
    await message.delete().catch(() => {});
    await message.channel.send({ content: text });
    return;
  }

  // ── /help ──
  if (content === '/help') {
    if (!message.member.permissions.has('Administrator')) return message.reply({ content: '❌ هذا الأمر للأدمن فقط!' });
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🤖 أوامر البوت')
      .setDescription('━━━━━━━━━━━━━━━━━━━━━━')
      .addFields(
        { name: '⚽ `/BN`',                   value: 'يرسل زر بث المباراة مع @everyone' },
        { name: '🏆 `/your.country`',         value: 'يرسل زر اختيار المنتخب' },
        { name: '⚠️ `/Tn: @شخص`',            value: 'يرسل تحذير رسمي (أدمن)' },
        { name: '📢 `/BOT: رسالة`',          value: 'البوت يرسل الرسالة بدلك (أدمن/قائد)' },
        { name: '🔧 `/help`',                 value: 'يعرض هذه القائمة (أدمن)' },
        { name: '🔊 `/MT: @شخص`',            value: 'رفع الكتم عن شخص مكتوم (أدمن/قائد)' },
        { name: '💰 `/$`',                    value: 'عرض رصيدك — للجميع' },
        { name: '🎁 `/daily`',               value: 'مكافأة يومية 0.01 IND تلقائية كل 24 ساعة — للجميع' },
        { name: '💸 `/transfer @شخص مبلغ`', value: 'تحويل مال لعضو آخر — للجميع' },
        { name: '⭐ `/level`',                value: 'عرض لفلك أو لفل شخص آخر — للجميع' },
        { name: '🏆 `/$$top`',               value: 'أغنى 10 أعضاء في السيرفر — للجميع' },
        { name: '🎰 `slot`',                 value: `السلوت! ${fmt(SLOT_BET)} للعب، اربح ${fmt(SLOT_PRIZE)} — 20% فوز — ${SLOT_MAX_PER_HR} محاولات/ساعة` },
        { name: '🏆 `GG`',                   value: `اكتبها أول واحد عند التحدي وتربح ${fmt(GG_PRIZE)} — مرتين يومياً` },
        { name: '➕ `/$:@شخص مبلغ`',         value: 'إضافة مال (أدمن/قائد)' },
        { name: '➖ `/-$:@شخص مبلغ`',        value: 'سحب مال (أدمن/قائد)' },
        { name: '🛒 `/TR:"عنوان"-DS:"وصف"-IMG:"رابط"-SM:"سعر"(حسابات)`',
          value: 'إنشاء منتج — (أدمن/قائد)\nمثال: `(name:01/psw:123,name:02/psw:456)`' },
        { name: '🃏 `/chkobba`',              value: 'ابدأ لعبة شكوبة تونسية (Slash Command) — 1 ضد بوت 🤖 أو 2/3/4 لاعبين — للجميع' },
      );
    await message.channel.send({ embeds: [embed] });
    await message.delete().catch(() => {});
  }
});

// =================== التفاعلات ===================
client.on('interactionCreate', async (interaction) => {

  // تفويض تفاعلات الشكوبة أولاً
  if (await chkobbaHandleInteraction(interaction)) return;

  // ── زر slot_start ──
  if (interaction.isButton() && interaction.customId.startsWith('slot_start_')) {
    const ownerId = interaction.customId.split('_')[2];
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;

    if (userId !== ownerId)
      return interaction.reply({ content: '❌ هذا الزر مو لك!', ephemeral: true });

    await interaction.deferUpdate();

    const slotData  = getSlotData(userId, guildId);
    const remaining = SLOT_MAX_PER_HR - slotData.count;

    if (remaining <= 0) {
      const msLeft = slotData.resetAt - Date.now();
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🎰 Slot Machine — انتهت المحاولات')
          .setDescription(
            `> ⛔ استنفذت **${SLOT_MAX_PER_HR} محاولات** هذه الساعة.\n` +
            `> ⏳ تنجم تلعب بعد: **${fmtTime(msLeft)}**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `> 🕌 **تذكير ديني:**\n` +
            `> هذه اللعبة **ترفيه فقط** ولا مال حقيقي فيها.\n` +
            `> **القمار الحقيقي حرام** بنص القرآن الكريم.\n` +
            `> احرص على دينك ولا تقرب القمار أبداً. 🙏`
          )
          .setFooter({ text: 'IYNexx Slot Machine' })],
        components: []
      });
    }

    const bal = money.getBalance(userId, guildId);
    if (bal < SLOT_BET) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🎰 Slot Machine')
          .setDescription(`❌ رصيدك ما يكفي!\nتحتاج **${fmt(SLOT_BET)}** للعب.\nرصيدك: **${fmt(bal)}**`)
          .setFooter({ text: 'IYNexx Slot Machine' })],
        components: []
      });
    }

    money.deductBalance(userId, guildId, SLOT_BET);
    incrementSlotAttempts(userId, guildId);

    const SYMBOLS = ['🍒', '🍋', '🍇', '💎', '⭐', '🔔', '7️⃣'];
    const isWin   = Math.random() < SLOT_WIN_PCT;
    let reels;
    if (isWin) {
      const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      reels = [sym, sym, sym];
    } else {
      do {
        reels = Array.from({ length: 3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
      } while (reels[0] === reels[1] && reels[1] === reels[2]);
    }

    const newData      = getSlotData(userId, guildId);
    const newRemaining = SLOT_MAX_PER_HR - newData.count;
    const components   = [];

    if (newRemaining > 0) {
      components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`slot_start_${userId}`)
          .setLabel(`🎰 العب مرة ثانية (${newRemaining} متبقية)`)
          .setStyle(ButtonStyle.Secondary)
      ));
    }

    if (isWin) {
      money.addBalance(userId, guildId, SLOT_PRIZE);
      const newBal = money.getBalance(userId, guildId);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle('🎰 Slot Machine — 🎉 فزت!')
          .setDescription(
            `\n  ${reels[0]}  ║  ${reels[1]}  ║  ${reels[2]}  \n\n` +
            `✨ **ثلاثة متطابقة! جاكبوت!**\n💰 ربحت **${fmt(SLOT_PRIZE)}**`
          )
          .addFields(
            { name: '💼 رصيدك الآن',    value: `**${fmt(newBal)}**`,                  inline: true },
            { name: '📈 صافي الربح',    value: `**+${fmt(SLOT_PRIZE - SLOT_BET)}**`,  inline: true },
            { name: '🎮 متبقية/ساعة',  value: `**${newRemaining}/${SLOT_MAX_PER_HR}**`, inline: true },
          )
          .setFooter({ text: 'IYNexx Slot Machine • فرصة الفوز 20%' })
          .setTimestamp()],
        components
      });
    } else {
      const newBal      = money.getBalance(userId, guildId);
      const warningField = newRemaining <= 0 ? [{
        name: '🕌 تذكير مهم',
        value: '> يكفيك هذه الساعة! 🛑\n> **القمار الحقيقي حرام** — هذا مجرد ترفيه داخل السيرفر.\n> احرص على دينك ولا تقرب القمار أبداً. 🙏',
        inline: false
      }] : [];
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(newRemaining <= 0 ? 0xe74c3c : 0x95a5a6)
          .setTitle('🎰 Slot Machine — 😔 خسرت')
          .setDescription(
            `\n  ${reels[0]}  ║  ${reels[1]}  ║  ${reels[2]}  \n\n` +
            `💨 **حظاً أوفر!**`
          )
          .addFields(
            { name: '💼 رصيدك الآن',   value: `**${fmt(newBal)}**`,                  inline: true },
            { name: '📉 الخسارة',       value: `**-${fmt(SLOT_BET)}**`,               inline: true },
            { name: '🎮 متبقية/ساعة', value: `**${newRemaining}/${SLOT_MAX_PER_HR}**`, inline: true },
            ...warningField
          )
          .setFooter({ text: 'IYNexx Slot Machine • فرصة الفوز 20%' })
          .setTimestamp()],
        components
      });
    }
    return;
  }

  // ── زر شراء ──
  if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
    const productId = interaction.customId.slice(4);
    const userId    = interaction.user.id;
    const guildId   = interaction.guildId;
    await interaction.deferReply({ ephemeral: true });
    const product = money.getProduct(productId);
    if (!product) return interaction.editReply({ content: '❌ المنتج غير موجود!' });
    if (product.soldOut || product.accounts.every(a => a.sold)) {
      await _markSoldOut(interaction.client, product, productId);
      return interaction.editReply({ content: '❌ عذراً، نفد المخزون!' });
    }
    const bal = money.getBalance(userId, guildId);
    if (bal < product.price)
      return interaction.editReply({ content: `❌ رصيدك غير كافٍ!\nرصيدك: **${fmt(bal)}** | السعر: **${fmt(product.price)}**` });
    money.deductBalance(userId, guildId, product.price);
    const account = money.purchaseProduct(productId);
    if (!account) {
      money.addBalance(userId, guildId, product.price);
      await _markSoldOut(interaction.client, product, productId);
      return interaction.editReply({ content: '❌ نفد المخزون للتو، تم إعادة رصيدك!' });
    }
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x2ecc71).setTitle('✅ تم الشراء بنجاح!')
        .setDescription(`شكراً لشرائك **${product.title}**\n\nمعلومات حسابك:`)
        .addFields(
          { name: '👤 اسم المستخدم', value: `\`${account.name}\``, inline: true },
          { name: '🔑 كلمة المرور',  value: `\`${account.psw}\``,  inline: true },
        )
        .setFooter({ text: `خُصم ${fmt(product.price)} من رصيدك` })]
    });
    await _refreshShopMessage(interaction.client, money.getProduct(productId), productId);
    return;
  }

  // ── زر المباراة ──
  if (interaction.isButton() && interaction.customId === 'join_voice') {
    const member = interaction.member;
    if (!member.voice.channel) return interaction.reply({ content: '⚠️ لازم تكون داخل Voice Channel أول!', ephemeral: true });
    try {
      const ch = interaction.guild.channels.cache.get(VOICE_CHANNEL_ID);
      await member.voice.setChannel(ch);
      await interaction.reply({ content: `✅ تم نقلك لـ **${ch.name}**!`, ephemeral: true });
    } catch {
      await interaction.reply({ content: '❌ ما قدرت أنقلك.', ephemeral: true });
    }
  }

  // ── زر اختيار الدولة ──
  if (interaction.isButton() && interaction.customId === 'open_country_select') {
    const rows = chunk(teams, 25).map((ch, i) => {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`select_team_${i}`).setPlaceholder('🌍 اختر دولتك')
        .addOptions(ch.map(t => new StringSelectMenuOptionBuilder().setLabel(t.label).setValue(t.label).setEmoji(t.emoji)));
      return new ActionRowBuilder().addComponents(menu);
    });
    await interaction.reply({ content: '👇 اختر منتخبك:', components: rows, ephemeral: true });
  }

  // ── اختيار المنتخب ──
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_team')) {
    await interaction.deferReply({ ephemeral: true });
    const selected = interaction.values[0];
    const team     = teams.find(t => t.label === selected);
    const member   = interaction.member;
    const guild    = interaction.guild;
    try {
      await member.fetch();
      let role = guild.roles.cache.find(r => r.name === team.role);
      if (!role) role = await guild.roles.create({ name: team.role, reason: 'كأس العالم 2026' });
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        return interaction.editReply({ content: `❌ تمت إزالة رتبة **${team.role}**` });
      }
      for (const t of teams) {
        const old = guild.roles.cache.find(r => r.name === t.role);
        if (old && member.roles.cache.has(old.id)) await member.roles.remove(old).catch(() => {});
      }
      await member.roles.add(role);
      await interaction.editReply({ content: `${team.emoji} تم تعيين رتبة **${team.role}** لك!` });
    } catch {
      await interaction.editReply({ content: '❌ صار خطأ، حاول مرة ثانية.' });
    }
  }
});

// =================== مساعدات المتجر ===================
async function _markSoldOut(client, product, productId) {
  try {
    const ch  = await client.channels.fetch(product.channelId);
    const msg = await ch.messages.fetch(product.messageId);
    const btn = new ButtonBuilder().setCustomId(`buy_${productId}`).setLabel('❌ نفد المخزون').setStyle(ButtonStyle.Danger).setDisabled(true);
    await msg.edit({ embeds: [buildShopEmbed(money.getProduct(productId), true)], components: [new ActionRowBuilder().addComponents(btn)] });
  } catch {}
}

async function _refreshShopMessage(client, product, productId) {
  try {
    const ch  = await client.channels.fetch(product.channelId);
    const msg = await ch.messages.fetch(product.messageId);
    if (product.soldOut) {
      const btn = new ButtonBuilder().setCustomId(`buy_${productId}`).setLabel('❌ نفد المخزون').setStyle(ButtonStyle.Danger).setDisabled(true);
      await msg.edit({ embeds: [buildShopEmbed(product, true)], components: [new ActionRowBuilder().addComponents(btn)] });
    } else {
      const btn = new ButtonBuilder().setCustomId(`buy_${productId}`).setLabel(`🛒 شراء — ${fmt(product.price)}`).setStyle(ButtonStyle.Success);
      await msg.edit({ embeds: [buildShopEmbed(product, false)], components: [new ActionRowBuilder().addComponents(btn)] });
    }
  } catch {}
}

client.login(TOKEN);
