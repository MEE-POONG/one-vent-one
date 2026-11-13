"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Flame, Timer } from "lucide-react";

type CountdownState = {
  ready: boolean;
  status: "upcoming" | "live" | "ended";
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function computeCountdown(startsAt: string, endsAt?: string): CountdownState {
  const now = Date.now();
  const startMs = Date.parse(startsAt);
  const endMs = endsAt ? Date.parse(endsAt) : NaN;

  if (Number.isNaN(startMs)) {
    return {
      ready: true,
      status: "ended",
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const diff = startMs - now;
  if (diff <= 0) {
    const isLive = Number.isNaN(endMs) || now < endMs;
    return {
      ready: true,
      status: isLive ? "live" : "ended",
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    ready: true,
    status: "upcoming",
    days,
    hours,
    minutes,
    seconds,
  };
}

export function EventCountdown({
  startsAt,
  endsAt,
}: {
  startsAt: string;
  endsAt?: string;
}) {
  const [state, setState] = useState<CountdownState>({
    ready: false,
    status: "upcoming",
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const tick = () => setState(computeCountdown(startsAt, endsAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [startsAt, endsAt]);

  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    <section
      className="customer-card event-countdown-card"
      aria-label="เวลานับถอยหลังก่อนเริ่มการแสดง"
    >
      <div className="event-countdown-head">
        <div>
          <div className="section-kicker">
            <span /> SHOWTIME COUNTDOWN
          </div>
          <h2>นับถอยหลังสู่เวลาเริ่มการแสดง</h2>
        </div>
        {state.ready && state.status === "live" ? (
          <span className="event-countdown-badge is-live">
            <Flame size={15} /> กำลังทำการแสดง
          </span>
        ) : state.ready && state.status === "ended" ? (
          <span className="event-countdown-badge is-ended">
            <CheckCircle2 size={15} /> จบการแสดงแล้ว
          </span>
        ) : (
          <span className="event-countdown-badge">
            <Timer size={15} /> เตรียมพบกันเร็ว ๆ นี้
          </span>
        )}
      </div>

      <div className="event-countdown-grid" role="timer" aria-live="off">
        <div className="event-countdown-unit">
          <strong>{state.ready ? pad(state.days) : "--"}</strong>
          <span>วัน</span>
          <small>DAYS</small>
        </div>
        <div className="event-countdown-sep" aria-hidden="true">
          :
        </div>
        <div className="event-countdown-unit">
          <strong>{state.ready ? pad(state.hours) : "--"}</strong>
          <span>ชั่วโมง</span>
          <small>HOURS</small>
        </div>
        <div className="event-countdown-sep" aria-hidden="true">
          :
        </div>
        <div className="event-countdown-unit">
          <strong>{state.ready ? pad(state.minutes) : "--"}</strong>
          <span>นาที</span>
          <small>MINUTES</small>
        </div>
        <div className="event-countdown-sep" aria-hidden="true">
          :
        </div>
        <div className="event-countdown-unit is-seconds">
          <strong>{state.ready ? pad(state.seconds) : "--"}</strong>
          <span>วินาที</span>
          <small>SECONDS</small>
        </div>
      </div>
    </section>
  );
}

