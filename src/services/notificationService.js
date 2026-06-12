import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getLoanDueState, getLoanInterestAmount } from '../utils/loanManager';

const TIMEZONE = 'Asia/Dhaka';
const CHANNEL_ID = 'loan-reminders';
const SMALL_ICON = 'ic_stat_dena_mono';
const LARGE_ICON = 'ic_notification_large';
const ID_NAMESPACE_MIN = 710000000;
const ID_NAMESPACE_MAX = 719999999;
const DEBUG_NAMESPACE_MIN = 720000000;
const DEBUG_NAMESPACE_MAX = 720999999;

const toDhakaYmd = (date) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
};

const toDhakaDateAtHour = (ymd, hour24 = 16) => new Date(`${ymd}T${String(hour24).padStart(2, '0')}:00:00+06:00`);

const shiftDhakaYmdDays = (ymd, days) => {
  const base = new Date(`${ymd}T00:00:00+06:00`);
  base.setUTCDate(base.getUTCDate() + days);
  return toDhakaYmd(base);
};

const isPast = (date) => date.getTime() <= Date.now();

const getNextDhakaFourPm = () => {
  const now = new Date();
  const todayDhaka = toDhakaYmd(now);
  const todayAt4 = toDhakaDateAtHour(todayDhaka, 16);
  return isPast(todayAt4) ? toDhakaDateAtHour(shiftDhakaYmdDays(todayDhaka, 1), 16) : todayAt4;
};

const normalizeLoanDueYmd = (nextPaymentDateIso) => toDhakaYmd(new Date(nextPaymentDateIso));

const simpleHash = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const makeNotificationId = (loanId, type) => {
  const bucket = simpleHash(`${loanId}:${type}`) % 9000000;
  return ID_NAMESPACE_MIN + bucket;
};

const isAndroidNative = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const buildLoanNotifications = (loan) => {
  if (loan.status !== 'ACTIVE') return [];

  const { nextPaymentDate } = getLoanDueState(loan);
  const installmentInterestText = getLoanInterestAmount(loan).toLocaleString('bn-BD');
  const dueYmd = normalizeLoanDueYmd(nextPaymentDate);
  const dayBeforeYmd = shiftDhakaYmdDays(dueYmd, -1);
  const dayBeforeAt4 = toDhakaDateAtHour(dayBeforeYmd, 16);
  const dueAt4 = toDhakaDateAtHour(dueYmd, 16);
  const dueDateOnly = new Date(`${dueYmd}T00:00:00+06:00`);
  const now = new Date();
  const isOverdue = dueDateOnly.getTime() < new Date(`${toDhakaYmd(now)}T00:00:00+06:00`).getTime();

  const result = [];

  if (!isPast(dayBeforeAt4)) {
    result.push({
      id: makeNotificationId(loan.id, 'day-before'),
      title: 'আগামীকাল কিস্তি',
      body: `${loan.name} এর কিস্তি আগামীকাল। প্রাপ্য মুনাফা: ${installmentInterestText} টাকা।`,
      schedule: { at: dayBeforeAt4, allowWhileIdle: true },
      channelId: CHANNEL_ID,
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
    });
  }

  if (!isPast(dueAt4)) {
    result.push({
      id: makeNotificationId(loan.id, 'due-day'),
      title: 'আজ কিস্তি',
      body: `${loan.name} আজ কিস্তি দেওয়ার কথা। প্রাপ্য মুনাফা: ${installmentInterestText} টাকা।`,
      schedule: { at: dueAt4, allowWhileIdle: true },
      channelId: CHANNEL_ID,
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
    });
  }

  if (isOverdue) {
    result.push({
      id: makeNotificationId(loan.id, 'overdue-daily'),
      title: 'বকেয়া কিস্তি',
      body: `${loan.name} এর কিস্তি এখনো বাকি। আজ বিকাল ৪টার মধ্যে হিসাব আপডেট করুন।`,
      schedule: { at: getNextDhakaFourPm(), every: 'day', allowWhileIdle: true },
      channelId: CHANNEL_ID,
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
    });
  }

  return result;
};

export const requestNotificationAccess = async () => {
  if (!isAndroidNative()) return false;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display === 'granted') return true;

  const asked = await LocalNotifications.requestPermissions();
  return asked.display === 'granted';
};

