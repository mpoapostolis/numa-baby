// White noise, for the twenty minutes between a feed and actual sleep.
//
// Built on an <audio> element rather than Web Audio on purpose: Safari
// suspends an AudioContext the moment the screen locks, and a soother that
// dies mid-nap is worse than none. See src/domain/soothe.ts.
//
// Two things it refuses to do. It never starts loud — the volume opens low
// and the copy says to keep it that way, because the AAP has flagged sound
// levels from infant sleep machines as a concern. And it never runs for ever
// by accident: a timer is offered up front, because "I'll turn it off in a
// minute" at 3am means it plays until morning.

import { useEffect, useRef, useState } from "react";
import "../styles/screens/soothe.css";
import { ExternalLink, Pause, Play, Waves } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { track } from "../domain/analytics";
import { NOISE_KINDS, NoiseKind, TIMER_CHOICES, TimerChoice, noiseUrl } from "../domain/soothe";

const AAP_NOISE = {
  name: "AAP · Sounds the alarm on excessive noise",
  url: "https://www.healthychildren.org/English/news/Pages/sounds-the-alarm-on-excessive-noise-and-risks-to-children.aspx",
};

function formatLeft(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SoothePlayer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [kind, setKind] = useState<NoiseKind>("brown");
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [timer, setTimer] = useState<TimerChoice>(30);
  // An end time, not a countdown: a decrementing counter drifts, and it stops
  // being decremented at all once the phone sleeps the timers.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));

  // One element for the life of the component; the source swaps with the kind.
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // The clock that drives the countdown, and the stop it exists to guarantee.
  // Both live in the interval callback rather than the effect body — the
  // effect only subscribes.
  useEffect(() => {
    if (!playing || endsAt === null) return;
    const id = window.setInterval(() => {
      if (Date.now() >= endsAt) {
        audioRef.current?.pause();
        setPlaying(false);
        setEndsAt(null);
      } else {
        setNow(Date.now());
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, endsAt]);

  async function start() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = noiseUrl(kind);
    audio.volume = volume;
    try {
      await audio.play();
    } catch {
      // Autoplay refused, or no user gesture. Nothing to recover — the
      // button is the gesture, so this only happens if the tab lost focus.
      return;
    }
    setPlaying(true);
    setNow(Date.now());
    setEndsAt(timer === null ? null : Date.now() + timer * 60_000);
    track("soothe_started", { kind, timer: timer ?? 0 });

    // Lock-screen controls, so it can be stopped without unlocking a phone
    // in a dark room with a baby on one arm.
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: "White noise", artist: "Baby Tracker" });
      navigator.mediaSession.setActionHandler("pause", () => stop());
      navigator.mediaSession.setActionHandler("play", () => void start());
    }
  }

  function stop() {
    audioRef.current?.pause();
    setPlaying(false);
    setEndsAt(null);
    track("soothe_stopped", { kind });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="soothe-dialog">
        <DialogTitle>White noise</DialogTitle>
        <DialogDescription>
          Keeps playing with the screen off. Set a timer — at 3am “I’ll turn it off in a minute”
          means it runs until morning.
        </DialogDescription>

        <div className="soothe-kinds" role="radiogroup" aria-label="Sound">
          {NOISE_KINDS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={option.key === kind}
              className={option.key === kind ? "soothe-kind is-active" : "soothe-kind"}
              onClick={() => {
                setKind(option.key);
                // Swapping while playing must not stop the sound.
                if (playing && audioRef.current) {
                  audioRef.current.src = noiseUrl(option.key);
                  void audioRef.current.play();
                }
              }}
            >
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </button>
          ))}
        </div>

        <label className="soothe-field">
          <span className="t-label">Volume</span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
          />
        </label>

        <div className="soothe-field">
          <span className="t-label">Stop after</span>
          <div className="soothe-timers">
            {TIMER_CHOICES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className={timer === minutes ? "soothe-timer is-active" : "soothe-timer"}
                onClick={() => setTimer(minutes)}
              >
                {minutes}m
              </button>
            ))}
            <button
              type="button"
              className={timer === null ? "soothe-timer is-active" : "soothe-timer"}
              onClick={() => setTimer(null)}
            >
              Keep going
            </button>
          </div>
        </div>

        <Button className="soothe-action" onClick={() => (playing ? stop() : void start())}>
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {playing
            ? secondsLeft === null ? "Stop" : `Stop · ${formatLeft(secondsLeft)} left`
            : "Play"}
        </Button>

        <p className="soothe-safety">
          Keep it quiet and across the room rather than beside the cot. The AAP has raised
          concerns about sound levels from infant sleep machines and suggests talking to your
          paediatrician about safe use.{" "}
          <a className="fact-source" href={AAP_NOISE.url} target="_blank" rel="noopener noreferrer"
             onClick={() => track("source_opened", { name: AAP_NOISE.name })}>
            {AAP_NOISE.name} <ExternalLink size={12} aria-hidden="true" />
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}

export { Waves as SootheIcon };
