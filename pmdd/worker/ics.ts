// iCal feed generation. The client subscribes once (Google/Apple Calendar
// "from URL"); every fetch recomputes from the latest logged cycle, so logging
// a period start in the app reorients the subscribed calendar automatically.

import {
  addDays,
  cycleInfo,
  dosesFor,
  type Settings,
  type SupplyStatus,
} from '../shared/protocol';

const HORIZON_DAYS = 60;

// Static VTIMEZONE for America/Chicago (CST/CDT). Calendar clients require
// the definition inline; US DST rules are stable enough to embed.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:America/Chicago',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0600',
  'TZOFFSETTO:-0500',
  'TZNAME:CDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0600',
  'TZNAME:CST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n');

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Fold long lines per RFC 5545 (75 octets, continuation indented). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

interface EventSpec {
  uid: string;
  summary: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: { start: string; end: string }; // HH:MM local; omit for all-day
  alarmMinutes?: number;
}

function vevent(e: EventSpec, stamp: string): string {
  const lines = ['BEGIN:VEVENT', `UID:${e.uid}@pmdd`, `DTSTAMP:${stamp}`];
  const d = e.date.replace(/-/g, '');
  if (e.time) {
    lines.push(
      `DTSTART;TZID=America/Chicago:${d}T${e.time.start.replace(':', '')}00`,
      `DTEND;TZID=America/Chicago:${d}T${e.time.end.replace(':', '')}00`,
    );
  } else {
    lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, '')}`);
  }
  lines.push(fold(`SUMMARY:${esc(e.summary)}`));
  if (e.description) lines.push(fold(`DESCRIPTION:${esc(e.description)}`));
  if (e.alarmMinutes !== undefined) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER:-PT${e.alarmMinutes}M`,
      `DESCRIPTION:${esc(e.summary)}`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export function buildFeed(
  today: string,
  starts: string[],
  settings: Settings,
  supplies: SupplyStatus[],
): string {
  const stamp = `${today.replace(/-/g, '')}T000000Z`;
  const events: EventSpec[] = [];

  for (let i = 0; i < HORIZON_DAYS; i++) {
    const date = addDays(today, i);
    const info = cycleInfo(date, starts, settings);
    if (!info) continue;
    const doses = dosesFor(date, info.phase);
    const patches = doses.filter((x) => x.item !== 'elix' && x.item !== 'elix_extra' && x.item !== 'd3k2');
    const desc = doses.map((x) => `• ${x.label}: ${x.detail}${x.optional ? ' (optional)' : ''}`).join('\n');
    events.push({
      uid: `on-${date}`,
      summary: `Patches on (${patches.length}) + doses — cycle day ${info.day}`,
      description: `${info.phase === 'luteal' ? 'Luteal phase.' : 'Follicular phase.'}\n${desc}\nApply to clean, dry skin. Keep well hydrated.`,
      date,
      time: { start: '07:00', end: '07:15' },
      alarmMinutes: 0,
    });
    events.push({
      uid: `off-${date}`,
      summary: 'Patches off — discard',
      description: '12-hour maximum wear. Peel and discard; never reuse a patch.',
      date,
      time: { start: '19:00', end: '19:10' },
      alarmMinutes: 0,
    });
  }

  const info = cycleInfo(today, starts, settings);
  if (info) {
    if (info.lutealStartDate >= today)
      events.push({
        uid: `luteal-${info.anchor}`,
        summary: 'Luteal phase begins — add SP6 Complete',
        description:
          'From today until the period starts: one SP6 Complete above the right inner ankle each morning, plus the optional Elix extra dose on high-symptom days.',
        date: info.lutealStartDate,
      });
    events.push({
      uid: `period-${info.anchor}`,
      summary: 'Period expected — log it in the tracker',
      description:
        'When it arrives, log the start date in the app. The whole protocol (and this calendar) re-anchors to it. SP6 stops.',
      date: info.nextPeriodDate,
    });
  }

  for (const s of supplies) {
    if (s.daysLeft > 365) continue;
    const date = s.reorderDate >= today ? s.reorderDate : today;
    events.push({
      uid: `reorder-${s.item}-${s.runoutDate}`,
      summary: `Reorder ${s.label}`,
      description: `~${s.remaining} doses left — runs out around ${s.runoutDate}. Order now so the replacement arrives in time.`,
      date,
    });
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//pmdd-tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PMDD Protocol',
    'X-WR-TIMEZONE:America/Chicago',
    'X-PUBLISHED-TTL:PT6H',
    VTIMEZONE,
    ...events.map((e) => vevent(e, stamp)),
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