export const initializeNotificationChannel = async () => {
  if (!isAndroidNative()) return;

  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'কিস্তি রিমাইন্ডার',
    description: 'কিস্তির দিন, আগের দিন এবং বকেয়া রিমাইন্ডার',
    importance: 4,
    visibility: 1,
    lights: true,
    vibration: true,
  });
};

export const syncLoanNotifications = async (loans) => {
  if (!isAndroidNative()) return;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') return;

  const pending = await LocalNotifications.getPending();
  const ourPendingIds = pending.notifications
    .map((item) => item.id)
    .filter((id) => id >= ID_NAMESPACE_MIN && id <= ID_NAMESPACE_MAX)
    .map((id) => ({ id }));

  if (ourPendingIds.length > 0) {
    await LocalNotifications.cancel({ notifications: ourPendingIds });
  }

  const notifications = loans.flatMap(buildLoanNotifications);
  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
};

export const getLoanPendingNotifications = async () => {
  if (!isAndroidNative()) return [];
  const pending = await LocalNotifications.getPending();
  return pending.notifications.filter(
    (item) => item.id >= ID_NAMESPACE_MIN && item.id <= ID_NAMESPACE_MAX
  );
};

export const clearLoanNotifications = async () => {
  if (!isAndroidNative()) return;

  const loanPending = await getLoanPendingNotifications();
  if (loanPending.length === 0) return;

  await LocalNotifications.cancel({
    notifications: loanPending.map((item) => ({ id: item.id })),
  });
};

export const scheduleDebugTestNotification = async (secondsFromNow = 30) => {
  if (!isAndroidNative()) return null;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') return null;

  const now = Date.now();
  const id = DEBUG_NAMESPACE_MIN + (now % 100000);
  const at = new Date(now + Math.max(5, Number(secondsFromNow)) * 1000);

  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: 'টেস্ট নোটিফিকেশন',
        body: `এই টেস্ট নোটিফিকেশন ${secondsFromNow} সেকেন্ড পরে পাঠানো হয়েছে।`,
        schedule: { at, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        smallIcon: SMALL_ICON,
        largeIcon: LARGE_ICON,
      },
    ],
  });

  return { id, at };
};

export const clearDebugNotifications = async () => {
  if (!isAndroidNative()) return;
  const pending = await LocalNotifications.getPending();
  const debugPending = pending.notifications
    .filter((item) => item.id >= DEBUG_NAMESPACE_MIN && item.id <= DEBUG_NAMESPACE_MAX)
    .map((item) => ({ id: item.id }));

  if (debugPending.length > 0) {
    await LocalNotifications.cancel({ notifications: debugPending });
  }
};

export const scheduleRealMessagePreviewNotifications = async (loan) => {
  if (!isAndroidNative()) return [];
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') return [];

  const now = Date.now();
  const customerName = loan?.name || 'রহিম মিয়া';
  const installmentInterest = Number(getLoanInterestAmount(loan) || 2000).toLocaleString('bn-BD');
  const overdueCount = 1;

  const notifications = [
    {
      id: DEBUG_NAMESPACE_MIN + ((now + 10000) % 100000),
      title: 'আগামীকাল কিস্তি',
      body: `${customerName} এর কিস্তি আগামীকাল। প্রাপ্য মুনাফা: ${installmentInterest} টাকা।`,
      schedule: { at: new Date(now + 10000), allowWhileIdle: true },
      channelId: CHANNEL_ID,
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
    },
    {
      id: DEBUG_NAMESPACE_MIN + ((now + 20000) % 100000),
      title: 'আজ কিস্তি',
      body: `${customerName} আজ কিস্তি দেওয়ার কথা। প্রাপ্য মুনাফা: ${installmentInterest} টাকা।`,
      schedule: { at: new Date(now + 20000), allowWhileIdle: true },
      channelId: CHANNEL_ID,
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
    },
    {
      id: DEBUG_NAMESPACE_MIN + ((now + 30000) % 100000),
      title: 'বকেয়া কিস্তি',
      body: `আজকের হিসাবে ${Number(overdueCount).toLocaleString('bn-BD')} জনের কিস্তি বকেয়া আছে। অ্যাপ খুলে হিসাব আপডেট করুন।`,
      schedule: { at: new Date(now + 30000), allowWhileIdle: true },
      channelId: CHANNEL_ID,
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
    },
  ];

  await LocalNotifications.schedule({ notifications });
  return notifications.map((item) => ({ id: item.id, at: item.schedule.at }));
};
