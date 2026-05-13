const TASHKENT_TIME_ZONE = 'Asia/Tashkent';

export function getTodayStr(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TASHKENT_TIME_ZONE }).format(date);
}

export function isVirdInputLockedAt(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: TASHKENT_TIME_ZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);

  return hour > 23 || (hour === 23 && minute >= 50);
}
