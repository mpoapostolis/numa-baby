// White noise, for the twenty minutes between a feed and actual sleep.
//
// Take two — the sounds are real files now (see domain/soothe.ts for the
// history of why). What this component still refuses to do is unchanged:
// it never starts loud — the volume opens low and the copy says to keep it
// that way, because the AAP has flagged sound levels from infant sleep
// machines — and it never runs for ever by accident: a timer is offered up
// front, because "I'll turn it off in a minute" at 3am means morning.
//
// The silent switch is why take one looked broken even when it played. An
// iPhone <audio> defaults to the "ambient" session, which the mute switch
// silences — and play() still RESOLVES. Declaring the session as playback
// puts the sound on the media channel, where the switch does not reach;
// where that API does not exist, the hint below is the honest fallback.

import { useEffect, useRef, useState } from "react";
import "../styles/screens/soothe.css";
import { ExternalLink, Pause, Play, Waves } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { track } from "../domain/analytics";
import {
  LULLABIES,
  LullabyKind,
  NOISE_KINDS,
  NoiseKind,
  TIMER_CHOICES,
  TimerChoice,
  soundUrl,
} from "../domain/soothe";

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
  const [mode, setMode] = useState<"noise" | "lullaby">("noise");
  const [kind, setKind] = useState<NoiseKind>("brown");
  const [tune, setTune] = useState<LullabyKind>("brahms");

  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [timer, setTimer] = useState<TimerChoice>(30);
  // An end time, not a countdown: a decrementing counter drifts, and it stops
  // being decremented at all once the phone sleeps the timers.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const secondsLeft = endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));

  const selectedUrl = mode === "noise" ? soundUrl(kind) : soundUrl(tune);

  // One element for the life of the component; the source swaps with the
  // selection. It lives in the document, invisibly: standalone-mode WebKit
  // has a history of refusing play() on detached elements.
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    // iOS refuses to play media that could be fullscreen video without this,
    // even for audio-only sources.
    audio.setAttribute("playsinline", "");
    audio.style.display = "none";
    document.body.appendChild(audio);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.remove();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // The file loads AHEAD of the tap, so the gesture is spent on play() alone.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || playing) return;
    audio.src = selectedUrl;
    audio.load();
  }, [selectedUrl, playing]);

  // The clock that drives the countdown, and the stop it exists to guarantee.
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

  function start() {
    const audio = audioRef.current;
    if (!audio) return;
    setFailed(false);

    // Claim the media channel BEFORE play(), inside the gesture. Without
    // this an iPhone plays white noise into a channel its mute switch
    // silences — successfully, and inaudibly.
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";
    } catch {
      // Older WebKit. The hint under the controls covers it.
    }
    audio.volume = volume;
    audio.muted = false;
    // play() is called synchronously inside the gesture, never after an await.
    audio.play().catch((error: unknown) => {
      setPlaying(false);
      setEndsAt(null);
      track("soothe_failed", { stage: "play", name: error instanceof Error ? error.name : "unknown" });
      setFailed(true);
    });
    setPlaying(true);
    setNow(Date.now());
    setEndsAt(timer === null ? null : Date.now() + timer * 60_000);
    track("soothe_started", { mode, sound: mode === "noise" ? kind : tune, timer: timer ?? 0 });

    // Lock-screen controls, so it can be stopped without unlocking a phone
    // in a dark room with a baby on one arm.
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: mode === "noise" ? "White noise" : "Lullaby",
        artist: "Numalog",
      });
      navigator.mediaSession.setActionHandler("pause", () => stop());
      navigator.mediaSession.setActionHandler("play", () => start());
    }
  }

  function stop() {
    audioRef.current?.pause();
    setPlaying(false);
    setEndsAt(null);
    track("soothe_stopped", { mode });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="soothe-dialog" onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogTitle>Sounds</DialogTitle>
        <DialogDescription>
          Keeps playing with the screen off. Set a timer — at 3am “I’ll turn it off in a minute”
          means it runs until morning.
        </DialogDescription>

        {/* Plain toggle buttons, not the ARIA tabs pattern — no panels, no
            arrow-key promise to break. */}
        <div className="soothe-modes" role="group" aria-label="Kind of sound">
          {(["noise", "lullaby"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              className={mode === option ? "soothe-mode is-active" : "soothe-mode"}
              onClick={() => setMode(option)}
            >
              {option === "noise" ? "White noise" : "Lullabies"}
            </button>
          ))}
        </div>

        <div className="soothe-kinds" role="radiogroup" aria-label="Sound">
          {(mode === "noise" ? NOISE_KINDS : LULLABIES).map((option) => {
            const selected = mode === "noise" ? option.key === kind : option.key === tune;
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? "soothe-kind is-active" : "soothe-kind"}
                onClick={() => {
                  if (mode === "noise") setKind(option.key as NoiseKind);
                  else setTune(option.key as LullabyKind);
                  // Swapping while playing must not stop the sound.
                  if (playing && audioRef.current) {
                    audioRef.current.src = soundUrl(option.key as NoiseKind | LullabyKind);
                    audioRef.current.play().catch(() => setFailed(true));
                  }
                }}
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            );
          })}
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

        <Button className="soothe-action" onClick={() => (playing ? stop() : start())}>
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {playing
            ? secondsLeft === null ? "Stop" : `Stop · ${formatLeft(secondsLeft)} left`
            : "Play"}
        </Button>

        {failed && (
          <p className="soothe-failed" role="alert">
            Your phone would not start the sound. Turn the silent switch off, check the
            volume, and try once more — some browsers also block audio until you have
            interacted with the page.
          </p>
        )}

        {/* Shown while it believes it is playing, because that is exactly when
            a silenced phone is indistinguishable from a broken app. */}
        {playing && !failed && (
          <p className="soothe-hint">
            No sound? Turn up the volume, and on an iPhone check the switch on the side —
            it silences apps even when they are playing.
          </p>
        )}

        <p className="soothe-safety">
          {mode === "lullaby" && "Rendered by the app, not a recording — traditional tunes, nothing to license. "}
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
